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


const OPS_DATASET =
  String(
    process.env.GROWTHOS_OPS_DATASET
    ||
    'growthos_ops'
  ).trim();


const LOCATION =
  String(
    process.env.GROWTHOS_OPS_LOCATION
    ||
    'asia-south1'
  ).trim();


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_BACKFILL_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });


// ============================================================
// RUN DML
//
// We need the real BigQuery Job because:
// statistics.query.numDmlAffectedRows
//
// is used for conditional state transitions.
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


  // Wait until the DML operation finishes.
  await job.getQueryResults();


  const [
    metadata,
  ] =
    await job.getMetadata();


  const affectedRows =
    Number(

      metadata
        ?.statistics
        ?.query
        ?.numDmlAffectedRows

      ??
      0

    );


  return {

    affectedRows,

    jobId:
      job.id
      ??
      null,

  };

}


// ============================================================
// GET BACKFILL WINDOW
// ============================================================
// ============================================================
// GET BACKFILL WINDOW
//
// The backfill window is the authoritative execution context.
//
// Callers should NOT need to resend:
//
// - connection_id
// - integration_account_id
// - provider_account_id
// - entity
// - historical range
//
// Those identities were persisted when the plan was created.
// ============================================================

export async function getBackfillWindow(
  input
) {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

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

          updated_at,

          error

        FROM
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

      },

      types: {

        backfill_window_id:
          'STRING',

        backfill_run_id:
          'STRING',

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

      },

    });


  return rows?.[0]
    ??
    null;

}


// ============================================================
// CLAIM BACKFILL WINDOW
//
// queued
// retry_wait
// dispatching
//      ↓
// starting
//
// dispatching is included because Q3E-5B reserves a window
// before publishing its Pub/Sub message.
//
// Conditional UPDATE is the concurrency lock.
// ============================================================

export async function claimBackfillWindow(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'starting',

          attempt_count =
            attempt_count + 1,

          started_at =
            COALESCE(
              started_at,
              CURRENT_TIMESTAMP()
            ),

          next_retry_at =
            NULL,

          updated_at =
            CURRENT_TIMESTAMP(),

          error =
            NULL

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND status IN
            (
              'queued',
              'retry_wait',
              'dispatching'
            )

          AND bulk_operation_id
            IS NULL

      `,

      params: {

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

      },

    });


  // ==========================================================
  // CLAIM SUCCESS
  // ==========================================================

  if (
    result.affectedRows === 1
  ) {

    return {

      claimed:
        true,

      jobId:
        result.jobId,

    };

  }


  // ==========================================================
  // NOT CLAIMED
  //
  // Determine existing state for idempotency / retry handling.
  // ==========================================================

  const existing =
    await getBackfillWindow(
      input
    );


  if (!existing) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOW_NOT_FOUND'
    );

  }


  return {

    claimed:
      false,

    status:
      existing.status
      ??
      null,

    bulkOperationId:
      existing.bulk_operation_id
      ??
      null,

    bulkOperationStatus:
      existing.bulk_operation_status
      ??
      null,

    attemptCount:
      Number(
        existing.attempt_count
        ??
        0
      ),

  };

}


// ============================================================
// RELEASE BACKFILL START CLAIM
//
// Used only when Shopify Bulk Operation did NOT successfully
// start.
//
// starting
//      ↓
// queued
//
// Pub/Sub may safely retry.
// ============================================================

export async function releaseBackfillWindowClaim(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'queued',

          next_retry_at =
            NULL,

          error =
            @error,

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND status =
            'starting'

          AND bulk_operation_id
            IS NULL

      `,

      params: {

        error:
          String(
            input.error
            ??
            'SHOPIFY_BULK_START_FAILED'
          ),

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

      },

    });


  return {

    released:
      result.affectedRows === 1,

  };

}


// ============================================================
// MARK SHOPIFY BULK STARTED
//
// starting
//      ↓
// running
//
// This persists the Shopify Bulk Operation ID.
//
// Run counters move only when THIS invocation performs the
// transition.
// ============================================================

