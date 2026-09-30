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
  writeShopifyOrderLineItemBulkStage,
} from './shopify-order-line-item-bulk-warehouse.js';

import {
  writeShopifyCustomerBulkStage,
} from './shopify-customer-bulk-warehouse.js';

import {
  writeShopifyProductBulkStage,
} from './shopify-product-bulk-warehouse.js';

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
// AUTHORITATIVE BACKFILL ENTITY
//
// Entity comes only from persisted Growth OS backfill state.
//
// Request payload cannot choose the destination warehouse.
// ============================================================

function resolveBackfillEntity(
  window
) {

  const entity =
    requireString(
      window?.entity,
      'SHOPIFY_BACKFILL_PROCESS_ENTITY_MISSING'
    );


  if (
    entity !==
      'orders'
    &&
    entity !==
      'customers'
    &&
    entity !==
      'products'

  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_PROCESS_ENTITY_UNSUPPORTED'
    );

  }


  return entity;

}


// ============================================================
// ENTITY WAREHOUSE ADAPTER
// ============================================================

function getBackfillWarehouseWriter(
  entity
) {

  if (
    entity ===
      'orders'
  ) {

    return writeShopifyBulkStage;

  }


  if (
    entity ===
      'customers'
  ) {

    return writeShopifyCustomerBulkStage;

  }

  if (
    entity ===
      'products'
  ) {

    return writeShopifyProductBulkStage;

  }


  throw new Error(
    'SHOPIFY_BACKFILL_WAREHOUSE_ENTITY_UNSUPPORTED'
  );

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
//    â†“
// status check
//
// result_ready
//    â†“
// conditional loading claim
//
// loading
//    â†“
// another processor owns it
//
// completed
//    â†“
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
  // AUTHORITATIVE ENTITY
  // ==========================================================

  const entity =
    resolveBackfillEntity(
      window
    );


  const warehouseWriter =
    getBackfillWarehouseWriter(
      entity
    );


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

      rootObjectCount:
  operation.rootObjectCount,

totalObjectCount:
  operation.objectCount,

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
  // running â†’ result_ready
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
  //            â†“
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
    // SHOPIFY JSONL â†’ GCS
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

        entity,

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
    // GCS â†’ LOSSLESS BIGQUERY STAGE
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


    // ========================================================
// STAGE COUNT VALIDATION
//
// Customers / Products:
//   JSONL rows = rootObjectCount
//
// Orders V2:
//   JSONL rows = objectCount
//             = Orders + LineItem children
//
// We therefore validate Orders against Shopify's TOTAL
// objectCount while preserving rootObjectCount for the
// canonical Order count.
// ========================================================

if (
  entity ===
    'orders'
) {

  if (
    operation.objectCount !==
      null
    &&
    operation.objectCount !==
      undefined
    &&
    stage.rowsLoaded !==
      Number(
        operation.objectCount
      )
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_STAGE_TOTAL_OBJECT_COUNT_MISMATCH'
    );

  }

} else {

  if (
    operation.rootObjectCount !==
      null
    &&
    operation.rootObjectCount !==
      undefined
    &&
    stage.rowsLoaded !==
      Number(
        operation.rootObjectCount
      )
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_STAGE_ROW_COUNT_MISMATCH'
    );

  }

}


    // ========================================================
    // LOSSLESS STAGE â†’ CANONICAL RAW + STATE
    //
    // CURRENT remains a view.
    // ========================================================

    const warehouse =
  await warehouseWriter({

    workspaceId:
      runtimeJob.workspaceId,

    brandId:
      runtimeJob.brandId,

    integrationAccountId:
      runtimeJob.integrationAccountId,

    stageTableId:
      stage.tableId,

  });


// ========================================================
// ORDERS V2 CHILD WAREHOUSE
//
// ONE Shopify Bulk operation:
//
// Order roots
// +
// LineItem children
//
// Order roots continue through the existing Orders writer.
//
// LineItem children go through the dedicated SET-BASED
// historical writer into the SAME Line Item RAW / STATE /
// CURRENT canonical warehouse used by realtime/incremental.
// ========================================================

