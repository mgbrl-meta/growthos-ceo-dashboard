import 'server-only';

import {
  readIntegrationSecret,
  storeIntegrationSecret,
} from '@/lib/integrations/secrets';

import type {
  ShopifyResolvedShop,
} from '@/lib/auth/shopify';

import {
  queryEarliestShopifyOrder,
} from '@/lib/auth/shopify';

import type {
  ShopifyOfflineOAuthCredential,
} from '@/lib/integrations/providers/shopify-oauth';

import {
  refreshShopifyOfflineAccessToken,
} from '@/lib/integrations/providers/shopify-oauth';


// ============================================================
// STORED SHOPIFY CREDENTIAL CONTRACT
//
// This JSON exists ONLY inside Google Secret Manager.
//
// BigQuery never stores:
//
// access_token
// refresh_token
//
// BigQuery will later store only:
//
// secret_name
//
// Schema versioning allows us to evolve the credential contract
// safely in future.
// ============================================================

export type StoredShopifyCredentialV1 = {

  schema_version:
    1;

  credential_type:
    'shopify_offline_expiring';

  provider:
    'shopify';

  shop_id:
    string;

  shop_domain:
    string;

  shop_name:
    string;

  access_token:
    string;

  refresh_token:
    string | null;

  scope:
    string;

  issued_at:
    string;

  access_token_expires_at:
    string | null;

  refresh_token_expires_at:
    string | null;

  updated_at:
    string;

};


// ============================================================
// SAFE VERIFICATION RESULT
//
// Contains no secret material.
// ============================================================

export type ShopifyStoredCredentialVerification = {

  schemaVersion:
    number;

  credentialType:
    string;

  provider:
    string;

  shopId:
    string;

  shopDomain:
    string;

  shopName:
    string;

  scope:
    string;

  accessTokenExpiresAt:
    string | null;

  refreshTokenPresent:
    boolean;

  refreshTokenExpiresAt:
    string | null;

};


// ============================================================
// EXPIRY TIMESTAMP
//
// Shopify gives durations in seconds.
//
// Convert immediately to absolute UTC timestamps so future
// workers can directly determine:
//
// - token expired?
// - token expiring soon?
// - when to refresh?
// ============================================================

function buildExpiryTimestamp(
  issuedAt: Date,
  expiresInSeconds:
    number | null
) {

  if (
    expiresInSeconds ===
    null
    ||
    !Number.isFinite(
      expiresInSeconds
    )
    ||
    expiresInSeconds <=
    0
  ) {

    return null;

  }


  return new Date(
    issuedAt.getTime()
    +
    expiresInSeconds *
    1000
  )
    .toISOString();

}


// ============================================================
// STORE SHOPIFY OFFLINE CREDENTIAL
//
// One logical secret per:
//
// workspace
// + brand
// + shopify
//
// Example:
//
// growthos-brillare-brillare-shopify
//
// Reauthorization / refresh:
//
// same secret
//       ↓
// new Secret Manager version
// ============================================================

export async function storeShopifyOfflineCredential(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    shop:
      ShopifyResolvedShop;

    credential:
      ShopifyOfflineOAuthCredential;

  }
) {

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
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'SHOPIFY_CREDENTIAL_TENANT_MISSING'
    );

  }


  const shopId =
    String(
      input.shop.shopId
      ||
      ''
    ).trim();


  const shopDomain =
    String(
      input.shop.shopDomain
      ||
      ''
    )
      .trim()
      .toLowerCase();


  const shopName =
    String(
      input.shop.shopName
      ||
      ''
    ).trim();


  if (
    !shopId
    ||
    !shopDomain
  ) {

    throw new Error(
      'SHOPIFY_CREDENTIAL_SHOP_IDENTITY_MISSING'
    );

  }


  const accessToken =
    String(
      input
        .credential
        .accessToken
      ||
      ''
    );


  if (!accessToken) {

    throw new Error(
      'SHOPIFY_CREDENTIAL_ACCESS_TOKEN_MISSING'
    );

  }


  // ==========================================================
  // ISSUE / EXPIRY TIMESTAMPS
  // ==========================================================

  const issuedAt =
    new Date();


  const issuedAtIso =
    issuedAt
      .toISOString();


  const accessTokenExpiresAt =
    buildExpiryTimestamp(

      issuedAt,

      input
        .credential
        .expiresIn

    );


  const refreshTokenExpiresAt =
    buildExpiryTimestamp(

      issuedAt,

      input
        .credential
        .refreshTokenExpiresIn

    );


  // ==========================================================
  // SECRET PAYLOAD
  //
  // IMPORTANT:
  //
  // Never log this object.
  // ==========================================================

  const payload:
    StoredShopifyCredentialV1 = {

      schema_version:
        1,

      credential_type:
        'shopify_offline_expiring',

      provider:
        'shopify',

      shop_id:
        shopId,

      shop_domain:
        shopDomain,

      shop_name:
        shopName,

      access_token:
        accessToken,

      refresh_token:
        input
          .credential
          .refreshToken
        ??
        null,

      scope:
        String(
          input
            .credential
            .scope
          ||
          ''
        ),

      issued_at:
        issuedAtIso,

      access_token_expires_at:
        accessTokenExpiresAt,

      refresh_token_expires_at:
        refreshTokenExpiresAt,

      updated_at:
        issuedAtIso,

    };


  // ==========================================================
  // SECRET MANAGER
  // ==========================================================

  const secretName =
    await storeIntegrationSecret({

      workspaceId,

      brandId,

      provider:
        'shopify',

      value:
        payload,

    });


  return {

    secretName,

    accessTokenExpiresAt,

    refreshTokenExpiresAt,

  };

}


