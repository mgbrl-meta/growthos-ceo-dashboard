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
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS integration control plane requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ENSURE DATASET
//
// Idempotent.
//
// Multiple subsystems can safely call this simultaneously.
// ============================================================

async function ensureDataset() {

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
        error?.message
        ||
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
// INTEGRATION CONNECTIONS
//
// One logical provider connection.
//
// Example:
//
// workspace = brillare
// brand     = brillare
// provider  = meta_ads
//
// connection_mode today:
// legacy
//
// connection_mode later:
// oauth
// ============================================================

async function ensureConnectionsTable() {

  const projectId =
    requireProjectId();


  const createQuery = `

    CREATE TABLE IF NOT EXISTS
    \`${projectId}.${DATASET_ID}.integration_connections\`
    (

      connection_id STRING NOT NULL,

      workspace_id STRING NOT NULL,

      brand_id STRING,

      provider STRING NOT NULL,

      connection_mode STRING,

      ingestion_adapter STRING,

      status STRING NOT NULL,

      provider_user_id STRING,

      provider_user_name STRING,

      provider_account_id STRING,

      provider_account_name STRING,

      secret_name STRING,

      connected_at TIMESTAMP,

      updated_at TIMESTAMP,

      last_verified_at TIMESTAMP,

      last_sync_at TIMESTAMP,

      error STRING

    )

    CLUSTER BY
      workspace_id,
      brand_id,
      provider

  `;


  await bigquery.query({
    query:
      createQuery,
  });


  /*
   * Migration for installations where
   * integration_connections already exists.
   */

  await bigquery.query({
    query: `

      ALTER TABLE
        \`${projectId}.${DATASET_ID}.integration_connections\`

      ADD COLUMN IF NOT EXISTS
        brand_id STRING

    `,
  });


  await bigquery.query({
    query: `

      ALTER TABLE
        \`${projectId}.${DATASET_ID}.integration_connections\`

      ADD COLUMN IF NOT EXISTS
        connection_mode STRING

    `,
  });

  await bigquery.query({
    query: `

      ALTER TABLE
        \`${projectId}.${DATASET_ID}.integration_connections\`

      ADD COLUMN IF NOT EXISTS
        ingestion_adapter STRING

    `,
  });

}


// ============================================================
// INTEGRATION ACCOUNTS
//
// One connection may expose multiple accounts.
//
// Example:
//
// Meta login
//     ↓
// act_123
// act_456
// act_789
//
// User selects which account belongs to a brand.
//
// This table remains useful even when authentication later
// changes from legacy to OAuth.
// ============================================================

async function ensureAccountsTable() {

  const projectId =
    requireProjectId();


  const query = `

    CREATE TABLE IF NOT EXISTS
    \`${projectId}.${DATASET_ID}.integration_accounts\`
    (

      integration_account_id STRING NOT NULL,

      workspace_id STRING NOT NULL,

      brand_id STRING NOT NULL,

      connection_id STRING NOT NULL,

      provider STRING NOT NULL,

      provider_account_id STRING NOT NULL,

      provider_account_name STRING,

      account_type STRING,

      is_selected BOOL,

      currency STRING,

      timezone STRING,

      metadata JSON,

      discovered_at TIMESTAMP,

      selected_at TIMESTAMP,

      updated_at TIMESTAMP

    )

    CLUSTER BY
      workspace_id,
      brand_id,
      provider,
      connection_id

  `;


  await bigquery.query({
    query,
  });

}


// ============================================================
// INTEGRATION SYNC STATE
//
// Persistent state for incremental ingestion.
//
// One row per:
//
// connection
// provider entity
//
// Examples:
//
// Meta / campaigns
// Meta / adsets
// Meta / ads
//
// Google / campaigns
// Google / search_terms
//
// Shopify / orders
// Shopify / customers
//
// This prevents ingestion logic from being tied to one vendor.
// ============================================================

async function ensureSyncStateTable() {

  const projectId =
    requireProjectId();


  const query = `

    CREATE TABLE IF NOT EXISTS
    \`${projectId}.${DATASET_ID}.integration_sync_state\`
    (

      sync_state_id STRING NOT NULL,

      workspace_id STRING NOT NULL,

      brand_id STRING NOT NULL,

      connection_id STRING NOT NULL,

      provider STRING NOT NULL,

      entity STRING NOT NULL,

      cursor STRING,

      last_source_timestamp TIMESTAMP,

      last_synced_at TIMESTAMP,

      next_sync_at TIMESTAMP,

      backfill_status STRING,

      incremental_status STRING,

      consecutive_failures INT64,

      last_error STRING,

      metadata JSON,

      created_at TIMESTAMP,

      updated_at TIMESTAMP

    )

    CLUSTER BY
      workspace_id,
      brand_id,
      provider,
      connection_id

  `;


  await bigquery.query({
    query,
  });

}


// ============================================================
// INTEGRATION SYNC RUNS
//
// Immutable execution history.
//
// Every backfill, incremental sync, manual sync and recovery
// execution gets one run record.
//
// This powers:
//
// Data Health
// Sync History
// retries
// diagnostics
// monitoring
// future billing / usage reporting
// ============================================================

async function ensureSyncRunsTable() {

  const projectId =
    requireProjectId();


  const query = `

    CREATE TABLE IF NOT EXISTS
    \`${projectId}.${DATASET_ID}.integration_sync_runs\`
    (

      run_id STRING NOT NULL,

      workspace_id STRING NOT NULL,

      brand_id STRING NOT NULL,

      connection_id STRING NOT NULL,

      provider STRING NOT NULL,

      entity STRING NOT NULL,

      sync_type STRING NOT NULL,

      status STRING NOT NULL,

      attempt INT64,

      started_at TIMESTAMP,

      completed_at TIMESTAMP,

      duration_ms INT64,

      source_start_at TIMESTAMP,

      source_end_at TIMESTAMP,

      records_fetched INT64,

      records_loaded INT64,

      records_rejected INT64,

      bytes_processed INT64,

      cursor_before STRING,

      cursor_after STRING,

      error_code STRING,

      error_message STRING,

      metadata JSON,

      created_at TIMESTAMP

    )

    PARTITION BY
      DATE(created_at)

    CLUSTER BY
      workspace_id,
      brand_id,
      provider,
      status

  `;


  await bigquery.query({
    query,
  });

}


// ============================================================
// MASTER BOOTSTRAP
//
// Safe to run repeatedly.
//
// Future migration:
// fresh Growth OS infrastructure
//       ↓
// run bootstrap
//       ↓
// entire integration control plane exists
// ============================================================

export async function ensureIntegrationControlPlane() {

  await ensureDataset();

  await ensureConnectionsTable();

  await ensureAccountsTable();

  await ensureSyncStateTable();

  await ensureSyncRunsTable();


  return {

    projectId:
      requireProjectId(),

    datasetId:
      DATASET_ID,

    tables: [

      'integration_connections',

      'integration_accounts',

      'integration_sync_state',

      'integration_sync_runs',

    ],

  };

}