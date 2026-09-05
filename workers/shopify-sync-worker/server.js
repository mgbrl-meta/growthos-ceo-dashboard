import express from 'express';

import {
  resolveShopifyRuntimeContext,
} from './shopify-context.js';

import {
  fetchOrdersPage,
} from './shopify-api.js';

import {
  writeShopifyOrders,
} from './shopify-writer.js';

import {
  startOrdersBulkOperation,
  getBulkOperation,
} from './shopify-bulk.js';

import {
  loadOrdersBulkJsonl,
} from './shopify-bulk-loader.js';

import {
  claimBackfillWindow,
  claimBackfillLoad,
  getBackfillWindow,
  markBackfillBulkStarted,
  markBackfillResultReady,
  markBackfillBulkFailed,
  markBackfillLoadCompleted,
  recoverStaleBackfillClaims,
  releaseBackfillWindowClaim,
  releaseBackfillLoadClaim,
} from './shopify-backfill-state.js';


// ============================================================
// APP
// ============================================================

const app =
  express();


app.use(
  express.json({
    limit: '10mb',
  })
);


const PORT =
  Number(
    process.env.PORT
    ||
    8080
  );


// ============================================================
// HEALTH
// ============================================================

app.get(
  '/health',

  (_req, res) => {

    return res
      .status(200)
      .json({

        ok:
          true,

        service:
          'growthos-shopify-sync-worker',

      });

  }
);


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
// DECODE PUB/SUB
// ============================================================

function decodePubSubData(
  encodedData
) {

  const encoded =
    requireString(
      encodedData,
      'PUBSUB_DATA_MISSING'
    );


  try {

    return JSON.parse(

      Buffer
        .from(
          encoded,
          'base64'
        )
        .toString(
          'utf8'
        )

    );

  } catch {

    throw new Error(
      'PUBSUB_DATA_INVALID'
    );

  }

}


// ============================================================
// VALIDATE SHOPIFY JOB
//
// Validation only.
//
// Must NOT:
//
// - query BigQuery
// - call Shopify
// - claim windows
// - write state
// - send HTTP responses
// ============================================================

