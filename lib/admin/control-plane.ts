import 'server-only';

import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  ensureGrowthOSControlPlane,
} from '@/lib/tenancy/control-plane';

import {
  ensureGrowthOSAuthStore,
} from '@/lib/auth/user-store';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';


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

export type GrowthOSPlanStatus =
  | 'active'
  | 'draft'
  | 'archived';


export type GrowthOSModuleType =
  | 'standard'
  | 'custom';


export type GrowthOSModuleStatus =
  | 'active'
  | 'draft'
  | 'suspended';


export type GrowthOSModuleCategory =
  | 'workspace'
  | 'growth'
  | 'customers'
  | 'commerce'
  | 'data'
  | 'system'
  | 'custom';


export type GrowthOSSubscriptionStatus =
  | 'active'
  | 'trial'
  | 'suspended'
  | 'cancelled';


export type GrowthOSOrderLimitOverrideMode =
  | 'inherit'
  | 'custom'
  | 'unlimited';


export type GrowthOSModuleOverride =
  | 'default'
  | 'enabled'
  | 'disabled';


export type GrowthOSUserModulePermission =
  | 'inherit'
  | 'viewer'
  | 'editor'
  | 'disabled';

export type GrowthOSUserSubmodulePermission =
  GrowthOSUserModulePermission;  


// ============================================================
// STORED MODELS
// ============================================================

export type StoredGrowthOSPlan = {

  plan_id:
    string;

  plan_name:
    string;

  description:
    string | null;

  status:
    GrowthOSPlanStatus;

  monthly_order_limit:
    number | null;

  max_users:
    number | null;

  created_at:
    string | null;

  updated_at:
    string | null;

};


export type StoredGrowthOSModule = {

  module_id:
    string;

  module_name:
    string;

  description:
    string | null;

  module_type:
    GrowthOSModuleType;

  category:
    GrowthOSModuleCategory;

  route_key:
    string;

  status:
    GrowthOSModuleStatus;

  setup_required:
    boolean;

  created_at:
    string | null;

  updated_at:
    string | null;

};


export type StoredGrowthOSBrandSubscription = {

  subscription_id:
    string;

  workspace_id:
    string;

  brand_id:
    string;

  plan_id:
    string;

  status:
    GrowthOSSubscriptionStatus;

  order_limit_override_mode:
    GrowthOSOrderLimitOverrideMode;

  monthly_order_limit_override:
    number | null;

  created_at:
    string | null;

  updated_at:
    string | null;

};


export type StoredGrowthOSBrandModuleOverride = {

  override_id:
    string;

  workspace_id:
    string;

  brand_id:
    string;

  module_id:
    string;

  module_override:
    GrowthOSModuleOverride;

  created_at:
    string | null;

  updated_at:
    string | null;

};


export type StoredGrowthOSUserModulePermission = {

  permission_id:
    string;

  membership_id:
    string;

  module_id:
    string;

  permission:
    GrowthOSUserModulePermission;

  created_at:
    string | null;

  updated_at:
    string | null;

};

export type StoredGrowthOSUserSubmodulePermission = {

  permission_id:
    string;

  membership_id:
    string;

  module_id:
    string;

  submodule_id:
    string;

  permission:
    GrowthOSUserSubmodulePermission;

  created_at:
    string | null;

  updated_at:
    string | null;

};


// ============================================================
// DEFAULT MODULE CATALOG
// ============================================================

const DEFAULT_MODULES = [

  {
    moduleId:
      'command-center',

    moduleName:
      'Command Center',

    description:
      'Executive business overview and cross-channel intelligence.',

    moduleType:
      'standard',

    category:
      'workspace',

    routeKey:
      'CEO Summary',

    status:
      'active',

    setupRequired:
      false,
  },


  {
    moduleId:
      'meta',

    moduleName:
      'Meta',

    description:
      'Meta campaign, ad set, creative and performance intelligence.',

    moduleType:
      'standard',

    category:
      'growth',

    routeKey:
      'Meta OS',

    status:
      'active',

    setupRequired:
      true,
  },


  {
    moduleId:
      'google',

    moduleName:
      'Google',

    description:
      'Google Ads, search intent and commerce performance intelligence.',

    moduleType:
      'standard',

    category:
      'growth',

    routeKey:
      'Google OS',

    status:
      'active',

    setupRequired:
      true,
  },


  {
    moduleId:
      'attribution',

    moduleName:
      'Attribution',

    description:
      'Customer journey and multi-touch attribution intelligence.',

    moduleType:
      'standard',

    category:
      'growth',

    routeKey:
      'Attribution OS',

    status:
      'active',

    setupRequired:
      true,
  },


  {
    moduleId:
      'retention',

    moduleName:
      'Retention',

    description:
      'Customer retention, opportunities and next best actions.',

    moduleType:
      'standard',

    category:
      'customers',

    routeKey:
      'Retention OS',

    status:
      'active',

    setupRequired:
      true,
  },


  {
    moduleId:
      'product',

    moduleName:
      'Product',

    description:
      'SKU, inventory, demand and product intelligence.',

    moduleType:
      'standard',

    category:
      'commerce',

    routeKey:
      'Product OS',

    status:
      'active',

    setupRequired:
      true,
  },

] as const;


// ============================================================
// DEFAULT PLANS
// ============================================================

