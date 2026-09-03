import 'server-only';

import crypto from 'crypto';

import {
  getShopifyClientId,
  getShopifyClientSecret,
  normalizeShopDomain,
} from '@/lib/auth/config';


// ============================================================
// SHOPIFY OAUTH CONFIG
// ============================================================

const DEFAULT_SHOPIFY_SCOPES = [
  'read_orders',
  'read_all_orders',
  'read_customers',
  'read_products',
  'write_pixels',
];


// ============================================================
// TYPES
// ============================================================

// ------------------------------------------------------------
// Offline Shopify credential acquired after a successful
// authorization-code exchange.
//
// IMPORTANT:
//
// Step 1C obtains and validates this credential.
//
// Step 1D will:
// - persist it in Secret Manager
// - store expiry metadata
// - implement refresh-token rotation
//
// NEVER expose accessToken or refreshToken to browser responses.
// ------------------------------------------------------------

export type ShopifyOfflineOAuthCredential = {

  accessToken: string;

  refreshToken: string | null;

  scope: string;

  expiresIn: number | null;

  refreshTokenExpiresIn: number | null;

};


// ============================================================
// GROWTH OS APP URL
// ============================================================

function getGrowthOSAppUrl() {

  return String(
    process.env.GROWTHOS_APP_URL
    ||
    'http://localhost:3000'
  )
    .trim()
    .replace(
      /\/+$/,
      ''
    );

}


// ============================================================
// SHOPIFY CALLBACK URL
//
// Development:
// http://localhost:3000/api/integrations/shopify/callback
//
// Production:
// https://growthos-ceo-dashboard.vercel.app/
// api/integrations/shopify/callback
//
// SHOPIFY_OAUTH_CALLBACK_URL can override the generated URL.
// ============================================================

export function getShopifyOAuthCallbackUrl() {

  const configured =
    String(
      process.env.SHOPIFY_OAUTH_CALLBACK_URL
      ||
      ''
    ).trim();


  if (configured) {

    return configured;

  }


  return (
    `${getGrowthOSAppUrl()}` +
    `/api/integrations/shopify/callback`
  );

}


// ============================================================
// SHOPIFY SCOPES
//
// Environment variable:
//
// SHOPIFY_SCOPES=read_orders,read_customers,...
//
// We will perform the final least-privilege scope reduction
// separately after the Shopify ingestion requirements are locked.
// ============================================================

export function getShopifyOAuthScopes() {

  const configured =
    String(
      process.env.SHOPIFY_SCOPES
      ||
      ''
    )
      .split(',')
      .map(
        value =>
          value.trim()
      )
      .filter(
        Boolean
      );


  const scopes =
    configured.length > 0
      ? configured
      : DEFAULT_SHOPIFY_SCOPES;


  return Array.from(
    new Set(
      scopes
    )
  );

}


// ============================================================
// SHOP DOMAIN VALIDATION
//
// Accept only canonical Shopify *.myshopify.com domains.
//
// Examples:
//
// brillare-root-deep.myshopify.com       ✅
// https://brillare-root-deep.myshopify.com  → normalized
//
// admin.shopify.com/...                  ❌
// random-domain.com                      ❌
// ============================================================

export function validateShopifyOAuthShop(
  shop: string
) {

  const normalized =
    normalizeShopDomain(
      shop
    );


  if (
    !normalized
    ||
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i
      .test(
        normalized
      )
  ) {

    throw new Error(
      'Invalid Shopify shop domain'
    );

  }


  return normalized;

}


// ============================================================
// OAUTH STATE
//
// Cryptographically random anti-CSRF value.
//
// Stored temporarily in an HttpOnly cookie by the install route
// and validated when Shopify returns to the callback.
// ============================================================

export function generateShopifyOAuthState() {

  return crypto
    .randomBytes(
      32
    )
    .toString(
      'hex'
    );

}


// ============================================================
// AUTHORIZATION URL
//
// Standalone Shopify application:
//
// Growth OS
//      ↓
// Shopify authorization
//      ↓
// merchant approval
//      ↓
// Growth OS callback
//
// Step 1C.1
// ============================================================

