import 'server-only';

import {
  randomUUID,
} from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';


// ============================================================
// CONFIG
// ============================================================

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


// ============================================================
// TYPES
// ============================================================

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
// FULL-HISTORY WINDOW
//
// INITIAL BACKFILL STRATEGY:
//
// ONE requested historical range
//        ↓
// ONE Shopify Bulk window
//
// Canonical interval:
//
// [from, to)
//
// start = inclusive
// end   = exclusive
//
// Example:
//
// 2021-01-01T00:00:00Z
//        ↓
// 2026-09-05T00:00:00Z
//
// Growth OS first asks Shopify to process the entire historical
// range.
//
// Future Q3E-6:
//
// If Shopify cannot process this range or the resulting export
// becomes operationally unsuitable, the backfill engine will
// split this window adaptively.
//
// The planner itself must NOT pre-split into months/quarters.
// ============================================================

function createFullHistoryWindow(
  from: Date,
  to: Date
):

  BackfillWindow[] {

  return [
    {

      backfillWindowId:
        `bfw_${randomUUID()}`,

      from:
        from.toISOString(),

      to:
        to.toISOString(),

    },
  ];

}


// ============================================================
// CREATE SHOPIFY ORDERS BACKFILL
//
// PLANNER RESPONSIBILITY ONLY:
//
// validate request
//      ↓
// create backfill run
//      ↓
// create ONE full-history window
//      ↓
// return plan
//
// IMPORTANT:
//
// This module does NOT:
//
// - publish Pub/Sub
// - call Shopify
// - start Bulk Operations
// - load JSONL
// - orchestrate execution
//
// Cloud Run backfill engine owns execution.
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

  // ==========================================================
  // VALIDATE IDENTIFIERS
  // ==========================================================

  const workspaceId =
    String(
      input.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      input.brandId
      ||
      ''
    ).trim();


  const connectionId =
    String(
      input.connectionId
      ||
      ''
    ).trim();


  const integrationAccountId =
    String(
      input.integrationAccountId
      ||
      ''
    ).trim();


  const providerAccountId =
    String(
      input.providerAccountId
      ||
      ''
    ).trim();


  if (!workspaceId) {

    throw new Error(
      'SHOPIFY_BACKFILL_WORKSPACE_MISSING'
    );

  }


  if (!brandId) {

    throw new Error(
      'SHOPIFY_BACKFILL_BRAND_MISSING'
    );

  }


  if (!connectionId) {

    throw new Error(
      'SHOPIFY_BACKFILL_CONNECTION_MISSING'
    );

  }


  if (!integrationAccountId) {

    throw new Error(
      'SHOPIFY_BACKFILL_INTEGRATION_ACCOUNT_MISSING'
    );

  }


  if (!providerAccountId) {

    throw new Error(
      'SHOPIFY_BACKFILL_PROVIDER_ACCOUNT_MISSING'
    );

  }


  // ==========================================================
  // VALIDATE RANGE
  // ==========================================================

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


  // ==========================================================
  // CREATE ONE FULL-HISTORY WINDOW
  // ==========================================================

  const windows =
    createFullHistoryWindow(
      from,
      to
    );


  if (
    windows.length !== 1
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_FULL_HISTORY_WINDOW_INVALID'
    );

  }


  const firstWindow =
    windows[0];


  if (!firstWindow) {

    throw new Error(
      'SHOPIFY_BACKFILL_FIRST_WINDOW_MISSING'
    );

  }


  // ==========================================================
  // RUN ID
  // ==========================================================

  const backfillRunId =
    `bfr_${randomUUID()}`;


  const now =
    new Date()
      .toISOString();


  // ==========================================================
  // INSERT BACKFILL RUN
  //
  // IMPORTANT:
  //
  // Use BigQuery DML.
  //
  // Do NOT use streaming table.insert() here because immediate
  // UPDATE/MERGE state transitions may otherwise encounter
  // BigQuery streaming-buffer limitations.
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
        'shopify_bulk_full_history_v1',
        'queued',

        TIMESTAMP(
          @requested_from
        ),

        TIMESTAMP(
          @requested_to
        ),

        @requested_by,

        TIMESTAMP(
          @requested_at
        ),

        1,
        1,
        0,
        0,
        0,

        0,

        NULL,
        NULL,

        NULL,

        TIMESTAMP(
          @created_at
        ),

        TIMESTAMP(
          @updated_at
        )
      )

    `,

    location:
      OPS_LOCATION,

    params: {

      backfill_run_id:
        backfillRunId,

      workspace_id:
        workspaceId,

      brand_id:
        brandId,

      connection_id:
        connectionId,

      integration_account_id:
        integrationAccountId,

      provider_account_id:
        providerAccountId,

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
  // INSERT ONE FULL-HISTORY WINDOW
  // ==========================================================

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

      VALUES
      (
        @backfill_window_id,
        @backfill_run_id,

        @workspace_id,
        @brand_id,

        @connection_id,
        @integration_account_id,
        @provider_account_id,

        'orders',

        TIMESTAMP(
          @window_start
        ),

        TIMESTAMP(
          @window_end
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

        TIMESTAMP(
          @created_at
        ),

        TIMESTAMP(
          @updated_at
        )
      )

    `,

    location:
      OPS_LOCATION,

    params: {

      backfill_window_id:
        firstWindow.backfillWindowId,

      backfill_run_id:
        backfillRunId,

      workspace_id:
        workspaceId,

      brand_id:
        brandId,

      connection_id:
        connectionId,

      integration_account_id:
        integrationAccountId,

      provider_account_id:
        providerAccountId,

      window_start:
        firstWindow.from,

      window_end:
        firstWindow.to,

      created_at:
        now,

      updated_at:
        now,

    },

  });


  // ==========================================================
  // RESULT
  //
  // IMPORTANT:
  //
  // No dispatch occurs here.
  //
  // Cloud Run will later observe this queued run/window and
  // control execution.
  // ==========================================================

  return {

    backfillRunId,

    strategy:
      'shopify_bulk_full_history_v1',

    requestedFrom:
      from.toISOString(),

    requestedTo:
      to.toISOString(),

    totalWindows:
      1,

    firstWindow: {

      backfillWindowId:
        firstWindow.backfillWindowId,

      from:
        firstWindow.from,

      to:
        firstWindow.to,

      status:
        'queued',

    },

    dispatchMode:
      'cloud_run_orchestrated',

  };

}


// ============================================================
// DIAGNOSTIC CONFIG
// ============================================================

export const SHOPIFY_BACKFILL_OPS = {

  projectId:
    PROJECT_ID,

  dataset:
    OPS_DATASET,

  location:
    OPS_LOCATION,

  strategy:
    'shopify_bulk_full_history_v1',

};