let lineItemWarehouse =
  null;


if (
  entity ===
    'orders'
) {

  const classifiedOrderRows =
    Number(
      warehouse
        ?.validation
        ?.orderRows
      ??
      0
    );

  const classifiedLineItemRows =
    Number(
      warehouse
        ?.validation
        ?.lineItemRows
      ??
      0
    );


  // ======================================================
  // ROOT OBJECT CONTRACT
  //
  // Shopify rootObjectCount must equal the number of
  // classified Order roots in the staged JSONL.
  // ======================================================

  if (
    operation.rootObjectCount !==
      null
    &&
    operation.rootObjectCount !==
      undefined
    &&
    classifiedOrderRows !==
      Number(
        operation.rootObjectCount
      )
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_ORDER_ROOT_COUNT_MISMATCH'
    );

  }


  // ======================================================
  // ORDER WRITER CONTRACT
  // ======================================================

  if (
    Number(
      warehouse.received
      ??
      0
    )
    !==
    classifiedOrderRows
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_ORDER_WAREHOUSE_COUNT_MISMATCH'
    );

  }


  // ======================================================
  // LINE ITEM WRITER
  // ======================================================

  lineItemWarehouse =
    await writeShopifyOrderLineItemBulkStage({

      workspaceId:
        runtimeJob.workspaceId,

      brandId:
        runtimeJob.brandId,

      integrationAccountId:
        runtimeJob.integrationAccountId,

      stageTableId:
        stage.tableId,

    });


  // ======================================================
  // CHILD COUNT CONTRACT
  // ======================================================

  if (
    Number(
      lineItemWarehouse.received
      ??
      0
    )
    !==
    classifiedLineItemRows
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_LINE_ITEM_WAREHOUSE_COUNT_MISMATCH'
    );

  }


  // ======================================================
  // COMPLETE SNAPSHOT CONTRACT
  //
  // Every root Order in the Bulk stage must also have an
  // Order snapshot available to the Line Item writer,
  // including Orders containing zero current Line Items.
  // ======================================================

  if (
    Number(
      lineItemWarehouse.orderSnapshots
      ??
      0
    )
    !==
    classifiedOrderRows
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_LINE_ITEM_SNAPSHOT_COUNT_MISMATCH'
    );

  }


  // ======================================================
  // FINAL STAGE CLASSIFICATION CONTRACT
  // ======================================================

  if (
    (
      classifiedOrderRows
      +
      classifiedLineItemRows
    )
    !==
      Number(
        stage.rowsLoaded
        ??
        0
      )
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_CLASSIFIED_STAGE_COUNT_MISMATCH'
    );

  }

} else {

  // ======================================================
  // EXISTING CUSTOMERS / PRODUCTS CONTRACT
  // ======================================================

  if (
    Number(
      warehouse.received
      ??
      0
    )
    !==
      Number(
        stage.rowsLoaded
        ??
        0
      )
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_WAREHOUSE_ROW_COUNT_MISMATCH'
    );

  }

}

    // ========================================================
    // loading â†’ completed
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

         // Backward-compatible root entity count.
  objectCount:
    operation.rootObjectCount,

  rootObjectCount:
    operation.rootObjectCount,

  totalObjectCount:
    operation.objectCount,

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

      lineItems:
  lineItemWarehouse
    ?
      {

        orderSnapshots:
          lineItemWarehouse.orderSnapshots,

        received:
          lineItemWarehouse.received,

        changed:
          lineItemWarehouse.changed,

        skipped:
          lineItemWarehouse.skipped,

        loaded:
          lineItemWarehouse.loaded,

        rawInserted:
          lineItemWarehouse.rawInserted,

        rawAlreadyPresent:
          lineItemWarehouse.rawAlreadyPresent,

        removed:
          lineItemWarehouse.removed,

        durationMs:
          lineItemWarehouse.durationMs,

      }
    :
      null,

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
    //    â†“
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
