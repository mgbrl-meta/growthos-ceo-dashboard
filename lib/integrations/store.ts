import {
  bigquery,
} from '@/lib/bigquery';


// ============================================================
// TYPES
// ============================================================

export type StoredIntegrationConnection = {

  connection_id: string;

  workspace_id: string;

  brand_id: string;

  provider: string;

  connection_mode: string;

  ingestion_adapter: string;

  status: string;

  provider_user_id?: string | null;

  provider_user_name?: string | null;

  provider_account_id?: string | null;

  provider_account_name?: string | null;

  secret_name?: string | null;

  connected_at?: string | null;

  updated_at?: string | null;

  last_verified_at?: string | null;

  last_sync_at?: string | null;

  error?: string | null;

};


export type StoredIntegrationAccount = {

  integration_account_id: string;

  workspace_id: string;

  brand_id: string;

  connection_id: string;

  provider: string;

  provider_account_id: string;

  provider_account_name?: string | null;

  account_type?: string | null;

  is_selected?: boolean | null;

  currency?: string | null;

  timezone?: string | null;

  metadata?: Record<
    string,
    unknown
  > | null;

  discovered_at?: string | null;

  selected_at?: string | null;

  updated_at?: string | null;

};


export type UpsertIntegrationAccountInput = {

  workspaceId: string;

  brandId: string;

  connectionId: string;

  provider: string;

  providerAccountId: string;

  providerAccountName?: string | null;

  accountType?: string | null;

  isSelected?: boolean;

  currency?: string | null;

  timezone?: string | null;

  metadata?: Record<
    string,
    unknown
  > | null;

};


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
// IN-PROCESS SCHEMA CACHE
// ============================================================

let integrationStoreReady =
  false;


let integrationStorePromise:
  Promise<void> | null =
    null;


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Integration store requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ENSURE INTEGRATION STORE
//
// Creates / verifies:
//
// integration_connections
// integration_accounts
//
// Safe for:
//
// current Brillare development
// future brands
// future workspaces
// clean Growth OS installations
// ============================================================

export async function ensureIntegrationStore() {

  if (
    integrationStoreReady
  ) {

    return;

  }


  if (
    integrationStorePromise
  ) {

    return integrationStorePromise;

  }


  integrationStorePromise =
    (async () => {

      const projectId =
        requireProjectId();


      // ======================================================
      // DATASET
      // ======================================================

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


      // ======================================================
      // INTEGRATION CONNECTIONS
      // ======================================================

      await bigquery.query({

        query: `

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

        `,

        location:
          LOCATION,

      });


      // ======================================================
      // CONNECTION MIGRATIONS
      // ======================================================

      await bigquery.query({

        query: `

          ALTER TABLE
            \`${projectId}.${DATASET_ID}.integration_connections\`

          ADD COLUMN IF NOT EXISTS
            brand_id STRING

        `,

        location:
          LOCATION,

      });


      await bigquery.query({

        query: `

          ALTER TABLE
            \`${projectId}.${DATASET_ID}.integration_connections\`

          ADD COLUMN IF NOT EXISTS
            connection_mode STRING

        `,

        location:
          LOCATION,

      });


      await bigquery.query({

        query: `

          ALTER TABLE
            \`${projectId}.${DATASET_ID}.integration_connections\`

          ADD COLUMN IF NOT EXISTS
            ingestion_adapter STRING

        `,

        location:
          LOCATION,

      });


      // ======================================================
      // INTEGRATION ACCOUNTS
      //
      // One connection may expose one or more provider accounts.
      //
      // Examples:
      //
      // Shopify:
      //   one store
      //
      // Meta:
      //   multiple ad accounts
      //
      // Google Ads:
      //   multiple customer accounts
      // ======================================================

      await bigquery.query({

        query: `

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

        `,

        location:
          LOCATION,

      });


      integrationStoreReady =
        true;

    })();


  try {

    await integrationStorePromise;

  } catch (
    error
  ) {

    integrationStorePromise =
      null;

    integrationStoreReady =
      false;

    throw error;

  }


  integrationStorePromise =
    null;

}


