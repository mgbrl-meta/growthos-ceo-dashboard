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

export type AdminClient = {

  workspaceId:
    string;

  workspaceName:
    string | null;

  workspaceSlug:
    string | null;

  workspaceStatus:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  brandSlug:
    string | null;

  brandStatus:
    string | null;

  currency:
    string | null;

  timezone:
    string | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;


  // ----------------------------------------------------------
  // SUBSCRIPTION
  // ----------------------------------------------------------

  subscriptionId:
    string | null;

  subscriptionStatus:
    string | null;

  planId:
    string | null;

  planName:
    string | null;

  planStatus:
    string | null;

  orderLimitOverrideMode:
    string | null;

  monthlyOrderLimitOverride:
    number | null;

  planMonthlyOrderLimit:
    number | null;

  effectiveMonthlyOrderLimit:
    number | null;

  unlimitedOrders:
    boolean;

  maxUsers:
    number | null;


  // ----------------------------------------------------------
  // USERS
  // ----------------------------------------------------------

  totalUsers:
    number;

  activeUsers:
    number;

  owners:
    number;

  admins:
    number;


  // ----------------------------------------------------------
  // INTEGRATIONS
  // ----------------------------------------------------------

  integrations:
    number;

  connectedIntegrations:
    number;

};


export type AdminClientsSnapshot = {

  summary: {

    total:
      number;

    active:
      number;

    setup:
      number;

    suspended:
      number;

    withSubscription:
      number;

    withoutSubscription:
      number;

    users:
      number;

    integrations:
      number;

  };

  clients:
    AdminClient[];

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin Clients requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// GET ADMIN CLIENTS
//
// GLOBAL READ ONLY.
//
// One logical row per:
//
// workspace_id + brand_id
//
// No bootstrap.
// No writes.
// No tenant loops.
// ============================================================

export async function getAdminClientsSnapshot():

  Promise<
    AdminClientsSnapshot
  > {

  const projectId =
    requireProjectId();


  const [
    rawRows,
  ] =
    await bigquery.query({

      query: `

        -- ====================================================
        -- LATEST WORKSPACES
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
        -- LATEST BRANDS
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
        -- LATEST SUBSCRIPTIONS
        -- ====================================================

        latest_subscriptions AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_subscriptions\`

          QUALIFY

            ROW_NUMBER() OVER
            (
              PARTITION BY
                workspace_id,
                brand_id

              ORDER BY
                updated_at DESC,
                created_at DESC,
                subscription_id DESC
            ) = 1

        ),


        -- ====================================================
        -- LATEST MEMBERSHIPS
        -- ====================================================

        latest_memberships AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_memberships\`

          QUALIFY

            ROW_NUMBER() OVER
            (
              PARTITION BY
                user_id,
                workspace_id,
                brand_id

              ORDER BY
                updated_at DESC,
                created_at DESC,
                membership_id DESC
            ) = 1

        ),


        membership_summary AS
        (

          SELECT

            workspace_id,

            brand_id,

            COUNT(
              DISTINCT user_id
            )
              AS total_users,

            COUNT(
              DISTINCT
              IF(
                status = 'active',
                user_id,
                NULL
              )
            )
              AS active_users,

            COUNT(
              DISTINCT
              IF(
                status = 'active'
                AND role = 'owner',
                user_id,
                NULL
              )
            )
              AS owners,

            COUNT(
              DISTINCT
              IF(
                status = 'active'
                AND role = 'admin',
                user_id,
                NULL
              )
            )
              AS admins

          FROM
            latest_memberships

          GROUP BY
            workspace_id,
            brand_id

        ),


        -- ====================================================
        -- LATEST CONNECTIONS
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


        integration_summary AS
        (

          SELECT

            workspace_id,

            brand_id,

            COUNT(*)
              AS integrations,

            COUNTIF(
              LOWER(
                COALESCE(
                  status,
                  ''
                )
              )
              IN
              (
                'connected',
                'active',
                'ready'
              )
            )
              AS connected_integrations

          FROM
            latest_connections

          GROUP BY
            workspace_id,
            brand_id

        )


        -- ====================================================
        -- FINAL CLIENT ROW
        -- ====================================================

        SELECT

          b.workspace_id,

          w.workspace_name,

          w.workspace_slug,

          w.status
            AS workspace_status,

          b.brand_id,

          b.brand_name,

          b.brand_slug,

          b.status
            AS brand_status,

          b.currency,

          b.timezone,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            b.created_at
          )
            AS created_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            b.updated_at
          )
            AS updated_at,


          -- ==================================================
          -- SUBSCRIPTION
          -- ==================================================

          s.subscription_id,

          s.status
            AS subscription_status,

          s.plan_id,

          p.plan_name,

          p.status
            AS plan_status,

          s.order_limit_override_mode,

          s.monthly_order_limit_override,

          p.monthly_order_limit
            AS plan_monthly_order_limit,


          CASE

            WHEN
              s.order_limit_override_mode =
                'unlimited'

            THEN
              NULL


            WHEN
              s.order_limit_override_mode =
                'custom'

            THEN
              s.monthly_order_limit_override


            ELSE
              p.monthly_order_limit

          END
            AS effective_monthly_order_limit,


          CASE

            WHEN
              s.order_limit_override_mode =
                'unlimited'

            THEN
              TRUE

            ELSE
              FALSE

          END
            AS unlimited_orders,


          p.max_users,


          -- ==================================================
          -- USERS
          -- ==================================================

          COALESCE(
            ms.total_users,
            0
          )
            AS total_users,

          COALESCE(
            ms.active_users,
            0
          )
            AS active_users,

          COALESCE(
            ms.owners,
            0
          )
            AS owners,

          COALESCE(
            ms.admins,
            0
          )
            AS admins,


          -- ==================================================
          -- INTEGRATIONS
          -- ==================================================

          COALESCE(
            ins.integrations,
            0
          )
            AS integrations,

          COALESCE(
            ins.connected_integrations,
            0
          )
            AS connected_integrations


        FROM
          latest_brands
          AS b


        LEFT JOIN
          latest_workspaces
          AS w

        ON
          w.workspace_id =
            b.workspace_id


        LEFT JOIN
          latest_subscriptions
          AS s

        ON
          s.workspace_id =
            b.workspace_id

          AND s.brand_id =
            b.brand_id


        LEFT JOIN
          \`${projectId}.${DATASET_ID}.plans\`
          AS p

        ON
          p.plan_id =
            s.plan_id


        LEFT JOIN
          membership_summary
          AS ms

        ON
          ms.workspace_id =
            b.workspace_id

          AND ms.brand_id =
            b.brand_id


        LEFT JOIN
          integration_summary
          AS ins

        ON
          ins.workspace_id =
            b.workspace_id

          AND ins.brand_id =
            b.brand_id


        ORDER BY

          CASE

            WHEN
              LOWER(
                COALESCE(
                  b.status,
                  ''
                )
              ) =
                'active'

            THEN
              1

            ELSE
              2

          END,

          COALESCE(
            b.brand_name,
            w.workspace_name,
            b.brand_id
          )

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


  const clients:
    AdminClient[] =
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

          workspaceSlug:
            row.workspace_slug
            ??
            null,

          workspaceStatus:
            row.workspace_status
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

          brandSlug:
            row.brand_slug
            ??
            null,

          brandStatus:
            row.brand_status
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

          createdAt:
            row.created_at
            ??
            null,

          updatedAt:
            row.updated_at
            ??
            null,


          subscriptionId:
            row.subscription_id
            ??
            null,

          subscriptionStatus:
            row.subscription_status
            ??
            null,

          planId:
            row.plan_id
            ??
            null,

          planName:
            row.plan_name
            ??
            null,

          planStatus:
            row.plan_status
            ??
            null,

          orderLimitOverrideMode:
            row.order_limit_override_mode
            ??
            null,

          monthlyOrderLimitOverride:
            toNullableNumber(
              row.monthly_order_limit_override
            ),

          planMonthlyOrderLimit:
            toNullableNumber(
              row.plan_monthly_order_limit
            ),

          effectiveMonthlyOrderLimit:
            toNullableNumber(
              row.effective_monthly_order_limit
            ),

          unlimitedOrders:
            Boolean(
              row.unlimited_orders
            ),

          maxUsers:
            toNullableNumber(
              row.max_users
            ),


          totalUsers:
            Number(
              row.total_users
              ||
              0
            ),

          activeUsers:
            Number(
              row.active_users
              ||
              0
            ),

          owners:
            Number(
              row.owners
              ||
              0
            ),

          admins:
            Number(
              row.admins
              ||
              0
            ),


          integrations:
            Number(
              row.integrations
              ||
              0
            ),

          connectedIntegrations:
            Number(
              row.connected_integrations
              ||
              0
            ),

        })
      );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const active =
    clients.filter(
      client =>
        normalizeStatus(
          client.brandStatus
        ) ===
          'active'
    ).length;


  const suspended =
    clients.filter(
      client =>
        normalizeStatus(
          client.brandStatus
        ) ===
          'suspended'
    ).length;


  const setup =
    clients.filter(
      client => {

        const status =
          normalizeStatus(
            client.brandStatus
          );


        return (
          status !==
            'active'
          &&
          status !==
            'suspended'
        );

      }
    ).length;


  const withSubscription =
    clients.filter(
      client =>
        Boolean(
          client.subscriptionId
        )
    ).length;


  const withoutSubscription =
    clients.length
    -
    withSubscription;


  const users =
    clients.reduce(
      (
        total,
        client
      ) =>
        total
        +
        client.totalUsers,
      0
    );


  const integrations =
    clients.reduce(
      (
        total,
        client
      ) =>
        total
        +
        client.integrations,
      0
    );


  return {

    summary: {

      total:
        clients.length,

      active,

      setup,

      suspended,

      withSubscription,

      withoutSubscription,

      users,

      integrations,

    },

    clients,

  };

}


// ============================================================
// HELPERS
// ============================================================

function toNullableNumber(
  value:
    unknown
) {

  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {

    return null;

  }


  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number
    : null;

}


function normalizeStatus(
  value:
    string |
    null
) {

  return String(
    value
    ||
    ''
  )
    .trim()
    .toLowerCase();

}