export function buildShopifyAuthorizationUrl(
  shop: string,
  state: string
) {

  const normalizedShop =
    validateShopifyOAuthShop(
      shop
    );


  if (!state) {

    throw new Error(
      'Missing Shopify OAuth state'
    );

  }


  const params =
    new URLSearchParams({

      client_id:
        getShopifyClientId(),

      scope:
        getShopifyOAuthScopes()
          .join(','),

      redirect_uri:
        getShopifyOAuthCallbackUrl(),

      state,

    });


  return (
    `https://${normalizedShop}` +
    `/admin/oauth/authorize?` +
    params.toString()
  );

}


// ============================================================
// CONSTANT-TIME STRING COMPARISON
//
// Used for:
// - OAuth state
// - Shopify HMAC
//
// Prevents timing-based comparison attacks.
// ============================================================

function secureEqual(
  left: string,
  right: string
) {

  const leftBuffer =
    Buffer.from(
      left,
      'utf8'
    );


  const rightBuffer =
    Buffer.from(
      right,
      'utf8'
    );


  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {

    return false;

  }


  return crypto
    .timingSafeEqual(
      leftBuffer,
      rightBuffer
    );

}


// ============================================================
// VERIFY OAUTH STATE
//
// Protects against CSRF.
//
// Step 1C.2
// ============================================================

export function verifyShopifyOAuthState(
  receivedState: string,
  expectedState: string
) {

  if (
    !receivedState
    ||
    !expectedState
  ) {

    throw new Error(
      'SHOPIFY_OAUTH_STATE_MISSING'
    );

  }


  if (
    !secureEqual(
      receivedState,
      expectedState
    )
  ) {

    throw new Error(
      'SHOPIFY_OAUTH_STATE_INVALID'
    );

  }


  return true;

}


// ============================================================
// VERIFY CALLBACK SHOP
//
// Ensures Shopify returns us to OAuth for exactly the same shop
// that initiated the authorization request.
//
// Step 1C.2
// ============================================================

export function verifyShopifyOAuthShop(
  receivedShop: string,
  expectedShop: string
) {

  const received =
    validateShopifyOAuthShop(
      receivedShop
    );


  const expected =
    validateShopifyOAuthShop(
      expectedShop
    );


  if (
    received !==
    expected
  ) {

    throw new Error(
      'SHOPIFY_OAUTH_SHOP_MISMATCH'
    );

  }


  return received;

}


// ============================================================
// VERIFY SHOPIFY OAUTH CALLBACK HMAC
//
// Shopify callback:
//
// ?code=...
// &hmac=...
// &shop=...
// &state=...
// &timestamp=...
//
// Verification:
//
// 1. Remove hmac
// 2. Sort remaining parameters alphabetically
// 3. Build canonical query message
// 4. HMAC-SHA256 with Shopify client secret
// 5. Constant-time compare
//
// Step 1C.2
// ============================================================

export function verifyShopifyOAuthHmac(
  searchParams: URLSearchParams
) {

  const receivedHmac =
    String(
      searchParams.get(
        'hmac'
      )
      ||
      ''
    );


  if (!receivedHmac) {

    throw new Error(
      'SHOPIFY_OAUTH_HMAC_MISSING'
    );

  }


  const entries =
    Array.from(
      searchParams.entries()
    )
      .filter(
        ([key]) =>
          key !==
          'hmac'
      )
      .sort(
        (
          [leftKey],
          [rightKey]
        ) =>
          leftKey.localeCompare(
            rightKey
          )
      );


  const message =
    entries
      .map(
        ([key, value]) =>
          `${key}=${value}`
      )
      .join(
        '&'
      );


  const calculatedHmac =
    crypto
      .createHmac(
        'sha256',
        getShopifyClientSecret()
      )
      .update(
        message
      )
      .digest(
        'hex'
      );


  if (
    !secureEqual(
      calculatedHmac,
      receivedHmac
    )
  ) {

    throw new Error(
      'SHOPIFY_OAUTH_HMAC_INVALID'
    );

  }


  return true;

}