export async function markBackfillBulkStarted(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'running',

          bulk_operation_id =
            @bulk_operation_id,

          bulk_operation_status =
            @bulk_operation_status,

          updated_at =
            CURRENT_TIMESTAMP(),

          error =
            NULL

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND status =
            'starting'

          AND bulk_operation_id
            IS NULL

      `,

      params: {

        bulk_operation_id:
          input.bulkOperationId,

        bulk_operation_status:
          input.bulkOperationStatus,

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

      },

    });


  // ==========================================================
  // WINDOW TRANSITION SUCCEEDED
  // ==========================================================

  if (
    result.affectedRows === 1
  ) {

    // ========================================================
    // UPDATE PARENT RUN
    // ========================================================

    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`

        SET

          status =
            'running',

          started_at =
            COALESCE(
              started_at,
              CURRENT_TIMESTAMP()
            ),

          queued_windows =
            GREATEST(
              queued_windows - 1,
              0
            ),

          running_windows =
            running_windows + 1,

          updated_at =
            CURRENT_TIMESTAMP(),

          error =
            NULL

        WHERE

          backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

      `,

      params: {

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

      },

    });


    return {

      alreadyRecorded:
        false,

    };

  }


  // ==========================================================
  // IDEMPOTENT REDELIVERY
  // ==========================================================

  const existing =
    await getBackfillWindow(
      input
    );


  if (
    existing
    &&
    existing.bulk_operation_id ===
      input.bulkOperationId
  ) {

    return {

      alreadyRecorded:
        true,

    };

  }


  throw new Error(
    'SHOPIFY_BACKFILL_STATE_UPDATE_FAILED'
  );

}


// ============================================================
// MARK RESULT READY
//
// running
//      ↓
// result_ready
//
// Shopify signed JSONL URL is intentionally NOT stored.
// ============================================================

export async function markBackfillResultReady(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'result_ready',

          bulk_operation_status =
            @bulk_operation_status,

          bulk_object_count =
            @bulk_object_count,

          bulk_file_size_bytes =
            @bulk_file_size_bytes,

          result_ready_at =
            COALESCE(
              result_ready_at,
              CURRENT_TIMESTAMP()
            ),

          updated_at =
            CURRENT_TIMESTAMP(),

          error =
            NULL

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND bulk_operation_id =
            @bulk_operation_id

          AND status IN
            (
              'running',
              'result_ready'
            )

      `,

      params: {

        bulk_operation_status:
          input.bulkOperationStatus,

        bulk_object_count:
          Number(
            input.objectCount
            ??
            0
          ),

        bulk_file_size_bytes:
          input.fileSize
          ??
          null,

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        bulk_operation_id:
          input.bulkOperationId,

      },

      types: {

        bulk_file_size_bytes:
          'INT64',

      },

    });


  return {

    updated:
      result.affectedRows === 1,

  };

}


// ============================================================
// MARK BULK OPERATION FAILED
// ============================================================

export async function markBackfillBulkFailed(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'failed',

          bulk_operation_status =
            @bulk_operation_status,

          bulk_object_count =
            @bulk_object_count,

          bulk_file_size_bytes =
            @bulk_file_size_bytes,

          completed_at =
            CURRENT_TIMESTAMP(),

          updated_at =
            CURRENT_TIMESTAMP(),

          next_retry_at =
            NULL,

          error =
            @error

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND bulk_operation_id =
            @bulk_operation_id

          AND status NOT IN
            (
              'completed',
              'failed'
            )

      `,

      params: {

        bulk_operation_status:
          input.bulkOperationStatus,

        bulk_object_count:
          Number(
            input.objectCount
            ??
            0
          ),

        bulk_file_size_bytes:
          input.fileSize
          ??
          null,

        error:
          String(
            input.error
            ||
            'SHOPIFY_BULK_FAILED'
          ),

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        bulk_operation_id:
          input.bulkOperationId,

      },

      types: {

        bulk_file_size_bytes:
          'INT64',

      },

    });


  // ==========================================================
  // UPDATE RUN COUNTERS ON FIRST FAILURE ONLY
  // ==========================================================

  if (
    result.affectedRows === 1
  ) {

    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`

        SET

          running_windows =
            GREATEST(
              running_windows - 1,
              0
            ),

          failed_windows =
            failed_windows + 1,

          status =
            CASE

              WHEN
                completed_windows
                +
                failed_windows
                +
                1
                >=
                total_windows

              THEN
                'partial_failed'

              ELSE
                status

            END,

          completed_at =
            CASE

              WHEN
                completed_windows
                +
                failed_windows
                +
                1
                >=
                total_windows

              THEN
                CURRENT_TIMESTAMP()

              ELSE
                completed_at

            END,

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

      `,

      params: {

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

      },

    });

  }


  return {

    updated:
      result.affectedRows === 1,

  };

}


// ============================================================
// CLAIM JSONL RESULT FOR LOADING
//
// result_ready
// retry_wait
//      ↓
// loading
//
// retry_wait is allowed here only when the caller provides the
// existing bulk_operation_id.
//
// This lets failed JSONL loads replay safely.
// ============================================================

export async function claimBackfillLoad(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'loading',

          loading_started_at =
            COALESCE(
              loading_started_at,
              CURRENT_TIMESTAMP()
            ),

          next_retry_at =
            NULL,

          updated_at =
            CURRENT_TIMESTAMP(),

          error =
            NULL

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND bulk_operation_id =
            @bulk_operation_id

          AND status IN
            (
              'result_ready',
              'retry_wait'
            )

      `,

      params: {

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        bulk_operation_id:
          input.bulkOperationId,

      },

    });


  if (
    result.affectedRows === 1
  ) {

    return {

      claimed:
        true,

    };

  }


  const existing =
    await getBackfillWindow(
      input
    );


  if (!existing) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOW_NOT_FOUND'
    );

  }


  return {

    claimed:
      false,

    status:
      existing.status
      ??
      null,

  };

}


