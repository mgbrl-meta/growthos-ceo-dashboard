import express from 'express';

import {
  resolveShopifyRuntimeContext,
} from './shopify-context.js';

import {
  fetchOrdersPage,
  fetchCustomersPage,
  fetchEarliestShopifyOrder,
  fetchShopifyOrderById,
} from './shopify-api.js';

import {
  writeShopifyOrders,
} from './shopify-writer.js';

import {
  writeShopifyCustomers,
} from './shopify-customer-writer.js';

import {
  startOrdersBulkOperation,
  startCustomersBulkOperation,
  getBulkOperation,
} from './shopify-bulk.js';

import {
  loadOrdersBulkJsonl,
} from './shopify-bulk-loader.js';

import {
  stageShopifyBulkResult,
} from './shopify-gcs.js';

import {
  buildShopifyStageTableId,
  loadShopifyBulkGcsToStage,
} from './shopify-bq-stage.js';

import {
  analyzeShopifyBulkStage,
  writeShopifyBulkStage,
} from './shopify-bulk-warehouse.js';

import {
  claimBackfillWindow,
  claimBackfillLoad,
  getBackfillWindow,
  markBackfillBulkStarted,
  markBackfillResultReady,
  markBackfillBulkFailed,
  markBackfillLoadCompleted,
  releaseBackfillWindowClaim,
  releaseBackfillLoadClaim,
} from './shopify-backfill-state.js';

import {
  processShopifyBackfillWindow,
} from './shopify-backfill-processor.js';

import {
  superviseShopifyBackfills,
} from './shopify-backfill-supervisor.js';

import {
  superviseShopifyOrdersIncremental,
} from './shopify-incremental-supervisor.js';

import {
  claimShopifyOrdersIncrementalRun,
  completeShopifyOrdersIncrementalRun,
  failShopifyOrdersIncrementalRun,
} from './shopify-incremental-state.js';


// ============================================================
// APP
// ============================================================

const app =
  express();