// ============================================================
// VERIFY CALLBACK TIMESTAMP
//
// Additional replay protection.
//
// OAuth state cookie expires after approximately 10 minutes.
// Apply the same maximum age to Shopify's callback timestamp.
//
// Step 1C.2
// ============================================================

export function verifyShopifyOAuthTimestamp(
  timestamp: string
) {

  const parsed =
    Number(
      timestamp
    );


  if (
    !Number.isFinite(
      parsed
    )
  ) {

    throw new Error(
      'SHOPIFY_OAUTH_TIMESTAMP_INVALID'
    );

  }


  const nowSeconds =
    Math.floor(
      Date.now() /
      1000
    );


  const ageSeconds =
    Math.abs(
      nowSeconds -
      parsed
    );


  if (
    ageSeconds >
    10 * 60
  ) {

    throw new Error(
      'SHOPIFY_OAUTH_CALLBACK_EXPIRED'
    );

  }


  return true;

}


// ============================================================
// EXCHANGE SHOPIFY AUTHORIZATION CODE
//
// Step 1C.3
//
// Verified Shopify callback
//         ↓
// authorization code
//         ↓
// POST /admin/oauth/access_token
//         ↓
// expiring OFFLINE Admin API token
//         +
// refresh token
//
// Why offline:
//
// Growth OS needs Shopify access when no merchant is present:
//
// - Admin API backfill
// - incremental sync
// - reconciliation
// - webhook provisioning
// - Web Pixel provisioning
// - recovery jobs
//
// IMPORTANT:
//
// Tokens remain server-only.
//
// Step 1D will persist them securely in Secret Manager.
// ============================================================

export async function exchangeShopifyAuthorizationCode(
  shop: string,
  code: string
):

  Promise<
    ShopifyOfflineOAuthCredential
  > {

  // ==========================================================
  // VALIDATE SHOP
  // ==========================================================

  const normalizedShop =
    validateShopifyOAuthShop(
      shop
    );


  // ==========================================================
  // VALIDATE AUTHORIZATION CODE
  // ==========================================================

  if (!code) {

    throw new Error(
      'SHOPIFY_OAUTH_CODE_MISSING'
    );

  }


  // ==========================================================
  // EXCHANGE AUTHORIZATION CODE
  // ==========================================================

  const response =
    await fetch(

      `https://${normalizedShop}/admin/oauth/access_token`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/x-www-form-urlencoded',

          'Accept':
            'application/json',

        },

        body:
          new URLSearchParams({

            client_id:
              getShopifyClientId(),

            client_secret:
              getShopifyClientSecret(),

            code,

            // Request an expiring offline credential.
            //
            // Shopify returns:
            //
            // access_token
            // expires_in
            // refresh_token
            // refresh_token_expires_in
            //
            // for supported/public-app flows.
            expiring:
              '1',

          }),

        cache:
          'no-store',

      }

    );


  // ==========================================================
  // READ RESPONSE
  // ==========================================================

  const raw =
    await response.text();


  let json:
    any = {};


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_OAUTH_TOKEN_RESPONSE_INVALID'
    );

  }


  // ==========================================================
  // TOKEN EXCHANGE FAILED
  //
  // NEVER log access_token or refresh_token.
  // ==========================================================

  if (!response.ok) {

    console.error(
      'SHOPIFY_OAUTH_TOKEN_EXCHANGE_FAILED',
      {

        status:
          response.status,

        error:
          json?.error
          ??
          null,

        errorDescription:
          json?.error_description
          ??
          null,

      }
    );


    throw new Error(
      `SHOPIFY_OAUTH_TOKEN_EXCHANGE_FAILED_${response.status}`
    );

  }


  // ==========================================================
  // ACCESS TOKEN
  // ==========================================================

  const accessToken =
    String(
      json?.access_token
      ||
      ''
    );


  if (!accessToken) {

    throw new Error(
      'SHOPIFY_OAUTH_ACCESS_TOKEN_MISSING'
    );

  }


  // ==========================================================
  // REFRESH TOKEN
  // ==========================================================

  const refreshToken =
    json?.refresh_token
      ? String(
          json.refresh_token
        )
      : null;


  // ==========================================================
  // EXPIRATION METADATA
  // ==========================================================

  const expiresInRaw =
    Number(
      json?.expires_in
    );


  const refreshTokenExpiresInRaw =
    Number(
      json?.refresh_token_expires_in
    );


  const expiresIn =
    Number.isFinite(
      expiresInRaw
    )
      ? expiresInRaw
      : null;


  const refreshTokenExpiresIn =
    Number.isFinite(
      refreshTokenExpiresInRaw
    )
      ? refreshTokenExpiresInRaw
      : null;


  // ==========================================================
  // RETURN SERVER-SIDE CREDENTIAL
  // ==========================================================

  return {

    accessToken,

    refreshToken,

    scope:
      String(
        json?.scope
        ||
        ''
      ),

    expiresIn,

    refreshTokenExpiresIn,

  };

}
// ============================================================
// REFRESH EXPIRING SHOPIFY OFFLINE CREDENTIAL
//
// Stored refresh token
//        ↓
// Shopify token endpoint
//        ↓
// NEW access token
// NEW refresh token
// NEW expiration metadata
//
// IMPORTANT:
//
// Shopify rotates the refresh-token pair.
// The newly returned refresh token must replace the previous
// one in secure storage.
//
// Secret Manager versioning handles this atomically for
// Growth OS.
// ============================================================