// ============================================================
// CONNECTION ID
//
// One logical connection per:
//
// workspace
// + brand
// + provider
// ============================================================

function buildConnectionId(
  workspaceId: string,
  brandId: string,
  provider: string
) {

  return [
    workspaceId,
    brandId,
    provider,
  ].join(
    ':'
  );

}


// ============================================================
// INTEGRATION ACCOUNT ID
//
// Deterministic.
//
// Same provider account discovered again
// resolves to the same Growth OS identity.
//
// Example:
//
// workspace
// + brand
// + shopify
// + Shopify shop ID
// ============================================================

function buildIntegrationAccountId(
  workspaceId: string,
  brandId: string,
  provider: string,
  providerAccountId: string
) {

  return [

    workspaceId,

    brandId,

    provider,

    providerAccountId,

  ].join(
    ':'
  );

}


// ============================================================
// UPSERT CONNECTION
// ============================================================

export async function upsertIntegrationConnection(
  input: {

    workspaceId: string;

    brandId: string;

    provider: string;

    connectionMode: string;

    ingestionAdapter: string;

    status: string;

    providerUserId?: string | null;

    providerUserName?: string | null;

    providerAccountId?: string | null;

    providerAccountName?: string | null;

    secretName?: string | null;

    error?: string | null;

  }
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const connectionId =
    buildConnectionId(
      input.workspaceId,
      input.brandId,
      input.provider
    );


  const query = `

    MERGE
      \`${projectId}.${DATASET_ID}.integration_connections\`
      AS target


    USING
    (

      SELECT

        @connection_id
          AS connection_id,

        @workspace_id
          AS workspace_id,

        @brand_id
          AS brand_id,

        @provider
          AS provider,

        @connection_mode
          AS connection_mode,

        @ingestion_adapter
          AS ingestion_adapter,

        @status
          AS status,

        @provider_user_id
          AS provider_user_id,

        @provider_user_name
          AS provider_user_name,

        @provider_account_id
          AS provider_account_id,

        @provider_account_name
          AS provider_account_name,

        @secret_name
          AS secret_name,

        @error
          AS error

    )
    AS source


    ON
      target.connection_id =
      source.connection_id


    WHEN MATCHED THEN

      UPDATE SET

        workspace_id =
          source.workspace_id,

        brand_id =
          source.brand_id,

        provider =
          source.provider,

        connection_mode =
          source.connection_mode,

        ingestion_adapter =
          source.ingestion_adapter,

        status =
          source.status,

        provider_user_id =
          source.provider_user_id,

        provider_user_name =
          source.provider_user_name,

        provider_account_id =
          source.provider_account_id,

        provider_account_name =
          source.provider_account_name,

        secret_name =
          source.secret_name,

        updated_at =
          CURRENT_TIMESTAMP(),

        last_verified_at =
          CURRENT_TIMESTAMP(),

        error =
          source.error


    WHEN NOT MATCHED THEN

      INSERT
      (

        connection_id,

        workspace_id,

        brand_id,

        provider,

        connection_mode,

        ingestion_adapter,

        status,

        provider_user_id,

        provider_user_name,

        provider_account_id,

        provider_account_name,

        secret_name,

        connected_at,

        updated_at,

        last_verified_at,

        error

      )

      VALUES
      (

        source.connection_id,

        source.workspace_id,

        source.brand_id,

        source.provider,

        source.connection_mode,

        source.ingestion_adapter,

        source.status,

        source.provider_user_id,

        source.provider_user_name,

        source.provider_account_id,

        source.provider_account_name,

        source.secret_name,

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP(),

        source.error

      )

  `;


  await bigquery.query({

    query,

    location:
      LOCATION,

    params: {

      connection_id:
        connectionId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      provider:
        input.provider,

      connection_mode:
        input.connectionMode,

      ingestion_adapter:
        input.ingestionAdapter,

      status:
        input.status,

      provider_user_id:
        input.providerUserId
        ??
        null,

      provider_user_name:
        input.providerUserName
        ??
        null,

      provider_account_id:
        input.providerAccountId
        ??
        null,

      provider_account_name:
        input.providerAccountName
        ??
        null,

      secret_name:
        input.secretName
        ??
        null,

      error:
        input.error
        ??
        null,

    },

    types: {

      connection_id:
        'STRING',

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      provider:
        'STRING',

      connection_mode:
        'STRING',

      ingestion_adapter:
        'STRING',

      status:
        'STRING',

      provider_user_id:
        'STRING',

      provider_user_name:
        'STRING',

      provider_account_id:
        'STRING',

      provider_account_name:
        'STRING',

      secret_name:
        'STRING',

      error:
        'STRING',

    },

  });


  return connectionId;

}


