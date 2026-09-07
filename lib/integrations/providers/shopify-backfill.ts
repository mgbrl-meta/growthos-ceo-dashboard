import 'server-only';

import {
  createHash,
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
// STRATEGY
// ============================================================

const BACKFILL_STRATEGY =
  'shopify_bulk_quarterly_v1';


// ============================================================
// TYPES
// ============================================================

export type ShopifyBackfillWindowPlan = {

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
// REQUIRED STRING
// ============================================================

function requireValue(
  value: unknown,
  errorCode: string
) {

  const normalized =
    String(
      value
      ??
      ''
    ).trim();


  if (!normalized) {

    throw new Error(
      errorCode
    );

  }


  return normalized;

}


// ============================================================
// DETERMINISTIC ID
//
// Used when caller supplies an idempotency key.
//
// Same logical bootstrap:
//      ↓
// same run ID
// same window IDs
//
// This lets setup/bootstrap safely retry without intentionally
// creating another logical backfill.
// ============================================================

function deterministicId(
  prefix: string,
  value: string
) {

  const hash =
    createHash(
      'sha256'
    )
      .update(
        value,
        'utf8'
      )
      .digest(
        'hex'
      )
      .slice(
        0,
        40
      );


  return `${prefix}_${hash}`;

}


// ============================================================
// QUARTER WINDOWS
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
// 2020-11-12 → 2021-01-01
// 2021-01-01 → 2021-04-01
// 2021-04-01 → 2021-07-01
//
// No overlaps.
// No gaps.
//
// If idempotencyKey is present, window IDs are deterministic.
// Otherwise random IDs preserve manual/test behavior.
// ============================================================

function createQuarterWindows(
  from: Date,
  to: Date,
  idempotencyKey?:
    string | null
):
  ShopifyBackfillWindowPlan[] {

  const windows:
    ShopifyBackfillWindowPlan[] =
      [];


  let cursor =
    new Date(
      from.getTime()
    );


  while (
    cursor <
      to
  ) {

    const year =
      cursor
        .getUTCFullYear();


    const month =
      cursor
        .getUTCMonth();


    // ========================================================
    // NEXT QUARTER BOUNDARY
    //
    // Jan-Mar  → Apr 1
    // Apr-Jun  → Jul 1
    // Jul-Sep  → Oct 1
    // Oct-Dec  → Jan 1 next year
    //
    // Date.UTC automatically handles month 12 rollover.
    // ========================================================

    const nextQuarterMonth =
      Math.floor(
        month / 3
      )
      * 3
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
      quarterBoundary <
        to
        ?
          quarterBoundary
        :
          to;


    if (
      windowEnd <=
        cursor
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_WINDOW_BOUNDARY_INVALID'
      );

    }


    const fromIso =
      cursor
        .toISOString();


    const toIso =
      windowEnd
        .toISOString();


    const backfillWindowId =
      idempotencyKey
        ?
          deterministicId(
            'bfw',
            [
              idempotencyKey,
              fromIso,
              toIso,
            ].join(
              ':'
            )
          )
        :
          `bfw_${randomUUID()}`;


    windows.push({

      backfillWindowId,

      from:
        fromIso,

      to:
        toIso,

    });


    cursor =
      new Date(
        windowEnd
          .getTime()
      );

  }


  return windows;

}


// ============================================================
// READ-ONLY WINDOW PREVIEW
//
// No BigQuery writes.
// No Pub/Sub.
// No orchestration.
//
// Preview IDs may be random because they are diagnostic only.
// Actual bootstrap creation gets deterministic IDs through the
// idempotency key.
// ============================================================

export function planShopifyOrdersBackfillWindows(
  input: {

    from:
      string;

    to:
      string;

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
    from >=
      to
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
    windows.length ===
      0
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOWS_EMPTY'
    );

  }


  return {

    strategy:
      BACKFILL_STRATEGY,

    requestedFrom:
      from.toISOString(),

    requestedTo:
      to.toISOString(),

    totalWindows:
      windows.length,

    windows,

  };

}


