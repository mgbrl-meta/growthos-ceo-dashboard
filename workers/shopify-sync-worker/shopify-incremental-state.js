import {
  BigQuery,
} from '@google-cloud/bigquery';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.GOOGLE_CLOUD_PROJECT
    ||
    ''
  ).trim();


const CONTROL_DATASET =
  String(
    process.env.GROWTHOS_CONTROL_DATASET
    ||
    'growthos_control'
  ).trim();


const LOCATION =
  String(
    process.env.GROWTHOS_CONTROL_LOCATION
    ||
    process.env.GCP_BQ_LOCATION
    ||
    'asia-south1'
  ).trim();


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_INCREMENTAL_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });


// ============================================================
// HELPERS
// ============================================================

function requireString(
  value,
  errorCode
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


function makeStateId(
  input
) {

  return [

    requireString(
      input.workspaceId,
      'SHOPIFY_INCREMENTAL_WORKSPACE_MISSING'
    ),

    requireString(
      input.brandId,
      'SHOPIFY_INCREMENTAL_BRAND_MISSING'
    ),

    requireString(
      input.connectionId,
      'SHOPIFY_INCREMENTAL_CONNECTION_MISSING'
    ),

    'shopify',

    'orders',

  ].join(':');

}


// ============================================================
// RUN DML
// ============================================================

async function runDml(
  options
) {

  const [
    job,
  ] =
    await bigquery.createQueryJob({

      ...options,

      location:
        LOCATION,

    });


  await job.getQueryResults();


  const [
    metadata,
  ] =
    await job.getMetadata();


  return {

    affectedRows:
      Number(
        metadata
          ?.statistics
          ?.query
          ?.numDmlAffectedRows
        ??
        0
      ),

    jobId:
      job.id
      ??
      null,

  };

}


// ============================================================
// ENSURE SHOPIFY ORDERS STATE
//
// Important:
//
// This does NOT modify generic sync-store.ts.
//
// Shopify state identity is:
//
// workspace
// + brand
// + connection
// + shopify
// + orders
//
// Initial watermark is setup completion time.
//
// Existing state is NEVER overwritten here.
// ============================================================

export async function ensureShopifyOrdersIncrementalState(
  input
) {

  const syncStateId =
    makeStateId(
      input
    );


  const initialWatermark =
    requireString(
      input.initialWatermark,
      'SHOPIFY_INCREMENTAL_INITIAL_WATERMARK_MISSING'
    );


  await bigquery.query({

    query: `

      MERGE
        \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`
        AS target

      USING
      (

        SELECT

          @sync_state_id
            AS sync_state_id,

          @workspace_id
            AS workspace_id,

          @brand_id
            AS brand_id,

          @connection_id
            AS connection_id,

          TIMESTAMP(
            @initial_watermark
          )
            AS initial_watermark

      )
      AS source

      ON
        target.sync_state_id =
          source.sync_state_id


      WHEN NOT MATCHED THEN

        INSERT
        (

          sync_state_id,

          workspace_id,
          brand_id,

          connection_id,

          provider,
          entity,

          cursor,

          last_source_timestamp,

          last_synced_at,
          next_sync_at,

          backfill_status,
          incremental_status,

          consecutive_failures,
          last_error,

          created_at,
          updated_at

        )

        VALUES
        (

          source.sync_state_id,

          source.workspace_id,
          source.brand_id,

          source.connection_id,

          'shopify',
          'orders',

          NULL,

          source.initial_watermark,

          NULL,
          CURRENT_TIMESTAMP(),

          NULL,
          'ready',

          0,
          NULL,

          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()

        )

    `,

    location:
      LOCATION,

    params: {

      sync_state_id:
        syncStateId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      initial_watermark:
        initialWatermark,

    },

  });


  return {

    syncStateId,

  };

}


// ============================================================
// GET STATE
// ============================================================

export async function getShopifyOrdersIncrementalState(
  input
) {

  const syncStateId =
    makeStateId(
      input
    );


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          sync_state_id,

          workspace_id,
          brand_id,

          connection_id,

          provider,
          entity,

          cursor,

          last_source_timestamp,

          last_synced_at,
          next_sync_at,

          backfill_status,
          incremental_status,

          consecutive_failures,
          last_error,

          created_at,
          updated_at

        FROM
          \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`

        WHERE

          sync_state_id =
            @sync_state_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND connection_id =
            @connection_id

          AND provider =
            'shopify'

          AND entity =
            'orders'

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        sync_state_id:
          syncStateId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        connection_id:
          input.connectionId,

      },

    });


  return rows?.[0]
    ??
    null;

}