const DEFAULT_PLANS = [

  {
    planId:
      'starter',

    planName:
      'Starter',

    description:
      'Accessible Growth OS for smaller and emerging businesses.',

    status:
      'active',

    monthlyOrderLimit:
      2500,

    maxUsers:
      3,

    modules: [
      'command-center',
      'meta',
    ],
  },


  {
    planId:
      'pro',

    planName:
      'Pro',

    description:
      'Growth intelligence for scaling commerce businesses.',

    status:
      'active',

    monthlyOrderLimit:
      10000,

    maxUsers:
      8,

    modules: [
      'command-center',
      'meta',
      'google',
      'product',
    ],
  },


  {
    planId:
      'advanced',

    planName:
      'Advanced',

    description:
      'Full intelligence stack including attribution and retention.',

    status:
      'active',

    monthlyOrderLimit:
      50000,

    maxUsers:
      20,

    modules: [
      'command-center',
      'meta',
      'google',
      'attribution',
      'retention',
      'product',
    ],
  },


  {
    planId:
      'enterprise',

    planName:
      'Enterprise',

    description:
      'Growth OS for high-volume and enterprise businesses.',

    status:
      'active',

    monthlyOrderLimit:
      null,

    maxUsers:
      null,

    modules: [
      'command-center',
      'meta',
      'google',
      'attribution',
      'retention',
      'product',
    ],
  },

] as const;


// ============================================================
// PROCESS CACHE
// ============================================================

let adminControlReady =
  false;


let adminControlPromise:
  Promise<void> | null =
    null;


// ============================================================
// HELPERS
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS admin control plane requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// DETERMINISTIC ID
// ============================================================

function deterministicId(
  prefix:
    string,
  parts:
    string[]
) {

  return (
    prefix
    +
    '_'
    +
    crypto
      .createHash(
        'sha256'
      )
      .update(
        parts.join(
          ':'
        )
      )
      .digest(
        'hex'
      )
      .slice(
        0,
        24
      )
  );

}


// ============================================================
// ENSURE PLANS TABLE
// ============================================================

async function ensurePlansTable() {

  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.plans\`
      (

        plan_id STRING NOT NULL,

        plan_name STRING NOT NULL,

        description STRING,

        status STRING NOT NULL,

        monthly_order_limit INT64,

        max_users INT64,

        created_at TIMESTAMP,

        updated_at TIMESTAMP

      )

      CLUSTER BY
        plan_id,
        status

    `,

    location:
      LOCATION,

  });

}


// ============================================================
// ENSURE MODULES TABLE
// ============================================================

async function ensureModulesTable() {

  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.modules\`
      (

        module_id STRING NOT NULL,

        module_name STRING NOT NULL,

        description STRING,

        module_type STRING NOT NULL,

        category STRING NOT NULL,

        route_key STRING NOT NULL,

        status STRING NOT NULL,

        setup_required BOOL,

        created_at TIMESTAMP,

        updated_at TIMESTAMP

      )

      CLUSTER BY
        module_id,
        category,
        status

    `,

    location:
      LOCATION,

  });

}


// ============================================================
// ENSURE PLAN MODULES TABLE
// ============================================================

async function ensurePlanModulesTable() {

  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.plan_modules\`
      (

        plan_id STRING NOT NULL,

        module_id STRING NOT NULL,

        enabled BOOL NOT NULL,

        created_at TIMESTAMP,

        updated_at TIMESTAMP

      )

      CLUSTER BY
        plan_id,
        module_id,
        enabled

    `,

    location:
      LOCATION,

  });

}


// ============================================================
// ENSURE BRAND SUBSCRIPTIONS TABLE
// ============================================================

async function ensureBrandSubscriptionsTable() {

  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.brand_subscriptions\`
      (

        subscription_id STRING NOT NULL,

        workspace_id STRING NOT NULL,

        brand_id STRING NOT NULL,

        plan_id STRING NOT NULL,

        status STRING NOT NULL,

        order_limit_override_mode STRING NOT NULL,

        monthly_order_limit_override INT64,

        created_at TIMESTAMP,

        updated_at TIMESTAMP

      )

      CLUSTER BY
        workspace_id,
        brand_id,
        plan_id,
        status

    `,

    location:
      LOCATION,

  });

}


// ============================================================
// ENSURE BRAND MODULE OVERRIDES TABLE
// ============================================================

async function ensureBrandModuleOverridesTable() {

  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.brand_module_overrides\`
      (

        override_id STRING NOT NULL,

        workspace_id STRING NOT NULL,

        brand_id STRING NOT NULL,

        module_id STRING NOT NULL,

        module_override STRING NOT NULL,

        created_at TIMESTAMP,

        updated_at TIMESTAMP

      )

      CLUSTER BY
        workspace_id,
        brand_id,
        module_id

    `,

    location:
      LOCATION,

  });

}


// ============================================================
// ENSURE USER MODULE PERMISSIONS TABLE
// ============================================================

async function ensureUserModulePermissionsTable() {

  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.user_module_permissions\`
      (

        permission_id STRING NOT NULL,

        membership_id STRING NOT NULL,

        module_id STRING NOT NULL,

        permission STRING NOT NULL,

        created_at TIMESTAMP,

        updated_at TIMESTAMP

      )

      CLUSTER BY
        membership_id,
        module_id

    `,

    location:
      LOCATION,

  });

}

// ============================================================
// ENSURE USER SUBMODULE PERMISSIONS TABLE
// ============================================================

async function ensureUserSubmodulePermissionsTable() {

  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      CREATE TABLE IF NOT EXISTS
        \`${projectId}.${DATASET_ID}.user_submodule_permissions\`
      (

        permission_id STRING NOT NULL,

        membership_id STRING NOT NULL,

        module_id STRING NOT NULL,

        submodule_id STRING NOT NULL,

        permission STRING NOT NULL,

        created_at TIMESTAMP,

        updated_at TIMESTAMP

      )

      CLUSTER BY
        membership_id,
        module_id,
        submodule_id

    `,

    location:
      LOCATION,

  });

}