// ============================================================
// VERIFY STORED SHOPIFY CREDENTIAL
//
// Reads versions/latest from Secret Manager.
//
// Checks:
//
// secret parses correctly
// correct schema
// correct provider
// access token exists
// stored shop ID matches OAuth/Admin API shop
// stored shop domain matches OAuth/Admin API shop
//
// IMPORTANT:
//
// Never returns access_token or refresh_token.
// ============================================================

export async function verifyStoredShopifyCredential(
  input: {

    secretName:
      string;

    expectedShopId:
      string;

    expectedShopDomain:
      string;

  }
):

  Promise<
    ShopifyStoredCredentialVerification
  > {

  const stored =
    await readIntegrationSecret<
      StoredShopifyCredentialV1
    >(
      input.secretName
    );


  // ==========================================================
  // SCHEMA
  // ==========================================================

  if (
    stored.schema_version !==
    1
  ) {

    throw new Error(
      'SHOPIFY_STORED_CREDENTIAL_SCHEMA_INVALID'
    );

  }


  if (
    stored.credential_type !==
    'shopify_offline_expiring'
  ) {

    throw new Error(
      'SHOPIFY_STORED_CREDENTIAL_TYPE_INVALID'
    );

  }


  if (
    stored.provider !==
    'shopify'
  ) {

    throw new Error(
      'SHOPIFY_STORED_CREDENTIAL_PROVIDER_INVALID'
    );

  }


  // ==========================================================
  // TOKEN EXISTS
  //
  // Never return its value.
  // ==========================================================

  if (
    !stored.access_token
  ) {

    throw new Error(
      'SHOPIFY_STORED_ACCESS_TOKEN_MISSING'
    );

  }


  // ==========================================================
  // CANONICAL SHOP IDENTITY
  // ==========================================================

  if (
    stored.shop_id !==
    input.expectedShopId
  ) {

    throw new Error(
      'SHOPIFY_STORED_SHOP_ID_MISMATCH'
    );

  }


  if (
    stored
      .shop_domain
      .toLowerCase()
    !==
    input
      .expectedShopDomain
      .toLowerCase()
  ) {

    throw new Error(
      'SHOPIFY_STORED_SHOP_DOMAIN_MISMATCH'
    );

  }


  // ==========================================================
  // SAFE RESULT
  // ==========================================================

  return {

    schemaVersion:
      stored.schema_version,

    credentialType:
      stored.credential_type,

    provider:
      stored.provider,

    shopId:
      stored.shop_id,

    shopDomain:
      stored.shop_domain,

    shopName:
      stored.shop_name,

    scope:
      stored.scope,

    accessTokenExpiresAt:
      stored.access_token_expires_at,

    refreshTokenPresent:
      Boolean(
        stored.refresh_token
      ),

    refreshTokenExpiresAt:
      stored.refresh_token_expires_at,

  };

}

