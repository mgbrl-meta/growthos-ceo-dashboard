import {
  BigQuery,
} from '@google-cloud/bigquery';

import {
  SecretManagerServiceClient,
} from '@google-cloud/secret-manager';


// ============================================================
// GROWTH OS SHOPIFY WORKER CONTEXT
//
// Pub/Sub identity
//       ↓
// growthos_control
//       ↓
// integration connection
//       ↓
// integration account
//       ↓
// Secret Manager
//       ↓
// canonical Shopify credential
//
// IMPORTANT:
//
// Cloud Run uses Application Default Credentials through:
//
// growthos-shopify-worker@...
//
// No GCP private key is required inside the worker.
// ============================================================


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.GOOGLE_CLOUD_PROJECT
    ||
    ''
  ).trim();


const CONTROL_DATASET =
  String(
    process.env.GROWTHOS_CONTROL_DATASET
    ||
    'growthos_control'
  ).trim();


const CONTROL_LOCATION =
  String(
    process.env.GROWTHOS_CONTROL_LOCATION
    ||
    'asia-south1'
  ).trim();


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_WORKER_PROJECT_MISSING'
  );

}


// ============================================================
// GOOGLE CLIENTS
//
// No explicit service-account key.
//
// Cloud Run attached service account provides identity.
// ============================================================

const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });


const secretManager =
  new SecretManagerServiceClient({

    projectId:
      PROJECT_ID,

  });


// ============================================================
// REQUIRED STRING
// ============================================================

function requireString(
  value,
  errorCode
) {

  const normalized =
    String(
      value
      ??
      ''
    ).trim();


  if (!normalized) {

    throw new Error(
      errorCode
    );

  }


  return normalized;

}


// ============================================================
// TIMESTAMP STATUS
// ============================================================

function getExpiryStatus(
  value
) {

  if (!value) {

    return {

      value:
        null,

      expired:
        false,

    };

  }


  const timestamp =
    Date.parse(
      String(
        value
      )
    );


  if (
    Number.isNaN(
      timestamp
    )
  ) {

    return {

      value:
        String(
          value
        ),

      expired:
        false,

    };

  }


  return {

    value:
      new Date(
        timestamp
      ).toISOString(),

    // Five-minute safety window.
    expired:
      timestamp <=
      (
        Date.now()
        +
        5 * 60 * 1000
      ),

  };

}


// ============================================================
// RESOLVE CONNECTION
//
// Security rule:
//
// queue payload identity is NOT trusted by itself.
//
// Every identifier must resolve to the same control-plane
// tenant.
// ============================================================