// ============================================================
// SEED MODULE CATALOG
// ============================================================

async function seedModules() {

  const projectId =
    requireProjectId();


  for (
    const module
    of DEFAULT_MODULES
  ) {

    await bigquery.query({

      query: `

        MERGE
          \`${projectId}.${DATASET_ID}.modules\`
          AS target

        USING
        (
          SELECT

            @module_id
              AS module_id,

            @module_name
              AS module_name,

            @description
              AS description,

            @module_type
              AS module_type,

            @category
              AS category,

            @route_key
              AS route_key,

            @status
              AS status,

            @setup_required
              AS setup_required

        )
        AS source


        ON
          target.module_id =
          source.module_id


        WHEN MATCHED THEN

          UPDATE SET

            module_name =
              source.module_name,

            description =
              source.description,

            module_type =
              source.module_type,

            category =
              source.category,

            route_key =
              source.route_key,

            status =
              source.status,

            setup_required =
              source.setup_required,

            updated_at =
              CURRENT_TIMESTAMP()


        WHEN NOT MATCHED THEN

          INSERT
          (

            module_id,

            module_name,

            description,

            module_type,

            category,

            route_key,

            status,

            setup_required,

            created_at,

            updated_at

          )

          VALUES
          (

            source.module_id,

            source.module_name,

            source.description,

            source.module_type,

            source.category,

            source.route_key,

            source.status,

            source.setup_required,

            CURRENT_TIMESTAMP(),

            CURRENT_TIMESTAMP()

          )

      `,

      location:
        LOCATION,

      params: {

        module_id:
          module.moduleId,

        module_name:
          module.moduleName,

        description:
          module.description,

        module_type:
          module.moduleType,

        category:
          module.category,

        route_key:
          module.routeKey,

        status:
          module.status,

        setup_required:
          module.setupRequired,

      },

      types: {

        module_id:
          'STRING',

        module_name:
          'STRING',

        description:
          'STRING',

        module_type:
          'STRING',

        category:
          'STRING',

        route_key:
          'STRING',

        status:
          'STRING',

        setup_required:
          'BOOL',

      },

    });

  }

}


// ============================================================
// SEED PLAN CATALOG
// ============================================================

async function seedPlans() {

  const projectId =
    requireProjectId();


  for (
    const plan
    of DEFAULT_PLANS
  ) {

    await bigquery.query({

      query: `

        MERGE
          \`${projectId}.${DATASET_ID}.plans\`
          AS target

        USING
        (
          SELECT

            @plan_id
              AS plan_id,

            @plan_name
              AS plan_name,

            @description
              AS description,

            @status
              AS status,

            @monthly_order_limit
              AS monthly_order_limit,

            @max_users
              AS max_users

        )
        AS source


        ON
          target.plan_id =
          source.plan_id


        WHEN MATCHED THEN

          UPDATE SET

            plan_name =
              source.plan_name,

            description =
              source.description,

            status =
              source.status,

            monthly_order_limit =
              source.monthly_order_limit,

            max_users =
              source.max_users,

            updated_at =
              CURRENT_TIMESTAMP()


        WHEN NOT MATCHED THEN

          INSERT
          (

            plan_id,

            plan_name,

            description,

            status,

            monthly_order_limit,

            max_users,

            created_at,

            updated_at

          )

          VALUES
          (

            source.plan_id,

            source.plan_name,

            source.description,

            source.status,

            source.monthly_order_limit,

            source.max_users,

            CURRENT_TIMESTAMP(),

            CURRENT_TIMESTAMP()

          )

      `,

      location:
        LOCATION,

      params: {

        plan_id:
          plan.planId,

        plan_name:
          plan.planName,

        description:
          plan.description,

        status:
          plan.status,

        monthly_order_limit:
          plan.monthlyOrderLimit,

        max_users:
          plan.maxUsers,

      },

      types: {

        plan_id:
          'STRING',

        plan_name:
          'STRING',

        description:
          'STRING',

        status:
          'STRING',

        monthly_order_limit:
          'INT64',

        max_users:
          'INT64',

      },

    });

  }

}


// ============================================================
// SEED PLAN MODULE ENTITLEMENTS
// ============================================================

async function seedPlanModules() {

  const projectId =
    requireProjectId();


  const moduleIds =
    DEFAULT_MODULES.map(
      module =>
        module.moduleId
    );


  for (
    const plan
    of DEFAULT_PLANS
  ) {

    for (
      const moduleId
      of moduleIds
    ) {

      const enabled =
        plan.modules.includes(
          moduleId as any
        );


      await bigquery.query({

        query: `

          MERGE
            \`${projectId}.${DATASET_ID}.plan_modules\`
            AS target

          USING
          (
            SELECT

              @plan_id
                AS plan_id,

              @module_id
                AS module_id,

              @enabled
                AS enabled

          )
          AS source


          ON
            target.plan_id =
            source.plan_id

            AND target.module_id =
            source.module_id


          WHEN MATCHED THEN

            UPDATE SET

              enabled =
                source.enabled,

              updated_at =
                CURRENT_TIMESTAMP()


          WHEN NOT MATCHED THEN

            INSERT
            (

              plan_id,

              module_id,

              enabled,

              created_at,

              updated_at

            )

            VALUES
            (

              source.plan_id,

              source.module_id,

              source.enabled,

              CURRENT_TIMESTAMP(),

              CURRENT_TIMESTAMP()

            )

        `,

        location:
          LOCATION,

        params: {

          plan_id:
            plan.planId,

          module_id:
            moduleId,

          enabled,

        },

        types: {

          plan_id:
            'STRING',

          module_id:
            'STRING',

          enabled:
            'BOOL',

        },

      });

    }

  }

}


