import {
  resolveShopifyRuntimeContext,
} from './shopify-context.js';

import {
  getBulkOperation,
} from './shopify-bulk.js';

import {
  stageShopifyBulkResult,
} from './shopify-gcs.js';

import {
  loadShopifyBulkGcsToStage,
} from './shopify-bq-stage.js';

import {
  writeShopifyBulkStage,
} from './shopify-bulk-warehouse.js';

import {
  getBackfillWindow,
  markBackfillResultReady,
  markBackfillBulkFailed,
  claimBackfillLoad,
  releaseBackfillLoadClaim,
  markBackfillLoadCompleted,
} from './shopify-backfill-state.js';


// ============================================================
// REQUIRED STRING
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


// ============================================================
// NORMALIZE PROCESS REQUEST
//
// IMPORTANT:
//
// Caller identifies only the Growth OS window.
//
// Connection/account/Bulk identity comes from the persisted
// control-plane row.
// ============================================================

function normalizeInput(
  input
) {

  return {

    workspaceId:
      requireString(
        input?.workspaceId,
        'SHOPIFY_BACKFILL_PROCESS_WORKSPACE_MISSING'
      ),

    brandId:
      requireString(
        input?.brandId,
        'SHOPIFY_BACKFILL_PROCESS_BRAND_MISSING'
      ),

    backfillRunId:
      requireString(
        input?.backfillRunId,
        'SHOPIFY_BACKFILL_PROCESS_RUN_MISSING'
      ),

    backfillWindowId:
      requireString(
        input?.backfillWindowId,
        'SHOPIFY_BACKFILL_PROCESS_WINDOW_MISSING'
      ),

  };

}


// ============================================================
// RUNTIME JOB FROM AUTHORITATIVE WINDOW
// ============================================================

function buildRuntimeJob(
  window
) {

  return {

    workspaceId:
      requireString(
        window?.workspace_id,
        'SHOPIFY_BACKFILL_PROCESS_WINDOW_WORKSPACE_MISSING'
      ),

    brandId:
      requireString(
        window?.brand_id,
        'SHOPIFY_BACKFILL_PROCESS_WINDOW_BRAND_MISSING'
      ),

    connectionId:
      requireString(
        window?.connection_id,
        'SHOPIFY_BACKFILL_PROCESS_CONNECTION_MISSING'
      ),

    integrationAccountId:
      requireString(
        window?.integration_account_id,
        'SHOPIFY_BACKFILL_PROCESS_ACCOUNT_MISSING'
      ),

    providerAccountId:
      requireString(
        window?.provider_account_id,
        'SHOPIFY_BACKFILL_PROCESS_PROVIDER_ACCOUNT_MISSING'
      ),

  };

}


// ============================================================
// PROCESS ONE BACKFILL WINDOW
//
// This is intentionally idempotent.
//
// Multiple calls are safe:
//
// running
//    ↓
// status check
//
// result_ready
//    ↓
// conditional loading claim
//
// loading
//    ↓
// another processor owns it
//
// completed
//    ↓
// return immediately
// ============================================================

