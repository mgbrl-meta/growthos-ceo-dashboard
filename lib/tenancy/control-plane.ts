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

export type UpsertGrowthOSTenantInput = {

  workspaceId: string;

  workspaceName: string;

  workspaceSlug: string;

  brandId: string;

  brandName: string;

  brandSlug: string;

  currency?: string;

  timezone?: string;

};


// ============================================================
// HELPERS
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS control plane requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ENSURE CONTROL DATASET
// ============================================================

async function ensureControlDataset() {

  requireProjectId();


  try {

    await bigquery.createDataset(
      DATASET_ID,
      {
        location:
          LOCATION,
      }
    );

  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message ||
        ''
      )
        .toLowerCase();


    const alreadyExists =
      error?.code === 409
      ||
      message.includes(
        'already exists'
      );


    if (!alreadyExists) {

      throw error;

    }

  }

}


// ============================================================
// WORKSPACES
// ============================================================

async function ensureWorkspacesTable() {

  const projectId =
    requireProjectId();


  const query = `

    CREATE TABLE IF NOT EXISTS
      \`${projectId}.${DATASET_ID}.workspaces\`
    (

      workspace_id STRING,

      workspace_name STRING,

      workspace_slug STRING,

      status STRING,

      created_at TIMESTAMP,

      updated_at TIMESTAMP

    )

    CLUSTER BY
      workspace_id,
      status

  `;


  await bigquery.query({

    query,

    location:
      LOCATION,

  });

}


// ============================================================
// BRANDS
// ============================================================

async function ensureBrandsTable() {

  const projectId =
    requireProjectId();


  const query = `

    CREATE TABLE IF NOT EXISTS
      \`${projectId}.${DATASET_ID}.brands\`
    (

      brand_id STRING,

      workspace_id STRING,

      brand_name STRING,

      brand_slug STRING,

      status STRING,

      currency STRING,

      timezone STRING,

      created_at TIMESTAMP,

      updated_at TIMESTAMP

    )

    CLUSTER BY
      workspace_id,
      brand_id,
      status

  `;


  await bigquery.query({

    query,

    location:
      LOCATION,

  });

}


// ============================================================
// CONTROL PLANE BOOTSTRAP
//
// Idempotent.
// Safe to call repeatedly.
// ============================================================

export async function ensureGrowthOSControlPlane() {

  await ensureControlDataset();

  await ensureWorkspacesTable();

  await ensureBrandsTable();

}


// ============================================================
// GENERIC TENANT UPSERT
//
// CANONICAL SAAS TENANT PROVISIONING FUNCTION.
//
// Used by:
//
// development bootstrap
// Shopify installation
// future manual onboarding
// future admin provisioning
//
// This function contains NO provider-specific logic.
// ============================================================