// ============================================================
// ENSURE ADMIN CONTROL PLANE
// ============================================================

export async function ensureGrowthOSAdminControlPlane() {

  if (
    adminControlReady
  ) {

    return;

  }


  if (
    adminControlPromise
  ) {

    return adminControlPromise;

  }


  adminControlPromise =
    (async () => {

      await ensureGrowthOSControlPlane();

      await ensureGrowthOSAuthStore();


      await ensurePlansTable();

      await ensureModulesTable();

      await ensurePlanModulesTable();

      await ensureBrandSubscriptionsTable();

      await ensureBrandModuleOverridesTable();

      await ensureUserModulePermissionsTable();

      await ensureUserSubmodulePermissionsTable();

      await seedModules();

      await seedPlans();

      await seedPlanModules();


      adminControlReady =
        true;

    })();


  try {

    await adminControlPromise;

  } catch (
    error
  ) {

    adminControlPromise =
      null;

    adminControlReady =
      false;

    throw error;

  }


  adminControlPromise =
    null;

}


// ============================================================
// LIST PLANS
// ============================================================

export async function listGrowthOSPlans():

  Promise<
    StoredGrowthOSPlan[]
  > {

  await ensureGrowthOSAdminControlPlane();


  const projectId =
    requireProjectId();


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          plan_id,

          plan_name,

          description,

          status,

          monthly_order_limit,

          max_users,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            created_at
          )
            AS created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            updated_at
          )
            AS updated_at

        FROM
          \`${projectId}.${DATASET_ID}.plans\`

        ORDER BY

          CASE plan_id

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

          plan_name

      `,

      location:
        LOCATION,

    });


  return (
    rows
    ||
    []
  ) as StoredGrowthOSPlan[];

}


// ============================================================
// LIST MODULES
// ============================================================

export async function listGrowthOSModules():

  Promise<
    StoredGrowthOSModule[]
  > {

  await ensureGrowthOSAdminControlPlane();


  const projectId =
    requireProjectId();


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          module_id,

          module_name,

          description,

          module_type,

          category,

          route_key,

          status,

          setup_required,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            created_at
          )
            AS created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            updated_at
          )
            AS updated_at

        FROM
          \`${projectId}.${DATASET_ID}.modules\`

        ORDER BY

          CASE category

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

          module_name

      `,

      location:
        LOCATION,

    });


  return (
    rows
    ||
    []
  ) as StoredGrowthOSModule[];

}


// ============================================================
// LIST PLAN MODULES
// ============================================================