// ============================================================
// UPSERT INTEGRATION ACCOUNT
//
// Stores provider-native account identity separately from
// authentication / connection identity.
//
// Shopify:
//
// connection
//    ↓
// shop ID
//    ↓
// integration_account_id
//
// The deterministic ID prevents reconnecting the same provider
// account from creating duplicate Growth OS accounts.
// ============================================================

export async function upsertIntegrationAccount(
  input: UpsertIntegrationAccountInput
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const integrationAccountId =
    buildIntegrationAccountId(

      input.workspaceId,

      input.brandId,

      input.provider,

      input.providerAccountId

    );


  const query = `

    -- ========================================================
    -- ONLY ONE SELECTED ACCOUNT
    -- PER WORKSPACE + BRAND + PROVIDER
    -- ========================================================

    UPDATE
      \`${projectId}.${DATASET_ID}.integration_accounts\`

    SET

      is_selected =
        FALSE,

      updated_at =
        CURRENT_TIMESTAMP()

    WHERE

      workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id

      AND provider =
        @provider

      AND integration_account_id !=
        @integration_account_id

      AND @is_selected =
        TRUE;


    -- ========================================================
    -- UPSERT ACCOUNT
    -- ========================================================

    MERGE
      \`${projectId}.${DATASET_ID}.integration_accounts\`
      AS target


    USING
    (

      SELECT

        @integration_account_id
          AS integration_account_id,

        @workspace_id
          AS workspace_id,

        @brand_id
          AS brand_id,

        @connection_id
          AS connection_id,

        @provider
          AS provider,

        @provider_account_id
          AS provider_account_id,

        @provider_account_name
          AS provider_account_name,

        @account_type
          AS account_type,

        @is_selected
          AS is_selected,

        @currency
          AS currency,

        @timezone
          AS timezone,

        PARSE_JSON(
          @metadata_json
        )
          AS metadata

    )
    AS source


    ON
      target.integration_account_id =
      source.integration_account_id


    WHEN MATCHED THEN

      UPDATE SET

        workspace_id =
          source.workspace_id,

        brand_id =
          source.brand_id,

        connection_id =
          source.connection_id,

        provider =
          source.provider,

        provider_account_id =
          source.provider_account_id,

        provider_account_name =
          source.provider_account_name,

        account_type =
          source.account_type,

        is_selected =
          source.is_selected,

        currency =
          source.currency,

        timezone =
          source.timezone,

        metadata =
          source.metadata,

        selected_at =
          CASE

            WHEN source.is_selected
            THEN
              COALESCE(
                target.selected_at,
                CURRENT_TIMESTAMP()
              )

            ELSE
              target.selected_at

          END,

        updated_at =
          CURRENT_TIMESTAMP()


    WHEN NOT MATCHED THEN

      INSERT
      (

        integration_account_id,

        workspace_id,

        brand_id,

        connection_id,

        provider,

        provider_account_id,

        provider_account_name,

        account_type,

        is_selected,

        currency,

        timezone,

        metadata,

        discovered_at,

        selected_at,

        updated_at

      )

      VALUES
      (

        source.integration_account_id,

        source.workspace_id,

        source.brand_id,

        source.connection_id,

        source.provider,

        source.provider_account_id,

        source.provider_account_name,

        source.account_type,

        source.is_selected,

        source.currency,

        source.timezone,

        source.metadata,

        CURRENT_TIMESTAMP(),

        CASE

          WHEN source.is_selected
          THEN CURRENT_TIMESTAMP()

          ELSE NULL

        END,

        CURRENT_TIMESTAMP()

      );

  `;


  await bigquery.query({

    query,

    location:
      LOCATION,

    params: {

      integration_account_id:
        integrationAccountId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      provider:
        input.provider,

      provider_account_id:
        input.providerAccountId,

      provider_account_name:
        input.providerAccountName
        ??
        null,

      account_type:
        input.accountType
        ??
        null,

      is_selected:
        input.isSelected
        ??
        false,

      currency:
        input.currency
        ??
        null,

      timezone:
        input.timezone
        ??
        null,

      metadata_json:
        JSON.stringify(
          input.metadata
          ??
          {}
        ),

    },

    types: {

      integration_account_id:
        'STRING',

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      connection_id:
        'STRING',

      provider:
        'STRING',

      provider_account_id:
        'STRING',

      provider_account_name:
        'STRING',

      account_type:
        'STRING',

      is_selected:
        'BOOL',

      currency:
        'STRING',

      timezone:
        'STRING',

      metadata_json:
        'STRING',

    },

  });


  return integrationAccountId;

}