function validateShopifyMessage(
  payload
) {

  // ==========================================================
  // PAYLOAD
  // ==========================================================

  if (
    !payload
    ||
    typeof payload !==
      'object'
    ||
    Array.isArray(
      payload
    )
  ) {

    throw new Error(
      'SHOPIFY_JOB_INVALID'
    );

  }


  // ==========================================================
  // SCHEMA
  // ==========================================================

  if (
    Number(
      payload.schemaVersion
    ) !== 1
  ) {

    throw new Error(
      'SHOPIFY_JOB_SCHEMA_UNSUPPORTED'
    );

  }


  // ==========================================================
  // PROVIDER
  // ==========================================================

  if (
    payload.provider !==
      'shopify'
  ) {

    throw new Error(
      'SHOPIFY_JOB_PROVIDER_INVALID'
    );

  }


  // ==========================================================
  // EVENT TYPE
  // ==========================================================

  const eventType =
    requireString(
      payload.eventType,
      'SHOPIFY_JOB_EVENT_TYPE_MISSING'
    );


  const allowedEventTypes =
    new Set([
      'shopify.queue.test',
      'shopify.sync.requested',
    ]);


  if (
    !allowedEventTypes.has(
      eventType
    )
  ) {

    throw new Error(
      'SHOPIFY_JOB_EVENT_TYPE_UNSUPPORTED'
    );

  }


  // ==========================================================
  // COMMON JOB
  // ==========================================================

  const job = {

    eventType,

    jobId:
      requireString(
        payload.jobId,
        'SHOPIFY_JOB_ID_MISSING'
      ),

    workspaceId:
      requireString(
        payload.workspaceId,
        'SHOPIFY_JOB_WORKSPACE_MISSING'
      ),

    brandId:
      requireString(
        payload.brandId,
        'SHOPIFY_JOB_BRAND_MISSING'
      ),

    connectionId:
      requireString(
        payload.connectionId,
        'SHOPIFY_JOB_CONNECTION_MISSING'
      ),

    integrationAccountId:
      requireString(
        payload.integrationAccountId,
        'SHOPIFY_JOB_ACCOUNT_MISSING'
      ),

    providerAccountId:
      requireString(
        payload.providerAccountId,
        'SHOPIFY_JOB_PROVIDER_ACCOUNT_MISSING'
      ),

    entity:
      payload.entity
        ?
          String(
            payload.entity
          ).trim()
        :
          null,

    syncType:
      payload.syncType
        ?
          String(
            payload.syncType
          ).trim()
        :
          null,

    requestedAt:
      payload.requestedAt
      ??
      null,

    requestedBy:
      payload.requestedBy
      ??
      null,

    cursor:
      payload.cursor
      ??
      null,

    window:
      payload.window
      ??
      null,

    backfillRunId:
      payload.backfillRunId
      ??
      null,

    backfillWindowId:
      payload.backfillWindowId
      ??
      null,

  };


  // ==========================================================
  // CREDENTIALS MUST NEVER ENTER PUB/SUB
  // ==========================================================

  const forbiddenKeys = [

    'accessToken',
    'access_token',

    'refreshToken',
    'refresh_token',

    'clientSecret',
    'client_secret',

    'privateKey',
    'private_key',

    'SHOPIFY_CLIENT_SECRET',
    'GCP_PRIVATE_KEY',

  ];


  for (
    const key
    of forbiddenKeys
  ) {

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          payload,
          key
        )
    ) {

      throw new Error(
        'SHOPIFY_JOB_CONTAINS_FORBIDDEN_CREDENTIAL'
      );

    }

  }


  // ==========================================================
  // QUEUE TEST
  // ==========================================================

  if (
    eventType ===
      'shopify.queue.test'
  ) {

    return job;

  }


  // ==========================================================
  // ENTITY
  // ==========================================================

  const allowedEntities =
    new Set([

      'orders',
      'customers',
      'products',
      'order_transactions',

    ]);


  if (
    !job.entity
    ||
    !allowedEntities.has(
      job.entity
    )
  ) {

    throw new Error(
      'SHOPIFY_JOB_ENTITY_INVALID'
    );

  }


  // ==========================================================
  // SYNC TYPE
  // ==========================================================

  const allowedSyncTypes =
    new Set([

      'manual',
      'backfill',
      'incremental',
      'reconciliation',

    ]);


  if (
    !job.syncType
    ||
    !allowedSyncTypes.has(
      job.syncType
    )
  ) {

    throw new Error(
      'SHOPIFY_JOB_SYNC_TYPE_INVALID'
    );

  }


  // ==========================================================
  // BACKFILL VALIDATION
  // ==========================================================

  if (
    job.syncType ===
      'backfill'
  ) {

    job.backfillRunId =
      requireString(
        job.backfillRunId,
        'SHOPIFY_BACKFILL_RUN_ID_MISSING'
      );


    job.backfillWindowId =
      requireString(
        job.backfillWindowId,
        'SHOPIFY_BACKFILL_WINDOW_ID_MISSING'
      );


    if (
      !job.window
      ||
      typeof job.window !==
        'object'
      ||
      Array.isArray(
        job.window
      )
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_WINDOW_MISSING'
      );

    }


    const from =
      requireString(
        job.window.from,
        'SHOPIFY_BACKFILL_FROM_MISSING'
      );


    const to =
      requireString(
        job.window.to,
        'SHOPIFY_BACKFILL_TO_MISSING'
      );


    const fromTime =
      Date.parse(
        from
      );


    const toTime =
      Date.parse(
        to
      );


    if (
      Number.isNaN(
        fromTime
      )
      ||
      Number.isNaN(
        toTime
      )
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_DATE_INVALID'
      );

    }


    if (
      fromTime >=
        toTime
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_RANGE_INVALID'
      );

    }


    job.window = {

      from:
        new Date(
          fromTime
        ).toISOString(),

      to:
        new Date(
          toTime
        ).toISOString(),

    };

  }


  return job;

}


// ============================================================
// PUB/SUB SHOPIFY WORKER
// ============================================================

