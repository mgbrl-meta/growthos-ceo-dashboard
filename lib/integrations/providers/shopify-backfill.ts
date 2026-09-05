import 'server-only';

import {
  randomUUID,
} from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  publishShopifySyncJob,
} from './shopify-jobs';


const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    'shopify-colab'
  ).trim();


const OPS_DATASET =
  String(
    process.env.GROWTHOS_OPS_DATASET
    ||
    'growthos_ops'
  ).trim();


const OPS_LOCATION =
  String(
    process.env.GROWTHOS_OPS_LOCATION
    ||
    'asia-south1'
  ).trim();


type BackfillWindow = {

  backfillWindowId:
    string;

  from:
    string;

  to:
    string;

};


// ============================================================
// DATE
// ============================================================

function parseDate(
  value: string,
  errorCode: string
) {

  const timestamp =
    Date.parse(
      value
    );


  if (
    Number.isNaN(
      timestamp
    )
  ) {

    throw new Error(
      errorCode
    );

  }


  return new Date(
    timestamp
  );

}


// ============================================================
// QUARTER WINDOWS
// ============================================================

function createQuarterWindows(
  from: Date,
  to: Date
):

  BackfillWindow[] {

  const windows:
    BackfillWindow[] = [];


  let cursor =
    new Date(
      from.getTime()
    );


  while (
    cursor < to
  ) {

    const year =
      cursor.getUTCFullYear();


    const month =
      cursor.getUTCMonth();


    const nextQuarterMonth =
      Math.floor(
        month / 3
      ) * 3
      +
      3;


    const quarterBoundary =
      new Date(
        Date.UTC(
          year,
          nextQuarterMonth,
          1,
          0,
          0,
          0,
          0
        )
      );


    const windowEnd =
      quarterBoundary < to
        ? quarterBoundary
        : to;


    windows.push({

      backfillWindowId:
        `bfw_${randomUUID()}`,

      from:
        cursor.toISOString(),

      to:
        windowEnd.toISOString(),

    });


    cursor =
      new Date(
        windowEnd.getTime()
      );

  }


  return windows;

}


// ============================================================
// CREATE BACKFILL
//
// IMPORTANT:
//
// Uses BigQuery SQL INSERT jobs.
//
// Do NOT use:
//
// table.insert()
//
// because that uses streaming insert and blocks immediate
// UPDATE / MERGE against newly inserted operational rows.
// ============================================================