app.use(
  express.json({
    limit:
      '10mb',
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
// SHOPIFY IDENTITY
// ============================================================

function requireShopifyIdentity(
  input
) {

  return {

    workspaceId:
      requireString(
        input?.workspaceId,
        'SHOPIFY_JOB_WORKSPACE_MISSING'
      ),

    brandId:
      requireString(
        input?.brandId,
        'SHOPIFY_JOB_BRAND_MISSING'
      ),

    connectionId:
      requireString(
        input?.connectionId,
        'SHOPIFY_JOB_CONNECTION_MISSING'
      ),

    integrationAccountId:
      requireString(
        input?.integrationAccountId,
        'SHOPIFY_JOB_ACCOUNT_MISSING'
      ),

    providerAccountId:
      requireString(
        input?.providerAccountId,
        'SHOPIFY_JOB_PROVIDER_ACCOUNT_MISSING'
      ),

  };

}


// ============================================================
// BACKFILL IDENTITY
// ============================================================

function requireBackfillIdentity(
  input
) {

  return {

    workspaceId:
      requireString(
        input?.workspaceId,
        'SHOPIFY_JOB_WORKSPACE_MISSING'
      ),

    brandId:
      requireString(
        input?.brandId,
        'SHOPIFY_JOB_BRAND_MISSING'
      ),

    backfillRunId:
      requireString(
        input?.backfillRunId,
        'SHOPIFY_BACKFILL_RUN_ID_MISSING'
      ),

    backfillWindowId:
      requireString(
        input?.backfillWindowId,
        'SHOPIFY_BACKFILL_WINDOW_ID_MISSING'
      ),

    bulkOperationId:
      requireString(
        input?.bulkOperationId,
        'SHOPIFY_BULK_OPERATION_ID_MISSING'
      ),

  };

}


// ============================================================
// VERIFY WINDOW / BULK OPERATION
// ============================================================

async function verifyBackfillWindow(
  input
) {

  const window =
    await getBackfillWindow({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      backfillRunId:
        input.backfillRunId,

      backfillWindowId:
        input.backfillWindowId,

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
    )
    !==
    input.bulkOperationId
  ) {

    throw new Error(
      'SHOPIFY_BULK_OPERATION_WINDOW_MISMATCH'
    );

  }


  return window;

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
    ) !==
      1
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
      'shopify.order.webhook',
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

        orderId:
      payload.orderId
      ??
      null,

    webhookTopic:
      payload.webhookTopic
      ??
      null,

    webhookId:
      payload.webhookId
      ??
      null,

    shopDomain:
      payload.shopDomain
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
  // REALTIME ORDER WEBHOOK
  // ==========================================================

  if (
    eventType ===
      'shopify.order.webhook'
  ) {

    job.entity =
      'orders';


    job.orderId =
      requireString(
        job.orderId,
        'SHOPIFY_WEBHOOK_ORDER_ID_MISSING'
      );


    if (
      !job.orderId.startsWith(
        'gid://shopify/Order/'
      )
    ) {

      throw new Error(
        'SHOPIFY_WEBHOOK_ORDER_ID_INVALID'
      );

    }


    job.webhookTopic =
      requireString(
        job.webhookTopic,
        'SHOPIFY_WEBHOOK_TOPIC_MISSING'
      );


    const allowedWebhookTopics =
      new Set([

        'orders/create',
        'orders/updated',

      ]);


    if (
      !allowedWebhookTopics.has(
        job.webhookTopic
      )
    ) {

      throw new Error(
        'SHOPIFY_WEBHOOK_TOPIC_INVALID'
      );

    }


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
  // BACKFILL
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

    let incrementalLifecycle =
      null;


    try {

      const message =
        req.body?.message;


      if (!message) {

        throw new Error(
          'PUBSUB_MESSAGE_MISSING'
        );

      }


      const payload =
        decodePubSubData(
          message.data
        );


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

            jobId:
              job.jobId,

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

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
      // REALTIME SHOPIFY ORDER WEBHOOK
      //
      // Webhook message contains only identity.
      //
      // Worker:
      //
      // 1. resolves Secret Manager credential
      // 2. fetches canonical GraphQL Order
      // 3. writes through existing canonical writer
      //
      // Pub/Sub duplicate delivery is safe because the writer
      // hashes/dedupes canonical Order payloads.
      // ======================================================

      if (
        job.eventType ===
          'shopify.order.webhook'
      ) {

        const runtime =
          await resolveShopifyRuntimeContext(
            job
          );


        const fetched =
          await fetchShopifyOrderById(

            runtime,

            job.orderId

          );


        if (
          !fetched.order
        ) {

          throw new Error(
            'SHOPIFY_WEBHOOK_ORDER_NOT_FOUND'
          );

        }


        const warehouse =
          await writeShopifyOrders({

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

            integrationAccountId:
              job.integrationAccountId,

            orders: [

              fetched.order,

            ],

          });


        console.log(
          'SHOPIFY_ORDER_WEBHOOK_COMPLETED',
          {

            pubsubMessageId:
              message.messageId
              ??
              null,

            jobId:
              job.jobId,

            webhookId:
              job.webhookId
              ??
              null,

            webhookTopic:
              job.webhookTopic,

            orderId:
              job.orderId,

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

            integrationAccountId:
              job.integrationAccountId,

            orderUpdatedAt:
              fetched
                .order
                .updatedAt
              ??
              null,

            tokenRefreshed:
              fetched.tokenRefreshed,

            warehouseReceived:
              warehouse.received,

            warehouseChanged:
              warehouse.changed,

            warehouseSkipped:
              warehouse.skipped,

            warehouseLoaded:
              warehouse.loaded,

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
      // CUSTOMERS — MANUAL SYNC
      //
      // Manual Customer jobs are handled here.
      //
      // Historical Customer backfills intentionally fall
      // through to the shared entity-aware backfill path below.
      //
      // Customer incremental / reconciliation are not enabled
      // yet and remain fail-closed by the routing gate below.
      // ======================================================

      if (
        job.entity ===
          'customers'
        &&
        job.syncType ===
          'manual'
      ) {


        // ====================================================
        // RUNTIME / CREDENTIAL
        // ====================================================

        const runtime =
          await resolveShopifyRuntimeContext(
            job
          );


        // ====================================================
        // FETCH LATEST 25 CUSTOMERS
        // ====================================================

        const page =
          await fetchCustomersPage(

            runtime,

            {

              first:
                25,

              after:
                null,

              reverse:
                true,

            }

          );


        // ====================================================
        // CANONICAL WAREHOUSE WRITE
        // ====================================================

        const warehouse =
          await writeShopifyCustomers({

            workspaceId:
              job.workspaceId,

            brandId:
              job.brandId,

            integrationAccountId:
              job.integrationAccountId,

            customers:
              page.customers,

          });


        // ====================================================
        // RESULT
        // ====================================================

        console.log(
          'SHOPIFY_CUSTOMERS_SYNC_COMPLETED',
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

            integrationAccountId:
              job.integrationAccountId,

            entity:
              'customers',

            syncType:
              job.syncType,

            recordsFetched:
              page.customers.length,

            firstCustomerId:
              page.customers[0]
                ?.id
              ??
              null,

            firstCustomerUpdatedAt:
              page.customers[0]
                ?.updatedAt
              ??
              null,

            lastCustomerId:
              page.customers[
                page.customers.length - 1
              ]
                ?.id
              ??
              null,

            lastCustomerUpdatedAt:
              page.customers[
                page.customers.length - 1
              ]
                ?.updatedAt
              ??
              null,

            hasNextPage:
              page.pageInfo.hasNextPage,

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
      // SUPPORTED ROUTING
      //
      // Non-backfill execution:
      //
      // orders
      //   manual
      //   incremental
      //   reconciliation
      //
      // customers
      //   manual is handled above
      //
      // Historical backfill:
      //
      // orders
      // customers
      //
      // All other entity/sync combinations remain fail-closed.
      // ======================================================

      const isSupportedHistoricalBackfill =
        job.syncType ===
          'backfill'
        &&
        (
          job.entity ===
            'orders'
          ||
          job.entity ===
            'customers'
        );


      if (
        job.entity !==
          'orders'
        &&
        !isSupportedHistoricalBackfill
      ) {

        throw new Error(
          'SHOPIFY_ENTITY_NOT_IMPLEMENTED'
        );

      }

      // ======================================================
// INCREMENTAL RUN CLAIM
//
// Supervisor creates:
// state = dispatching
// run   = queued
//
// Worker claims:
// queued -> running
//
// Duplicate Pub/Sub deliveries therefore cannot
// execute the same run twice.
// ======================================================

if (
  job.entity ===
    'orders'
  &&
  job.syncType ===
    'incremental'
) {

  const runClaim =
    await claimShopifyOrdersIncrementalRun({

      runId:
        job.jobId,

      workspaceId:
        job.workspaceId,

      brandId:
        job.brandId,

      connectionId:
        job.connectionId,

    });


  if (
    !runClaim.claimed
  ) {

    console.log(
      'SHOPIFY_INCREMENTAL_RUN_NOT_CLAIMED',
      {

        pubsubMessageId:
          message.messageId
          ??
          null,

        runId:
          job.jobId,

        workspaceId:
          job.workspaceId,

        brandId:
          job.brandId,

        connectionId:
          job.connectionId,

      }
    );


    // Duplicate/already processed message.
    // ACK Pub/Sub.
    return res
      .status(204)
      .end();

  }


  incrementalLifecycle = {

    runId:
      job.jobId,

    workspaceId:
      job.workspaceId,

    brandId:
      job.brandId,

    connectionId:
      job.connectionId,

    windowEnd:
      requireString(
        job.window?.to,
        'SHOPIFY_INCREMENTAL_WINDOW_END_MISSING'
      ),

  };


  console.log(
    'SHOPIFY_INCREMENTAL_RUN_CLAIMED',
    {

      pubsubMessageId:
        message.messageId
        ??
        null,

      runId:
        job.jobId,

      workspaceId:
        job.workspaceId,

      brandId:
        job.brandId,

      connectionId:
        job.connectionId,

      windowEnd:
        incrementalLifecycle.windowEnd,

    }
  );

}


      // ======================================================
      // HISTORICAL BACKFILL START
      // ======================================================

      if (
        job.syncType ===
          'backfill'
      ) {

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


          if (
            claim.bulkOperationId
          ) {

            return res
              .status(204)
              .end();

          }


          throw new Error(
            'SHOPIFY_BACKFILL_WINDOW_ALREADY_CLAIMED'
          );

        }


                let operation;


        let backfillEntity =
          null;


        try {

          // ====================================================
          // AUTHORITATIVE PERSISTED WINDOW
          //
          // Pub/Sub carries routing information, but the
          // persisted Growth OS backfill window is authoritative.
          // ====================================================

          const persistedWindow =
            await getBackfillWindow({

              workspaceId:
                job.workspaceId,

              brandId:
                job.brandId,

              backfillRunId:
                job.backfillRunId,

              backfillWindowId:
                job.backfillWindowId,

            });


          if (!persistedWindow) {

            throw new Error(
              'SHOPIFY_BACKFILL_WINDOW_NOT_FOUND_AFTER_CLAIM'
            );

          }


          backfillEntity =
            requireString(
              persistedWindow.entity,
              'SHOPIFY_BACKFILL_ENTITY_MISSING'
            );


          // ====================================================
          // MESSAGE ↔ PERSISTED STATE INTEGRITY
          // ====================================================

          if (
            job.entity !==
              backfillEntity
          ) {

            throw new Error(
              'SHOPIFY_BACKFILL_ENTITY_MISMATCH'
            );

          }


          // ====================================================
          // ENTITY BULK STARTER
          // ====================================================

          let startBulkOperation =
            null;


          if (
            backfillEntity ===
              'orders'
          ) {

            startBulkOperation =
              startOrdersBulkOperation;

          }


          if (
            backfillEntity ===
              'customers'
          ) {

            startBulkOperation =
              startCustomersBulkOperation;

          }


          if (
            !startBulkOperation
          ) {

            throw new Error(
              'SHOPIFY_BACKFILL_ENTITY_UNSUPPORTED'
            );

          }


          // ====================================================
          // RUNTIME
          // ====================================================

          const runtime =
            await resolveShopifyRuntimeContext(
              job
            );


          // ====================================================
          // START SHOPIFY BULK OPERATION
          // ====================================================

          operation =
            await startBulkOperation(

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

          // ====================================================
          // RELEASE CLAIM
          //
          // Includes:
          //
          // persisted-state mismatch
          // unsupported entity
          // runtime/credential failure
          // Shopify Bulk start failure
          //
          // Window may therefore retry safely.
          // ====================================================

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

            entity:
              backfillEntity,  

            backfillRunId:
              job.backfillRunId,

            backfillWindowId:
              job.backfillWindowId,

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
      // NORMAL / INCREMENTAL / RECONCILIATION ORDERS
      //
      // manual:
      //
      // latest 25 only
      //
      // incremental / reconciliation:
      //
      // bounded UPDATED_AT window
      //      ↓
      // 250 records/page
      //      ↓
      // cursor pagination
      //      ↓
      // exhaust entire window
      //
      // Warehouse writes are idempotent through RAW/STATE.
      // ======================================================

      const runtime =
        await resolveShopifyRuntimeContext(
          job
        );


      const isWindowedSync =
        job.syncType ===
          'incremental'
        ||
        job.syncType ===
          'reconciliation';


      // ======================================================
      // WINDOW VALIDATION
      // ======================================================

      let from =
        null;


      let to =
        null;


      if (
        isWindowedSync
      ) {

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
            'SHOPIFY_INCREMENTAL_WINDOW_MISSING'
          );

        }


        from =
          requireString(
            job.window.from,
            'SHOPIFY_INCREMENTAL_FROM_MISSING'
          );


        to =
          requireString(
            job.window.to,
            'SHOPIFY_INCREMENTAL_TO_MISSING'
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
            'SHOPIFY_INCREMENTAL_WINDOW_INVALID'
          );

        }


        if (
          fromTime >=
            toTime
        ) {

          throw new Error(
            'SHOPIFY_INCREMENTAL_WINDOW_RANGE_INVALID'
          );

        }

      }


      // ======================================================
      // PAGINATION STATE
      // ======================================================

      const pageSize =
        isWindowedSync
          ?
            250
          :
            25;


      const maxPages =
        1000;


      let cursor =
        job.cursor
          ?
            String(
              job.cursor
            ).trim()
          :
            null;


      let pageNumber =
        0;


      let totalFetched =
        0;


      let totalReceived =
        0;


      let totalChanged =
        0;


      let totalSkipped =
        0;


      let totalLoaded =
        0;


      let tokenRefreshed =
        false;


      let firstOrder =
        null;


      let lastOrder =
        null;


      let finalCursor =
        cursor;


      // ======================================================
      // PAGE LOOP
      //
      // Manual:
      // one page only.
      //
      // Incremental / reconciliation:
      // continue until Shopify says hasNextPage = false.
      // ======================================================

      while (
        true
      ) {

        pageNumber +=
          1;


        if (
          pageNumber >
            maxPages
        ) {

          throw new Error(
            'SHOPIFY_INCREMENTAL_PAGE_LIMIT_EXCEEDED'
          );

        }


        const page =
          await fetchOrdersPage(

            runtime,

            {

              first:
                pageSize,

              after:
                cursor,

              from:
                from,

              to:
                to,

              reverse:
                isWindowedSync
                  ?
                    false
                  :
                    true,

            }

          );


        if (
          page.tokenRefreshed
        ) {

          tokenRefreshed =
            true;

        }


        if (
          !firstOrder
          &&
          page.orders.length > 0
        ) {

          firstOrder =
            page.orders[0];

        }


        if (
          page.orders.length > 0
        ) {

          lastOrder =
            page.orders[
              page.orders.length - 1
            ];

        }


        // ====================================================
        // WAREHOUSE WRITE
        // ====================================================

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


        totalFetched +=
          page.orders.length;


        totalReceived +=
          Number(
            warehouse.received
            ??
            0
          );


        totalChanged +=
          Number(
            warehouse.changed
            ??
            0
          );


        totalSkipped +=
          Number(
            warehouse.skipped
            ??
            0
          );


        totalLoaded +=
          Number(
            warehouse.loaded
            ??
            0
          );


        finalCursor =
          page
            .pageInfo
            .endCursor
          ??
          finalCursor;


        // ====================================================
        // PAGE DIAGNOSTIC
        // ====================================================

        console.log(
          'SHOPIFY_ORDERS_INCREMENTAL_PAGE',
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

            integrationAccountId:
              job.integrationAccountId,

            syncType:
              job.syncType,

            pageNumber,

            pageSize,

            from,

            to,

            recordsFetched:
              page.orders.length,

            hasNextPage:
              page.pageInfo.hasNextPage,

            cursorPresent:
              Boolean(
                page.pageInfo.endCursor
              ),

            firstUpdatedAt:
              page.orders[0]
                ?.updatedAt
              ??
              null,

            lastUpdatedAt:
              page.orders[
                page.orders.length - 1
              ]
                ?.updatedAt
              ??
              null,

            warehouseReceived:
              warehouse.received,

            warehouseChanged:
              warehouse.changed,

            warehouseSkipped:
              warehouse.skipped,

            warehouseLoaded:
              warehouse.loaded,

          }
        );


        // ====================================================
        // MANUAL MODE
        //
        // Preserve current behavior:
        // latest page only.
        // ====================================================

        if (
          !isWindowedSync
        ) {

          break;

        }


        // ====================================================
        // WINDOW EXHAUSTED
        // ====================================================

        if (
          !page
            .pageInfo
            .hasNextPage
        ) {

          break;

        }


        // ====================================================
        // CONTINUATION CURSOR REQUIRED
        // ====================================================

        const nextCursor =
          String(
            page
              .pageInfo
              .endCursor
            ??
            ''
          ).trim();


        if (!nextCursor) {

          throw new Error(
            'SHOPIFY_INCREMENTAL_CURSOR_MISSING'
          );

        }


        if (
          nextCursor ===
            cursor
        ) {

          throw new Error(
            'SHOPIFY_INCREMENTAL_CURSOR_NOT_ADVANCING'
          );

        }


        cursor =
          nextCursor;

      }


      // ======================================================
      // COMPLETE SYNC SUMMARY
      // ======================================================

      console.log(
        'SHOPIFY_ORDERS_SYNC_COMPLETED',
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

          integrationAccountId:
            job.integrationAccountId,

          entity:
            'orders',

          syncType:
            job.syncType,

          from,

          to,

          pagesProcessed:
            pageNumber,

          recordsFetched:
            totalFetched,

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

          finalCursorPresent:
            Boolean(
              finalCursor
            ),

          tokenRefreshed,

          warehouseReceived:
            totalReceived,

          warehouseChanged:
            totalChanged,

          warehouseSkipped:
            totalSkipped,

          warehouseLoaded:
            totalLoaded,

          durationMs:
            Date.now()
            -
            startedAt,

        }
      );

      // ======================================================
// COMPLETE INCREMENTAL RUN
//
// Persistent watermark = successful window.to
//
// We deliberately DO NOT save:
// - Shopify pagination cursor
// - last order.updatedAt
// ======================================================

if (
  incrementalLifecycle
) {

  await completeShopifyOrdersIncrementalRun({

    ...incrementalLifecycle,

    recordsFetched:
      totalFetched,

    recordsLoaded:
      totalLoaded,

    recordsRejected:
      0,

  });


  console.log(
    'SHOPIFY_INCREMENTAL_RUN_COMPLETED',
    {

      runId:
        incrementalLifecycle.runId,

      workspaceId:
        incrementalLifecycle.workspaceId,

      brandId:
        incrementalLifecycle.brandId,

      connectionId:
        incrementalLifecycle.connectionId,

      windowEnd:
        incrementalLifecycle.windowEnd,

      recordsFetched:
        totalFetched,

      recordsLoaded:
        totalLoaded,

    }
  );

}


      return res
        .status(204)
        .end();


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Unknown Shopify worker failure'
        );

      if (
  incrementalLifecycle
) {

  try {

    await failShopifyOrdersIncrementalRun({

      ...incrementalLifecycle,

      errorMessage:
        message,

    });


    console.error(
      'SHOPIFY_INCREMENTAL_RUN_FAILED',
      {

        runId:
          incrementalLifecycle.runId,

        workspaceId:
          incrementalLifecycle.workspaceId,

        brandId:
          incrementalLifecycle.brandId,

        connectionId:
          incrementalLifecycle.connectionId,

        error:
          message,

      }
    );


  } catch (
    stateError
  ) {

    console.error(
      'SHOPIFY_INCREMENTAL_FAILURE_STATE_UPDATE_FAILED',
      {

        runId:
          incrementalLifecycle.runId,

        message:
          String(
            stateError?.message
            ||
            'Unknown incremental state update failure'
          ),

      }
    );

  }

}

      console.error(
        'SHOPIFY_WORKER_MESSAGE_FAILED',
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
            'SHOPIFY_WORKER_EXECUTION_FAILED',

        });

    }

  }
);


// ============================================================
// BACKFILL STATUS
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


      const job =
        requireShopifyIdentity(
          input
        );


      const identity =
        requireBackfillIdentity(
          input
        );


      await verifyBackfillWindow(
        identity
      );


      const runtime =
        await resolveShopifyRuntimeContext(
          job
        );


      const operation =
        await getBulkOperation(

          runtime,

          identity.bulkOperationId

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
            identity.workspaceId,

          brandId:
            identity.brandId,

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

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
            identity.workspaceId,

          brandId:
            identity.brandId,

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

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
            identity.workspaceId,

          brandId:
            identity.brandId,

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

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

          completedAt:
            operation.completedAt,

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
// LEGACY JSONL → 250-ROW WRITER
//
// Keep temporarily as fallback / benchmark.
//
// New full-history path uses:
//
// GCS → BigQuery stage → bulk warehouse.
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


      const job =
        requireShopifyIdentity(
          input
        );


      const identity =
        requireBackfillIdentity(
          input
        );


      stateInput = {

        workspaceId:
          identity.workspaceId,

        brandId:
          identity.brandId,

        backfillRunId:
          identity.backfillRunId,

        backfillWindowId:
          identity.backfillWindowId,

        bulkOperationId:
          identity.bulkOperationId,

      };


      const window =
        await verifyBackfillWindow(
          identity
        );


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


      const operation =
        await getBulkOperation(

          runtime,

          identity.bulkOperationId

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

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

          bulkOperationId:
            identity.bulkOperationId,

          ordersReceived:
            load.ordersReceived,

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
// Q3E-6B-2
//
// SHOPIFY SIGNED JSONL → GCS
//
// No BigQuery warehouse changes.
// ============================================================

app.post(
  '/internal/shopify/backfill-stage',

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


      const job =
        requireShopifyIdentity(
          input
        );


      const identity =
        requireBackfillIdentity(
          input
        );


      await verifyBackfillWindow(
        identity
      );


      const runtime =
        await resolveShopifyRuntimeContext(
          job
        );


      const operation =
        await getBulkOperation(

          runtime,

          identity.bulkOperationId

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


      const staged =
        await stageShopifyBulkResult({

          resultUrl:
            operation.url,

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          integrationAccountId:
            job.integrationAccountId,

          entity:
            'orders',

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

          bulkOperationId:
            identity.bulkOperationId,

          expectedFileSize:
            operation.fileSize,

        });


      console.log(
        'SHOPIFY_BACKFILL_GCS_STAGED',
        {

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

          bulkOperationId:
            identity.bulkOperationId,

          reused:
            staged.reused,

          gcsUri:
            staged.gcsUri,

          sizeBytes:
            staged.sizeBytes,

          sizeMatchesExpected:
            staged.sizeMatchesExpected,

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

          staged,

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
          'Unable to stage Shopify Bulk result'
        );


      console.error(
        'SHOPIFY_BACKFILL_GCS_STAGE_FAILED',
        {
          message,
        }
      );


      return res
        .status(500)
        .json({

          ok:
            false,

          error:
            'SHOPIFY_BACKFILL_GCS_STAGE_FAILED',

          message,

        });

    }

  }
);


// ============================================================
// Q3E-6B-3
//
// GCS → LOSSLESS BIGQUERY STAGE
//
// One JSONL line = one payload_raw STRING.
//
// No RAW/STATE changes.
// ============================================================

app.post(
  '/internal/shopify/backfill-stage-load',

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


      const identity =
        requireBackfillIdentity(
          input
        );


      const gcsUri =
        requireString(
          input.gcsUri,
          'SHOPIFY_STAGE_GCS_URI_MISSING'
        );


      await verifyBackfillWindow(
        identity
      );


      const staged =
        await loadShopifyBulkGcsToStage({

          gcsUri,

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

        });


      console.log(
        'SHOPIFY_BACKFILL_BIGQUERY_STAGED',
        {

          workspaceId:
            identity.workspaceId,

          brandId:
            identity.brandId,

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

          table:
            staged.fullyQualifiedTable,

          rowsLoaded:
            staged.rowsLoaded,

          schemaMode:
            staged.schemaMode,

          sourceSizeBytes:
            staged.sourceSizeBytes,

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

          staged,

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
          'Unable to load Shopify staging table'
        );


      console.error(
        'SHOPIFY_BACKFILL_BIGQUERY_STAGE_FAILED',
        {
          message,
        }
      );


      return res
        .status(500)
        .json({

          ok:
            false,

          error:
            'SHOPIFY_BACKFILL_BIGQUERY_STAGE_FAILED',

          message,

        });

    }

  }
);


// ============================================================
// Q3E-6B-4
//
// LOSSLESS STAGE → CANONICAL WAREHOUSE
//
// DEFAULT:
// commit = false
//
// Analysis-only.
//
// Writes require:
// commit = true
//
// IMPORTANT:
//
// Do NOT use commit=true until canonical compatibility test
// shows rawHashMissing = 0 for our existing 18,111-order file.
// ============================================================

app.post(
  '/internal/shopify/backfill-warehouse',

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


      const identity =
        requireBackfillIdentity(
          input
        );


      const window =
        await verifyBackfillWindow(
          identity
        );


      const integrationAccountId =
        requireString(
          window.integration_account_id,
          'SHOPIFY_BACKFILL_INTEGRATION_ACCOUNT_MISSING'
        );


      const stageTableId =
        buildShopifyStageTableId({

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

        });


      const commit =
        input.commit ===
          true;


      const result =
        commit

          ?
            await writeShopifyBulkStage({

              workspaceId:
                identity.workspaceId,

              brandId:
                identity.brandId,

              integrationAccountId,

              stageTableId,

            })

          :
            await analyzeShopifyBulkStage({

              workspaceId:
                identity.workspaceId,

              brandId:
                identity.brandId,

              integrationAccountId,

              stageTableId,

            });


      console.log(
        'SHOPIFY_BACKFILL_WAREHOUSE_RESULT',
        {

          workspaceId:
            identity.workspaceId,

          brandId:
            identity.brandId,

          backfillRunId:
            identity.backfillRunId,

          backfillWindowId:
            identity.backfillWindowId,

          bulkOperationId:
            identity.bulkOperationId,

          commit,

          received:
            result.received,

          rawHashPresent:
            result.rawHashPresent
            ??
            null,

          rawHashMissing:
            result.rawHashMissing
            ??
            null,

          changed:
            result.changed
            ??
            null,

          loaded:
            result.loaded
            ??
            null,

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

          commit,

          result,

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
          'Shopify bulk warehouse failed'
        );


      console.error(
        'SHOPIFY_BACKFILL_WAREHOUSE_FAILED',
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
            'SHOPIFY_BACKFILL_WAREHOUSE_FAILED',

          message,

        });

    }

  }
);

// ============================================================
// Q3E-6C-1
// PROCESS ONE SHOPIFY BACKFILL WINDOW
//
// Caller supplies only Growth OS identity.
//
// Worker resolves:
//
// connection
// integration account
// provider account
// Bulk Operation
//
// from the control plane.
// ============================================================

app.post(
  '/internal/shopify/backfill-process',

  async (
    req,
    res
  ) => {

    const startedAt =
      Date.now();


    try {

      const result =
        await processShopifyBackfillWindow(
          req.body
          ??
          {}
        );


      console.log(
        'SHOPIFY_BACKFILL_PROCESS_RESULT',
        {

          workspaceId:
            req.body?.workspaceId
            ??
            null,

          brandId:
            req.body?.brandId
            ??
            null,

          backfillRunId:
            req.body?.backfillRunId
            ??
            null,

          backfillWindowId:
            req.body?.backfillWindowId
            ??
            null,

          outcome:
            result.outcome,

          status:
            result.status,

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

          result,

        });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Shopify backfill processor failed'
        );


      console.error(
        'SHOPIFY_BACKFILL_PROCESS_FAILED',
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
            'SHOPIFY_BACKFILL_PROCESS_FAILED',

          message,

        });

    }

  }
);