export async function listGrowthOSPlanModules(
  planId: string
) {

  await ensureGrowthOSAdminControlPlane();


  const projectId =
    requireProjectId();


  const normalizedPlanId =
    String(
      planId
      ||
      ''
    ).trim();


  if (!normalizedPlanId) {

    throw new Error(
      'planId is required'
    );

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          pm.plan_id,

          pm.module_id,

          pm.enabled,

          m.module_name,

          m.description,

          m.category,

          m.route_key,

          m.status AS module_status,

          m.setup_required

        FROM
          \`${projectId}.${DATASET_ID}.plan_modules\`
          AS pm

        LEFT JOIN
          \`${projectId}.${DATASET_ID}.modules\`
          AS m

        ON
          m.module_id =
          pm.module_id

        WHERE

          pm.plan_id =
            @plan_id

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

      params: {

        plan_id:
          normalizedPlanId,

      },

      types: {

        plan_id:
          'STRING',

      },

    });


  return (
    rows
    ||
    []
  ) as Array<{

    plan_id:
      string;

    module_id:
      string;

    enabled:
      boolean;

    module_name:
      string | null;

    description:
      string | null;

    category:
      string | null;

    route_key:
      string | null;

    module_status:
      string | null;

    setup_required:
      boolean | null;

  }>;

}


// ============================================================
// GET BRAND SUBSCRIPTION
// ============================================================

export async function getGrowthOSBrandSubscription(

  workspaceId:
    string,

  brandId:
    string

):

  Promise<
    StoredGrowthOSBrandSubscription |
    null
  > {

  await ensureGrowthOSAdminControlPlane();


  const projectId =
    requireProjectId();


  const normalizedWorkspaceId =
    String(
      workspaceId
      ||
      ''
    ).trim();


  const normalizedBrandId =
    String(
      brandId
      ||
      ''
    ).trim();


  if (
    !normalizedWorkspaceId
    ||
    !normalizedBrandId
  ) {

    throw new Error(
      'workspaceId and brandId are required'
    );

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          subscription_id,

          workspace_id,

          brand_id,

          plan_id,

          status,

          order_limit_override_mode,

          monthly_order_limit_override,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            created_at
          )
            AS created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            updated_at
          )
            AS updated_at

        FROM
          \`${projectId}.${DATASET_ID}.brand_subscriptions\`

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

        QUALIFY

          ROW_NUMBER() OVER (

            PARTITION BY
              workspace_id,
              brand_id

            ORDER BY
              updated_at DESC,
              created_at DESC,
              subscription_id DESC

          ) = 1

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          normalizedWorkspaceId,

        brand_id:
          normalizedBrandId,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredGrowthOSBrandSubscription
    |
    null;

}


// ============================================================
// UPSERT BRAND SUBSCRIPTION
//
// One logical subscription row per:
//
// workspace_id + brand_id
//
// BigQuery does not enforce UNIQUE constraints.
//
// We use:
//
// transaction
// DELETE existing logical row
// INSERT canonical row
//
// Conflicting concurrent writes are retried.
// ============================================================

export async function upsertGrowthOSBrandSubscription(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    planId:
      string;

    status?:
      GrowthOSSubscriptionStatus;

    orderLimitOverrideMode?:
      GrowthOSOrderLimitOverrideMode;

    monthlyOrderLimitOverride?:
      number | null;

  }
) {

  await ensureGrowthOSAdminControlPlane();


  const projectId =
    requireProjectId();


  const workspaceId =
    String(
      input.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      input.brandId
      ||
      ''
    ).trim();


  const planId =
    String(
      input.planId
      ||
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
    ||
    !planId
  ) {

    throw new Error(
      'workspaceId, brandId and planId are required'
    );

  }


  // ==========================================================
  // VERIFY TENANT
  // ==========================================================

  await resolveTenantContextById(
    workspaceId,
    brandId
  );


  // ==========================================================
  // VERIFY PLAN
  // ==========================================================

  const [
    planRows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          plan_id

        FROM
          \`${projectId}.${DATASET_ID}.plans\`

        WHERE

          plan_id =
            @plan_id

          AND status !=
            'archived'

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        plan_id:
          planId,

      },

      types: {

        plan_id:
          'STRING',

      },

    });


  if (
    !planRows?.length
  ) {

    throw new Error(
      'Growth OS plan does not exist'
    );

  }


  // ==========================================================
  // NORMALIZE COMMERCIAL SETTINGS
  // ==========================================================

  const status =
    input.status
    ||
    'active';


  const overrideMode =
    input.orderLimitOverrideMode
    ||
    'inherit';


  let monthlyOrderLimitOverride:
    number |
    null =
      null;


  if (
    overrideMode ===
      'custom'
  ) {

    const value =
      Number(
        input.monthlyOrderLimitOverride
      );


    if (
      !Number.isFinite(
        value
      )
      ||
      value <=
        0
    ) {

      throw new Error(
        'Custom monthly order limit must be greater than zero'
      );

    }


    monthlyOrderLimitOverride =
      Math.floor(
        value
      );

  }


  // ==========================================================
  // DETERMINISTIC SUBSCRIPTION ID
  // ==========================================================

  const subscriptionId =
    deterministicId(
      'sub',
      [
        workspaceId,
        brandId,
      ]
    );


  // ==========================================================
  // CANONICAL WRITE
  // ==========================================================

  const maxAttempts =
    3;


  let lastError:
    unknown =
      null;


  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {

    try {

      await bigquery.query({

        query: `

          BEGIN TRANSACTION;


          DELETE FROM
            \`${projectId}.${DATASET_ID}.brand_subscriptions\`

          WHERE

            workspace_id =
              @workspace_id

            AND brand_id =
              @brand_id;


          INSERT INTO
            \`${projectId}.${DATASET_ID}.brand_subscriptions\`
          (

            subscription_id,

            workspace_id,

            brand_id,

            plan_id,

            status,

            order_limit_override_mode,

            monthly_order_limit_override,

            created_at,

            updated_at

          )

          VALUES
          (

            @subscription_id,

            @workspace_id,

            @brand_id,

            @plan_id,

            @status,

            @order_limit_override_mode,

            @monthly_order_limit_override,

            CURRENT_TIMESTAMP(),

            CURRENT_TIMESTAMP()

          );


          COMMIT TRANSACTION;

        `,

        location:
          LOCATION,

        params: {

          subscription_id:
            subscriptionId,

          workspace_id:
            workspaceId,

          brand_id:
            brandId,

          plan_id:
            planId,

          status,

          order_limit_override_mode:
            overrideMode,

          monthly_order_limit_override:
            monthlyOrderLimitOverride,

        },

        types: {

          subscription_id:
            'STRING',

          workspace_id:
            'STRING',

          brand_id:
            'STRING',

          plan_id:
            'STRING',

          status:
            'STRING',

          order_limit_override_mode:
            'STRING',

          monthly_order_limit_override:
            'INT64',

        },

      });


      lastError =
        null;


      break;

    } catch (
      error
    ) {

      lastError =
        error;


      if (
        attempt >=
        maxAttempts
      ) {

        break;

      }


      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            attempt * 250
          )
      );

    }

  }


  if (
    lastError
  ) {

    throw lastError;

  }


  return {

    subscriptionId,

    workspaceId,

    brandId,

    planId,

    status,

    orderLimitOverrideMode:
      overrideMode,

    monthlyOrderLimitOverride,

  };

}


// ============================================================
// UPSERT BRAND MODULE OVERRIDE
// ============================================================