// ============================================================
// REFRESH + ROTATE STORED SHOPIFY CREDENTIAL
//
// Secret Manager latest version
//        ↓
// current refresh token
//        ↓
// Shopify refresh
//        ↓
// NEW credential pair
//        ↓
// same logical Secret Manager secret
//        ↓
// NEW secret version
//        ↓
// read-back verification
//
// No BigQuery update required because secret_name stays the
// same across versions.
// ============================================================

export async function refreshStoredShopifyCredential(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    secretName:
      string;

  }
) {

  const stored =
    await readIntegrationSecret<
      StoredShopifyCredentialV1
    >(
      input.secretName
    );


  if (
    stored.schema_version !==
    1
    ||
    stored.provider !==
    'shopify'
  ) {

    throw new Error(
      'SHOPIFY_REFRESH_STORED_CREDENTIAL_INVALID'
    );

  }


  if (!stored.refresh_token) {

    throw new Error(
      'SHOPIFY_REFRESH_TOKEN_MISSING'
    );

  }


  const refreshed =
    await refreshShopifyOfflineAccessToken(

      stored.shop_domain,

      stored.refresh_token

    );


  const result =
    await storeShopifyOfflineCredential({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      shop: {

        shopId:
          stored.shop_id,

        shopDomain:
          stored.shop_domain,

        shopName:
          stored.shop_name,

      },

      credential:
        refreshed,

    });


  if (
    result.secretName !==
    input.secretName
  ) {

    throw new Error(
      'SHOPIFY_REFRESH_SECRET_IDENTITY_CHANGED'
    );

  }


  const verified =
    await verifyStoredShopifyCredential({

      secretName:
        result.secretName,

      expectedShopId:
        stored.shop_id,

      expectedShopDomain:
        stored.shop_domain,

    });


  return {

    secretName:
      result.secretName,

    verified,

  };

}

// ============================================================
// EARLIEST ORDER USING STORED SHOPIFY CREDENTIAL
//
// Secret material remains inside this server-only module.
//
// Caller receives:
// - earliest order
// - safe refresh information
//
// Caller never receives:
// - access_token
// - refresh_token
// ============================================================

// ============================================================
// GET VALID STORED SHOPIFY ACCESS TOKEN
//
// SERVER-ONLY.
//
// Used by internal Shopify operations that need the Admin API
// without starting a new OAuth flow.
//
// Flow:
//
// Secret Manager latest
//        ↓
// verify canonical shop identity
//        ↓
// refresh if expiring within 5 minutes
//        ↓
// read newest secret version
//        ↓
// return current access token SERVER-SIDE ONLY
//
// IMPORTANT:
//
// Never expose the returned accessToken through an API response
// or log it.
// ============================================================

export async function getValidStoredShopifyAccessToken(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    secretName:
      string;

    expectedShopId:
      string;

    expectedShopDomain:
      string;

  }
) {

  // ==========================================================
  // 1. VERIFY STORED CREDENTIAL + SHOP IDENTITY
  // ==========================================================

  const verified =
    await verifyStoredShopifyCredential({

      secretName:
        input.secretName,

      expectedShopId:
        input.expectedShopId,

      expectedShopDomain:
        input.expectedShopDomain,

    });


  // ==========================================================
  // 2. REFRESH WHEN EXPIRING SOON
  //
  // Five-minute safety margin.
  // ==========================================================

  let tokenRefreshed =
    false;


  const expiresAt =
    verified.accessTokenExpiresAt
      ?
        Date.parse(
          verified.accessTokenExpiresAt
        )
      :
        null;


  if (
    expiresAt !==
      null
    &&
    Number.isFinite(
      expiresAt
    )
    &&
    expiresAt <=
      Date.now()
      +
      5 * 60 * 1000
  ) {

    await refreshStoredShopifyCredential({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      secretName:
        input.secretName,

    });


    tokenRefreshed =
      true;

  }


  // ==========================================================
  // 3. READ CURRENT SECRET VERSION
  // ==========================================================

  let stored =
    await readIntegrationSecret<
      StoredShopifyCredentialV1
    >(
      input.secretName
    );


  // ==========================================================
  // 4. DEFENCE-IN-DEPTH VALIDATION
  // ==========================================================

  if (
    stored.schema_version !==
      1
    ||
    stored.credential_type !==
      'shopify_offline_expiring'
    ||
    stored.provider !==
      'shopify'
  ) {

    throw new Error(
      'SHOPIFY_STORED_CREDENTIAL_INVALID'
    );

  }


  if (
    stored.shop_id !==
      input.expectedShopId
  ) {

    throw new Error(
      'SHOPIFY_STORED_SHOP_ID_MISMATCH'
    );

  }


  if (
    stored
      .shop_domain
      .toLowerCase()
    !==
    input
      .expectedShopDomain
      .toLowerCase()
  ) {

    throw new Error(
      'SHOPIFY_STORED_SHOP_DOMAIN_MISMATCH'
    );

  }


  if (!stored.access_token) {

    throw new Error(
      'SHOPIFY_STORED_ACCESS_TOKEN_MISSING'
    );

  }


  // ==========================================================
  // 5. RETURN SERVER-SIDE CREDENTIAL
  //
  // Caller must never serialize/log accessToken.
  // ==========================================================

  return {

    accessToken:
      stored.access_token,

    shopId:
      stored.shop_id,

    shopDomain:
      stored.shop_domain,

    tokenRefreshed,

  };

}

