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

export type AdminPlanModule = {

  moduleId:
    string;

  moduleName:
    string | null;

  description:
    string | null;

  category:
    string | null;

  routeKey:
    string | null;

  moduleStatus:
    string | null;

  setupRequired:
    boolean;

  enabled:
    boolean;

};


export type AdminPlan = {

  planId:
    string;

  planName:
    string;

  description:
    string | null;

  status:
    string;

  monthlyOrderLimit:
    number | null;

  maxUsers:
    number | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

  assignedClients:
    number;

  enabledModules:
    number;

  totalModules:
    number;

  modules:
    AdminPlanModule[];

};


export type AdminPlansSnapshot = {

  summary: {

    total:
      number;

    active:
      number;

    inactive:
      number;

    assignedClients:
      number;

    unassignedPlans:
      number;

  };

  plans:
    AdminPlan[];

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin Plans requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ADMIN PLANS
//
// GLOBAL FAST READ.
//
// Source:
//
// plans
// plan_modules
// modules
// brand_subscriptions
//
// No bootstrap.
// No seeding.
// No writes.
// ============================================================

export async function getAdminPlansSnapshot():

  Promise<
    AdminPlansSnapshot
  > {

  const projectId =
    requireProjectId();


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        -- ====================================================
        -- LATEST SUBSCRIPTIONS
        -- ====================================================

        WITH latest_subscriptions AS
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
        -- PLAN ASSIGNMENT SUMMARY
        -- ====================================================

        subscription_summary AS
        (

          SELECT

            plan_id,

            COUNT(
              DISTINCT
              CONCAT(
                workspace_id,
                ':',
                brand_id
              )
            )
              AS assigned_clients

          FROM
            latest_subscriptions

          WHERE
            status =
              'active'

          GROUP BY
            plan_id

        )


        -- ====================================================
        -- FINAL PLAN + MODULE ROWS
        -- ====================================================

        SELECT

          p.plan_id,

          p.plan_name,

          p.description,

          p.status
            AS plan_status,

          p.monthly_order_limit,

          p.max_users,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            p.created_at
          )
            AS plan_created_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            p.updated_at
          )
            AS plan_updated_at,


          COALESCE(
            ss.assigned_clients,
            0
          )
            AS assigned_clients,


          m.module_id,

          m.module_name,

          m.description
            AS module_description,

          m.category,

          m.route_key,

          m.status
            AS module_status,

          COALESCE(
            m.setup_required,
            FALSE
          )
            AS setup_required,

          COALESCE(
            pm.enabled,
            FALSE
          )
            AS module_enabled


        FROM
          \`${projectId}.${DATASET_ID}.plans\`
          AS p


        LEFT JOIN
          subscription_summary
          AS ss

        ON
          ss.plan_id =
            p.plan_id


        CROSS JOIN
          \`${projectId}.${DATASET_ID}.modules\`
          AS m


        LEFT JOIN
          \`${projectId}.${DATASET_ID}.plan_modules\`
          AS pm

        ON
          pm.plan_id =
            p.plan_id

          AND pm.module_id =
            m.module_id


        ORDER BY

          CASE p.plan_id

            WHEN 'starter'
              THEN 1

            WHEN 'pro'
              THEN 2

            WHEN 'advanced'
              THEN 3

            WHEN 'enterprise'
              THEN 4

            ELSE 99

          END,

          p.plan_name,

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


  const planMap =
    new Map<
      string,
      AdminPlan
    >();


  for (
    const row
    of (
      rows
      ||
      []
    ) as any[]
  ) {

    const planId =
      String(
        row.plan_id
        ||
        ''
      );


    if (!planId) {

      continue;

    }


    let plan =
      planMap.get(
        planId
      );


    if (!plan) {

      plan = {

        planId,

        planName:
          String(
            row.plan_name
            ||
            planId
          ),

        description:
          row.description
          ??
          null,

        status:
          String(
            row.plan_status
            ||
            'unknown'
          ),

        monthlyOrderLimit:
          toNullableNumber(
            row.monthly_order_limit
          ),

        maxUsers:
          toNullableNumber(
            row.max_users
          ),

        createdAt:
          row.plan_created_at
          ??
          null,

        updatedAt:
          row.plan_updated_at
          ??
          null,

        assignedClients:
          Number(
            row.assigned_clients
            ||
            0
          ),

        enabledModules:
          0,

        totalModules:
          0,

        modules:
          [],

      };


      planMap.set(
        planId,
        plan
      );

    }


    if (
      row.module_id
    ) {

      const enabled =
        Boolean(
          row.module_enabled
        );


      plan.modules.push({

        moduleId:
          String(
            row.module_id
          ),

        moduleName:
          row.module_name
          ??
          null,

        description:
          row.module_description
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

        moduleStatus:
          row.module_status
          ??
          null,

        setupRequired:
          Boolean(
            row.setup_required
          ),

        enabled,

      });


      plan.totalModules +=
        1;


      if (enabled) {

        plan.enabledModules +=
          1;

      }

    }

  }


  const plans =
    Array.from(
      planMap.values()
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const active =
    plans.filter(
      plan =>
        plan.status
          .toLowerCase() ===
        'active'
    ).length;


  const inactive =
    plans.length
    -
    active;


  const assignedClients =
    plans.reduce(
      (
        total,
        plan
      ) =>
        total
        +
        plan.assignedClients,
      0
    );


  const unassignedPlans =
    plans.filter(
      plan =>
        plan.assignedClients ===
        0
    ).length;


  return {

    summary: {

      total:
        plans.length,

      active,

      inactive,

      assignedClients,

      unassignedPlans,

    },

    plans,

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


  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;

}