export async function upsertGrowthOSBrandModuleOverride(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    moduleId:
      string;

    moduleOverride:
      GrowthOSModuleOverride;

  }
) {

  await ensureGrowthOSAdminControlPlane();


  const projectId =
    requireProjectId();


  const workspaceId =
    String(
      input.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      input.brandId
      ||
      ''
    ).trim();


  const moduleId =
    String(
      input.moduleId
      ||
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
    ||
    !moduleId
  ) {

    throw new Error(
      'workspaceId, brandId and moduleId are required'
    );

  }


  await resolveTenantContextById(
    workspaceId,
    brandId
  );


  const overrideId =
    deterministicId(
      'ovr',
      [
        workspaceId,
        brandId,
        moduleId,
      ]
    );


  await bigquery.query({

    query: `

      MERGE
        \`${projectId}.${DATASET_ID}.brand_module_overrides\`
        AS target

      USING
      (
        SELECT

          @override_id
            AS override_id,

          @workspace_id
            AS workspace_id,

          @brand_id
            AS brand_id,

          @module_id
            AS module_id,

          @module_override
            AS module_override

      )
      AS source


      ON

        target.workspace_id =
          source.workspace_id

        AND target.brand_id =
          source.brand_id

        AND target.module_id =
          source.module_id


      WHEN MATCHED THEN

        UPDATE SET

          override_id =
            source.override_id,

          module_override =
            source.module_override,

          updated_at =
            CURRENT_TIMESTAMP()


      WHEN NOT MATCHED THEN

        INSERT
        (

          override_id,

          workspace_id,

          brand_id,

          module_id,

          module_override,

          created_at,

          updated_at

        )

        VALUES
        (

          source.override_id,

          source.workspace_id,

          source.brand_id,

          source.module_id,

          source.module_override,

          CURRENT_TIMESTAMP(),

          CURRENT_TIMESTAMP()

        )

    `,

    location:
      LOCATION,

    params: {

      override_id:
        overrideId,

      workspace_id:
        workspaceId,

      brand_id:
        brandId,

      module_id:
        moduleId,

      module_override:
        input.moduleOverride,

    },

    types: {

      override_id:
        'STRING',

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      module_id:
        'STRING',

      module_override:
        'STRING',

    },

  });


  return {

    overrideId,

    workspaceId,

    brandId,

    moduleId,

    moduleOverride:
      input.moduleOverride,

  };

}


// ============================================================
// LIST USER MODULE PERMISSIONS — FAST RUNTIME READ
//
// NO schema creation / bootstrap / migrations.
// ============================================================

export async function listGrowthOSUserModulePermissionsFast(
  membershipId: string
):

  Promise<
    StoredGrowthOSUserModulePermission[]
  > {

  const projectId =
    requireProjectId();


  const normalizedMembershipId =
    String(
      membershipId
      ||
      ''
    ).trim();


  if (!normalizedMembershipId) {

    throw new Error(
      'membershipId is required'
    );

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          permission_id,

          membership_id,

          module_id,

          permission,

          created_at,

          updated_at

        FROM
          \`${projectId}.${DATASET_ID}.user_module_permissions\`

        WHERE
          membership_id =
            @membership_id

        ORDER BY
          module_id

      `,

      location:
        LOCATION,

      params: {

        membership_id:
          normalizedMembershipId,

      },

      types: {

        membership_id:
          'STRING',

      },

    });


  return (
    rows
    ||
    []
  ) as StoredGrowthOSUserModulePermission[];

}

// ============================================================
// LIST USER SUBMODULE PERMISSIONS — FAST RUNTIME READ
// ============================================================

export async function listGrowthOSUserSubmodulePermissionsFast(
  membershipId: string
):

  Promise<
    StoredGrowthOSUserSubmodulePermission[]
  > {

  const projectId =
    requireProjectId();


  const normalizedMembershipId =
    String(
      membershipId
      ||
      ''
    ).trim();


  if (!normalizedMembershipId) {

    throw new Error(
      'membershipId is required'
    );

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          permission_id,

          membership_id,

          module_id,

          submodule_id,

          permission,

          created_at,

          updated_at

        FROM
          \`${projectId}.${DATASET_ID}.user_submodule_permissions\`

        WHERE
          membership_id =
            @membership_id

        ORDER BY
          module_id,
          submodule_id

      `,

      location:
        LOCATION,

      params: {

        membership_id:
          normalizedMembershipId,

      },

      types: {

        membership_id:
          'STRING',

      },

    });


  return (
    rows
    ||
    []
  ) as StoredGrowthOSUserSubmodulePermission[];

}

// ============================================================
// UPSERT USER MODULE PERMISSION
// ============================================================

export async function upsertGrowthOSUserModulePermission(
  input: {

    membershipId:
      string;

    moduleId:
      string;

    permission:
      GrowthOSUserModulePermission;

  }
) {


  const projectId =
    requireProjectId();


  const membershipId =
    String(
      input.membershipId
      ||
      ''
    ).trim();


  const moduleId =
    String(
      input.moduleId
      ||
      ''
    ).trim();

  const permission =
    input.permission;


  const allowedPermissions:
    GrowthOSUserModulePermission[] =
      [
        'inherit',
        'viewer',
        'editor',
        'disabled',
      ];


  if (
    !allowedPermissions.includes(
      permission
    )
  ) {

    throw new Error(
      'Invalid user module permission'
    );

  }  


  if (
    !membershipId
    ||
    !moduleId
  ) {

    throw new Error(
      'membershipId and moduleId are required'
    );

  }


  // ==========================================================
  // VERIFY MEMBERSHIP
  // ==========================================================

  const [
    membershipRows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          membership_id

        FROM
          \`${projectId}.${DATASET_ID}.brand_memberships\`

        WHERE

          membership_id =
            @membership_id


        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        membership_id:
          membershipId,

      },

      types: {

        membership_id:
          'STRING',

      },

    });


  if (
    !membershipRows?.length
  ) {

    throw new Error(
      'Growth OS membership does not exist'
    );

  }


  const permissionId =
    deterministicId(
      'perm',
      [
        membershipId,
        moduleId,
      ]
    );


  await bigquery.query({

    query: `

      MERGE
        \`${projectId}.${DATASET_ID}.user_module_permissions\`
        AS target

      USING
      (
        SELECT

          @permission_id
            AS permission_id,

          @membership_id
            AS membership_id,

          @module_id
            AS module_id,

          @permission
            AS permission

      )
      AS source


      ON

        target.membership_id =
          source.membership_id

        AND target.module_id =
          source.module_id


      WHEN MATCHED THEN

        UPDATE SET

          permission_id =
            source.permission_id,

          permission =
            source.permission,

          updated_at =
            CURRENT_TIMESTAMP()


      WHEN NOT MATCHED THEN

        INSERT
        (

          permission_id,

          membership_id,

          module_id,

          permission,

          created_at,

          updated_at

        )

        VALUES
        (

          source.permission_id,

          source.membership_id,

          source.module_id,

          source.permission,

          CURRENT_TIMESTAMP(),

          CURRENT_TIMESTAMP()

        )

    `,

    location:
      LOCATION,

    params: {

      permission_id:
        permissionId,

      membership_id:
        membershipId,

      module_id:
        moduleId,

      permission,

    },

    types: {

      permission_id:
        'STRING',

      membership_id:
        'STRING',

      module_id:
        'STRING',

      permission:
        'STRING',

    },

  });


  return {

    permissionId,

    membershipId,

    moduleId,

    permission,

  };

}