export async function refreshShopifyOfflineAccessToken(
  shop: string,
  refreshToken: string
):

  Promise<
    ShopifyOfflineOAuthCredential
  > {

  const normalizedShop =
    validateShopifyOAuthShop(
      shop
    );


  if (!refreshToken) {

    throw new Error(
      'SHOPIFY_REFRESH_TOKEN_MISSING'
    );

  }


  const response =
    await fetch(

      `https://${normalizedShop}/admin/oauth/access_token`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/x-www-form-urlencoded',

          'Accept':
            'application/json',

        },

        body:
          new URLSearchParams({

            client_id:
              getShopifyClientId(),

            client_secret:
              getShopifyClientSecret(),

            grant_type:
              'refresh_token',

            refresh_token:
              refreshToken,

          }),

        cache:
          'no-store',

      }

    );


  const raw =
    await response.text();


  let json:
    any = {};


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_REFRESH_RESPONSE_INVALID'
    );

  }


  if (!response.ok) {

    console.error(
      'SHOPIFY_REFRESH_FAILED',
      {

        status:
          response.status,

        error:
          json?.error
          ??
          null,

        errorDescription:
          json?.error_description
          ??
          null,

      }
    );


    if (
      response.status ===
      401
    ) {

      throw new Error(
        'SHOPIFY_REFRESH_REAUTH_REQUIRED'
      );

    }


    throw new Error(
      `SHOPIFY_REFRESH_FAILED_${response.status}`
    );

  }


  const accessToken =
    String(
      json?.access_token
      ||
      ''
    );


  const newRefreshToken =
    String(
      json?.refresh_token
      ||
      ''
    );


  if (!accessToken) {

    throw new Error(
      'SHOPIFY_REFRESH_ACCESS_TOKEN_MISSING'
    );

  }


  if (!newRefreshToken) {

    throw new Error(
      'SHOPIFY_REFRESH_TOKEN_ROTATION_MISSING'
    );

  }


  const expiresInRaw =
    Number(
      json?.expires_in
    );


  const refreshTokenExpiresInRaw =
    Number(
      json?.refresh_token_expires_in
    );


  return {

    accessToken,

    refreshToken:
      newRefreshToken,

    scope:
      String(
        json?.scope
        ||
        ''
      ),

    expiresIn:
      Number.isFinite(
        expiresInRaw
      )
        ? expiresInRaw
        : null,

    refreshTokenExpiresIn:
      Number.isFinite(
        refreshTokenExpiresInRaw
      )
        ? refreshTokenExpiresInRaw
        : null,

  };

}