async function resolveConnection(
  job
) {

  const query = `

    SELECT

      connection_id,

      workspace_id,

      brand_id,

      provider,

      connection_mode,

      ingestion_adapter,

      status,

      provider_account_id,

      provider_account_name,

      secret_name

    FROM
      \`${PROJECT_ID}.${CONTROL_DATASET}.integration_connections\`

    WHERE

      connection_id =
        @connection_id

      AND workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id

      AND provider =
        'shopify'

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        CONTROL_LOCATION,

      params: {

        connection_id:
          job.connectionId,

        workspace_id:
          job.workspaceId,

        brand_id:
          job.brandId,

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


  const connection =
    rows?.[0]
    ??
    null;


  if (!connection) {

    throw new Error(
      'SHOPIFY_WORKER_CONNECTION_NOT_FOUND'
    );

  }


  if (
    connection.status !==
      'connected'
  ) {

    throw new Error(
      'SHOPIFY_WORKER_CONNECTION_NOT_CONNECTED'
    );

  }


  if (!connection.secret_name) {

    throw new Error(
      'SHOPIFY_WORKER_SECRET_POINTER_MISSING'
    );

  }


  return connection;

}


// ============================================================
// RESOLVE INTEGRATION ACCOUNT
//
// connection
// + workspace
// + brand
// + integration account
// + provider account
//
// must ALL agree.
// ============================================================

async function resolveAccount(
  job
) {

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

      metadata

    FROM
      \`${PROJECT_ID}.${CONTROL_DATASET}.integration_accounts\`

    WHERE

      integration_account_id =
        @integration_account_id

      AND workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id

      AND connection_id =
        @connection_id

      AND provider =
        'shopify'

      AND provider_account_id =
        @provider_account_id

      AND is_selected =
        TRUE

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        CONTROL_LOCATION,

      params: {

        integration_account_id:
          job.integrationAccountId,

        workspace_id:
          job.workspaceId,

        brand_id:
          job.brandId,

        connection_id:
          job.connectionId,

        provider_account_id:
          job.providerAccountId,

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

        provider_account_id:
          'STRING',

      },

    });


  const account =
    rows?.[0]
    ??
    null;


  if (!account) {

    throw new Error(
      'SHOPIFY_WORKER_ACCOUNT_NOT_FOUND'
    );

  }


  return account;

}


// ============================================================
// READ CREDENTIAL
//
// Always reads:
//
// secret_name/versions/latest
//
// Access token / refresh token never enter:
//
// Pub/Sub
// logs
// BigQuery
// browser
// ============================================================

async function readCredential(
  secretName
) {

  const normalizedSecretName =
    requireString(
      secretName,
      'SHOPIFY_WORKER_SECRET_NAME_MISSING'
    );


  const [
    version,
  ] =
    await secretManager
      .accessSecretVersion({

        name:
          `${normalizedSecretName}/versions/latest`,

      });


  const data =
    version
      ?.payload
      ?.data;


  if (!data) {

    throw new Error(
      'SHOPIFY_WORKER_SECRET_EMPTY'
    );

  }


  const raw =
    Buffer
      .from(
        data
      )
      .toString(
        'utf8'
      );


  let credential;


  try {

    credential =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_WORKER_SECRET_INVALID_JSON'
    );

  }


  return credential;

}


// ============================================================
// VALIDATE CANONICAL SHOPIFY CREDENTIAL
// ============================================================

function validateCredential(
  credential,
  account
) {

  if (
    Number(
      credential?.schema_version
    ) !== 1
  ) {

    throw new Error(
      'SHOPIFY_WORKER_CREDENTIAL_SCHEMA_UNSUPPORTED'
    );

  }


  if (
    credential?.credential_type !==
      'shopify_offline_expiring'
  ) {

    throw new Error(
      'SHOPIFY_WORKER_CREDENTIAL_TYPE_INVALID'
    );

  }


  if (
    credential?.provider !==
      'shopify'
  ) {

    throw new Error(
      'SHOPIFY_WORKER_CREDENTIAL_PROVIDER_INVALID'
    );

  }


  const shopId =
    requireString(
      credential?.shop_id,
      'SHOPIFY_WORKER_CREDENTIAL_SHOP_ID_MISSING'
    );


  const shopDomain =
    requireString(
      credential?.shop_domain,
      'SHOPIFY_WORKER_CREDENTIAL_SHOP_DOMAIN_MISSING'
    )
      .toLowerCase();


  if (
    !shopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'SHOPIFY_WORKER_CREDENTIAL_SHOP_DOMAIN_INVALID'
    );

  }


  if (
    shopId !==
      String(
        account.provider_account_id
      )
  ) {

    throw new Error(
      'SHOPIFY_WORKER_CREDENTIAL_ACCOUNT_MISMATCH'
    );

  }


  const accessToken =
    requireString(
      credential?.access_token,
      'SHOPIFY_WORKER_ACCESS_TOKEN_MISSING'
    );


  const accessExpiry =
    getExpiryStatus(
      credential?.access_token_expires_at
    );


  const refreshExpiry =
    getExpiryStatus(
      credential?.refresh_token_expires_at
    );


  return {

    // Sensitive.
    // Never log.
    accessToken,

    refreshToken:
      credential?.refresh_token
        ? String(
            credential.refresh_token
          )
        : null,


    // Safe metadata.
    shopId,

    shopDomain,

    shopName:
      credential?.shop_name
      ??
      null,

    scope:
      credential?.scope
      ??
      '',

    credentialType:
      credential.credential_type,

    accessTokenExpiresAt:
      accessExpiry.value,

    accessTokenExpired:
      accessExpiry.expired,

    refreshTokenExpiresAt:
      refreshExpiry.value,

    refreshTokenExpired:
      refreshExpiry.expired,

  };

}


// ============================================================
// PUBLIC RESOLVER
// ============================================================

export async function resolveShopifyRuntimeContext(
  job
) {

  const connection =
    await resolveConnection(
      job
    );


  const account =
    await resolveAccount(
      job
    );


  // Additional connection/account integrity check.
  if (
    String(
      connection.provider_account_id
      ??
      ''
    )
    &&
    String(
      connection.provider_account_id
    ) !==
      String(
        account.provider_account_id
      )
  ) {

    throw new Error(
      'SHOPIFY_WORKER_PROVIDER_ACCOUNT_MISMATCH'
    );

  }


  const rawCredential =
    await readCredential(
      connection.secret_name
    );


  const credential =
    validateCredential(

      rawCredential,

      account

    );


  return {

    connection,

    account,

    credential,

  };

}