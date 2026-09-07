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
  processShopifyBackfillWindow,
} from './shopify-backfill-processor.js';


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


const RAW_TOPIC_NAME =
  String(
    process.env.GROWTHOS_SHOPIFY_SYNC_TOPIC
    ||
    process.env.SHOPIFY_SYNC_TOPIC
    ||
    ''
  ).trim();


const MAX_PROCESS_PER_TICK =
  5;


const MAX_DISPATCH_PER_TICK =
  5;


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_BACKFILL_SUPERVISOR_PROJECT_MISSING'
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


// ============================================================
// PUB/SUB TOPIC
//
// Accept either:
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
      'SHOPIFY_BACKFILL_SUPERVISOR_TOPIC_MISSING'
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
// BIGQUERY DML
// ============================================================

async function runDml(
  input
) {

  const [
    job,
  ] =
    await bigquery.createQueryJob({

      query:
        input.query,

      location:
        LOCATION,

      params:
        input.params
        ??
        undefined,

      types:
        input.types
        ??
        undefined,

    });


  await job.getQueryResults();


  const [
    metadata,
  ] =
    await job.getMetadata();


  return Number(

    metadata
      ?.statistics
      ?.query
      ?.numDmlAffectedRows

    ??
    0

  );

}


// ============================================================
// TIMESTAMP → ISO
// ============================================================

function timestampToIso(
  value
) {

  const raw =
    value?.value
    ??
    value;


  const date =
    new Date(
      raw
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    throw new Error(
      'SHOPIFY_BACKFILL_SUPERVISOR_TIMESTAMP_INVALID'
    );

  }


  return date
    .toISOString();

}


// ============================================================
// RECOVER STALE DISPATCH RESERVATIONS
//
// A process could theoretically die after:
//
// queued → dispatching
//
// but before Pub/Sub publish.
//
// Safe recovery:
//
// dispatching + no Bulk ID + old
//        ↓
// retry_wait
//
// Pub/Sub/worker state claiming remains idempotent.
// ============================================================

async function recoverStaleDispatches() {

  return runDml({

    query: `

      UPDATE
        \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`

      SET

        status =
          'retry_wait',

        next_retry_at =
          CURRENT_TIMESTAMP(),

        error =
          'SHOPIFY_BACKFILL_STALE_DISPATCH_RECOVERED',

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE

        entity =
          'orders'

        AND status =
          'dispatching'

        AND bulk_operation_id
          IS NULL

        AND updated_at <
          TIMESTAMP_SUB(
            CURRENT_TIMESTAMP(),
            INTERVAL 5 MINUTE
          )

    `,

  });

}


// ============================================================
// ACTIVE PROCESSING WINDOWS
//
// These already have a Shopify Bulk Operation.
//
// The existing processor owns:
//
// status check
// GCS
// BigQuery stage
// canonical warehouse
// completion
// retry handling
// ============================================================

async function findProcessCandidates() {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          w.backfill_run_id,
          w.backfill_window_id,

          w.workspace_id,
          w.brand_id,

          w.integration_account_id,

          w.status,
          w.bulk_operation_id,

          w.updated_at

        FROM
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`
          AS w

        JOIN
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`
          AS r

        ON

          r.backfill_run_id =
            w.backfill_run_id

          AND r.workspace_id =
            w.workspace_id

          AND r.brand_id =
            w.brand_id

        WHERE

          w.entity =
            'orders'

          AND w.status IN
            (
              'running',
              'result_ready',
              'retry_wait'
            )

          AND w.bulk_operation_id
            IS NOT NULL

          AND
            (
              w.next_retry_at
                IS NULL

              OR

              w.next_retry_at <=
                CURRENT_TIMESTAMP()
            )

          AND r.status IN
            (
              'queued',
              'running'
            )

        ORDER BY

          w.updated_at ASC

        LIMIT ${MAX_PROCESS_PER_TICK}

      `,

      location:
        LOCATION,

    });


  return Array.isArray(
    rows
  )
    ? rows
    : [];

}


// ============================================================
// NEXT DISPATCH CANDIDATE
//
// Same rules as the existing Next orchestrator:
//
// - queued/retry_wait
// - no Bulk Operation yet
// - retry time reached
// - run still active
// - global lock per Shopify integration account
// ============================================================