// ============================================================
// Q3E-6C-2
// AUTOMATIC SHOPIFY BACKFILL SUPERVISOR
//
// Intended caller:
// Google Cloud Scheduler with OIDC.
//
// No browser/session identity is required.
//
// Execution is derived entirely from the persisted control
// plane.
// ============================================================

app.post(
  '/internal/shopify/backfill-supervise',

  async (
    _req,
    res
  ) => {

    const startedAt =
      Date.now();


    try {

      const result =
        await superviseShopifyBackfills();


      console.log(
        'SHOPIFY_BACKFILL_SUPERVISOR_RESULT',
        {

          staleDispatchesRecovered:
            result.staleDispatchesRecovered,

          processedCount:
            result.processedCount,

          dispatchedCount:
            result.dispatchedCount,

          durationMs:
            result.durationMs,

        }
      );


      return res
        .status(200)
        .json({

          ok:
            true,

          result,

        });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Shopify backfill supervisor failed'
        );


      console.error(
        'SHOPIFY_BACKFILL_SUPERVISOR_FAILED',
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
            'SHOPIFY_BACKFILL_SUPERVISOR_FAILED',

          message,

        });

    }

  }
);


// ============================================================
// AUTOMATIC SHOPIFY ORDERS INCREMENTAL SUPERVISOR
//
// Intended caller:
//
// Google Cloud Scheduler
//        ↓
// OIDC authenticated POST
//
// No workspace / brand is supplied.
//
// The supervisor discovers every eligible Shopify connection
// from the Growth OS control plane.
// ============================================================