// ============================================================
// RELEASE FAILED JSONL LOAD
//
// loading
//      ↓
// retry_wait
//
// Replaying JSONL is safe because the canonical writer hashes
// and deduplicates Orders.
// ============================================================

export async function releaseBackfillLoadClaim(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'retry_wait',

          next_retry_at =
            TIMESTAMP_ADD(
              CURRENT_TIMESTAMP(),
              INTERVAL 1 MINUTE
            ),

          updated_at =
            CURRENT_TIMESTAMP(),

          error =
            @error

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND bulk_operation_id =
            @bulk_operation_id

          AND status =
            'loading'

      `,

      params: {

        error:
          String(
            input.error
            ||
            'SHOPIFY_BULK_LOAD_FAILED'
          ),

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        bulk_operation_id:
          input.bulkOperationId,

      },

    });


  return {

    released:
      result.affectedRows === 1,

  };

}


// ============================================================
// COMPLETE JSONL LOAD
//
// loading
//      ↓
// completed
// ============================================================

export async function markBackfillLoadCompleted(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'completed',

          bulk_operation_status =
            'COMPLETED',

          records_received =
            @records_received,

          records_loaded =
            @records_loaded,

          records_skipped =
            @records_skipped,

          completed_at =
            CURRENT_TIMESTAMP(),

          updated_at =
            CURRENT_TIMESTAMP(),

          next_retry_at =
            NULL,

          error =
            NULL

        WHERE

          backfill_window_id =
            @backfill_window_id

          AND backfill_run_id =
            @backfill_run_id

          AND workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND bulk_operation_id =
            @bulk_operation_id

          AND status =
            'loading'

      `,

      params: {

        records_received:
          Number(
            input.recordsReceived
            ??
            0
          ),

        records_loaded:
          Number(
            input.recordsLoaded
            ??
            0
          ),

        records_skipped:
          Number(
            input.recordsSkipped
            ??
            0
          ),

        backfill_window_id:
          input.backfillWindowId,

        backfill_run_id:
          input.backfillRunId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        bulk_operation_id:
          input.bulkOperationId,

      },

    });


  // ==========================================================
  // NOT TRANSITIONED
  // ==========================================================

  if (
    result.affectedRows !== 1
  ) {

    const existing =
      await getBackfillWindow(
        input
      );


    // Idempotent replay after successful completion.
    if (
      existing?.status ===
        'completed'
    ) {

      return {

        alreadyCompleted:
          true,

      };

    }


    throw new Error(
      'SHOPIFY_BACKFILL_COMPLETE_STATE_FAILED'
    );

  }


  // ==========================================================
  // UPDATE PARENT RUN
  // ==========================================================

  await runDml({

    query: `

      UPDATE
        \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`

      SET

        running_windows =
          GREATEST(
            running_windows - 1,
            0
          ),

        completed_windows =
          completed_windows + 1,

        records_loaded =
          records_loaded
          +
          @records_loaded,

        status =
          CASE

            WHEN
              completed_windows
              +
              failed_windows
              +
              1
              >=
              total_windows

            THEN

              CASE

                WHEN
                  failed_windows > 0

                THEN
                  'partial_failed'

                ELSE
                  'completed'

              END

            ELSE
              'running'

          END,

        completed_at =
          CASE

            WHEN
              completed_windows
              +
              failed_windows
              +
              1
              >=
              total_windows

            THEN
              CURRENT_TIMESTAMP()

            ELSE
              completed_at

          END,

        updated_at =
          CURRENT_TIMESTAMP(),

        error =
          NULL

      WHERE

        backfill_run_id =
          @backfill_run_id

        AND workspace_id =
          @workspace_id

        AND brand_id =
          @brand_id

    `,

    params: {

      records_loaded:
        Number(
          input.recordsLoaded
          ??
          0
        ),

      backfill_run_id:
        input.backfillRunId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

    },

  });


  return {

    alreadyCompleted:
      false,

  };

}


// ============================================================
// Q3E-5A
// RECOVER STALE BACKFILL CLAIMS
//
// Handles:
//
// dispatching
// starting
//
// but ONLY:
//
// bulk_operation_id IS NULL
//
// and only after 10 minutes.
//
// This prevents an abandoned reservation/claim from blocking a
// backfill forever.
//
// dispatching / starting
//          ↓
//      retry_wait
//
// Q3E-5B orchestrator can then republish the window.
// ============================================================

export async function recoverStaleBackfillClaims(
  input
) {

  const result =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

        SET

          status =
            'retry_wait',

          next_retry_at =
            CURRENT_TIMESTAMP(),

          error =
            'STALE_BACKFILL_CLAIM_RECOVERED',

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND status IN
            (
              'starting',
              'dispatching'
            )

          AND bulk_operation_id
            IS NULL

          AND updated_at <
            TIMESTAMP_SUB(
              CURRENT_TIMESTAMP(),
              INTERVAL 10 MINUTE
            )

      `,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

      },

    });


  return {

    recovered:
      result.affectedRows,

  };

}