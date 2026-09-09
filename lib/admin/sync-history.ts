import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET
  ||
  'growthos_control';


const LOCATION =
  process.env.GCP_BQ_LOCATION
  ||
  'asia-south1';


// ============================================================
// TYPES
// ============================================================

export type AdminSyncRun = {

  runId:
    string;

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  connectionId:
    string;

  provider:
    string;

  entity:
    string;

  syncType:
    string;

  status:
    string;

  attempt:
    number;

  startedAt:
    string | null;

  completedAt:
    string | null;

  durationMs:
    number | null;

  sourceStartAt:
    string | null;

  sourceEndAt:
    string | null;

  recordsFetched:
    number;

  recordsLoaded:
    number;

  recordsRejected:
    number;

  bytesProcessed:
    number;

  cursorBefore:
    string | null;

  cursorAfter:
    string | null;

  errorCode:
    string | null;

  errorMessage:
    string | null;

};


export type AdminSyncHistorySnapshot = {

  summary: {

    total:
      number;

    running:
      number;

    success:
      number;

    partial:
      number;

    failed:
      number;

    clients:
      number;

    providers:
      number;

  };

  runs:
    AdminSyncRun[];

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin Sync History requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// GET ADMIN SYNC HISTORY
//
// Runtime read only.
//
// No bootstrap.
// No mutations.
// No retries triggered.
// ============================================================

export async function getAdminSyncHistory():

  Promise<
    AdminSyncHistorySnapshot
  > {

  const projectId =
    requireProjectId();


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        WITH latest_workspaces AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.workspaces\`

          QUALIFY

            ROW_NUMBER() OVER
            (
              PARTITION BY
                workspace_id

              ORDER BY
                updated_at DESC,
                created_at DESC
            ) = 1

        ),


        latest_brands AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brands\`

          QUALIFY

            ROW_NUMBER() OVER
            (
              PARTITION BY
                workspace_id,
                brand_id

              ORDER BY
                updated_at DESC,
                created_at DESC
            ) = 1

        )


        SELECT

          r.run_id,

          r.workspace_id,

          w.workspace_name,

          r.brand_id,

          b.brand_name,

          r.connection_id,

          r.provider,

          r.entity,

          r.sync_type,

          r.status,

          COALESCE(
            r.attempt,
            1
          )
            AS attempt,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            r.started_at
          )
            AS started_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            r.completed_at
          )
            AS completed_at,


          r.duration_ms,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            r.source_start_at
          )
            AS source_start_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            r.source_end_at
          )
            AS source_end_at,


          COALESCE(
            r.records_fetched,
            0
          )
            AS records_fetched,


          COALESCE(
            r.records_loaded,
            0
          )
            AS records_loaded,


          COALESCE(
            r.records_rejected,
            0
          )
            AS records_rejected,


          COALESCE(
            r.bytes_processed,
            0
          )
            AS bytes_processed,


          r.cursor_before,

          r.cursor_after,

          r.error_code,

          r.error_message


        FROM
          \`${projectId}.${DATASET_ID}.integration_sync_runs\`
          AS r


        LEFT JOIN
          latest_workspaces
          AS w

        ON
          w.workspace_id =
            r.workspace_id


        LEFT JOIN
          latest_brands
          AS b

        ON
          b.workspace_id =
            r.workspace_id

          AND b.brand_id =
            r.brand_id


        ORDER BY

          COALESCE(
            r.started_at,
            r.created_at
          )
          DESC


        LIMIT 500

      `,

      location:
        LOCATION,

    });


  const runs:
    AdminSyncRun[] =
      (
        rows
        ||
        []
      ).map(
        (
          row:
            any
        ) => ({

          runId:
            String(
              row.run_id
              ||
              ''
            ),

          workspaceId:
            String(
              row.workspace_id
              ||
              ''
            ),

          workspaceName:
            row.workspace_name
            ??
            null,

          brandId:
            String(
              row.brand_id
              ||
              ''
            ),

          brandName:
            row.brand_name
            ??
            null,

          connectionId:
            String(
              row.connection_id
              ||
              ''
            ),

          provider:
            String(
              row.provider
              ||
              ''
            ),

          entity:
            String(
              row.entity
              ||
              ''
            ),

          syncType:
            String(
              row.sync_type
              ||
              ''
            ),

          status:
            String(
              row.status
              ||
              ''
            ),

          attempt:
            Number(
              row.attempt
              ||
              1
            ),

          startedAt:
            row.started_at
            ??
            null,

          completedAt:
            row.completed_at
            ??
            null,

          durationMs:
            row.duration_ms ===
              null
              ||
              row.duration_ms ===
                undefined

              ? null

              : Number(
                  row.duration_ms
                ),

          sourceStartAt:
            row.source_start_at
            ??
            null,

          sourceEndAt:
            row.source_end_at
            ??
            null,

          recordsFetched:
            Number(
              row.records_fetched
              ||
              0
            ),

          recordsLoaded:
            Number(
              row.records_loaded
              ||
              0
            ),

          recordsRejected:
            Number(
              row.records_rejected
              ||
              0
            ),

          bytesProcessed:
            Number(
              row.bytes_processed
              ||
              0
            ),

          cursorBefore:
            row.cursor_before
            ??
            null,

          cursorAfter:
            row.cursor_after
            ??
            null,

          errorCode:
            row.error_code
            ??
            null,

          errorMessage:
            row.error_message
            ??
            null,

        })
      );


  const running =
    runs.filter(
      run =>
        run.status ===
        'running'
    ).length;


  const success =
    runs.filter(
      run =>
        run.status ===
        'success'
    ).length;


  const partial =
    runs.filter(
      run =>
        run.status ===
        'partial'
    ).length;


  const failed =
    runs.filter(
      run =>
        run.status ===
        'failed'
    ).length;


  const clients =
    new Set(
      runs.map(
        run =>
          `${run.workspaceId}:${run.brandId}`
      )
    ).size;


  const providers =
    new Set(
      runs
        .map(
          run =>
            run.provider
        )
        .filter(
          Boolean
        )
    ).size;


  return {

    summary: {

      total:
        runs.length,

      running,

      success,

      partial,

      failed,

      clients,

      providers,

    },

    runs,

  };

}