export async function upsertGrowthOSTenant(
  input: UpsertGrowthOSTenantInput
) {

  await ensureGrowthOSControlPlane();


  const workspaceId =
    String(
      input.workspaceId || ''
    ).trim();


  const workspaceName =
    String(
      input.workspaceName || ''
    ).trim();


  const workspaceSlug =
    String(
      input.workspaceSlug || ''
    ).trim();


  const brandId =
    String(
      input.brandId || ''
    ).trim();


  const brandName =
    String(
      input.brandName || ''
    ).trim();


  const brandSlug =
    String(
      input.brandSlug || ''
    ).trim();


  const currency =
    String(
      input.currency
      ||
      'INR'
    )
      .trim()
      .toUpperCase();


  const timezone =
    String(
      input.timezone
      ||
      'Asia/Kolkata'
    ).trim();


  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (
    !workspaceId
    ||
    !workspaceName
    ||
    !workspaceSlug
    ||
    !brandId
    ||
    !brandName
    ||
    !brandSlug
  ) {

    throw new Error(
      'Growth OS tenant provisioning requires workspace and brand identity'
    );

  }


  const projectId =
    requireProjectId();


  // ==========================================================
  // UPSERT WORKSPACE
  // ==========================================================

  const workspaceQuery = `

    MERGE
      \`${projectId}.${DATASET_ID}.workspaces\`
      AS target

    USING
    (
      SELECT

        @workspace_id
          AS workspace_id,

        @workspace_name
          AS workspace_name,

        @workspace_slug
          AS workspace_slug

    )
    AS source


    ON
      target.workspace_id =
      source.workspace_id


    WHEN MATCHED THEN

      UPDATE SET

        workspace_name =
          source.workspace_name,

        workspace_slug =
          source.workspace_slug,

        status =
          'active',

        updated_at =
          CURRENT_TIMESTAMP()


    WHEN NOT MATCHED THEN

      INSERT
      (

        workspace_id,

        workspace_name,

        workspace_slug,

        status,

        created_at,

        updated_at

      )

      VALUES
      (

        source.workspace_id,

        source.workspace_name,

        source.workspace_slug,

        'active',

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP()

      )

  `;


  await bigquery.query({

    query:
      workspaceQuery,

    location:
      LOCATION,

    params: {

      workspace_id:
        workspaceId,

      workspace_name:
        workspaceName,

      workspace_slug:
        workspaceSlug,

    },

  });


  // ==========================================================
  // UPSERT BRAND
  // ==========================================================

  const brandQuery = `

    MERGE
      \`${projectId}.${DATASET_ID}.brands\`
      AS target

    USING
    (
      SELECT

        @brand_id
          AS brand_id,

        @workspace_id
          AS workspace_id,

        @brand_name
          AS brand_name,

        @brand_slug
          AS brand_slug,

        @currency
          AS currency,

        @timezone
          AS timezone

    )
    AS source


    ON
      target.workspace_id =
      source.workspace_id

      AND target.brand_id =
      source.brand_id


    WHEN MATCHED THEN

      UPDATE SET

        brand_name =
          source.brand_name,

        brand_slug =
          source.brand_slug,

        currency =
          source.currency,

        timezone =
          source.timezone,

        status =
          'active',

        updated_at =
          CURRENT_TIMESTAMP()


    WHEN NOT MATCHED THEN

      INSERT
      (

        brand_id,

        workspace_id,

        brand_name,

        brand_slug,

        status,

        currency,

        timezone,

        created_at,

        updated_at

      )

      VALUES
      (

        source.brand_id,

        source.workspace_id,

        source.brand_name,

        source.brand_slug,

        'active',

        source.currency,

        source.timezone,

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP()

      )

  `;


  await bigquery.query({

    query:
      brandQuery,

    location:
      LOCATION,

    params: {

      brand_id:
        brandId,

      workspace_id:
        workspaceId,

      brand_name:
        brandName,

      brand_slug:
        brandSlug,

      currency,

      timezone,

    },

  });


  return {

    workspaceId,

    workspaceName,

    workspaceSlug,

    brandId,

    brandName,

    brandSlug,

    currency,

    timezone,

  };

}


// ============================================================
// DEVELOPMENT TENANT
//
// DEVELOPMENT COMPATIBILITY ONLY.
//
// Brillare currently comes from environment configuration.
//
// The actual database provisioning is delegated to the same
// generic function future Shopify installations will use.
// ============================================================

export async function bootstrapDevelopmentTenant() {

  const workspaceId =
    process.env.GROWTHOS_DEFAULT_WORKSPACE_ID;


  const workspaceName =
    process.env.GROWTHOS_DEFAULT_WORKSPACE_NAME;


  const brandId =
    process.env.GROWTHOS_DEFAULT_BRAND_ID;


  const brandName =
    process.env.GROWTHOS_DEFAULT_BRAND_NAME;


  const currency =
    process.env.GROWTHOS_DEFAULT_CURRENCY
    ||
    'INR';


  const timezone =
    process.env.GROWTHOS_DEFAULT_TIMEZONE
    ||
    'Asia/Kolkata';


  if (
    !workspaceId
    ||
    !workspaceName
    ||
    !brandId
    ||
    !brandName
  ) {

    throw new Error(
      'Growth OS development workspace configuration is incomplete'
    );

  }


  return upsertGrowthOSTenant({

    workspaceId,

    workspaceName,

    workspaceSlug:
      workspaceId,

    brandId,

    brandName,

    brandSlug:
      brandId,

    currency,

    timezone,

  });

}