export async function createShopifyOrdersBackfill(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    connectionId:
      string;

    integrationAccountId:
      string;

    providerAccountId:
      string;

    from:
      string;

    to:
      string;

    requestedBy?:
      string | null;

  }
) {

  const from =
    parseDate(
      input.from,
      'SHOPIFY_BACKFILL_FROM_INVALID'
    );


  const to =
    parseDate(
      input.to,
      'SHOPIFY_BACKFILL_TO_INVALID'
    );


  if (
    from >= to
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_RANGE_INVALID'
    );

  }


  const windows =
    createQuarterWindows(
      from,
      to
    );


  if (
    windows.length === 0
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOWS_EMPTY'
    );

  }


  const backfillRunId =
    `bfr_${randomUUID()}`;


  const now =
    new Date()
      .toISOString();


  // ==========================================================
  // INSERT RUN USING DML
  // ==========================================================

  await bigquery.query({

    query: `

      INSERT INTO
        \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`
      (
        backfill_run_id,
        workspace_id,
        brand_id,
        connection_id,
        integration_account_id,
        provider_account_id,
        provider,
        entity,
        strategy,
        status,
        requested_from,
        requested_to,
        requested_by,
        requested_at,
        total_windows,
        queued_windows,
        running_windows,
        completed_windows,
        failed_windows,
        records_loaded,
        started_at,
        completed_at,
        error,
        created_at,
        updated_at
      )

      VALUES
      (
        @backfill_run_id,
        @workspace_id,
        @brand_id,
        @connection_id,
        @integration_account_id,
        @provider_account_id,
        'shopify',
        'orders',
        'shopify_bulk_quarterly_v1',
        'queued',
        TIMESTAMP(@requested_from),
        TIMESTAMP(@requested_to),
        @requested_by,
        TIMESTAMP(@requested_at),
        @total_windows,
        @total_windows,
        0,
        0,
        0,
        0,
        NULL,
        NULL,
        NULL,
        TIMESTAMP(@created_at),
        TIMESTAMP(@updated_at)
      )

    `,

    location:
      OPS_LOCATION,

    params: {

      backfill_run_id:
        backfillRunId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      integration_account_id:
        input.integrationAccountId,

      provider_account_id:
        input.providerAccountId,

      requested_from:
        from.toISOString(),

      requested_to:
        to.toISOString(),

      requested_by:
        input.requestedBy
        ??
        null,

      requested_at:
        now,

      total_windows:
        windows.length,

      created_at:
        now,

      updated_at:
        now,

    },

    types: {

      requested_by:
        'STRING',

    },

  });


  // ==========================================================
  // INSERT WINDOWS USING DML
  // ==========================================================

  const windowsJson =
    JSON.stringify(

      windows.map(
        window => ({

          backfill_window_id:
            window.backfillWindowId,

          window_start:
            window.from,

          window_end:
            window.to,

        })
      )

    );


  await bigquery.query({

    query: `

      INSERT INTO
        \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`
      (
        backfill_window_id,
        backfill_run_id,
        workspace_id,
        brand_id,
        connection_id,
        integration_account_id,
        provider_account_id,
        entity,
        window_start,
        window_end,
        status,
        bulk_operation_id,
        bulk_operation_status,
        bulk_object_count,
        bulk_file_size_bytes,
        records_received,
        records_loaded,
        records_skipped,
        attempt_count,
        next_retry_at,
        started_at,
        result_ready_at,
        loading_started_at,
        completed_at,
        error,
        created_at,
        updated_at
      )

      SELECT

        JSON_VALUE(
          item,
          '$.backfill_window_id'
        ),

        @backfill_run_id,

        @workspace_id,

        @brand_id,

        @connection_id,

        @integration_account_id,

        @provider_account_id,

        'orders',

        TIMESTAMP(
          JSON_VALUE(
            item,
            '$.window_start'
          )
        ),

        TIMESTAMP(
          JSON_VALUE(
            item,
            '$.window_end'
          )
        ),

        'queued',

        NULL,
        NULL,
        NULL,
        NULL,

        0,
        0,
        0,
        0,

        NULL,
        NULL,
        NULL,
        NULL,
        NULL,

        NULL,

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP()

      FROM
        UNNEST(
          JSON_QUERY_ARRAY(
            PARSE_JSON(
              @windows_json
            )
          )
        ) AS item

    `,

    location:
      OPS_LOCATION,

    params: {

      windows_json:
        windowsJson,

      backfill_run_id:
        backfillRunId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      integration_account_id:
        input.integrationAccountId,

      provider_account_id:
        input.providerAccountId,

    },

  });


  // ==========================================================
  // ONLY FIRST WINDOW
  // ==========================================================

  const firstWindow =
    windows[0];


  if (!firstWindow) {

    throw new Error(
      'SHOPIFY_BACKFILL_FIRST_WINDOW_MISSING'
    );

  }


  const published =
    await publishShopifySyncJob({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      connectionId:
        input.connectionId,

      integrationAccountId:
        input.integrationAccountId,

      providerAccountId:
        input.providerAccountId,

      entity:
        'orders',

      syncType:
        'backfill',

      requestedBy:
        input.requestedBy
        ??
        null,

      from:
        firstWindow.from,

      to:
        firstWindow.to,

      cursor:
        null,

      backfillRunId,

      backfillWindowId:
        firstWindow.backfillWindowId,

    });


  return {

    backfillRunId,

    strategy:
      'shopify_bulk_quarterly_v1',

    requestedFrom:
      from.toISOString(),

    requestedTo:
      to.toISOString(),

    totalWindows:
      windows.length,

    firstWindow,

    messageId:
      published.messageId,

    topic:
      published.topic,

  };

}


export const SHOPIFY_BACKFILL_OPS = {

  projectId:
    PROJECT_ID,

  dataset:
    OPS_DATASET,

  location:
    OPS_LOCATION,

};