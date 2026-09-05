import {
  BigQuery,
} from '@google-cloud/bigquery';


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
// IMPORTANT:
//
// bigquery.query() is convenient for normal queries but we
// need the actual BigQuery Job here because:
//
// numDmlAffectedRows
//
// is stored in the query-job metadata.
//
// Therefore:
//
// createQueryJob
//      ↓
// wait for completion
//      ↓
// getMetadata
//      ↓
// numDmlAffectedRows
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


  // Wait for DML execution to complete.
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
// GET WINDOW
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

          status,

          bulk_operation_id,

          bulk_operation_status,

          attempt_count,

          started_at,

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

    });


  return rows?.[0]
    ??
    null;

}


// ============================================================
// CLAIM BACKFILL WINDOW
//
// queued
//     ↓
// starting
//
// The conditional UPDATE gives us the claim.
//
// Only a row still in queued/retry_wait and without a recorded
// Shopify operation may be claimed.
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
              'retry_wait'
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
  // Determine why.
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
// RELEASE CLAIM
//
// Used ONLY when Shopify Bulk Operation itself failed before
// Shopify returned an operation ID.
//
// starting
//     ↓
// queued
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
// MARK BULK STARTED
//
// starting
//     ↓
// running
//
// Shopify Bulk Operation ID is now persisted.
//
// IMPORTANT:
//
// Run counters are modified only if THIS invocation performs
// the state transition.
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
    // RUN COUNTERS
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
  // POSSIBLE IDEMPOTENT REDELIVERY
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
// IMPORTANT:
//
// The signed Shopify JSONL URL is intentionally NOT stored
// in BigQuery.
//
// It expires and grants temporary access to exported data.
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
            CURRENT_TIMESTAMP(),

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
// MARK BULK FAILED
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
  // UPDATE RUN COUNTERS ONLY ON FIRST FAILURE TRANSITION
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
// CLAIM RESULT FOR LOADING
//
// result_ready
//      ↓
// loading
//
// Only one worker may process the JSONL.
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
            CURRENT_TIMESTAMP(),

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
// RELEASE FAILED LOAD
//
// loading
//      ↓
// retry_wait
//
// The JSONL can safely be replayed because writeShopifyOrders
// is hash/dedupe protected.
// ============================================================

export async function releaseBackfillLoadClaim(
  input
) {

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

}


// ============================================================
// COMPLETE LOAD
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
            ||
            0
          ),

        records_loaded:
          Number(
            input.recordsLoaded
            ||
            0
          ),

        records_skipped:
          Number(
            input.recordsSkipped
            ||
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


  if (
    result.affectedRows !== 1
  ) {

    const existing =
      await getBackfillWindow(
        input
      );


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
  // UPDATE RUN
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

      records_loaded:
        Number(
          input.recordsLoaded
          ||
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
// RECOVER STALE STARTING CLAIMS
//
// Problem:
//
// Worker claims:
//
// queued
//   ↓
// starting
//
// If the process crashes before Shopify returns / before the
// operation ID is persisted, the window can remain:
//
// status = starting
// bulk_operation_id = NULL
//
// We must NOT blindly start Shopify again on Pub/Sub
// redelivery.
//
// Instead:
//
// starting + no operation + stale
//          ↓
// retry_wait
//
// Q3E-5B orchestrator will republish retry_wait windows.
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
            'STALE_STARTING_CLAIM_RECOVERED',

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND status =
            'starting'

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

// ============================================================
// Q3E-5A
// RECOVER STALE STARTING CLAIMS
//
// starting + NULL operation + stale
//                 ↓
//             retry_wait
//
// We never automatically assume a fresh "starting" claim is
// abandoned. The 10-minute threshold protects an active worker.
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
            'STALE_STARTING_CLAIM_RECOVERED',

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND status =
            'starting'

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