app.post(
  '/pubsub/shopify-sync',

  async (
    req,
    res
  ) => {

    const startedAt =
      Date.now();


    try {

      // ======================================================
      // PUB/SUB ENVELOPE
      // ======================================================

      const message =
        req.body?.message;


      if (!message) {

        throw new Error(
          'PUBSUB_MESSAGE_MISSING'
        );

      }


      // ======================================================
      // DECODE
      // ======================================================

      const payload =
        decodePubSubData(
          message.data
        );


      // ======================================================
      // VALIDATE
      // ======================================================

      const job =
        validateShopifyMessage(
          payload
        );


      // ======================================================
      // QUEUE TEST
      // ======================================================

      if (
        job.eventType ===
          'shopify.queue.test'
      ) {

        console.log(
          'SHOPIFY_WORKER_MESSAGE_RECEIVED',
          {

            pubsubMessageId:
              message.messageId
              ??
              null,

            eventType:
              job.eventType,

            jobId:
              job.jobId,

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

            connectionId:
              job.connectionId,

            integrationAccountId:
              job.integrationAccountId,

            providerAccountId:
              job.providerAccountId,

            durationMs:
              Date.now()
              -
              startedAt,

          }
        );


        return res
          .status(204)
          .end();

      }


      // ======================================================
      // CURRENTLY ORDERS ONLY
      // ======================================================

      if (
        job.entity !==
          'orders'
      ) {

        throw new Error(
          'SHOPIFY_ENTITY_NOT_IMPLEMENTED'
        );

      }


      // ======================================================
      // HISTORICAL BACKFILL
      // ======================================================

      if (
        job.syncType ===
          'backfill'
      ) {

        // ====================================================
        // CLAIM WINDOW
        // ====================================================

        const claim =
          await claimBackfillWindow({

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

            backfillRunId:
              job.backfillRunId,

            backfillWindowId:
              job.backfillWindowId,

          });


        // ====================================================
        // REDELIVERY / ALREADY CLAIMED
        // ====================================================

        if (
          !claim.claimed
        ) {

          console.log(
            'SHOPIFY_BACKFILL_WINDOW_NOT_CLAIMED',
            {

              pubsubMessageId:
                message.messageId
                ??
                null,

              jobId:
                job.jobId,

              workspaceId:
                job.workspaceId,

              brandId:
                job.brandId,

              backfillRunId:
                job.backfillRunId,

              backfillWindowId:
                job.backfillWindowId,

              status:
                claim.status
                ??
                null,

              bulkOperationIdPresent:
                Boolean(
                  claim.bulkOperationId
                ),

            }
          );


          // ==================================================
          // BULK OPERATION ALREADY EXISTS
          //
          // Normal Pub/Sub redelivery.
          //
          // The operation identity is already persisted, so
          // another delivery must NOT start Shopify again.
          // ==================================================

          if (
            claim.bulkOperationId
          ) {

            console.log(
              'SHOPIFY_BACKFILL_REDELIVERY_ACKNOWLEDGED',
              {

                jobId:
                  job.jobId,

                backfillRunId:
                  job.backfillRunId,

                backfillWindowId:
                  job.backfillWindowId,

                status:
                  claim.status
                  ??
                  null,

              }
            );


            return res
              .status(204)
              .end();

          }


          // ==================================================
          // STARTING WITHOUT BULK OPERATION ID
          //
          // IMPORTANT:
          //
          // Previously this threw:
          //
          // SHOPIFY_BACKFILL_WINDOW_ALREADY_CLAIMED
          //
          // which returned HTTP 500 and caused Pub/Sub to retry
          // forever.
          //
          // We now ACK the duplicate message.
          //
          // A separate recovery process decides whether the
          // stale claim should become retry_wait.
          // ==================================================

          if (
            claim.status ===
              'starting'
          ) {

            console.log(
              'SHOPIFY_BACKFILL_STARTING_ACKNOWLEDGED',
              {

                pubsubMessageId:
                  message.messageId
                  ??
                  null,

                jobId:
                  job.jobId,

                workspaceId:
                  job.workspaceId,

                brandId:
                  job.brandId,

                backfillRunId:
                  job.backfillRunId,

                backfillWindowId:
                  job.backfillWindowId,

              }
            );


            return res
              .status(204)
              .end();

          }


          // ==================================================
          // OTHER NON-RUNNABLE STATE
          //
          // Duplicate Pub/Sub delivery should not become a
          // poison retry loop.
          // ==================================================

          console.log(
            'SHOPIFY_BACKFILL_DELIVERY_IGNORED',
            {

              pubsubMessageId:
                message.messageId
                ??
                null,

              jobId:
                job.jobId,

              workspaceId:
                job.workspaceId,

              brandId:
                job.brandId,

              backfillRunId:
                job.backfillRunId,

              backfillWindowId:
                job.backfillWindowId,

              status:
                claim.status
                ??
                null,

            }
          );


          return res
            .status(204)
            .end();

        }


        // ====================================================
        // SECURE SHOPIFY CONTEXT
        // ====================================================

        const runtime =
          await resolveShopifyRuntimeContext(
            job
          );


        let operation;


        // ====================================================
        // START SHOPIFY BULK OPERATION
        // ====================================================

        try {

          operation =
            await startOrdersBulkOperation(

              runtime,

              {

                from:
                  job.window.from,

                to:
                  job.window.to,

              }

            );

        } catch (
          error
        ) {

          // ==================================================
          // SHOPIFY OPERATION DID NOT START
          //
          // Release the claim so a future job may retry.
          // ==================================================

          await releaseBackfillWindowClaim({

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

            backfillRunId:
              job.backfillRunId,

            backfillWindowId:
              job.backfillWindowId,

            error:
              error?.message
              ??
              'SHOPIFY_BULK_START_FAILED',

          });


          throw error;

        }


        // ====================================================
        // RECORD BULK OPERATION
        // ====================================================

        await markBackfillBulkStarted({

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          backfillRunId:
            job.backfillRunId,

          backfillWindowId:
            job.backfillWindowId,

          bulkOperationId:
            operation.id,

          bulkOperationStatus:
            operation.status,

        });


        // ====================================================
        // SAFE LOG
        // ====================================================

        console.log(
          'SHOPIFY_BULK_OPERATION_STARTED',
          {

            pubsubMessageId:
              message.messageId
              ??
              null,

            jobId:
              job.jobId,

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

            connectionId:
              job.connectionId,

            integrationAccountId:
              job.integrationAccountId,

            providerAccountId:
              job.providerAccountId,

            entity:
              job.entity,

            syncType:
              job.syncType,

            backfillRunId:
              job.backfillRunId,

            backfillWindowId:
              job.backfillWindowId,

            windowFrom:
              job.window.from,

            windowTo:
              job.window.to,

            bulkOperationId:
              operation.id,

            bulkOperationStatus:
              operation.status,

            tokenRefreshed:
              operation.tokenRefreshed,

            durationMs:
              Date.now()
              -
              startedAt,

          }
        );


        return res
          .status(204)
          .end();

      }


      // ======================================================
      // MANUAL / NORMAL ORDERS
      // ======================================================

      const runtime =
        await resolveShopifyRuntimeContext(
          job
        );


      const page =
        await fetchOrdersPage(

          runtime,

          {

            first:
              25,

          }

        );


      const warehouse =
        await writeShopifyOrders({

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          integrationAccountId:
            job.integrationAccountId,

          orders:
            page.orders,

        });


      const firstOrder =
        page.orders[0]
        ??
        null;


      const lastOrder =
        page.orders[
          page.orders.length - 1
        ]
        ??
        null;


      console.log(
        'SHOPIFY_ORDERS_PAGE_FETCHED',
        {

          pubsubMessageId:
            message.messageId
            ??
            null,

          jobId:
            job.jobId,

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          connectionId:
            job.connectionId,

          integrationAccountId:
            job.integrationAccountId,

          providerAccountId:
            job.providerAccountId,

          entity:
            'orders',

          syncType:
            job.syncType,

          recordsFetched:
            page.orders.length,

          hasNextPage:
            page
              .pageInfo
              .hasNextPage,

          cursorPresent:
            Boolean(
              page
                .pageInfo
                .endCursor
            ),

          firstOrderId:
            firstOrder?.id
            ??
            null,

          firstOrderUpdatedAt:
            firstOrder?.updatedAt
            ??
            null,

          lastOrderId:
            lastOrder?.id
            ??
            null,

          lastOrderUpdatedAt:
            lastOrder?.updatedAt
            ??
            null,

          tokenRefreshed:
            page.tokenRefreshed,

          warehouseReceived:
            warehouse.received,

          warehouseChanged:
            warehouse.changed,

          warehouseSkipped:
            warehouse.skipped,

          warehouseLoaded:
            warehouse.loaded,

          warehouseBatchId:
            warehouse.batchId,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(204)
        .end();


    } catch (
      error
    ) {

      const errorMessage =
        String(
          error?.message
          ||
          'Unknown Shopify worker failure'
        );


      console.error(
        'SHOPIFY_WORKER_MESSAGE_FAILED',
        {

          message:
            errorMessage,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(500)
        .json({

          ok:
            false,

          error:
            'SHOPIFY_WORKER_EXECUTION_FAILED',

        });

    }

  }
);


// ============================================================
// Q3E-3
// BACKFILL BULK OPERATION STATUS
// ============================================================

app.post(
  '/internal/shopify/backfill-status',

  async (
    req,
    res
  ) => {

    const startedAt =
      Date.now();


    try {

      const input =
        req.body
        ??
        {};


      const job = {

        workspaceId:
          requireString(
            input.workspaceId,
            'SHOPIFY_JOB_WORKSPACE_MISSING'
          ),

        brandId:
          requireString(
            input.brandId,
            'SHOPIFY_JOB_BRAND_MISSING'
          ),

        connectionId:
          requireString(
            input.connectionId,
            'SHOPIFY_JOB_CONNECTION_MISSING'
          ),

        integrationAccountId:
          requireString(
            input.integrationAccountId,
            'SHOPIFY_JOB_ACCOUNT_MISSING'
          ),

        providerAccountId:
          requireString(
            input.providerAccountId,
            'SHOPIFY_JOB_PROVIDER_ACCOUNT_MISSING'
          ),

      };


      const backfillRunId =
        requireString(
          input.backfillRunId,
          'SHOPIFY_BACKFILL_RUN_ID_MISSING'
        );


      const backfillWindowId =
        requireString(
          input.backfillWindowId,
          'SHOPIFY_BACKFILL_WINDOW_ID_MISSING'
        );


      const bulkOperationId =
        requireString(
          input.bulkOperationId,
          'SHOPIFY_BULK_OPERATION_ID_MISSING'
        );


      const window =
        await getBackfillWindow({

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          backfillRunId,

          backfillWindowId,

        });


      if (!window) {

        throw new Error(
          'SHOPIFY_BACKFILL_WINDOW_NOT_FOUND'
        );

      }


      if (
        String(
          window.bulk_operation_id
          ??
          ''
        ) !==
        bulkOperationId
      ) {

        throw new Error(
          'SHOPIFY_BULK_OPERATION_WINDOW_MISMATCH'
        );

      }


      const runtime =
        await resolveShopifyRuntimeContext(
          job
        );


      const operation =
        await getBulkOperation(

          runtime,

          bulkOperationId

        );


      // ======================================================
      // COMPLETED
      // ======================================================

      if (
        operation.status ===
          'COMPLETED'
      ) {

        if (!operation.url) {

          throw new Error(
            'SHOPIFY_BULK_RESULT_URL_MISSING'
          );

        }


        await markBackfillResultReady({

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          backfillRunId,

          backfillWindowId,

          bulkOperationId:
            operation.id,

          bulkOperationStatus:
            operation.status,

          objectCount:
            operation.rootObjectCount,

          fileSize:
            operation.fileSize,

        });

      }


      // ======================================================
      // TERMINAL FAILURE
      // ======================================================

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

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          backfillRunId,

          backfillWindowId,

          bulkOperationId:
            operation.id,

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

      }


      console.log(
        'SHOPIFY_BACKFILL_STATUS_RESOLVED',
        {

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          backfillRunId,

          backfillWindowId,

          bulkOperationId:
            operation.id,

          status:
            operation.status,

          objectCount:
            operation.objectCount,

          rootObjectCount:
            operation.rootObjectCount,

          fileSize:
            operation.fileSize,

          resultUrlPresent:
            Boolean(
              operation.url
            ),

          partialDataUrlPresent:
            Boolean(
              operation.partialDataUrl
            ),

          completedAt:
            operation.completedAt,

          tokenRefreshed:
            operation.tokenRefreshed,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(200)
        .json({

          ok:
            true,

          operation: {

            id:
              operation.id,

            status:
              operation.status,

            errorCode:
              operation.errorCode
              ??
              null,

            objectCount:
              operation.objectCount,

            rootObjectCount:
              operation.rootObjectCount,

            fileSize:
              operation.fileSize,

            resultUrlPresent:
              Boolean(
                operation.url
              ),

            partialDataUrlPresent:
              Boolean(
                operation.partialDataUrl
              ),

            createdAt:
              operation.createdAt,

            completedAt:
              operation.completedAt,

          },

          durationMs:
            Date.now()
            -
            startedAt,

        });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Shopify backfill status failed'
        );


      console.error(
        'SHOPIFY_BACKFILL_STATUS_FAILED',
        {

          message,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(500)
        .json({

          ok:
            false,

          error:
            'SHOPIFY_BACKFILL_STATUS_FAILED',

          message,

        });

    }

  }
);


// ============================================================
// Q3E-4
// LOAD SHOPIFY BULK JSONL
// ============================================================

app.post(
  '/internal/shopify/backfill-load',

  async (
    req,
    res
  ) => {

    const startedAt =
      Date.now();


    let claimed =
      false;


    let stateInput =
      null;


    try {

      const input =
        req.body
        ??
        {};


      const job = {

        workspaceId:
          requireString(
            input.workspaceId,
            'SHOPIFY_JOB_WORKSPACE_MISSING'
          ),

        brandId:
          requireString(
            input.brandId,
            'SHOPIFY_JOB_BRAND_MISSING'
          ),

        connectionId:
          requireString(
            input.connectionId,
            'SHOPIFY_JOB_CONNECTION_MISSING'
          ),

        integrationAccountId:
          requireString(
            input.integrationAccountId,
            'SHOPIFY_JOB_ACCOUNT_MISSING'
          ),

        providerAccountId:
          requireString(
            input.providerAccountId,
            'SHOPIFY_JOB_PROVIDER_ACCOUNT_MISSING'
          ),

      };


      const backfillRunId =
        requireString(
          input.backfillRunId,
          'SHOPIFY_BACKFILL_RUN_ID_MISSING'
        );


      const backfillWindowId =
        requireString(
          input.backfillWindowId,
          'SHOPIFY_BACKFILL_WINDOW_ID_MISSING'
        );


      const bulkOperationId =
        requireString(
          input.bulkOperationId,
          'SHOPIFY_BULK_OPERATION_ID_MISSING'
        );


      stateInput = {

        workspaceId:
          job.workspaceId,

        brandId:
          job.brandId,

        backfillRunId,

        backfillWindowId,

        bulkOperationId,

      };


      const window =
        await getBackfillWindow(
          stateInput
        );


      if (!window) {

        throw new Error(
          'SHOPIFY_BACKFILL_WINDOW_NOT_FOUND'
        );

      }


      if (
        String(
          window.bulk_operation_id
          ??
          ''
        ) !==
        bulkOperationId
      ) {

        throw new Error(
          'SHOPIFY_BULK_OPERATION_WINDOW_MISMATCH'
        );

      }


      // ======================================================
      // IDEMPOTENT COMPLETED CALL
      // ======================================================

      if (
        window.status ===
          'completed'
      ) {

        return res
          .status(200)
          .json({

            ok:
              true,

            alreadyCompleted:
              true,

          });

      }


      const runtime =
        await resolveShopifyRuntimeContext(
          job
        );


      // ======================================================
      // GET FRESH SIGNED RESULT URL
      // ======================================================

      const operation =
        await getBulkOperation(

          runtime,

          bulkOperationId

        );


      if (
        operation.status !==
          'COMPLETED'
      ) {

        throw new Error(
          `SHOPIFY_BULK_NOT_READY_${operation.status}`
        );

      }


      if (!operation.url) {

        throw new Error(
          'SHOPIFY_BULK_RESULT_URL_MISSING'
        );

      }


      // ======================================================
      // CLAIM LOAD
      // ======================================================

      const loadClaim =
        await claimBackfillLoad(
          stateInput
        );


      if (
        !loadClaim.claimed
      ) {

        if (
          loadClaim.status ===
            'completed'
        ) {

          return res
            .status(200)
            .json({

              ok:
                true,

              alreadyCompleted:
                true,

            });

        }


        throw new Error(
          `SHOPIFY_BACKFILL_LOAD_NOT_CLAIMED_${loadClaim.status}`
        );

      }


      claimed =
        true;


      // ======================================================
      // STREAM JSONL
      // ======================================================

      const load =
        await loadOrdersBulkJsonl({

          resultUrl:
            operation.url,

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          integrationAccountId:
            job.integrationAccountId,

          expectedRootObjectCount:
            operation.rootObjectCount,

          batchSize:
            250,

        });


      // ======================================================
      // MARK COMPLETE
      // ======================================================

      await markBackfillLoadCompleted({

        ...stateInput,

        recordsReceived:
          load.ordersReceived,

        recordsLoaded:
          load.loaded,

        recordsSkipped:
          load.skipped,

      });


      claimed =
        false;


      console.log(
        'SHOPIFY_BACKFILL_JSONL_LOADED',
        {

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          backfillRunId,

          backfillWindowId,

          bulkOperationId,

          linesReceived:
            load.linesReceived,

          ordersReceived:
            load.ordersReceived,

          ignoredLines:
            load.ignoredLines,

          batches:
            load.batches,

          batchSize:
            load.batchSize,

          warehouseChanged:
            load.changed,

          warehouseLoaded:
            load.loaded,

          warehouseSkipped:
            load.skipped,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(200)
        .json({

          ok:
            true,

          load: {

            ordersReceived:
              load.ordersReceived,

            changed:
              load.changed,

            loaded:
              load.loaded,

            skipped:
              load.skipped,

            batches:
              load.batches,

          },

          durationMs:
            Date.now()
            -
            startedAt,

        });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Shopify Bulk JSONL load failed'
        );


      if (
        claimed
        &&
        stateInput
      ) {

        try {

          await releaseBackfillLoadClaim({

            ...stateInput,

            error:
              message,

          });

        } catch (
          stateError
        ) {

          console.error(
            'SHOPIFY_BACKFILL_LOAD_RELEASE_FAILED',
            {

              message:
                String(
                  stateError?.message
                  ||
                  'Unknown state release failure'
                ),

            }
          );

        }

      }


      console.error(
        'SHOPIFY_BACKFILL_JSONL_LOAD_FAILED',
        {

          message,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(500)
        .json({

          ok:
            false,

          error:
            'SHOPIFY_BACKFILL_JSONL_LOAD_FAILED',

          message,

        });

    }

  }
);


// ============================================================
// Q3E-5A
// RECOVER STALE BACKFILL CLAIMS
//
// Temporary private endpoint.
//
// Finds:
//
// status = starting
// bulk_operation_id = NULL
// stale beyond recovery threshold
//
// and converts:
//
// starting
//    ↓
// retry_wait
//
// IMPORTANT:
//
// This endpoint does NOT start Shopify.
// It only repairs operational state.
//
// Q3E-5B will republish retry_wait windows.
// ============================================================

app.post(
  '/internal/shopify/recover-stale-backfills',

  async (
    req,
    res
  ) => {

    const startedAt =
      Date.now();


    try {

      const input =
        req.body
        ??
        {};


      const workspaceId =
        requireString(
          input.workspaceId,
          'SHOPIFY_JOB_WORKSPACE_MISSING'
        );


      const brandId =
        requireString(
          input.brandId,
          'SHOPIFY_JOB_BRAND_MISSING'
        );


      const result =
        await recoverStaleBackfillClaims({

          workspaceId,

          brandId,

        });


      console.log(
        'SHOPIFY_STALE_BACKFILLS_RECOVERED',
        {

          workspaceId,

          brandId,

          recovered:
            result.recovered,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(200)
        .json({

          ok:
            true,

          recovered:
            result.recovered,

          durationMs:
            Date.now()
            -
            startedAt,

        });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Unable to recover stale Shopify backfills'
        );


      console.error(
        'SHOPIFY_STALE_BACKFILL_RECOVERY_FAILED',
        {

          message,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );


      return res
        .status(500)
        .json({

          ok:
            false,

          error:
            'SHOPIFY_STALE_BACKFILL_RECOVERY_FAILED',

          message,

        });

    }

  }
);


// ============================================================
// START
// ============================================================

app.listen(
  PORT,
  '0.0.0.0',

  () => {

    console.log(
      'SHOPIFY_SYNC_WORKER_READY',
      {

        port:
          PORT,

      }
    );

  }
);