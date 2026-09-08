import {
  randomUUID,
} from 'node:crypto';

import {
  BigQuery,
} from '@google-cloud/bigquery';

import {
  PubSub,
} from '@google-cloud/pubsub';

import {
  ensureShopifyOrdersIncrementalState,
  getShopifyOrdersIncrementalState,
  claimShopifyOrdersIncrementalDispatch,
  createShopifyOrdersIncrementalRun,
  releaseShopifyOrdersIncrementalDispatch,
  recoverStaleShopifyOrdersIncrementalClaims,
} from './shopify-incremental-state.js';


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


const RAW_TOPIC_NAME =
  String(
    process.env.GROWTHOS_SHOPIFY_SYNC_TOPIC
    ||
    process.env.SHOPIFY_SYNC_TOPIC
    ||
    ''
  ).trim();


const RECOVERY_OVERLAP_MINUTES =
  15;


const MAX_DISPATCH_PER_TICK =
  10;


const DISCOVERY_LIMIT =
  100;


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_INCREMENTAL_SUPERVISOR_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });


const pubsub =
  new PubSub({

    projectId:
      PROJECT_ID,

  });


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
// TIMESTAMP → ISO
// ============================================================

function timestampToIso(
  value,
  errorCode =
    'SHOPIFY_INCREMENTAL_TIMESTAMP_INVALID'
) {

  const raw =
    value?.value
    ??
    value;


  const timestamp =
    Date.parse(
      String(
        raw
        ??
        ''
      )
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
  ).toISOString();

}


// ============================================================
// PUB/SUB TOPIC
//
// Supports:
//
// growthos-shopify-sync
//
// OR
//
// projects/shopify-colab/topics/growthos-shopify-sync
// ============================================================

function getTopicId() {

  const value =
    requireString(
      RAW_TOPIC_NAME,
      'SHOPIFY_INCREMENTAL_SUPERVISOR_TOPIC_MISSING'
    );


  const match =
    value.match(
      /\/topics\/([^/]+)$/
    );


  return match
    ? match[1]
    : value;

}


// ============================================================
// DISCOVER READY SHOPIFY ACCOUNTS
//
// Eligibility:
//
// provider = shopify
// account selected = true
// setup_status = ready
// connection status = connected
//
// IMPORTANT:
//
// No workspace or brand is hardcoded.
//
// Brillare
// Root Deep
// future Shopify brands
//
// are all discovered from the control plane.
// ============================================================

async function discoverReadyShopifyAccounts() {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          a.workspace_id,

          a.brand_id,

          a.connection_id,

          a.integration_account_id,

          a.provider_account_id,

          a.provider_account_name,

          JSON_VALUE(
            a.metadata,
            '$.setup_completed_at'
          )
            AS setup_completed_at

        FROM
          \`${PROJECT_ID}.${CONTROL_DATASET}.integration_accounts\`
          AS a

        INNER JOIN
          \`${PROJECT_ID}.${CONTROL_DATASET}.integration_connections\`
          AS c

        ON
          c.connection_id =
            a.connection_id

          AND c.workspace_id =
            a.workspace_id

          AND c.brand_id =
            a.brand_id

          AND c.provider =
            a.provider

        WHERE

          a.provider =
            'shopify'

          AND a.is_selected =
            TRUE

          AND JSON_VALUE(
            a.metadata,
            '$.setup_status'
          ) =
            'ready'

          AND c.status =
            'connected'

        ORDER BY

          a.workspace_id,

          a.brand_id,

          a.connection_id

        LIMIT
          @discovery_limit

      `,

      location:
        LOCATION,

      params: {

        discovery_limit:
          DISCOVERY_LIMIT,

      },

      types: {

        discovery_limit:
          'INT64',

      },

    });


  return (
    rows
    ??
    []
  );

}


// ============================================================
// BUILD INCREMENTAL WINDOW
//
// Persistent state:
//
// last_source_timestamp
//        =
// previous successful window.to
//
//
// Recovery:
//
// FROM = watermark - 15 minutes
//
// TO = current timestamp
//
//
// Result:
//
// [from, to)
//
// Duplicate records caused by the overlap are safe because
// the canonical Shopify warehouse uses hashing/state
// idempotency.
// ============================================================

function buildIncrementalWindow(
  watermarkValue
) {

  const watermark =
    timestampToIso(
      watermarkValue,
      'SHOPIFY_INCREMENTAL_WATERMARK_INVALID'
    );


  const watermarkMs =
    Date.parse(
      watermark
    );


  const from =
    new Date(

      watermarkMs

      -

      RECOVERY_OVERLAP_MINUTES
      *
      60
      *
      1000

    ).toISOString();


  const to =
    new Date()
      .toISOString();


  return {

    watermark,

    from,

    to,

  };

}


// ============================================================
// PUBLISH EXISTING SHOPIFY JOB CONTRACT
//
// IMPORTANT:
//
// runId === jobId
//
// This gives us one durable execution identity:
//
// integration_sync_runs
//        ↓
// Pub/Sub
//        ↓
// worker logs
//        ↓
// success / failure state
//
// We are NOT introducing another queue contract.
// ============================================================

