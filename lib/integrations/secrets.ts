import 'server-only';

import {
  SecretManagerServiceClient,
} from '@google-cloud/secret-manager';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


const CLIENT_EMAIL =
  process.env.GCP_CLIENT_EMAIL
  ||
  '';


const PRIVATE_KEY =
  process.env.GCP_PRIVATE_KEY
    ?.replace(
      /\\n/g,
      '\n'
    )
  ||
  '';


// ============================================================
// SECRET MANAGER REPLICATION MODE
//
// Supported:
//
// automatic
//
// user-managed
//
// Default:
//
// user-managed
//
// For Growth OS India deployment we currently use:
//
// GCP_SECRET_REPLICATION=user-managed
// GCP_SECRET_LOCATIONS=asia-south1
//
// Future multi-region example:
//
// GCP_SECRET_LOCATIONS=asia-south1,asia-southeast1
//
// No application-code change required.
// ============================================================

const SECRET_REPLICATION_MODE =
  String(
    process.env.GCP_SECRET_REPLICATION
    ||
    'user-managed'
  )
    .trim()
    .toLowerCase();


// ============================================================
// SECRET MANAGER LOCATIONS
//
// Priority:
//
// GCP_SECRET_LOCATIONS
//        ↓
// GCP_BQ_LOCATION
//        ↓
// asia-south1
//
// Examples:
//
// asia-south1
//
// asia-south1,asia-southeast1
//
// asia-south1,europe-west1,us-central1
// ============================================================

const SECRET_LOCATIONS =
  Array.from(
    new Set(
      String(
        process.env.GCP_SECRET_LOCATIONS
        ||
        process.env.GCP_BQ_LOCATION
        ||
        'asia-south1'
      )
        .split(',')
        .map(
          value =>
            value.trim()
        )
        .filter(
          Boolean
        )
    )
  );


// ============================================================
// CLIENT
//
// Local development:
// service-account credentials from environment.
//
// Production:
// can later move to Workload Identity / native GCP identity
// without changing the integration credential interface.
// ============================================================

const secretManager =
  new SecretManagerServiceClient({

    projectId:
      PROJECT_ID,

    credentials:
      CLIENT_EMAIL &&
      PRIVATE_KEY

        ? {

            client_email:
              CLIENT_EMAIL,

            private_key:
              PRIVATE_KEY,

          }

        : undefined,

  });


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Secret Manager requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// SECRET REPLICATION POLICY
//
// Returns the Secret Manager API representation.
//
// automatic:
//
// Google manages secret replication.
//
// user-managed:
//
// Growth OS explicitly controls one or more regions.
// ============================================================

function getSecretReplicationPolicy() {

  if (
    SECRET_REPLICATION_MODE ===
    'automatic'
  ) {

    return {

      automatic: {},

    };

  }


  if (
    SECRET_REPLICATION_MODE !==
    'user-managed'
    &&
    SECRET_REPLICATION_MODE !==
    'user_managed'
    &&
    SECRET_REPLICATION_MODE !==
    'usermanaged'
  ) {

    throw new Error(
      `Invalid GCP_SECRET_REPLICATION mode: ${SECRET_REPLICATION_MODE}`
    );

  }


  if (
    SECRET_LOCATIONS.length ===
    0
  ) {

    throw new Error(
      'At least one Secret Manager location is required'
    );

  }


  return {

    userManaged: {

      replicas:
        SECRET_LOCATIONS.map(
          location => ({

            location,

          })
        ),

    },

  };

}


// ============================================================
// SAFE SECRET ID
//
// Secret Manager IDs should contain only predictable,
// infrastructure-safe characters.
// ============================================================

function makeSafeSecretId(
  value: string
) {

  const normalized =
    value
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(
        0,
        200
      );


  if (!normalized) {

    throw new Error(
      'Unable to generate Secret Manager secret ID'
    );

  }


  return normalized;

}


// ============================================================
// BUILD TENANT SECRET ID
//
// Current:
//
// growthos-brillare-brillare-shopify
// growthos-brillare-brillare-meta-ads
//
// Future:
//
// growthos-workspace-123-brand-456-shopify
//
// One logical secret per:
//
// workspace
// + brand
// + provider
//
// Credential rotation creates NEW SECRET VERSIONS rather than
// exposing or replacing credentials in BigQuery.
// ============================================================

