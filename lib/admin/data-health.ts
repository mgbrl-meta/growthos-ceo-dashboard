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

export type AdminDataHealthStatus =
  | 'healthy'
  | 'attention'
  | 'critical'
  | 'not_monitored';


export type AdminDataHealthRow = {

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string | null;

  brandName:
    string | null;

  connectionId:
    string;

  provider:
    string;

  connectionStatus:
    string | null;

  connectionMode:
    string | null;

  ingestionAdapter:
    string | null;

  providerAccountId:
    string | null;

  providerAccountName:
    string | null;

  entity:
    string | null;

  backfillStatus:
    string | null;

  incrementalStatus:
    string | null;

  consecutiveFailures:
    number;

  lastError:
    string | null;

  lastSourceTimestamp:
    string | null;

  lastSyncedAt:
    string | null;

  nextSyncAt:
    string | null;

  freshnessMinutes:
    number | null;

  nextSyncOverdueMinutes:
    number | null;

  health:
    AdminDataHealthStatus;

};


export type AdminDataHealthSummary = {

  total:
    number;

  healthy:
    number;

  attention:
    number;

  critical:
    number;

  notMonitored:
    number;  

  clients:
    number;

  providers:
    number;

};


export type AdminDataHealthSnapshot = {

  summary:
    AdminDataHealthSummary;

  rows:
    AdminDataHealthRow[];

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin Data Health requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ADMIN DATA HEALTH SNAPSHOT
//
// IMPORTANT:
//
// Runtime read only.
//
// This function DOES NOT:
//
// - create datasets
// - create tables
// - run migrations
// - call ensureIntegrationControlPlane()
// - call ensureIntegrationStore()
//
// One BigQuery query returns the cross-client operational
// health of every integration connection/entity.
//
// The connection table is the base so we also surface
// connections that exist but have not yet produced sync state.
// ============================================================

export async function getAdminDataHealthSnapshot():

  Promise<
    AdminDataHealthSnapshot
  > {

  const projectId =
    requireProjectId();


  const [
    rawRows,
  ] =
    await bigquery.query({

      query: `

        -- ====================================================
        -- LATEST LOGICAL WORKSPACE ROW
        -- ====================================================

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
                created_at DESC,
                workspace_id DESC

            ) = 1

        ),


        -- ====================================================
        -- LATEST LOGICAL BRAND ROW
        -- ====================================================

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
                created_at DESC,
                brand_id DESC

            ) = 1

        ),


        -- ====================================================
        -- LATEST LOGICAL CONNECTION
        --
        -- Defensive dedupe because BigQuery does not enforce
        -- primary-key uniqueness.
        -- ====================================================

        latest_connections AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.integration_connections\`

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY
                connection_id

              ORDER BY
                updated_at DESC,
                connected_at DESC,
                connection_id DESC

            ) = 1

        ),


        -- ====================================================
        -- SELECTED PROVIDER ACCOUNT
        -- ====================================================

        selected_accounts AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.integration_accounts\`

          WHERE
            COALESCE(
              is_selected,
              FALSE
            ) = TRUE

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY
                connection_id

              ORDER BY
                updated_at DESC,
                selected_at DESC,
                discovered_at DESC,
                integration_account_id DESC

            ) = 1

        ),


        -- ====================================================
        -- LATEST SYNC STATE
        --
        -- One logical state per:
        --
        -- workspace
        -- brand
        -- connection
        -- provider
        -- entity
        -- ====================================================

        latest_sync_state AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.integration_sync_state\`

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY
                workspace_id,
                brand_id,
                connection_id,
                provider,
                entity

              ORDER BY
                updated_at DESC,
                last_synced_at DESC,
                created_at DESC,
                sync_state_id DESC

            ) = 1

        ),


        -- ====================================================
        -- JOINED OPERATIONAL STATE
        -- ====================================================

        health_rows AS
        (

          SELECT

            c.workspace_id,

            w.workspace_name,

            c.brand_id,

            b.brand_name,

            c.connection_id,

            c.provider,

            c.status
              AS connection_status,

            c.connection_mode,

            c.ingestion_adapter,

            a.provider_account_id,

            a.provider_account_name,

            s.entity,

            s.backfill_status,

            s.incremental_status,

            COALESCE(
              s.consecutive_failures,
              0
            )
              AS consecutive_failures,

            COALESCE(
              s.last_error,
              c.error
            )
              AS last_error,

            s.last_source_timestamp,

            s.last_synced_at,

            s.next_sync_at,


            -- ================================================
            -- FRESHNESS
            --
            -- Prefer source watermark because it represents
            -- source-data coverage.
            --
            -- Fall back to last_synced_at where a provider has
            -- not yet populated last_source_timestamp.
            -- ================================================

            CASE

              WHEN
                COALESCE(
                  s.last_source_timestamp,
                  s.last_synced_at
                )
                IS NULL

              THEN
                NULL

              ELSE
                GREATEST(

                  0,

                  TIMESTAMP_DIFF(

                    CURRENT_TIMESTAMP(),

                    COALESCE(
                      s.last_source_timestamp,
                      s.last_synced_at
                    ),

                    MINUTE

                  )

                )

            END
              AS freshness_minutes,


            -- ================================================
            -- NEXT SYNC OVERDUE
            -- ================================================

            CASE

              WHEN
                s.next_sync_at IS NULL

              THEN
                NULL


              WHEN
                CURRENT_TIMESTAMP() <=
                s.next_sync_at

              THEN
                0


              ELSE

                TIMESTAMP_DIFF(
                  CURRENT_TIMESTAMP(),
                  s.next_sync_at,
                  MINUTE
                )

            END
              AS next_sync_overdue_minutes,


            -- ================================================
            -- HEALTH V1
            --
            -- IMPORTANT:
            --
            -- We deliberately do NOT hard-code stale-minute
            -- thresholds yet.
            --
            -- Those thresholds will later come from persistent
            -- Admin system configuration.
            --
            -- V1 judges explicit operational state only.
            -- ================================================

            CASE

              -- ----------------------------------------------
              -- CONNECTION FAILURE
              -- ----------------------------------------------

              WHEN
                LOWER(
                  COALESCE(
                    c.status,
                    ''
                  )
                )
                IN
                (
                  'error',
                  'disconnected',
                  'suspended',
                  'failed'
                )

              THEN
                'critical'


              -- ----------------------------------------------
              -- FAILURE STREAK
              -- ----------------------------------------------

              WHEN
                COALESCE(
                  s.consecutive_failures,
                  0
                ) > 0

              THEN
                'critical'


              -- ----------------------------------------------
              -- FAILED INCREMENTAL STATE
              -- ----------------------------------------------

              WHEN
                LOWER(
                  COALESCE(
                    s.incremental_status,
                    ''
                  )
                )
                IN
                (
                  'failed',
                  'error'
                )

              THEN
                'critical'


              -- ----------------------------------------------
              -- FAILED BACKFILL
              -- ----------------------------------------------

              WHEN
                LOWER(
                  COALESCE(
                    s.backfill_status,
                    ''
                  )
                )
                IN
                (
                  'failed',
                  'error'
                )

              THEN
                'critical'


              -- ----------------------------------------------
              -- CONNECTION EXISTS BUT STATE HAS NEVER STARTED
              -- ----------------------------------------------

              WHEN
                s.sync_state_id IS NULL

              THEN
                'not_monitored'


              -- ----------------------------------------------
              -- RUNNING / PENDING WORK
              -- ----------------------------------------------

              WHEN
                LOWER(
                  COALESCE(
                    s.incremental_status,
                    ''
                  )
                )
                IN
                (
                  'running',
                  'syncing',
                  'pending',
                  'queued'
                )

              THEN
                'attention'


              WHEN
                LOWER(
                  COALESCE(
                    s.backfill_status,
                    ''
                  )
                )
                IN
                (
                  'running',
                  'syncing',
                  'pending',
                  'queued'
                )

              THEN
                'attention'


              -- ----------------------------------------------
              -- NO SUCCESSFUL SYNC YET
              -- ----------------------------------------------

              WHEN
                s.last_synced_at IS NULL

              THEN
                'attention'


              -- ----------------------------------------------
              -- EXPECTED NEXT SYNC MISSED
              --
              -- next_sync_at is already provider/scheduler
              -- specific, so it is safe to use without a
              -- global freshness threshold.
              -- ----------------------------------------------

              WHEN
                s.next_sync_at IS NOT NULL

                AND TIMESTAMP_DIFF(
                  CURRENT_TIMESTAMP(),
                  s.next_sync_at,
                  MINUTE
                ) > 30
                  
              THEN
                'attention'


              ELSE
                'healthy'

            END
              AS health


          FROM
            latest_connections
            AS c


          LEFT JOIN
            latest_workspaces
            AS w

          ON
            w.workspace_id =
              c.workspace_id


          LEFT JOIN
            latest_brands
            AS b

          ON
            b.workspace_id =
              c.workspace_id

            AND b.brand_id =
              c.brand_id


          LEFT JOIN
            selected_accounts
            AS a

          ON
            a.connection_id =
              c.connection_id


          LEFT JOIN
            latest_sync_state
            AS s

          ON
            s.workspace_id =
              c.workspace_id

            AND
            (
              s.brand_id =
                c.brand_id

              OR
              (
                s.brand_id IS NULL
                AND c.brand_id IS NULL
              )
            )

            AND s.connection_id =
              c.connection_id

            AND s.provider =
              c.provider

        )


        -- ====================================================
        -- FINAL RESULT
        -- ====================================================

        SELECT

          workspace_id,

          workspace_name,

          brand_id,

          brand_name,

          connection_id,

          provider,

          connection_status,

          connection_mode,

          ingestion_adapter,

          provider_account_id,

          provider_account_name,

          entity,

          backfill_status,

          incremental_status,

          consecutive_failures,

          last_error,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            last_source_timestamp
          )
            AS last_source_timestamp,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            last_synced_at
          )
            AS last_synced_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            next_sync_at
          )
            AS next_sync_at,


          freshness_minutes,

          next_sync_overdue_minutes,

          health


        FROM
          health_rows


        ORDER BY

          CASE health

            WHEN 'critical'
              THEN 1

            WHEN 'attention'
              THEN 2

            WHEN 'not_monitored'
              THEN 3  

            WHEN 'healthy'
              THEN 4

            ELSE 99

          END,

          COALESCE(
            brand_name,
            workspace_name,
            workspace_id
          ),

          provider,

          entity

      `,

      location:
        LOCATION,

    });


  const rows =
    (
      rawRows
      ||
      []
    ) as any[];


  // ==========================================================
  // NORMALIZE RESULT
  // ==========================================================

  const normalizedRows:
    AdminDataHealthRow[] =
      rows.map(
        row => ({

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
            row.brand_id
            ??
            null,

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

          connectionStatus:
            row.connection_status
            ??
            null,

          connectionMode:
            row.connection_mode
            ??
            null,

          ingestionAdapter:
            row.ingestion_adapter
            ??
            null,

          providerAccountId:
            row.provider_account_id
            ??
            null,

          providerAccountName:
            row.provider_account_name
            ??
            null,

          entity:
            row.entity
            ??
            null,

          backfillStatus:
            row.backfill_status
            ??
            null,

          incrementalStatus:
            row.incremental_status
            ??
            null,

          consecutiveFailures:
            Number(
              row.consecutive_failures
              ||
              0
            ),

          lastError:
            row.last_error
            ??
            null,

          lastSourceTimestamp:
            row.last_source_timestamp
            ??
            null,

          lastSyncedAt:
            row.last_synced_at
            ??
            null,

          nextSyncAt:
            row.next_sync_at
            ??
            null,

          freshnessMinutes:
            row.freshness_minutes ===
              null
              ||
              row.freshness_minutes ===
                undefined

              ? null

              : Number(
                  row.freshness_minutes
                ),

          nextSyncOverdueMinutes:
            row.next_sync_overdue_minutes ===
              null
              ||
              row.next_sync_overdue_minutes ===
                undefined

              ? null

              : Number(
                  row.next_sync_overdue_minutes
                ),

          health:
            (
              row.health
              ||
              'attention'
            ) as AdminDataHealthStatus,

        })
      );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const healthy =
    normalizedRows.filter(
      row =>
        row.health ===
        'healthy'
    ).length;


  const attention =
    normalizedRows.filter(
      row =>
        row.health ===
        'attention'
    ).length;


  const critical =
    normalizedRows.filter(
      row =>
        row.health ===
        'critical'
    ).length;

  const notMonitored =
    normalizedRows.filter(
      row =>
        row.health ===
        'not_monitored'
    ).length;  


  const clients =
    new Set(
      normalizedRows.map(
        row =>
          [
            row.workspaceId,
            row.brandId
            ||
            '',
          ].join(
            ':'
          )
      )
    ).size;


  const providers =
    new Set(
      normalizedRows
        .map(
          row =>
            row.provider
        )
        .filter(
          Boolean
        )
    ).size;


  return {

    summary: {

      total:
        normalizedRows.length,

      healthy,

      attention,

      critical,

      notMonitored,

      clients,

      providers,

    },

    rows:
      normalizedRows,

  };

}