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

export type AdminIntegrationConnection = {

  connectionId:
    string;

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  provider:
    string;

  connectionMode:
    string | null;

  ingestionAdapter:
    string | null;

  status:
    string;

  providerUserId:
    string | null;

  providerUserName:
    string | null;

  providerAccountId:
    string | null;

  providerAccountName:
    string | null;

  integrationAccountId:
    string | null;

  selectedAccountId:
    string | null;

  selectedAccountName:
    string | null;

  accountType:
    string | null;

  currency:
    string | null;

  timezone:
    string | null;

  connectedAt:
    string | null;

  updatedAt:
    string | null;

  lastVerifiedAt:
    string | null;

  lastSyncAt:
    string | null;

  accountSelectedAt:
    string | null;

  error:
    string | null;

};


export type AdminIntegrationsSnapshot = {

  summary: {

    total:
      number;

    connected:
      number;

    attention:
      number;

    disconnected:
      number;

    clients:
      number;

    providers:
      number;

  };

  integrations:
    AdminIntegrationConnection[];

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin Integrations requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ADMIN INTEGRATIONS
//
// FAST CROSS-CLIENT READ.
//
// IMPORTANT:
//
// No:
//
// ensureIntegrationStore()
// bootstrap
// migrations
// writes
// tenant loops
//
// BigQuery does not enforce primary-key uniqueness, therefore
// latest logical records are selected defensively.
// ============================================================

export async function getAdminIntegrationsSnapshot():

  Promise<
    AdminIntegrationsSnapshot
  > {

  const projectId =
    requireProjectId();


  const [
    rawRows,
  ] =
    await bigquery.query({

      query: `

        -- ====================================================
        -- WORKSPACES
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
                created_at DESC
            ) = 1

        ),


        -- ====================================================
        -- BRANDS
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
                created_at DESC
            ) = 1

        ),


        -- ====================================================
        -- CONNECTIONS
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
                connected_at DESC
            ) = 1

        ),


        -- ====================================================
        -- SELECTED ACCOUNTS
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
                discovered_at DESC
            ) = 1

        )


        -- ====================================================
        -- FINAL
        -- ====================================================

        SELECT

          c.connection_id,

          c.workspace_id,

          w.workspace_name,

          c.brand_id,

          b.brand_name,

          c.provider,

          c.connection_mode,

          c.ingestion_adapter,

          c.status,

          c.provider_user_id,

          c.provider_user_name,

          c.provider_account_id,

          c.provider_account_name,

          a.integration_account_id,

          a.provider_account_id
            AS selected_account_id,

          a.provider_account_name
            AS selected_account_name,

          a.account_type,

          a.currency,

          a.timezone,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            c.connected_at
          )
            AS connected_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            c.updated_at
          )
            AS updated_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            c.last_verified_at
          )
            AS last_verified_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            c.last_sync_at
          )
            AS last_sync_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            a.selected_at
          )
            AS account_selected_at,


          c.error


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


        ORDER BY

          COALESCE(
            b.brand_name,
            w.workspace_name,
            c.brand_id,
            c.workspace_id
          ),

          c.provider

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


  const integrations:
    AdminIntegrationConnection[] =
      rows.map(
        row => ({

          connectionId:
            String(
              row.connection_id
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

          provider:
            String(
              row.provider
              ||
              ''
            ),

          connectionMode:
            row.connection_mode
            ??
            null,

          ingestionAdapter:
            row.ingestion_adapter
            ??
            null,

          status:
            String(
              row.status
              ||
              'unknown'
            ),

          providerUserId:
            row.provider_user_id
            ??
            null,

          providerUserName:
            row.provider_user_name
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

          integrationAccountId:
            row.integration_account_id
            ??
            null,

          selectedAccountId:
            row.selected_account_id
            ??
            null,

          selectedAccountName:
            row.selected_account_name
            ??
            null,

          accountType:
            row.account_type
            ??
            null,

          currency:
            row.currency
            ??
            null,

          timezone:
            row.timezone
            ??
            null,

          connectedAt:
            row.connected_at
            ??
            null,

          updatedAt:
            row.updated_at
            ??
            null,

          lastVerifiedAt:
            row.last_verified_at
            ??
            null,

          lastSyncAt:
            row.last_sync_at
            ??
            null,

          accountSelectedAt:
            row.account_selected_at
            ??
            null,

          error:
            row.error
            ??
            null,

        })
      );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const connected =
    integrations.filter(
      integration =>
        [
          'connected',
          'active',
          'ready',
        ].includes(
          integration.status.toLowerCase()
        )
        &&
        !integration.error
    ).length;


  const disconnected =
    integrations.filter(
      integration =>
        [
          'disconnected',
          'uninstalled',
          'disabled',
          'suspended',
        ].includes(
          integration.status.toLowerCase()
        )
    ).length;


  const attention =
    integrations.filter(
      integration => {

        const status =
          integration.status
            .toLowerCase();


        if (
          integration.error
        ) {

          return true;

        }


        if (
          [
            'connected',
            'active',
            'ready',
            'disconnected',
            'uninstalled',
            'disabled',
            'suspended',
          ].includes(
            status
          )
        ) {

          return false;

        }


        return true;

      }
    ).length;


  const clients =
    new Set(
      integrations.map(
        integration =>
          [
            integration.workspaceId,
            integration.brandId,
          ].join(
            ':'
          )
      )
    ).size;


  const providers =
    new Set(
      integrations
        .map(
          integration =>
            integration.provider
        )
        .filter(
          Boolean
        )
    ).size;


  return {

    summary: {

      total:
        integrations.length,

      connected,

      attention,

      disconnected,

      clients,

      providers,

    },

    integrations,

  };

}