// ============================================================
// UPSERT USER SUBMODULE PERMISSION
//
// FAST CONTROL-PLANE WRITE.
//
// Membership may be ACTIVE or INACTIVE.
//
// This allows permissions to be configured before a newly
// created user's brand membership is activated.
// ============================================================

export async function upsertGrowthOSUserSubmodulePermission(
  input: {

    membershipId:
      string;

    moduleId:
      string;

    submoduleId:
      string;

    permission:
      GrowthOSUserSubmodulePermission;

  }
) {

  const projectId =
    requireProjectId();


  const membershipId =
    String(
      input.membershipId
      ||
      ''
    ).trim();


  const moduleId =
    String(
      input.moduleId
      ||
      ''
    ).trim();


  const submoduleId =
    String(
      input.submoduleId
      ||
      ''
    ).trim();


  const permission =
    input.permission;


  const allowedPermissions:
    GrowthOSUserSubmodulePermission[] =
      [
        'inherit',
        'viewer',
        'editor',
        'disabled',
      ];


  if (
    !allowedPermissions.includes(
      permission
    )
  ) {

    throw new Error(
      'Invalid user submodule permission'
    );

  }


  if (
    !membershipId
    ||
    !moduleId
    ||
    !submoduleId
  ) {

    throw new Error(
      'membershipId, moduleId and submoduleId are required'
    );

  }


  // ==========================================================
  // VERIFY MEMBERSHIP EXISTS
  //
  // Do NOT require status = active.
  //
  // New users are deliberately configured while their
  // membership is inactive.
  // ==========================================================

  const [
    membershipRows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          membership_id

        FROM
          \`${projectId}.${DATASET_ID}.brand_memberships\`

        WHERE
          membership_id =
            @membership_id

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        membership_id:
          membershipId,

      },

      types: {

        membership_id:
          'STRING',

      },

    });


  if (
    !membershipRows?.length
  ) {

    throw new Error(
      'Growth OS membership does not exist'
    );

  }


  // ==========================================================
  // DETERMINISTIC PERMISSION ID
  // ==========================================================

  const permissionId =
    deterministicId(
      'subperm',
      [
        membershipId,
        moduleId,
        submoduleId,
      ]
    );


  // ==========================================================
  // UPSERT
  // ==========================================================

  await bigquery.query({

    query: `

      MERGE
        \`${projectId}.${DATASET_ID}.user_submodule_permissions\`
        AS target

      USING
      (

        SELECT

          @permission_id
            AS permission_id,

          @membership_id
            AS membership_id,

          @module_id
            AS module_id,

          @submodule_id
            AS submodule_id,

          @permission
            AS permission

      )
      AS source


      ON

        target.membership_id =
          source.membership_id

        AND target.module_id =
          source.module_id

        AND target.submodule_id =
          source.submodule_id


      WHEN MATCHED THEN

        UPDATE SET

          permission_id =
            source.permission_id,

          permission =
            source.permission,

          updated_at =
            CURRENT_TIMESTAMP()


      WHEN NOT MATCHED THEN

        INSERT
        (

          permission_id,

          membership_id,

          module_id,

          submodule_id,

          permission,

          created_at,

          updated_at

        )

        VALUES
        (

          source.permission_id,

          source.membership_id,

          source.module_id,

          source.submodule_id,

          source.permission,

          CURRENT_TIMESTAMP(),

          CURRENT_TIMESTAMP()

        )

    `,

    location:
      LOCATION,

    params: {

      permission_id:
        permissionId,

      membership_id:
        membershipId,

      module_id:
        moduleId,

      submodule_id:
        submoduleId,

      permission,

    },

    types: {

      permission_id:
        'STRING',

      membership_id:
        'STRING',

      module_id:
        'STRING',

      submodule_id:
        'STRING',

      permission:
        'STRING',

    },

  });


  return {

    permissionId,

    membershipId,

    moduleId,

    submoduleId,

    permission,

  };

}


// ============================================================
// RUNTIME WORKSPACE SUBSCRIPTION SNAPSHOT
//
// IMPORTANT:
//
// Runtime request.
//
// NO:
//
// - schema creation
// - seeding
// - migrations
// - bootstrap
//
// One BigQuery query returns:
//
// subscription
// plan
// module catalog
// plan entitlement
// brand override
// effective access
// ============================================================