async function publishIncrementalJob(
  input
) {

  const job = {

    schemaVersion:
      1,

    eventType:
      'shopify.sync.requested',

    jobId:
      requireString(
        input.runId,
        'SHOPIFY_INCREMENTAL_RUN_ID_MISSING'
      ),

    provider:
      'shopify',

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

    entity:
      'orders',

    syncType:
      'incremental',

    requestedAt:
      new Date()
        .toISOString(),

    requestedBy:
      'shopify_incremental_supervisor',

    window: {

      from:
        timestampToIso(
          input.from,
          'SHOPIFY_INCREMENTAL_FROM_INVALID'
        ),

      to:
        timestampToIso(
          input.to,
          'SHOPIFY_INCREMENTAL_TO_INVALID'
        ),

    },

    cursor:
      null,

    backfillRunId:
      null,

    backfillWindowId:
      null,

  };


  const data =
    Buffer.from(
      JSON.stringify(
        job
      )
    );


  const topicId =
    getTopicId();


  const topic =
    pubsub.topic(
      topicId
    );


  const messageId =
    await topic.publishMessage({

      data,

      attributes: {

        schemaVersion:
          '1',

        provider:
          'shopify',

        eventType:
          job.eventType,

        workspaceId:
          job.workspaceId,

        brandId:
          job.brandId,

        entity:
          job.entity,

        syncType:
          job.syncType,

      },

    });


  return {

    messageId,

    topic:
      topicId,

    job,

  };

}


// ============================================================
// DISPATCH ONE SHOPIFY ACCOUNT
// ============================================================

async function dispatchAccount(
  account
) {

  // ==========================================================
  // IDENTITY
  // ==========================================================

  const workspaceId =
    requireString(
      account.workspace_id,
      'SHOPIFY_INCREMENTAL_WORKSPACE_MISSING'
    );


  const brandId =
    requireString(
      account.brand_id,
      'SHOPIFY_INCREMENTAL_BRAND_MISSING'
    );


  const connectionId =
    requireString(
      account.connection_id,
      'SHOPIFY_INCREMENTAL_CONNECTION_MISSING'
    );


  const integrationAccountId =
    requireString(
      account.integration_account_id,
      'SHOPIFY_INCREMENTAL_ACCOUNT_MISSING'
    );


  const providerAccountId =
    requireString(
      account.provider_account_id,
      'SHOPIFY_INCREMENTAL_PROVIDER_ACCOUNT_MISSING'
    );


  const setupCompletedAt =
    timestampToIso(
      account.setup_completed_at,
      'SHOPIFY_INCREMENTAL_SETUP_COMPLETED_AT_MISSING'
    );


  // ==========================================================
  // ENSURE CONNECTION-SPECIFIC ORDERS STATE
  //
  // First incremental watermark:
  //
  // setup_completed_at
  //
  // Historical data before setup remains the responsibility
  // of the separate historical backfill system.
  // ==========================================================

  await ensureShopifyOrdersIncrementalState({

    workspaceId,

    brandId,

    connectionId,

    initialWatermark:
      setupCompletedAt,

  });


  // ==========================================================
  // READ CURRENT WATERMARK
  // ==========================================================

  const state =
    await getShopifyOrdersIncrementalState({

      workspaceId,

      brandId,

      connectionId,

    });


  if (!state) {

    throw new Error(
      'SHOPIFY_INCREMENTAL_STATE_NOT_FOUND'
    );

  }


  if (
    !state.last_source_timestamp
  ) {

    throw new Error(
      'SHOPIFY_INCREMENTAL_WATERMARK_MISSING'
    );

  }


  // ==========================================================
  // CALCULATE [FROM, TO)
  // ==========================================================

  const window =
    buildIncrementalWindow(
      state.last_source_timestamp
    );


  // ==========================================================
  // FUTURE WATERMARK / INVALID CLOCK PROTECTION
  // ==========================================================

  if (
    Date.parse(
      window.from
    )
    >=
    Date.parse(
      window.to
    )
  ) {

    return {

      ok:
        true,

      dispatched:
        false,

      reason:
        'WINDOW_NOT_DUE',

      workspaceId,

      brandId,

      connectionId,

      integrationAccountId,

      watermark:
        window.watermark,

      from:
        window.from,

      to:
        window.to,

    };

  }


  // ==========================================================
  // ATOMIC STORE CLAIM
  //
  // Prevents two scheduler/supervisor invocations from both
  // dispatching Orders for the same Shopify connection.
  // ==========================================================

  const claim =
    await claimShopifyOrdersIncrementalDispatch({

      workspaceId,

      brandId,

      connectionId,

    });


  const claimed =

    claim ===
      true

    ||

    claim ===
      1

    ||

    claim?.claimed ===
      true

    ||

    claim?.reserved ===
      true

    ||

    Number(
      claim?.affectedRows
      ??
      0
    ) ===
      1;


  if (!claimed) {

    return {

      ok:
        true,

      dispatched:
        false,

      reason:
        'NOT_CLAIMED',

      workspaceId,

      brandId,

      connectionId,

      integrationAccountId,

    };

  }


  // ==========================================================
  // ONE EXECUTION ID
  //
  // Same ID becomes:
  //
  // integration_sync_runs.run_id
  // Pub/Sub jobId
  // worker execution identity
  // ==========================================================

  const runId =
    randomUUID();


  try {

    // ========================================================
    // CREATE DURABLE RUN BEFORE PUBLISHING
    //
    // State:
    //
    // incremental state = dispatching
    //
    // integration_sync_runs = queued
    // ========================================================

    await createShopifyOrdersIncrementalRun({

      runId,

      workspaceId,

      brandId,

      connectionId,

      from:
        window.from,

      to:
        window.to,

    });


    // ========================================================
    // PUBLISH EXISTING SHOPIFY JOB
    // ========================================================

    const published =
      await publishIncrementalJob({

        runId,

        workspaceId,

        brandId,

        connectionId,

        integrationAccountId,

        providerAccountId,

        from:
          window.from,

        to:
          window.to,

      });


    return {

      ok:
        true,

      dispatched:
        true,

      runId,

      jobId:
        published
          .job
          .jobId,

      messageId:
        published
          .messageId,

      topic:
        published
          .topic,

      workspaceId,

      brandId,

      connectionId,

      integrationAccountId,

      providerAccountId,

      watermark:
        window.watermark,

      from:
        window.from,

      to:
        window.to,

    };


  } catch (
    error
  ) {

    const message =
      String(
        error?.message
        ||
        'SHOPIFY_INCREMENTAL_DISPATCH_FAILED'
      );


    // ========================================================
    // RELEASE CLAIM
    //
    // If run creation or Pub/Sub publishing fails:
    //
    // queued/running run → failed
    // state              → failed
    // watermark          → unchanged
    // retry              → later
    // ========================================================

    try {

      await releaseShopifyOrdersIncrementalDispatch({

        runId,

        workspaceId,

        brandId,

        connectionId,

        errorMessage:
          message,

      });

    } catch (
      releaseError
    ) {

      console.error(
        'SHOPIFY_INCREMENTAL_SUPERVISOR_RELEASE_FAILED',
        {

          runId,

          workspaceId,

          brandId,

          connectionId,

          message:
            String(
              releaseError?.message
              ||
              'Unknown release failure'
            ),

        }
      );

    }


    throw error;

  }

}