// ============================================================
// CLAIM DISPATCH
//
// ready
// success
// failed
//      ↓
// dispatching
//
// Conditional UPDATE is the concurrency lock.
//
// A second supervisor invocation cannot claim the same Shopify
// connection while the first one owns it.
// ============================================================

export async function claimShopifyOrdersIncrementalDispatch(
  input
) {

  const syncStateId =
    makeStateId(
      input
    );


  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`

        SET

          incremental_status =
            'dispatching',

          next_sync_at =
            NULL,

          last_error =
            NULL,

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          sync_state_id =
            @sync_state_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND connection_id =
            @connection_id

          AND provider =
            'shopify'

          AND entity =
            'orders'

          AND
            (

              incremental_status
                IS NULL

              OR

              incremental_status IN
                (
                  'ready',
                  'success',
                  'failed'
                )

            )

          AND
            (

              next_sync_at
                IS NULL

              OR

              next_sync_at <=
                CURRENT_TIMESTAMP()

            )

          AND NOT EXISTS
            (

              SELECT
                1

              FROM
                \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_runs\`
                AS active

              WHERE

                active.workspace_id =
                  @workspace_id

                AND active.brand_id =
                  @brand_id

                AND active.connection_id =
                  @connection_id

                AND active.provider =
                  'shopify'

                AND active.entity =
                  'orders'

                AND active.sync_type =
                  'incremental'

                AND active.status IN
                  (
                    'queued',
                    'running'
                  )

            )

      `,

      params: {

        sync_state_id:
          syncStateId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        connection_id:
          input.connectionId,

      },

    });


  return {

    claimed:
      result.affectedRows ===
        1,

    syncStateId,

    jobId:
      result.jobId,

  };

}


// ============================================================
// CREATE QUEUED RUN
//
// Supervisor owns:
//
// state = dispatching
// run   = queued
//
// Pub/Sub worker later atomically moves:
//
// queued → running
//
// This gives Pub/Sub replay protection.
// ============================================================

export async function createShopifyOrdersIncrementalRun(
  input
) {

  const runId =
    requireString(
      input.runId,
      'SHOPIFY_INCREMENTAL_RUN_ID_MISSING'
    );


  await bigquery.query({

    query: `

      INSERT INTO
        \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_runs\`
      (

        run_id,

        workspace_id,
        brand_id,

        connection_id,

        provider,
        entity,
        sync_type,

        status,
        attempt,

        started_at,

        source_start_at,
        source_end_at,

        records_fetched,
        records_loaded,
        records_rejected,

        bytes_processed,

        cursor_before,
        cursor_after,

        error_code,
        error_message,

        created_at

      )

      VALUES
      (

        @run_id,

        @workspace_id,
        @brand_id,

        @connection_id,

        'shopify',
        'orders',
        'incremental',

        'queued',
        1,

        NULL,

        TIMESTAMP(
          @source_start_at
        ),

        TIMESTAMP(
          @source_end_at
        ),

        0,
        0,
        0,

        0,

        NULL,
        NULL,

        NULL,
        NULL,

        CURRENT_TIMESTAMP()

      )

    `,

    location:
      LOCATION,

    params: {

      run_id:
        runId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      source_start_at:
        requireString(
          input.from,
          'SHOPIFY_INCREMENTAL_FROM_MISSING'
        ),

      source_end_at:
        requireString(
          input.to,
          'SHOPIFY_INCREMENTAL_TO_MISSING'
        ),

    },

  });


  return {

    runId,

  };

}


// ============================================================
// CLAIM QUEUED RUN IN WORKER
//
// queued
//   ↓
// running
//
// Duplicate Pub/Sub deliveries cannot execute the same run
// twice.
// ============================================================

