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


const CONTROL_DATASET =
  process.env.GROWTHOS_CONTROL_DATASET
  ||
  'growthos_control';


const DATA_DATASET =
  process.env.GROWTHOS_DATA_DATASET
  ||
  'growthos_data';


const LOCATION =
  process.env.GROWTHOS_DATA_LOCATION
  ||
  process.env.GCP_BQ_LOCATION
  ||
  'asia-south1';


// ============================================================
// CORE TABLES
// ============================================================

const CONTROL_TABLES = [

  'workspaces',
  'brands',
  'plans',
  'modules',
  'plan_modules',
  'brand_subscriptions',
  'brand_module_overrides',
  'users',
  'brand_memberships',
  'integration_connections',
  'integration_accounts',
  'integration_sync_state',
  'integration_sync_runs',

] as const;


const DATA_TABLES = [

  'shopify_orders_raw_json',
  'shopify_orders_state',
  'shopify_customers_raw_json',
  'shopify_customers_state',
  'shopify_products_raw_json',
  'shopify_products_state',

] as const;


// ============================================================
// TYPES
// ============================================================

export type AdminSystemTableCheck = {

  tableId:
    string;

  exists:
    boolean;

};


export type AdminSystemSnapshot = {

  runtime: {

    environment:
      string;

    vercelEnvironment:
      string | null;

    nodeEnvironment:
      string | null;

    deploymentRegion:
      string | null;

    commitSha:
      string | null;

  };


  bigquery: {

    projectId:
      string;

    location:
      string;

    controlDataset:
      string;

    dataDataset:
      string;

  };


  controlPlane: {

    ready:
      boolean;

    existingTables:
      number;

    requiredTables:
      number;

    tables:
      AdminSystemTableCheck[];

  };


  dataPlane: {

    ready:
      boolean;

    existingTables:
      number;

    requiredTables:
      number;

    tables:
      AdminSystemTableCheck[];

  };

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin System requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ADMIN SYSTEM SNAPSHOT
//
// READ ONLY.
//
// IMPORTANT:
//
// This endpoint exposes only non-secret runtime metadata.
//
// NEVER expose:
//
// credentials
// service-account JSON
// tokens
// secret names containing credentials
// Shopify access tokens
// OAuth secrets
// database passwords
// ============================================================

export async function getAdminSystemSnapshot():

  Promise<
    AdminSystemSnapshot
  > {

  const projectId =
    requireProjectId();


  // ==========================================================
  // READ CONTROL DATASET TABLES
  // ==========================================================

  const [
    controlRows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          table_name

        FROM
          \`${projectId}.${CONTROL_DATASET}.INFORMATION_SCHEMA.TABLES\`

        WHERE
          table_type =
            'BASE TABLE'

      `,

      location:
        LOCATION,

    });


  // ==========================================================
  // READ DATA DATASET TABLES
  // ==========================================================

  const [
    dataRows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          table_name

        FROM
          \`${projectId}.${DATA_DATASET}.INFORMATION_SCHEMA.TABLES\`

        WHERE
          table_type =
            'BASE TABLE'

      `,

      location:
        LOCATION,

    });


  const controlExisting =
    new Set(
      (
        controlRows
        ||
        []
      ).map(
        (row: any) =>
          String(
            row.table_name
          )
      )
    );


  const dataExisting =
    new Set(
      (
        dataRows
        ||
        []
      ).map(
        (row: any) =>
          String(
            row.table_name
          )
      )
    );


  const controlTables:
    AdminSystemTableCheck[] =
      CONTROL_TABLES.map(
        tableId => ({

          tableId,

          exists:
            controlExisting.has(
              tableId
            ),

        })
      );


  const dataTables:
    AdminSystemTableCheck[] =
      DATA_TABLES.map(
        tableId => ({

          tableId,

          exists:
            dataExisting.has(
              tableId
            ),

        })
      );


  const controlExistingCount =
    controlTables.filter(
      table =>
        table.exists
    ).length;


  const dataExistingCount =
    dataTables.filter(
      table =>
        table.exists
    ).length;


  // ==========================================================
  // SAFE RUNTIME METADATA
  // ==========================================================

  const vercelEnvironment =
    safeString(
      process.env.VERCEL_ENV
    );


  const nodeEnvironment =
    safeString(
      process.env.NODE_ENV
    );


  const environment =
    vercelEnvironment
    ||
    nodeEnvironment
    ||
    'unknown';


  const commitShaRaw =
    safeString(
      process.env.VERCEL_GIT_COMMIT_SHA
    );


  const commitSha =
    commitShaRaw
      ? commitShaRaw.slice(
          0,
          12
        )
      : null;


  return {

    runtime: {

      environment,

      vercelEnvironment,

      nodeEnvironment,

      deploymentRegion:
        safeString(
          process.env.VERCEL_REGION
        ),

      commitSha,

    },


    bigquery: {

      projectId,

      location:
        LOCATION,

      controlDataset:
        CONTROL_DATASET,

      dataDataset:
        DATA_DATASET,

    },


    controlPlane: {

      ready:
        controlExistingCount ===
        CONTROL_TABLES.length,

      existingTables:
        controlExistingCount,

      requiredTables:
        CONTROL_TABLES.length,

      tables:
        controlTables,

    },


    dataPlane: {

      ready:
        dataExistingCount ===
        DATA_TABLES.length,

      existingTables:
        dataExistingCount,

      requiredTables:
        DATA_TABLES.length,

      tables:
        dataTables,

    },

  };

}


// ============================================================
// HELPERS
// ============================================================

function safeString(
  value:
    string |
    undefined
) {

  const normalized =
    String(
      value
      ||
      ''
    ).trim();


  return normalized
    ||
    null;

}