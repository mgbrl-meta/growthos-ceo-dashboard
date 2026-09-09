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

export type AdminModule = {

  moduleId:
    string;

  moduleName:
    string;

  description:
    string | null;

  moduleType:
    string | null;

  category:
    string | null;

  routeKey:
    string | null;

  status:
    string;

  setupRequired:
    boolean;

  createdAt:
    string | null;

  updatedAt:
    string | null;


  // ----------------------------------------------------------
  // PLAN USAGE
  // ----------------------------------------------------------

  enabledPlans:
    number;

  totalPlanRows:
    number;


  // ----------------------------------------------------------
  // CLIENT OVERRIDES
  // ----------------------------------------------------------

  clientOverrides:
    number;

  enabledOverrides:
    number;

  disabledOverrides:
    number;

};


export type AdminModulesSnapshot = {

  summary: {

    total:
      number;

    active:
      number;

    inactive:
      number;

    standard:
      number;

    custom:
      number;

    setupRequired:
      number;

    planAssignments:
      number;

    clientOverrides:
      number;

  };

  modules:
    AdminModule[];

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin Modules requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ADMIN MODULE REGISTRY
//
// GLOBAL FAST READ.
//
// Source:
//
// modules
// plan_modules
// brand_module_overrides
//
// IMPORTANT:
//
// Modules defines WHAT exists.
//
// It does not decide:
//
// - which client receives it
// - which individual user receives it
//
// Those are downstream entitlement layers.
// ============================================================

export async function getAdminModulesSnapshot():

  Promise<
    AdminModulesSnapshot
  > {

  const projectId =
    requireProjectId();


  const [
    rawRows,
  ] =
    await bigquery.query({

      query: `

        -- ====================================================
        -- PLAN USAGE
        -- ====================================================

        WITH plan_usage AS
        (

          SELECT

            module_id,

            COUNT(*)
              AS total_plan_rows,

            COUNT(
              DISTINCT
              IF(
                enabled = TRUE,
                plan_id,
                NULL
              )
            )
              AS enabled_plans

          FROM
            \`${projectId}.${DATASET_ID}.plan_modules\`

          GROUP BY
            module_id

        ),


        -- ====================================================
        -- LATEST CLIENT OVERRIDES
        -- ====================================================

        latest_overrides AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_module_overrides\`

          QUALIFY

            ROW_NUMBER() OVER
            (
              PARTITION BY

                workspace_id,

                brand_id,

                module_id

              ORDER BY

                updated_at DESC,

                created_at DESC,

                override_id DESC

            ) = 1

        ),


        override_usage AS
        (

          SELECT

            module_id,

            COUNT(*)
              AS client_overrides,

            COUNTIF(
              module_override =
                'enabled'
            )
              AS enabled_overrides,

            COUNTIF(
              module_override =
                'disabled'
            )
              AS disabled_overrides

          FROM
            latest_overrides

          WHERE
            module_override !=
              'default'

          GROUP BY
            module_id

        )


        -- ====================================================
        -- FINAL MODULE REGISTRY
        -- ====================================================

        SELECT

          m.module_id,

          m.module_name,

          m.description,

          m.module_type,

          m.category,

          m.route_key,

          m.status,

          COALESCE(
            m.setup_required,
            FALSE
          )
            AS setup_required,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            m.created_at
          )
            AS created_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            m.updated_at
          )
            AS updated_at,


          COALESCE(
            pu.enabled_plans,
            0
          )
            AS enabled_plans,


          COALESCE(
            pu.total_plan_rows,
            0
          )
            AS total_plan_rows,


          COALESCE(
            ou.client_overrides,
            0
          )
            AS client_overrides,


          COALESCE(
            ou.enabled_overrides,
            0
          )
            AS enabled_overrides,


          COALESCE(
            ou.disabled_overrides,
            0
          )
            AS disabled_overrides


        FROM
          \`${projectId}.${DATASET_ID}.modules\`
          AS m


        LEFT JOIN
          plan_usage
          AS pu

        ON
          pu.module_id =
            m.module_id


        LEFT JOIN
          override_usage
          AS ou

        ON
          ou.module_id =
            m.module_id


        ORDER BY

          CASE m.category

            WHEN 'workspace'
              THEN 1

            WHEN 'growth'
              THEN 2

            WHEN 'customers'
              THEN 3

            WHEN 'commerce'
              THEN 4

            WHEN 'data'
              THEN 5

            WHEN 'system'
              THEN 6

            ELSE 99

          END,

          m.module_name

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


  const modules:
    AdminModule[] =
      rows.map(
        row => ({

          moduleId:
            String(
              row.module_id
              ||
              ''
            ),

          moduleName:
            String(
              row.module_name
              ||
              row.module_id
              ||
              ''
            ),

          description:
            row.description
            ??
            null,

          moduleType:
            row.module_type
            ??
            null,

          category:
            row.category
            ??
            null,

          routeKey:
            row.route_key
            ??
            null,

          status:
            String(
              row.status
              ||
              'unknown'
            ),

          setupRequired:
            Boolean(
              row.setup_required
            ),

          createdAt:
            row.created_at
            ??
            null,

          updatedAt:
            row.updated_at
            ??
            null,

          enabledPlans:
            Number(
              row.enabled_plans
              ||
              0
            ),

          totalPlanRows:
            Number(
              row.total_plan_rows
              ||
              0
            ),

          clientOverrides:
            Number(
              row.client_overrides
              ||
              0
            ),

          enabledOverrides:
            Number(
              row.enabled_overrides
              ||
              0
            ),

          disabledOverrides:
            Number(
              row.disabled_overrides
              ||
              0
            ),

        })
      );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const active =
    modules.filter(
      module =>
        normalize(
          module.status
        ) ===
          'active'
    ).length;


  const inactive =
    modules.length
    -
    active;


  const standard =
    modules.filter(
      module =>
        normalize(
          module.moduleType
        ) ===
          'standard'
    ).length;


  const custom =
    modules.filter(
      module =>
        normalize(
          module.moduleType
        ) ===
          'custom'
    ).length;


  const setupRequired =
    modules.filter(
      module =>
        module.setupRequired
    ).length;


  const planAssignments =
    modules.reduce(
      (
        total,
        module
      ) =>
        total
        +
        module.enabledPlans,
      0
    );


  const clientOverrides =
    modules.reduce(
      (
        total,
        module
      ) =>
        total
        +
        module.clientOverrides,
      0
    );


  return {

    summary: {

      total:
        modules.length,

      active,

      inactive,

      standard,

      custom,

      setupRequired,

      planAssignments,

      clientOverrides,

    },

    modules,

  };

}


// ============================================================
// HELPERS
// ============================================================

function normalize(
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