// ============================================================
// SUPERVISE SHOPIFY ORDERS INCREMENTAL
//
// One invocation:
//
// 1. discover READY Shopify accounts
//
// 2. ensure per-connection Orders state
//
// 3. read persistent watermark
//
// 4. calculate:
//
//      watermark - 15 minutes
//             ↓
//            FROM
//
//      current time
//             ↓
//             TO
//
// 5. atomically claim account
//
// 6. create integration_sync_run
//
// 7. publish existing Shopify Pub/Sub job
//
// The worker-side:
//
// queued → running
// success → watermark advance
// failure → retain watermark
//
// wiring comes in the NEXT step.
// ============================================================

export async function superviseShopifyOrdersIncremental() {

  const startedAt =
    Date.now();
  
   // ==========================================================
  // RECOVER ABANDONED EXECUTIONS FIRST
  // ==========================================================

  const recovery =
    await recoverStaleShopifyOrdersIncrementalClaims();


  // ==========================================================
  // THEN DISCOVER ALL READY SHOPIFY STORES
  // ==========================================================  

  const accounts =
    await discoverReadyShopifyAccounts();


  const results = [];


  let dispatchedCount =
    0;


  for (
    const account
    of accounts
  ) {

    // ========================================================
    // CAP ACTUAL DISPATCHES
    //
    // We discover more than we dispatch so busy accounts at
    // the start of the list cannot starve later brands.
    // ========================================================

    if (
      dispatchedCount
      >=
      MAX_DISPATCH_PER_TICK
    ) {

      break;

    }


    try {

      const result =
        await dispatchAccount(
          account
        );


      results.push(
        result
      );


      if (
        result.dispatched ===
          true
      ) {

        dispatchedCount +=
          1;

      }


    } catch (
      error
    ) {

      results.push({

        ok:
          false,

        dispatched:
          false,

        workspaceId:
          account?.workspace_id
          ??
          null,

        brandId:
          account?.brand_id
          ??
          null,

        connectionId:
          account?.connection_id
          ??
          null,

        integrationAccountId:
          account?.integration_account_id
          ??
          null,

        error:
          String(
            error?.message
            ||
            'SHOPIFY_INCREMENTAL_SUPERVISOR_ACCOUNT_FAILED'
          ),

      });

    }

  }


  return {

    ok:
      true,

    recovery,  

    discoveredCount:
      accounts.length,

    dispatchedCount,

    skippedCount:
      results.filter(
        item =>
          item.ok ===
            true
          &&
          item.dispatched ===
            false
      ).length,

    failedCount:
      results.filter(
        item =>
          item.ok ===
            false
      ).length,

    overlapMinutes:
      RECOVERY_OVERLAP_MINUTES,

    results,

    durationMs:
      Date.now()
      -
      startedAt,

  };

}