async function findDispatchCandidate() {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          w.backfill_window_id,
          w.backfill_run_id,

          w.workspace_id,
          w.brand_id,

          w.connection_id,
          w.integration_account_id,
          w.provider_account_id,

          w.window_start,
          w.window_end,

          w.created_at

        FROM
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`
          AS w

        JOIN
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`
          AS r

        ON

          r.backfill_run_id =
            w.backfill_run_id

          AND r.workspace_id =
            w.workspace_id

          AND r.brand_id =
            w.brand_id

        WHERE

          w.entity =
            'orders'

          AND w.status IN
            (
              'queued',
              'retry_wait'
            )

          AND w.bulk_operation_id
            IS NULL

          AND
            (
              w.next_retry_at
                IS NULL

              OR

              w.next_retry_at <=
                CURRENT_TIMESTAMP()
            )

          AND r.status IN
            (
              'queued',
              'running'
            )

          AND NOT EXISTS
            (

              SELECT
                1

              FROM
                \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`
                AS active

              WHERE

                active.workspace_id =
                  w.workspace_id

                AND active.brand_id =
                  w.brand_id

                AND active.integration_account_id =
                  w.integration_account_id

                AND active.backfill_window_id !=
                  w.backfill_window_id

                AND
                  (

                    active.status IN
                      (
                        'dispatching',
                        'starting',
                        'running',
                        'result_ready',
                        'loading'
                      )

                    OR

                    (
                      active.status =
                        'retry_wait'

                      AND active.bulk_operation_id
                        IS NOT NULL
                    )

                  )

            )

        ORDER BY

          w.window_start ASC,

          w.created_at ASC

        LIMIT 1

      `,

      location:
        LOCATION,

    });


  return rows?.[0]
    ??
    null;

}


// ============================================================
// RESERVE DISPATCH
//
// Rechecks the account lock atomically.
//
// queued/retry_wait
//        ↓
// dispatching
// ============================================================