app.post(
  '/internal/shopify/incremental-supervise',

  async (
    _req,
    res
  ) => {

    const startedAt =
      Date.now();


    try {

      const result =
        await superviseShopifyOrdersIncremental();


      console.log(
        'SHOPIFY_INCREMENTAL_SUPERVISOR_RESULT',
        {

          runsRecovered:
            result.recovery
              ?.runsRecovered
            ??
            0,

          statesRecovered:
            result.recovery
              ?.statesRecovered
            ??
            0,

          discoveredCount:
            result.discoveredCount,

          dispatchedCount:
            result.dispatchedCount,

          skippedCount:
            result.skippedCount,

          failedCount:
            result.failedCount,

          durationMs:
            result.durationMs,

        }
      );


      return res
        .status(200)
        .json({

          ok:
            true,

          result,

        });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Shopify incremental supervisor failed'
        );


      console.error(
        'SHOPIFY_INCREMENTAL_SUPERVISOR_FAILED',
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
            'SHOPIFY_INCREMENTAL_SUPERVISOR_FAILED',

          message,

        });

    }

  }
);

// ============================================================
// Q3E-6D-2
// EARLIEST SHOPIFY ORDER PROBE
//
// Read-only.
//
// Used by onboarding/history bootstrap to determine the actual
// beginning of Shopify Orders history.
//
// No warehouse writes.
// No Bulk Operation.
// No backfill state mutation.
// ============================================================