export function buildIntegrationSecretId(
  workspaceId: string,
  brandId: string,
  provider: string
) {

  if (
    !workspaceId
    ||
    !brandId
    ||
    !provider
  ) {

    throw new Error(
      'workspaceId, brandId and provider are required to build an integration secret ID'
    );

  }


  return makeSafeSecretId(
    [

      'growthos',

      workspaceId,

      brandId,

      provider,

    ].join('-')
  );

}


// ============================================================
// STORE SECRET
//
// Idempotent at the logical-secret level:
//
// first connection
//      ↓
// create Secret Manager secret
//      ↓
// add version 1
//
// token refresh / reconnect
//      ↓
// same Secret Manager secret
//      ↓
// add version 2 / 3 / ...
//
// IMPORTANT:
//
// Access tokens and refresh tokens NEVER go into BigQuery.
//
// BigQuery stores only:
//
// secret_name
//
// Example:
//
// projects/shopify-colab/secrets/
// growthos-brillare-brillare-shopify
// ============================================================

export async function storeIntegrationSecret(
  input: {

    workspaceId: string;

    brandId: string;

    provider: string;

    value: unknown;

  }
) {

  const projectId =
    requireProjectId();


  if (
    input.value ===
    undefined
  ) {

    throw new Error(
      'Integration secret value is required'
    );

  }


  const secretId =
    buildIntegrationSecretId(

      input.workspaceId,

      input.brandId,

      input.provider

    );


  const projectName =
    `projects/${projectId}`;


  const secretName =
    `${projectName}/secrets/${secretId}`;


  // ==========================================================
  // CREATE SECRET IF NECESSARY
  //
  // IMPORTANT:
  //
  // Secret replication policy is immutable after creation.
  //
  // Changing GCP_SECRET_LOCATIONS later affects newly created
  // secrets only. Existing secrets require migration if their
  // replication policy must change.
  // ==========================================================

  try {

    await secretManager.createSecret({

      parent:
        projectName,

      secretId,

      secret: {

        replication:
          getSecretReplicationPolicy(),

      },

    });

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
      error?.code === 6
      ||
      error?.code === 409
      ||
      message.includes(
        'already exists'
      );


    if (!alreadyExists) {

      throw error;

    }

  }


  // ==========================================================
  // SERIALIZE SECRET
  //
  // JSON allows each provider to store its own structured
  // credential contract.
  //
  // Example Shopify payload:
  //
  // {
  //   schema_version: 1,
  //   credential_type: "shopify_offline_expiring",
  //   shop_id: "...",
  //   shop_domain: "...",
  //   access_token: "...",
  //   refresh_token: "...",
  //   scope: "...",
  //   access_token_expires_at: "...",
  //   refresh_token_expires_at: "..."
  // }
  // ==========================================================

  let serialized:
    string;


  try {

    serialized =
      JSON.stringify(
        input.value
      );

  } catch {

    throw new Error(
      'Integration credential could not be serialized'
    );

  }


  if (!serialized) {

    throw new Error(
      'Integration credential serialized to an empty value'
    );

  }


  const payload =
    Buffer.from(
      serialized,
      'utf8'
    );


  // ==========================================================
  // ADD NEW SECRET VERSION
  // ==========================================================

  await secretManager.addSecretVersion({

    parent:
      secretName,

    payload: {

      data:
        payload,

    },

  });


  return secretName;

}


// ============================================================
// READ SECRET
//
// Always reads:
//
// versions/latest
//
// This means token rotation automatically makes the newest
// credential available to ingestion workers without changing
// BigQuery's secret_name pointer.
// ============================================================

export async function readIntegrationSecret<T>(
  secretName: string
): Promise<T> {

  if (!secretName) {

    throw new Error(
      'Integration secret name is required'
    );

  }


  const [
    version,
  ] =
    await secretManager.accessSecretVersion({

      name:
        `${secretName}/versions/latest`,

    });


  const raw =
    version
      .payload
      ?.data
      ?.toString();


  if (!raw) {

    throw new Error(
      'Integration credential is empty'
    );

  }


  try {

    return JSON.parse(
      raw
    ) as T;

  } catch {

    throw new Error(
      'Integration credential contains invalid JSON'
    );

  }

}