export async function queryEarliestOrderWithStoredShopifyCredential(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    secretName:
      string;

    expectedShopId:
      string;

    expectedShopDomain:
      string;

  }
) {

  // ==========================================================
  // 1. VERIFY EXISTING STORED IDENTITY
  // ==========================================================

  const verified =
    await verifyStoredShopifyCredential({

      secretName:
        input.secretName,

      expectedShopId:
        input.expectedShopId,

      expectedShopDomain:
        input.expectedShopDomain,

    });


  // ==========================================================
  // 2. DETERMINE WHETHER TOKEN SHOULD BE REFRESHED
  //
  // Five-minute safety margin.
  // ==========================================================

  let tokenRefreshed =
    false;


  const expiresAt =
    verified.accessTokenExpiresAt
      ?
        Date.parse(
          verified.accessTokenExpiresAt
        )
      :
        null;


  if (
    expiresAt !==
      null
    &&
    Number.isFinite(
      expiresAt
    )
    &&
    expiresAt <=
      Date.now()
      +
      5 * 60 * 1000
  ) {

    await refreshStoredShopifyCredential({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      secretName:
        input.secretName,

    });


    tokenRefreshed =
      true;

  }


  // ==========================================================
  // 3. READ CURRENT SECRET VERSION
  //
  // This may be the same version or a newly refreshed version.
  // ==========================================================

  let stored =
    await readIntegrationSecret<
      StoredShopifyCredentialV1
    >(
      input.secretName
    );


  // ==========================================================
  // 4. DEFENCE-IN-DEPTH VALIDATION
  // ==========================================================

  if (
    stored.schema_version !==
      1
    ||
    stored.credential_type !==
      'shopify_offline_expiring'
    ||
    stored.provider !==
      'shopify'
  ) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_CREDENTIAL_INVALID'
    );

  }


  if (
    stored.shop_id !==
      input.expectedShopId
  ) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_SHOP_ID_MISMATCH'
    );

  }


  if (
    stored
      .shop_domain
      .toLowerCase()
    !==
    input
      .expectedShopDomain
      .toLowerCase()
  ) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_SHOP_DOMAIN_MISMATCH'
    );

  }


  if (!stored.access_token) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_ACCESS_TOKEN_MISSING'
    );

  }


  // ==========================================================
  // 5. QUERY SHOPIFY
  //
  // If Shopify unexpectedly rejects the stored token with 401,
  // refresh once and retry.
  // ==========================================================

  try {

    const order =
      await queryEarliestShopifyOrder(

        stored.shop_domain,

        stored.access_token

      );


    return {

      order,

      tokenRefreshed,

    };


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        ''
      );


    if (
      message !==
        'SHOPIFY_EARLIEST_ORDER_HTTP_401'
    ) {

      throw error;

    }


    // ========================================================
    // FORCED RECOVERY
    // ========================================================

    await refreshStoredShopifyCredential({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      secretName:
        input.secretName,

    });


    tokenRefreshed =
      true;


    stored =
      await readIntegrationSecret<
        StoredShopifyCredentialV1
      >(
        input.secretName
      );


    if (
      !stored.access_token
    ) {

      throw new Error(
        'SHOPIFY_EARLIEST_ORDER_REFRESHED_ACCESS_TOKEN_MISSING'
      );

    }


    const order =
      await queryEarliestShopifyOrder(

        stored.shop_domain,

        stored.access_token

      );


    return {

      order,

      tokenRefreshed,

    };

  }

}