export async function claimShopifyOrdersIncrementalRun(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_runs\`

        SET

          status =
            'running',

          started_at =
            COALESCE(
              started_at,
              CURRENT_TIMESTAMP()
            )

        WHERE

          run_id =
            @run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND connection_id =
            @connection_id

          AND provider =
            'shopify'

          AND entity =
            'orders'

          AND sync_type =
            'incremental'

          AND status =
            'queued'

      `,

      params: {

        run_id:
          input.runId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        connection_id:
          input.connectionId,

      },

    });


  if (
    result.affectedRows !==
      1
  ) {

    return {

      claimed:
        false,

    };

  }


  const syncStateId =
    makeStateId(
      input
    );


  await runDml({

    query: `

      UPDATE
        \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`

      SET

        incremental_status =
          'running',

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE

        sync_state_id =
          @sync_state_id

        AND incremental_status =
          'dispatching'

    `,

    params: {

      sync_state_id:
        syncStateId,

    },

  });


  return {

    claimed:
      true,

  };

}


// ============================================================
// COMPLETE RUN
//
// Critical watermark rule:
//
// last_source_timestamp = successful window.to
//
// NOT:
//
// - Shopify page cursor
// - last order.updatedAt
//
// Cursor returns to NULL between completed windows.
// ============================================================

export async function completeShopifyOrdersIncrementalRun(
  input
) {

  await runDml({

    query: `

      UPDATE
        \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_runs\`

      SET

        status =
          'success',

        completed_at =
          CURRENT_TIMESTAMP(),

        records_fetched =
          @records_fetched,

        records_loaded =
          @records_loaded,

        records_rejected =
          @records_rejected,

        cursor_after =
          NULL,

        error_code =
          NULL,

        error_message =
          NULL

      WHERE

        run_id =
          @run_id

        AND status =
          'running'

    `,

    params: {

      run_id:
        input.runId,

      records_fetched:
        Number(
          input.recordsFetched
          ??
          0
        ),

      records_loaded:
        Number(
          input.recordsLoaded
          ??
          0
        ),

      records_rejected:
        Number(
          input.recordsRejected
          ??
          0
        ),

    },

  });


  const syncStateId =
    makeStateId(
      input
    );


  await runDml({

    query: `

      UPDATE
        \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`

      SET

        cursor =
          NULL,

        last_source_timestamp =
          TIMESTAMP(
            @window_end
          ),

        last_synced_at =
          CURRENT_TIMESTAMP(),

        next_sync_at =
          CURRENT_TIMESTAMP(),

        incremental_status =
          'success',

        consecutive_failures =
          0,

        last_error =
          NULL,

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE

        sync_state_id =
          @sync_state_id

        AND connection_id =
          @connection_id

        AND provider =
          'shopify'

        AND entity =
          'orders'

    `,

    params: {

      sync_state_id:
        syncStateId,

      connection_id:
        input.connectionId,

      window_end:
        requireString(
          input.windowEnd,
          'SHOPIFY_INCREMENTAL_WINDOW_END_MISSING'
        ),

    },

  });

}


// ============================================================
// FAIL RUN
//
// Watermark is deliberately NOT changed.
//
// Failed range will therefore be retried.
// ============================================================

export async function failShopifyOrdersIncrementalRun(
  input
) {

  const message =
    String(
      input.errorMessage
      ??
      'SHOPIFY_INCREMENTAL_FAILED'
    );


  await runDml({

    query: `

      UPDATE
        \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_runs\`

      SET

        status =
          'failed',

        completed_at =
          CURRENT_TIMESTAMP(),

        error_code =
          'SHOPIFY_INCREMENTAL_FAILED',

        error_message =
          @error_message

      WHERE

        run_id =
          @run_id

        AND status IN
          (
            'queued',
            'running'
          )

    `,

    params: {

      run_id:
        input.runId,

      error_message:
        message,

    },

  });


  const syncStateId =
    makeStateId(
      input
    );


  await runDml({

    query: `

      UPDATE
        \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`

      SET

        incremental_status =
          'failed',

        next_sync_at =
          TIMESTAMP_ADD(
            CURRENT_TIMESTAMP(),
            INTERVAL 1 MINUTE
          ),

        consecutive_failures =
          IFNULL(
            consecutive_failures,
            0
          )
          +
          1,

        last_error =
          @error_message,

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE

        sync_state_id =
          @sync_state_id

        AND connection_id =
          @connection_id

        AND provider =
          'shopify'

        AND entity =
          'orders'

    `,

    params: {

      sync_state_id:
        syncStateId,

      connection_id:
        input.connectionId,

      error_message:
        message,

    },

  });

}


// ============================================================
// RELEASE DISPATCH FAILURE
//
// Used when:
// state was reserved
// run was created
// but Pub/Sub publication failed.
//
// Watermark remains unchanged.
// ============================================================

export async function releaseShopifyOrdersIncrementalDispatch(
  input
) {

  return failShopifyOrdersIncrementalRun({

    ...input,

    errorMessage:
      input.errorMessage
      ??
      'SHOPIFY_INCREMENTAL_DISPATCH_FAILED',

  });

}

// ============================================================
// RECOVER STALE SHOPIFY ORDERS INCREMENTAL CLAIMS
//
// Two failure states:
//
// 1. dispatching > 10 minutes
//
// Supervisor reserved the connection but crashed before the
// worker successfully claimed/executed it.
//
// 2. running > 60 minutes
//
// Worker claimed the run but never completed it.
//
// Recovery:
// active run -> failed
// state      -> failed
//
// Watermark is NEVER advanced.
//
// The supervisor can then create a completely new run from the
// last successful watermark.
// ============================================================

export async function recoverStaleShopifyOrdersIncrementalClaims() {

  // ==========================================================
  // 1. FAIL STALE RUNS
  // ==========================================================

  const runResult =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_runs\`
          AS r

        SET

          status =
            'failed',

          completed_at =
            CURRENT_TIMESTAMP(),

          error_code =
            'SHOPIFY_INCREMENTAL_STALE_RECOVERED',

          error_message =
            'Stale Shopify Orders incremental execution recovered'

        WHERE

          r.provider =
            'shopify'

          AND r.entity =
            'orders'

          AND r.sync_type =
            'incremental'

          AND r.status IN
            (
              'queued',
              'running'
            )

          AND EXISTS
            (

              SELECT
                1

              FROM
                \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`
                AS s

              WHERE

                s.workspace_id =
                  r.workspace_id

                AND s.brand_id =
                  r.brand_id

                AND s.connection_id =
                  r.connection_id

                AND s.provider =
                  'shopify'

                AND s.entity =
                  'orders'

                AND
                  (

                    (
                      s.incremental_status =
                        'dispatching'

                      AND s.updated_at <
                        TIMESTAMP_SUB(
                          CURRENT_TIMESTAMP(),
                          INTERVAL 10 MINUTE
                        )
                    )

                    OR

                    (
                      s.incremental_status =
                        'running'

                      AND s.updated_at <
                        TIMESTAMP_SUB(
                          CURRENT_TIMESTAMP(),
                          INTERVAL 60 MINUTE
                        )
                    )

                  )

            )

      `,

    });


  // ==========================================================
  // 2. RELEASE STALE STATE
  //
  // Do NOT modify last_source_timestamp.
  // ==========================================================

  const stateResult =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${CONTROL_DATASET}.integration_sync_state\`

        SET

          incremental_status =
            'failed',

          next_sync_at =
            CURRENT_TIMESTAMP(),

          consecutive_failures =
            IFNULL(
              consecutive_failures,
              0
            )
            +
            1,

          last_error =
            'SHOPIFY_INCREMENTAL_STALE_RECOVERED',

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          provider =
            'shopify'

          AND entity =
            'orders'

          AND
            (

              (
                incremental_status =
                  'dispatching'

                AND updated_at <
                  TIMESTAMP_SUB(
                    CURRENT_TIMESTAMP(),
                    INTERVAL 10 MINUTE
                  )
              )

              OR

              (
                incremental_status =
                  'running'

                AND updated_at <
                  TIMESTAMP_SUB(
                    CURRENT_TIMESTAMP(),
                    INTERVAL 60 MINUTE
                  )
              )

            )

      `,

    });


  return {

    runsRecovered:
      runResult.affectedRows,

    statesRecovered:
      stateResult.affectedRows,

  };

}