export async function processShopifyBackfillWindow(
  rawInput
) {

  const startedAt =
    Date.now();


  const input =
    normalizeInput(
      rawInput
    );


  const stateInput = {

    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    backfillRunId:
      input.backfillRunId,

    backfillWindowId:
      input.backfillWindowId,

  };


  // ==========================================================
  // LOAD AUTHORITATIVE CONTROL-PLANE ROW
  // ==========================================================

  let window =
    await getBackfillWindow(
      stateInput
    );


  if (!window) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOW_NOT_FOUND'
    );

  }


  // ==========================================================
  // ALREADY COMPLETE
  // ==========================================================

  if (
    window.status ===
      'completed'
  ) {

    return {

      ok:
        true,

      outcome:
        'already_completed',

      status:
        'completed',

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // TERMINAL FAILURE
  // ==========================================================

  if (
    window.status ===
      'failed'
  ) {

    return {

      ok:
        false,

      outcome:
        'already_failed',

      status:
        'failed',

      error:
        window.error
        ??
        null,

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // LOADING IS OWNED BY ANOTHER PROCESSOR
  //
  // Stale-loading recovery will be built separately.
  // Never steal an active loading claim here.
  // ==========================================================

  if (
    window.status ===
      'loading'
  ) {

    return {

      ok:
        true,

      outcome:
        'load_in_progress',

      status:
        'loading',

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // BULK OPERATION MUST ALREADY EXIST
  //
  // Starting/dispatching queued work remains the existing
  // dispatch responsibility.
  //
  // Q3E-6C-2 will connect dispatch scanning later.
  // ==========================================================

  const bulkOperationId =
    String(
      window.bulk_operation_id
      ??
      ''
    ).trim();


  if (!bulkOperationId) {

    return {

      ok:
        true,

      outcome:
        'awaiting_bulk_operation',

      status:
        window.status
        ??
        null,

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // AUTHORITATIVE SHOPIFY RUNTIME
  // ==========================================================

  const runtimeJob =
    buildRuntimeJob(
      window
    );


  const runtime =
    await resolveShopifyRuntimeContext(
      runtimeJob
    );


  // ==========================================================
  // GET FRESH SHOPIFY BULK STATUS
  //
  // Also gives us a fresh signed result URL when complete.
  // Signed URL is never persisted.
  // ==========================================================

  const operation =
    await getBulkOperation(

      runtime,

      bulkOperationId

    );


  // ==========================================================
  // SHOPIFY TERMINAL FAILURE
  // ==========================================================

  if (
    operation.status ===
      'FAILED'
    ||
    operation.status ===
      'CANCELED'
    ||
    operation.status ===
      'EXPIRED'
  ) {

    await markBackfillBulkFailed({

      ...stateInput,

      bulkOperationId,

      bulkOperationStatus:
        operation.status,

      objectCount:
        operation.rootObjectCount,

      fileSize:
        operation.fileSize,

      error:
        operation.errorCode
        ||
        `SHOPIFY_BULK_${operation.status}`,

    });


    return {

      ok:
        false,

      outcome:
        'bulk_failed',

      status:
        operation.status,

      errorCode:
        operation.errorCode
        ??
        null,

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // SHOPIFY STILL WORKING
  // ==========================================================

  if (
    operation.status !==
      'COMPLETED'
  ) {

    return {

      ok:
        true,

      outcome:
        'bulk_pending',

      status:
        operation.status,

      objectCount:
        operation.rootObjectCount,

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  if (!operation.url) {

    throw new Error(
      'SHOPIFY_BULK_RESULT_URL_MISSING'
    );

  }


  // ==========================================================
  // running → result_ready
  //
  // markBackfillResultReady is safe for redelivery.
  // ==========================================================

  if (
    window.status ===
      'running'
    ||
    window.status ===
      'result_ready'
  ) {

    await markBackfillResultReady({

      ...stateInput,

      bulkOperationId,

      bulkOperationStatus:
        operation.status,

      objectCount:
        operation.rootObjectCount,

      fileSize:
        operation.fileSize,

    });

  }


  // ==========================================================
  // REFRESH WINDOW
  //
  // Another processor could have advanced it between calls.
  // ==========================================================

  window =
    await getBackfillWindow(
      stateInput
    );


  if (!window) {

    throw new Error(
      'SHOPIFY_BACKFILL_WINDOW_NOT_FOUND_AFTER_STATUS'
    );

  }


  if (
    window.status ===
      'completed'
  ) {

    return {

      ok:
        true,

      outcome:
        'already_completed',

      status:
        'completed',

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  if (
    window.status ===
      'loading'
  ) {

    return {

      ok:
        true,

      outcome:
        'load_in_progress',

      status:
        'loading',

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // CLAIM HIGH-SPEED LOAD
  //
  // result_ready / retry_wait
  //            ↓
  //          loading
  // ==========================================================

  const loadStateInput = {

    ...stateInput,

    bulkOperationId,

  };


  const claim =
    await claimBackfillLoad(
      loadStateInput
    );


  if (!claim.claimed) {

    if (
      claim.status ===
        'completed'
    ) {

      return {

        ok:
          true,

        outcome:
          'already_completed',

        status:
          'completed',

        durationMs:
          Date.now()
          -
          startedAt,

      };

    }


    return {

      ok:
        true,

      outcome:
        'load_not_claimed',

      status:
        claim.status
        ??
        null,

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // WE OWN THE LOAD CLAIM
  // ==========================================================

  let ownsLoadClaim =
    true;


  try {

    // ========================================================
    // SHOPIFY JSONL → GCS
    //
    // Deterministic and idempotent.
    // Existing object is reused.
    // ========================================================

    const gcs =
      await stageShopifyBulkResult({

        resultUrl:
          operation.url,

        workspaceId:
          runtimeJob.workspaceId,

        brandId:
          runtimeJob.brandId,

        integrationAccountId:
          runtimeJob.integrationAccountId,

        entity:
          'orders',

        backfillRunId:
          input.backfillRunId,

        backfillWindowId:
          input.backfillWindowId,

        bulkOperationId,

        expectedFileSize:
          operation.fileSize,

      });


    if (
      gcs.sizeMatchesExpected ===
        false
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_GCS_SIZE_MISMATCH'
      );

    }


    // ========================================================
    // GCS → LOSSLESS BIGQUERY STAGE
    // ========================================================

    const stage =
      await loadShopifyBulkGcsToStage({

        gcsUri:
          gcs.gcsUri,

        backfillRunId:
          input.backfillRunId,

        backfillWindowId:
          input.backfillWindowId,

      });


    if (
      operation.rootObjectCount > 0
      &&
      stage.rowsLoaded !==
        operation.rootObjectCount
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_STAGE_ROW_COUNT_MISMATCH'
      );

    }


    // ========================================================
    // LOSSLESS STAGE → CANONICAL RAW + STATE
    //
    // CURRENT remains a view.
    // ========================================================

    const warehouse =
      await writeShopifyBulkStage({

        workspaceId:
          runtimeJob.workspaceId,

        brandId:
          runtimeJob.brandId,

        integrationAccountId:
          runtimeJob.integrationAccountId,

        stageTableId:
          stage.tableId,

      });


    if (
      warehouse.received !==
        stage.rowsLoaded
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_WAREHOUSE_ROW_COUNT_MISMATCH'
      );

    }


    // ========================================================
    // loading → completed
    //
    // Existing state function also reconciles run counters.
    // ========================================================

    const completion =
      await markBackfillLoadCompleted({

        ...loadStateInput,

        recordsReceived:
          warehouse.received,

        recordsLoaded:
          warehouse.loaded,

        recordsSkipped:
          warehouse.skipped,

      });


    ownsLoadClaim =
      false;


    return {

      ok:
        true,

      outcome:
        completion.alreadyCompleted
          ?
            'already_completed'
          :
            'completed',

      status:
        'completed',

      bulk: {

        id:
          bulkOperationId,

        objectCount:
          operation.rootObjectCount,

        fileSize:
          operation.fileSize,

      },

      gcs: {

        reused:
          gcs.reused,

        uri:
          gcs.gcsUri,

        sizeBytes:
          gcs.sizeBytes,

      },

      stage: {

        tableId:
          stage.tableId,

        rowsLoaded:
          stage.rowsLoaded,

        durationMs:
          stage.durationMs,

      },

      warehouse: {

        received:
          warehouse.received,

        changed:
          warehouse.changed,

        skipped:
          warehouse.skipped,

        loaded:
          warehouse.loaded,

        rawInserted:
          warehouse.rawInserted,

        durationMs:
          warehouse.durationMs,

      },

      durationMs:
        Date.now()
        -
        startedAt,

    };


  } catch (
    error
  ) {

    const message =
      String(
        error?.message
        ||
        'SHOPIFY_BACKFILL_PROCESS_FAILED'
      );


    // ========================================================
    // Release ONLY if we still own the load state.
    //
    // loading
    //    ↓
    // retry_wait
    // ========================================================

    if (ownsLoadClaim) {

      try {

        await releaseBackfillLoadClaim({

          ...loadStateInput,

          error:
            message,

        });

      } catch (
        releaseError
      ) {

        console.error(
          'SHOPIFY_BACKFILL_PROCESS_RELEASE_FAILED',
          {

            message:
              String(
                releaseError?.message
                ||
                'Unknown load-claim release failure'
              ),

          }
        );

      }

    }


    throw error;

  }

}