// ============================================================
// CREATE SHOPIFY ORDERS BACKFILL
//
// RESPONSIBILITY:
//
// validate identity
//      ↓
// validate requested range
//      ↓
// split range into quarterly windows
//      ↓
// create/ensure ONE parent run
//      ↓
// create/ensure MANY queued windows
//
// IMPORTANT:
//
// THIS FUNCTION DOES NOT DISPATCH.
//
// Cloud Scheduler
//      ↓
// Supervisor
//      ↓
// Orchestrator
//
// remains the only execution authority.
//
// IDEMPOTENCY:
//
// When idempotencyKey is supplied:
//
// same logical request
//      ↓
// same deterministic run ID
//      ↓
// same deterministic window IDs
//      ↓
// BigQuery MERGE
//
// When idempotencyKey is absent:
//
// random run/window IDs preserve manual/test semantics.
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

    idempotencyKey?:
      string | null;

  }
) {

  // ==========================================================
  // IDENTIFIERS
  // ==========================================================

  const workspaceId =
    requireValue(
      input.workspaceId,
      'SHOPIFY_BACKFILL_WORKSPACE_MISSING'
    );


  const brandId =
    requireValue(
      input.brandId,
      'SHOPIFY_BACKFILL_BRAND_MISSING'
    );


  const connectionId =
    requireValue(
      input.connectionId,
      'SHOPIFY_BACKFILL_CONNECTION_MISSING'
    );


  const integrationAccountId =
    requireValue(
      input.integrationAccountId,
      'SHOPIFY_BACKFILL_INTEGRATION_ACCOUNT_MISSING'
    );


  const providerAccountId =
    requireValue(
      input.providerAccountId,
      'SHOPIFY_BACKFILL_PROVIDER_ACCOUNT_MISSING'
    );


  const idempotencyKey =
    String(
      input.idempotencyKey
      ??
      ''
    ).trim();


  // ==========================================================
  // RANGE
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
    from >=
      to
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_RANGE_INVALID'
    );

  }


  // ==========================================================
  // PLAN QUARTERLY WINDOWS
  //
  // Bootstrap:
  // deterministic IDs.
  //
  // Manual/test:
  // random IDs.
  // ==========================================================

  const windows =
    createQuarterWindows(

      from,

      to,

      idempotencyKey
        ?
          idempotencyKey
        :
          null

    );


  if (
    windows.length ===
      0
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOWS_EMPTY'
    );

  }


  const firstWindow =
    windows[0];


  const lastWindow =
    windows[
      windows.length - 1
    ];


  if (
    !firstWindow
    ||
    !lastWindow
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOW_PLAN_INVALID'
    );

  }


  // ==========================================================
  // RUN ID
  // ==========================================================

  const backfillRunId =
    idempotencyKey
      ?
        deterministicId(
          'bfr',
          idempotencyKey
        )
      :
        `bfr_${randomUUID()}`;


  const now =
    new Date()
      .toISOString();


  // ==========================================================
  // ENSURE PARENT RUN
  //
  // MERGE instead of INSERT.
  //
  // Existing run is NEVER reset to queued and its counters are
  // NEVER overwritten.
  //
  // This is critical because a retry may arrive while the run
  // is already running or completed.
  // ==========================================================

  await bigquery.query({

    query: `

      MERGE
        \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`
          AS target

      USING
      (
        SELECT

          @backfill_run_id
            AS backfill_run_id

      )
        AS source

      ON

        target.backfill_run_id =
          source.backfill_run_id


      WHEN NOT MATCHED THEN

        INSERT
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
          @strategy,
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

          @total_windows,
          @total_windows,
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

      strategy:
        BACKFILL_STRATEGY,

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
  // SERIALIZE WINDOW PLAN
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


  // ==========================================================
  // ENSURE ALL WINDOWS
  //
  // MERGE instead of INSERT.
  //
  // Existing windows remain untouched:
  //
  // completed remains completed
  // running remains running
  // failed remains failed
  //
  // Missing windows are inserted queued.
  // ==========================================================

  await bigquery.query({

    query: `

      MERGE
        \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`
          AS target

      USING
      (

        SELECT

          JSON_VALUE(
            item,
            '$.backfill_window_id'
          )
            AS backfill_window_id,

          TIMESTAMP(
            JSON_VALUE(
              item,
              '$.window_start'
            )
          )
            AS window_start,

          TIMESTAMP(
            JSON_VALUE(
              item,
              '$.window_end'
            )
          )
            AS window_end

        FROM

          UNNEST(

            JSON_QUERY_ARRAY(

              PARSE_JSON(
                @windows_json
              )

            )

          )
            AS item

      )
        AS source

      ON

        target.backfill_window_id =
          source.backfill_window_id


      WHEN NOT MATCHED THEN

        INSERT
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
          source.backfill_window_id,
          @backfill_run_id,

          @workspace_id,
          @brand_id,

          @connection_id,
          @integration_account_id,
          @provider_account_id,

          'orders',

          source.window_start,
          source.window_end,

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
        )

    `,

    location:
      OPS_LOCATION,

    params: {

      windows_json:
        windowsJson,

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

    },

  });


  // ==========================================================
  // RESULT
  //
  // No dispatch occurs here.
  //
  // Scheduler/Supervisor discovers queued work.
  // ==========================================================

  return {

    backfillRunId,

    strategy:
      BACKFILL_STRATEGY,

    requestedFrom:
      from.toISOString(),

    requestedTo:
      to.toISOString(),

    totalWindows:
      windows.length,

    idempotent:
      Boolean(
        idempotencyKey
      ),

    firstWindow: {

      backfillWindowId:
        firstWindow.backfillWindowId,

      from:
        firstWindow.from,

      to:
        firstWindow.to,

      initialStatus:
        'queued',

    },

    lastWindow: {

      backfillWindowId:
        lastWindow.backfillWindowId,

      from:
        lastWindow.from,

      to:
        lastWindow.to,

      initialStatus:
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
    BACKFILL_STRATEGY,

};