export async function getGrowthOSWorkspaceSubscriptionSnapshot(

  workspaceId:
    string,

  brandId:
    string

) {

  const projectId =
    requireProjectId();


  const normalizedWorkspaceId =
    String(
      workspaceId
      ||
      ''
    ).trim();


  const normalizedBrandId =
    String(
      brandId
      ||
      ''
    ).trim();


  if (
    !normalizedWorkspaceId
    ||
    !normalizedBrandId
  ) {

    throw new Error(
      'workspaceId and brandId are required'
    );

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        WITH latest_subscription AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_subscriptions\`

          WHERE

            workspace_id =
              @workspace_id

            AND brand_id =
              @brand_id

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


        latest_brand_overrides AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_module_overrides\`

          WHERE

            workspace_id =
              @workspace_id

            AND brand_id =
              @brand_id

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

        )


        SELECT

          -- ==================================================
          -- SUBSCRIPTION
          -- ==================================================

          s.subscription_id,

          s.workspace_id,

          s.brand_id,

          s.plan_id,

          s.status
            AS subscription_status,

          s.order_limit_override_mode,

          s.monthly_order_limit_override,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            s.created_at
          )
            AS subscription_created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            s.updated_at
          )
            AS subscription_updated_at,


          -- ==================================================
          -- PLAN
          -- ==================================================

          p.plan_name,

          p.description
            AS plan_description,

          p.status
            AS plan_status,

          p.monthly_order_limit
            AS plan_monthly_order_limit,

          p.max_users,


          -- ==================================================
          -- EFFECTIVE ORDER LIMIT
          -- ==================================================

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


          -- ==================================================
          -- MODULE
          -- ==================================================

          m.module_id,

          m.module_name,

          m.description
            AS module_description,

          m.module_type,

          m.category,

          m.route_key,

          m.status
            AS module_status,

          m.setup_required,


          -- ==================================================
          -- PLAN ENTITLEMENT
          -- ==================================================

          COALESCE(
            pm.enabled,
            FALSE
          )
            AS plan_enabled,


          -- ==================================================
          -- BRAND OVERRIDE
          -- ==================================================

          COALESCE(
            bmo.module_override,
            'default'
          )
            AS brand_module_override,


          -- ==================================================
          -- EFFECTIVE MODULE ACCESS
          -- ==================================================

          CASE

            WHEN
              bmo.module_override =
                'enabled'

            THEN
              TRUE


            WHEN
              bmo.module_override =
                'disabled'

            THEN
              FALSE


            ELSE
              COALESCE(
                pm.enabled,
                FALSE
              )

          END
            AS effective_enabled


        FROM
          latest_subscription
          AS s


        INNER JOIN
          \`${projectId}.${DATASET_ID}.plans\`
          AS p

        ON
          p.plan_id =
            s.plan_id


        CROSS JOIN
          \`${projectId}.${DATASET_ID}.modules\`
          AS m


        LEFT JOIN
          \`${projectId}.${DATASET_ID}.plan_modules\`
          AS pm

        ON
          pm.plan_id =
            s.plan_id

          AND pm.module_id =
            m.module_id


        LEFT JOIN
          latest_brand_overrides
          AS bmo

        ON
          bmo.workspace_id =
            s.workspace_id

          AND bmo.brand_id =
            s.brand_id

          AND bmo.module_id =
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

      params: {

        workspace_id:
          normalizedWorkspaceId,

        brand_id:
          normalizedBrandId,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

      },

    });


  const resultRows =
    (
      rows
      ||
      []
    ) as any[];


  // ==========================================================
  // NO SUBSCRIPTION
  // ==========================================================

  if (
    resultRows.length ===
    0
  ) {

    return {

      configured:
        false,

      subscription:
        null,

      plan:
        null,

      modules:
        [],

    };

  }


  // ==========================================================
  // ROOT
  // ==========================================================

  const root =
    resultRows[0];


  // ==========================================================
  // RESPONSE
  // ==========================================================

  return {

    configured:
      true,


    subscription: {

      subscriptionId:
        String(
          root.subscription_id
        ),

      workspaceId:
        String(
          root.workspace_id
        ),

      brandId:
        String(
          root.brand_id
        ),

      status:
        String(
          root.subscription_status
        ),

      planId:
        String(
          root.plan_id
        ),

      orderLimitOverrideMode:
        String(
          root.order_limit_override_mode
        ),

      monthlyOrderLimitOverride:
        root.monthly_order_limit_override
        ??
        null,

      createdAt:
        root.subscription_created_at
        ??
        null,

      updatedAt:
        root.subscription_updated_at
        ??
        null,

    },


    plan: {

      planId:
        String(
          root.plan_id
        ),

      name:
        String(
          root.plan_name
        ),

      description:
        root.plan_description
        ??
        null,

      status:
        String(
          root.plan_status
        ),

      monthlyOrderLimit:
        root.plan_monthly_order_limit
        ??
        null,

      effectiveMonthlyOrderLimit:
        root.effective_monthly_order_limit
        ??
        null,

      maxUsers:
        root.max_users
        ??
        null,

    },


    modules:
      resultRows.map(
        row => ({

          moduleId:
            String(
              row.module_id
            ),

          name:
            row.module_name
            ??
            null,

          description:
            row.module_description
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
            row.module_status
            ??
            null,

          setupRequired:
            Boolean(
              row.setup_required
            ),

          planEnabled:
            Boolean(
              row.plan_enabled
            ),

          brandOverride:
            String(
              row.brand_module_override
              ||
              'default'
            ),

          enabled:
            Boolean(
              row.effective_enabled
            ),

        })),

  };

}