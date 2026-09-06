import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  publishShopifySyncJob,
} from './shopify-jobs';


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
// TYPES
// ============================================================

type CandidateWindow = {

  backfill_window_id:
    string;

  backfill_run_id:
    string;

  workspace_id:
    string;

  brand_id:
    string;

  connection_id:
    string;

  integration_account_id:
    string;

  provider_account_id:
    string;

  window_start:
    any;

  window_end:
    any;

};


// ============================================================
// TIMESTAMP → ISO
// ============================================================

function timestampToIso(
  value: any
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
      'SHOPIFY_BACKFILL_ORCHESTRATOR_TIMESTAMP_INVALID'
    );

  }


  return date.toISOString();

}


// ============================================================
// DML
// ============================================================

async function runDml(
  input: {

    query:
      string;

    params?:
      Record<string, any>;

    types?:
      Record<string, any>;

  }
) {

  const [
    job,
  ] =
    await bigquery.createQueryJob({

      query:
        input.query,

      location:
        OPS_LOCATION,

      params:
        input.params,

      types:
        input.types,

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
// FIND NEXT ELIGIBLE WINDOW
//
// IMPORTANT:
//
// This orchestrator operates on ONE EXPLICIT RUN.
//
// It does not randomly select another historical run.
//
// ACCOUNT LOCK:
//
// No new Bulk window may start while another historical
// pipeline stage is active for the same Shopify integration.
//
// This protects:
//
// run A
// run B
// run C
//
// from creating concurrent historical operations for the same
// Shopify store.
// ============================================================

async function findNextWindow(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    backfillRunId:
      string;

  }
):

  Promise<CandidateWindow | null> {

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

          w.window_end

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

          w.workspace_id =
            @workspace_id

          AND w.brand_id =
            @brand_id

          AND w.backfill_run_id =
            @backfill_run_id

          AND w.entity =
            'orders'

          AND w.status IN
            (
              'queued',
              'retry_wait'
            )

          -- ==================================================
          -- A retry_wait row WITH an existing Bulk Operation
          -- belongs to JSONL-load recovery.
          --
          -- It must NOT start another Shopify operation.
          -- ==================================================

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

          -- ==================================================
          -- SHOPIFY ACCOUNT GLOBAL LOCK
          --
          -- One historical pipeline at a time per Shopify
          -- integration account.
          --
          -- This also automatically enforces one active window
          -- within the same run.
          -- ==================================================

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
        OPS_LOCATION,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        backfill_run_id:
          input.backfillRunId,

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as CandidateWindow | null;

}


// ============================================================
// RESERVE WINDOW
//
// queued / retry_wait
//         ↓
// dispatching
//
// The account lock is checked AGAIN during reservation.
//
// This matters because two orchestrator requests could discover
// candidates nearly simultaneously.
// ============================================================

async function reserveWindow(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    backfillRunId:
      string;

    backfillWindowId:
      string;

    integrationAccountId:
      string;

  }
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
          input.workspaceId,

        brand_id:
          input.brandId,

        backfill_run_id:
          input.backfillRunId,

        backfill_window_id:
          input.backfillWindowId,

        integration_account_id:
          input.integrationAccountId,

      },

    });


  return affected === 1;

}


// ============================================================
// RELEASE FAILED DISPATCH
//
// dispatching
//      ↓
// retry_wait
// ============================================================

async function releaseDispatch(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    backfillRunId:
      string;

    backfillWindowId:
      string;

    error:
      string;

  }
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
        input.workspaceId,

      brand_id:
        input.brandId,

      backfill_run_id:
        input.backfillRunId,

      backfill_window_id:
        input.backfillWindowId,

      error:
        input.error,

    },

  });

}


// ============================================================
// RUN ORCHESTRATOR
//
// IMPORTANT:
//
// backfillRunId is REQUIRED.
//
// The future scheduler will choose the run explicitly and then
// call this same function.
//
// This prevents accidental resurrection/dispatch of unrelated
// historical test runs.
// ============================================================

export async function runShopifyBackfillOrchestrator(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    backfillRunId:
      string;

    requestedBy?:
      string | null;

  }
) {

  const backfillRunId =
    String(
      input.backfillRunId
      ||
      ''
    ).trim();


  if (!backfillRunId) {

    throw new Error(
      'SHOPIFY_BACKFILL_RUN_ID_MISSING'
    );

  }


  // ==========================================================
  // FIND NEXT WINDOW FOR THIS EXACT RUN
  // ==========================================================

  const candidate =
    await findNextWindow({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      backfillRunId,

    });


  if (!candidate) {

    return {

      ok:
        true,

      dispatched:
        false,

      backfillRunId,

      reason:
        'NO_ELIGIBLE_WINDOW',

    };

  }


  // ==========================================================
  // RESERVE
  // ==========================================================

  const reserved =
    await reserveWindow({

      workspaceId:
        candidate.workspace_id,

      brandId:
        candidate.brand_id,

      backfillRunId:
        candidate.backfill_run_id,

      backfillWindowId:
        candidate.backfill_window_id,

      integrationAccountId:
        candidate.integration_account_id,

    });


  if (!reserved) {

    return {

      ok:
        true,

      dispatched:
        false,

      backfillRunId,

      reason:
        'WINDOW_NOT_RESERVED',

    };

  }


  const from =
    timestampToIso(
      candidate.window_start
    );


  const to =
    timestampToIso(
      candidate.window_end
    );


  // ==========================================================
  // PUBLISH PUB/SUB
  // ==========================================================

  try {

    const published =
      await publishShopifySyncJob({

        workspaceId:
          candidate.workspace_id,

        brandId:
          candidate.brand_id,

        connectionId:
          candidate.connection_id,

        integrationAccountId:
          candidate.integration_account_id,

        providerAccountId:
          candidate.provider_account_id,

        entity:
          'orders',

        syncType:
          'backfill',

        requestedBy:
          input.requestedBy
          ??
          'shopify_backfill_orchestrator',

        from,

        to,

        cursor:
          null,

        backfillRunId:
          candidate.backfill_run_id,

        backfillWindowId:
          candidate.backfill_window_id,

      });


    return {

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

      from,

      to,

      messageId:
        published.messageId,

      topic:
        published.topic,

    };


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'SHOPIFY_BACKFILL_DISPATCH_FAILED'
      );


    await releaseDispatch({

      workspaceId:
        candidate.workspace_id,

      brandId:
        candidate.brand_id,

      backfillRunId:
        candidate.backfill_run_id,

      backfillWindowId:
        candidate.backfill_window_id,

      error:
        message,

    });


    throw error;

  }

}