async function reserveDispatchCandidate(
  candidate
) {

  const affected =
    await runDml({

      query: `

        UPDATE
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`
          AS w

        SET

          status =
            'dispatching',

          next_retry_at =
            NULL,

          error =
            NULL,

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          w.workspace_id =
            @workspace_id

          AND w.brand_id =
            @brand_id

          AND w.backfill_run_id =
            @backfill_run_id

          AND w.backfill_window_id =
            @backfill_window_id

          AND w.integration_account_id =
            @integration_account_id

          AND w.status IN
            (
              'queued',
              'retry_wait'
            )

          AND w.bulk_operation_id
            IS NULL

          AND
            (
              w.next_retry_at
                IS NULL

              OR

              w.next_retry_at <=
                CURRENT_TIMESTAMP()
            )

          AND NOT EXISTS
            (

              SELECT
                1

              FROM
                \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_windows\`
                AS active

              WHERE

                active.workspace_id =
                  w.workspace_id

                AND active.brand_id =
                  w.brand_id

                AND active.integration_account_id =
                  w.integration_account_id

                AND active.backfill_window_id !=
                  w.backfill_window_id

                AND
                  (

                    active.status IN
                      (
                        'dispatching',
                        'starting',
                        'running',
                        'result_ready',
                        'loading'
                      )

                    OR

                    (
                      active.status =
                        'retry_wait'

                      AND active.bulk_operation_id
                        IS NOT NULL
                    )

                  )

            )

      `,

      params: {

        workspace_id:
          candidate.workspace_id,

        brand_id:
          candidate.brand_id,

        backfill_run_id:
          candidate.backfill_run_id,

        backfill_window_id:
          candidate.backfill_window_id,

        integration_account_id:
          candidate.integration_account_id,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        backfill_run_id:
          'STRING',

        backfill_window_id:
          'STRING',

        integration_account_id:
          'STRING',

      },

    });


  return affected ===
    1;

}


// ============================================================
// RELEASE FAILED DISPATCH
// ============================================================

async function releaseDispatchCandidate(
  candidate,
  error
) {

  return runDml({

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

        error =
          @error,

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE

        workspace_id =
          @workspace_id

        AND brand_id =
          @brand_id

        AND backfill_run_id =
          @backfill_run_id

        AND backfill_window_id =
          @backfill_window_id

        AND status =
          'dispatching'

        AND bulk_operation_id
          IS NULL

    `,

    params: {

      workspace_id:
        candidate.workspace_id,

      brand_id:
        candidate.brand_id,

      backfill_run_id:
        candidate.backfill_run_id,

      backfill_window_id:
        candidate.backfill_window_id,

      error:
        String(
          error
          ??
          'SHOPIFY_BACKFILL_DISPATCH_FAILED'
        ),

    },

    types: {

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      backfill_run_id:
        'STRING',

      backfill_window_id:
        'STRING',

      error:
        'STRING',

    },

  });

}


// ============================================================
// PUBLISH EXISTING SHOPIFY JOB CONTRACT
//
// This intentionally matches shopify-jobs.ts.
//
// The existing Pub/Sub push subscription continues to call:
//
// POST /pubsub/shopify-sync
//
// No new execution contract is introduced.
// ============================================================

async function publishBackfillCandidate(
  candidate
) {

  const from =
    timestampToIso(
      candidate.window_start
    );


  const to =
    timestampToIso(
      candidate.window_end
    );


  const job = {

    schemaVersion:
      1,

    eventType:
      'shopify.sync.requested',

    jobId:
      randomUUID(),

    provider:
      'shopify',

    workspaceId:
      requireString(
        candidate.workspace_id,
        'SHOPIFY_JOB_WORKSPACE_MISSING'
      ),

    brandId:
      requireString(
        candidate.brand_id,
        'SHOPIFY_JOB_BRAND_MISSING'
      ),

    connectionId:
      requireString(
        candidate.connection_id,
        'SHOPIFY_JOB_CONNECTION_MISSING'
      ),

    integrationAccountId:
      requireString(
        candidate.integration_account_id,
        'SHOPIFY_JOB_ACCOUNT_MISSING'
      ),

    providerAccountId:
      requireString(
        candidate.provider_account_id,
        'SHOPIFY_JOB_PROVIDER_ACCOUNT_MISSING'
      ),

    entity:
      'orders',

    syncType:
      'backfill',

    requestedAt:
      new Date()
        .toISOString(),

    requestedBy:
      'shopify_backfill_supervisor',

    window: {

      from,

      to,

    },

    cursor:
      null,

    backfillRunId:
      candidate.backfill_run_id,

    backfillWindowId:
      candidate.backfill_window_id,

  };


  const data =
    Buffer.from(
      JSON.stringify(
        job
      )
    );


  const topic =
    pubsub.topic(
      getTopicId()
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
      getTopicId(),

    jobId:
      job.jobId,

    from,

    to,

  };

}


// ============================================================
// PROCESS ACTIVE WINDOWS
// ============================================================

async function processActiveWindows() {

  const candidates =
    await findProcessCandidates();


  const results = [];


  for (
    const candidate
    of candidates
  ) {

    try {

      const result =
        await processShopifyBackfillWindow({

          workspaceId:
            candidate.workspace_id,

          brandId:
            candidate.brand_id,

          backfillRunId:
            candidate.backfill_run_id,

          backfillWindowId:
            candidate.backfill_window_id,

        });


      results.push({

        ok:
          true,

        backfillRunId:
          candidate.backfill_run_id,

        backfillWindowId:
          candidate.backfill_window_id,

        previousStatus:
          candidate.status,

        outcome:
          result.outcome,

        status:
          result.status,

        durationMs:
          result.durationMs,

      });


    } catch (
      error
    ) {

      results.push({

        ok:
          false,

        backfillRunId:
          candidate.backfill_run_id,

        backfillWindowId:
          candidate.backfill_window_id,

        previousStatus:
          candidate.status,

        error:
          String(
            error?.message
            ||
            'SHOPIFY_BACKFILL_PROCESS_FAILED'
          ),

      });

    }

  }


  return results;

}


// ============================================================
// DISPATCH ELIGIBLE WINDOWS
//
// Repeats candidate lookup because after reserving one account,
// another Shopify account may still be eligible.
//
// The global lock prevents more than one active historical
// pipeline per integration account.
// ============================================================

async function dispatchEligibleWindows() {

  const results = [];


  for (
    let index = 0;
    index < MAX_DISPATCH_PER_TICK;
    index += 1
  ) {

    const candidate =
      await findDispatchCandidate();


    if (!candidate) {

      break;

    }


    const reserved =
      await reserveDispatchCandidate(
        candidate
      );


    if (!reserved) {

      continue;

    }


    try {

      const published =
        await publishBackfillCandidate(
          candidate
        );


      results.push({

        ok:
          true,

        dispatched:
          true,

        backfillRunId:
          candidate.backfill_run_id,

        backfillWindowId:
          candidate.backfill_window_id,

        integrationAccountId:
          candidate.integration_account_id,

        messageId:
          published.messageId,

        jobId:
          published.jobId,

        topic:
          published.topic,

        from:
          published.from,

        to:
          published.to,

      });


    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          'SHOPIFY_BACKFILL_DISPATCH_FAILED'
        );


      try {

        await releaseDispatchCandidate(
          candidate,
          message
        );

      } catch (
        releaseError
      ) {

        console.error(
          'SHOPIFY_BACKFILL_SUPERVISOR_RELEASE_FAILED',
          {

            backfillRunId:
              candidate.backfill_run_id,

            backfillWindowId:
              candidate.backfill_window_id,

            message:
              String(
                releaseError?.message
                ||
                'Unknown release failure'
              ),

          }
        );

      }


      results.push({

        ok:
          false,

        dispatched:
          false,

        backfillRunId:
          candidate.backfill_run_id,

        backfillWindowId:
          candidate.backfill_window_id,

        error:
          message,

      });

    }

  }


  return results;

}


// ============================================================
// SUPERVISE
//
// One invocation:
//
// 1. recover abandoned dispatch reservations
// 2. progress active Bulk/load windows
// 3. dispatch eligible queued work
//
// Calling repeatedly is safe.
// ============================================================

export async function superviseShopifyBackfills() {

  const startedAt =
    Date.now();


  const staleDispatchesRecovered =
    await recoverStaleDispatches();


  const processing =
    await processActiveWindows();


  const dispatching =
    await dispatchEligibleWindows();


  return {

    ok:
      true,

    staleDispatchesRecovered,

    processing,

    dispatching,

    processedCount:
      processing.length,

    dispatchedCount:
      dispatching.filter(
        item =>
          item.dispatched ===
            true
      ).length,

    durationMs:
      Date.now()
      -
      startedAt,

  };

}