app.post(
  '/internal/shopify/earliest-order',

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


      // ======================================================
      // EXISTING AUTHORITATIVE RUNTIME RESOLUTION
      // ======================================================

      const runtime =
        await resolveShopifyRuntimeContext(
          job
        );


      // ======================================================
      // SHOPIFY SOURCE PROBE
      // ======================================================

      const result =
        await fetchEarliestShopifyOrder(
          runtime
        );


      const order =
        result.order;


      console.log(
        'SHOPIFY_EARLIEST_ORDER_RESOLVED',
        {

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          integrationAccountId:
            job.integrationAccountId,

          providerAccountId:
            job.providerAccountId,

          hasOrders:
            Boolean(
              order
            ),

          orderId:
            order?.id
            ??
            null,

          createdAt:
            order?.createdAt
            ??
            null,

          tokenRefreshed:
            result.tokenRefreshed,

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

          result: {

            hasOrders:
              Boolean(
                order
              ),

            order:
              order
                ?
                  {

                    id:
                      order.id
                      ??
                      null,

                    legacyResourceId:
                      order.legacyResourceId
                      ??
                      null,

                    name:
                      order.name
                      ??
                      null,

                    createdAt:
                      order.createdAt
                      ??
                      null,

                    updatedAt:
                      order.updatedAt
                      ??
                      null,

                  }
                :
                  null,

            tokenRefreshed:
              result.tokenRefreshed,

            durationMs:
              Date.now()
              -
              startedAt,

          },

        });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'Shopify earliest order probe failed'
        );


      console.error(
        'SHOPIFY_EARLIEST_ORDER_FAILED',
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
            'SHOPIFY_EARLIEST_ORDER_FAILED',

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