// ============================================================
// GET ONE CONNECTION
// ============================================================

export async function getIntegrationConnection(
  workspaceId: string,
  brandId: string,
  provider: string
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const query = `

    SELECT

      connection_id,

      workspace_id,

      brand_id,

      provider,

      connection_mode,

      ingestion_adapter,

      status,

      provider_user_id,

      provider_user_name,

      provider_account_id,

      provider_account_name,

      secret_name,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        connected_at
      )
        AS connected_at,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        updated_at
      )
        AS updated_at,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_verified_at
      )
        AS last_verified_at,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_sync_at
      )
        AS last_sync_at,


      error


    FROM
      \`${projectId}.${DATASET_ID}.integration_connections\`


    WHERE

      workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id

      AND provider =
        @provider


    ORDER BY
      updated_at DESC


    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        LOCATION,

      params: {

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        provider,

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredIntegrationConnection
    | null;

}

// ============================================================
// GET INTEGRATION CONNECTION BY ID
//
// Generic connector setup resolver.
//
// connection_id
//      ↓
// integration_connections
//      ↓
// provider
// workspace
// brand
//
// The caller MUST still verify that the authenticated
// session owns the returned workspace + brand.
// ============================================================

export async function getIntegrationConnectionById(
  connectionId: string
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const normalizedConnectionId =
    String(
      connectionId
      ||
      ''
    ).trim();


  if (!normalizedConnectionId) {

    throw new Error(
      'Integration connection ID is required'
    );

  }


  const query = `

    SELECT

      connection_id,

      workspace_id,

      brand_id,

      provider,

      connection_mode,

      ingestion_adapter,

      status,

      provider_user_id,

      provider_user_name,

      provider_account_id,

      provider_account_name,

      secret_name,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        connected_at
      )
        AS connected_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        updated_at
      )
        AS updated_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_verified_at
      )
        AS last_verified_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_sync_at
      )
        AS last_sync_at,

      error

    FROM
      \`${projectId}.${DATASET_ID}.integration_connections\`

    WHERE

      connection_id =
        @connection_id

    ORDER BY
      updated_at DESC

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        LOCATION,

      params: {

        connection_id:
          normalizedConnectionId,

      },

      types: {

        connection_id:
          'STRING',

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredIntegrationConnection
    | null;

}

// ============================================================
// LIST CONNECTIONS FOR BRAND
// ============================================================

export async function listIntegrationConnections(
  workspaceId: string,
  brandId: string
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const query = `

    SELECT

      connection_id,

      workspace_id,

      brand_id,

      provider,

      connection_mode,

      ingestion_adapter,

      status,

      provider_user_id,

      provider_user_name,

      provider_account_id,

      provider_account_name,

      secret_name,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        connected_at
      )
        AS connected_at,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        updated_at
      )
        AS updated_at,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_verified_at
      )
        AS last_verified_at,


      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_sync_at
      )
        AS last_sync_at,


      error


    FROM
      \`${projectId}.${DATASET_ID}.integration_connections\`


    WHERE

      workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id


    ORDER BY
      provider

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        LOCATION,

      params: {

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

      },

    });


  return (
    rows
    ||
    []
  ) as StoredIntegrationConnection[];

}


// ============================================================
// FIND PROVIDER ACCOUNT GLOBALLY
//
// Used during provider installation BEFORE Growth OS knows
// which workspace / brand owns the external provider account.
//
// Shopify:
//
// canonical Shopify Shop GID
//          ↓
// integration_accounts
//          ↓
// existing workspace + brand
//
// Example:
//
// provider:
// shopify
//
// provider_account_id:
// gid://shopify/Shop/123456789
//
// This is provider-scoped so the same external identifier from
// two different providers cannot collide.
//
// IMPORTANT:
//
// This does not change account selection.
// This does not create anything.
// This only resolves an existing provider-account mapping.
// ============================================================

export async function getIntegrationAccountByProviderAccountId(
  provider: string,
  providerAccountId: string
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const normalizedProvider =
    String(
      provider
      ||
      ''
    ).trim();


  const normalizedProviderAccountId =
    String(
      providerAccountId
      ||
      ''
    ).trim();


  if (
    !normalizedProvider
    ||
    !normalizedProviderAccountId
  ) {

    throw new Error(
      'Provider and provider account ID are required'
    );

  }


  const query = `

    SELECT

      integration_account_id,

      workspace_id,

      brand_id,

      connection_id,

      provider,

      provider_account_id,

      provider_account_name,

      account_type,

      is_selected,

      currency,

      timezone,

      metadata,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        discovered_at
      )
        AS discovered_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        selected_at
      )
        AS selected_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        updated_at
      )
        AS updated_at

    FROM
      \`${projectId}.${DATASET_ID}.integration_accounts\`

    WHERE

      provider =
        @provider

      AND provider_account_id =
        @provider_account_id

    ORDER BY
      updated_at DESC

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        LOCATION,

      params: {

        provider:
          normalizedProvider,

        provider_account_id:
          normalizedProviderAccountId,

      },

      types: {

        provider:
          'STRING',

        provider_account_id:
          'STRING',

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredIntegrationAccount
    | null;

}


// ============================================================
// GET SELECTED INTEGRATION ACCOUNT
//
// Used by provider ingestion.
//
// Example:
//
// current workspace + brand + Shopify
//      ↓
// selected Shopify store
//      ↓
// integration_account_id
//      ↓
// growthos_data.shopify_*
// ============================================================

export async function getSelectedIntegrationAccount(
  workspaceId: string,
  brandId: string,
  provider: string
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const query = `

    SELECT

      integration_account_id,

      workspace_id,

      brand_id,

      connection_id,

      provider,

      provider_account_id,

      provider_account_name,

      account_type,

      is_selected,

      currency,

      timezone,

      metadata,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        discovered_at
      )
        AS discovered_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        selected_at
      )
        AS selected_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        updated_at
      )
        AS updated_at

    FROM
      \`${projectId}.${DATASET_ID}.integration_accounts\`

    WHERE

      workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id

      AND provider =
        @provider

      AND is_selected =
        TRUE

    ORDER BY
      updated_at DESC

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        LOCATION,

      params: {

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        provider,

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredIntegrationAccount
    | null;

}

// ============================================================
// FIND SHOPIFY INTEGRATION ACCOUNT BY SHOP DOMAIN
//
// Used when Shopify launches Growth OS as a standalone app.
//
// Shopify Admin
//       ↓
// verified shop domain
//       ↓
// integration_accounts.metadata.shop_domain
//       ↓
// workspace_id + brand_id
//
// Supports both:
//
// shop_domain
//   canonical current metadata
//
// shopDomain
//   older compatibility metadata
//
// No tenant ENV configuration is used.
// ============================================================

export async function getShopifyIntegrationAccountByDomain(
  shopDomain: string
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const normalizedShopDomain =
    String(
      shopDomain
      ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    !normalizedShopDomain
  ) {

    throw new Error(
      'Shopify shop domain is required'
    );

  }


  const query = `

    SELECT

      integration_account_id,

      workspace_id,

      brand_id,

      connection_id,

      provider,

      provider_account_id,

      provider_account_name,

      account_type,

      is_selected,

      currency,

      timezone,

      metadata,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        discovered_at
      )
        AS discovered_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        selected_at
      )
        AS selected_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        updated_at
      )
        AS updated_at

    FROM
      \`${projectId}.${DATASET_ID}.integration_accounts\`

    WHERE

      provider =
        'shopify'

      AND
      (

        LOWER(
          COALESCE(
            JSON_VALUE(
              metadata,
              '$.shop_domain'
            ),
            ''
          )
        )
          =
          @shop_domain

        OR

        LOWER(
          COALESCE(
            JSON_VALUE(
              metadata,
              '$.shopDomain'
            ),
            ''
          )
        )
          =
          @shop_domain

      )

    ORDER BY
      updated_at DESC

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        LOCATION,

      params: {

        shop_domain:
          normalizedShopDomain,

      },

      types: {

        shop_domain:
          'STRING',

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredIntegrationAccount
    | null;

}
// ============================================================
// MARK INTEGRATION SETUP READY
//
// Generic connector lifecycle:
//
// connected
//      ↓
// setup required
//      ↓
// setup ready
//
// SECURITY:
//
// workspace + brand + connection must all match.
//
// This prevents one authenticated tenant from modifying
// another tenant's connector setup state.
// ============================================================

export async function markIntegrationSetupReady(
  input: {

    connectionId:
      string;

    workspaceId:
      string;

    brandId:
      string;

  }
) {

  await ensureIntegrationStore();


  const projectId =
    requireProjectId();


  const connectionId =
    String(
      input.connectionId
      ||
      ''
    ).trim();


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


  if (
    !connectionId
    ||
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'Integration setup identity is incomplete'
    );

  }


  // ==========================================================
  // UPDATE ACCOUNT METADATA
  //
  // Preserve all existing provider-specific metadata.
  //
  // Add:
  //
  // setup_status
  // setup_completed_at
  // ==========================================================

  const query = `

    UPDATE
      \`${projectId}.${DATASET_ID}.integration_accounts\`

    SET

      metadata =
        JSON_SET(

          COALESCE(
            metadata,
            JSON '{}'
          ),

          '$.setup_status',
          'ready',

          '$.setup_completed_at',
          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            CURRENT_TIMESTAMP()
          )

        ),

      updated_at =
        CURRENT_TIMESTAMP()

    WHERE

      connection_id =
        @connection_id

      AND workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id

  `;


  await bigquery.query({

    query,

    location:
      LOCATION,

    params: {

      connection_id:
        connectionId,

      workspace_id:
        workspaceId,

      brand_id:
        brandId,

    },

    types: {

      connection_id:
        'STRING',

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

    },

  });


  return {

    connectionId,

    workspaceId,

    brandId,

    setupStatus:
      'ready',

  };

}