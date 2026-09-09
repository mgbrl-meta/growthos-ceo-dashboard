import 'server-only';

import {
  jwtVerify,
} from 'jose';

import {
  getShopifyApiVersion,
  getShopifyClientId,
  getShopifyClientSecret,
  normalizeShopDomain,
} from './config';

import {
  requireConfiguredShopifyTenant,
} from './tenant-registry';


// ============================================================
// TYPES
// ============================================================

type VerifiedShopifyToken = {

  userId: string;

  sessionId?: string;

  shopDomain: string;

};


export type ShopifyIdentity = {

  authSource:
    'shopify';

  userId: string;

  tenantId: string;

  shopId: string;

  shopDomain: string;

  sessionId?: string;

};


export type ShopifyResolvedShop = {

  shopId: string;

  shopDomain: string;

  shopName: string;

};


// ============================================================
// SHOPIFY OFFLINE INSTALLATION CREDENTIAL
//
// Sensitive server-side credential.
//
// IMPORTANT:
//
// Never return accessToken or refreshToken to the browser.
//
// Step 1C:
// obtain + validate credential
//
// Step 1D:
// persist credential securely in Secret Manager
// ============================================================

export type ShopifyOfflineCredential = {

  accessToken: string;

  refreshToken: string | null;

  expiresIn: number | null;

  refreshTokenExpiresIn:
    number | null;

  scope: string;

};


// ============================================================
// SHOPIFY INSTALLATION BOOTSTRAP
//
// Represents a successfully authenticated Shopify installation.
//
// Contains:
//
// canonical Shopify shop identity
// +
// offline Admin API credential
//
// Credential persistence happens later in Step 1D.
// ============================================================

export type ShopifyInstallationBootstrap = {

  shop:
    ShopifyResolvedShop;

  credential:
    ShopifyOfflineCredential;

};


// ============================================================
// SIGNING KEY
// ============================================================

function shopifySigningKey() {

  return new TextEncoder()
    .encode(
      getShopifyClientSecret()
    );

}


// ============================================================
// BEARER TOKEN
// ============================================================

export function getBearerToken(
  authorization:
    string | null
) {

  if (!authorization) {

    return null;

  }


  const [
    scheme,
    token,
  ] =
    authorization
      .trim()
      .split(
        /\s+/,
        2
      );


  if (
    scheme?.toLowerCase() !==
      'bearer'
    ||
    !token
  ) {

    return null;

  }


  return token;

}


// ============================================================
// VERIFY SHOPIFY ID TOKEN
//
// Verifies Shopify authentication.
//
// Does NOT call Shopify Admin API.
//
// Used for:
//
// normal embedded requests
// installation bootstrap
// authenticated Shopify context
// ============================================================

export async function verifyShopifyTokenClaims(
  token: string
):

  Promise<
    VerifiedShopifyToken
  > {

  if (!token) {

    throw new Error(
      'Missing Shopify ID token'
    );

  }


  const {
    payload,
  } =
    await jwtVerify(

      token,

      shopifySigningKey(),

      {

        algorithms: [
          'HS256',
        ],

        audience:
          getShopifyClientId(),

        clockTolerance:
          5,

      }

    );


  const issuer =
    String(
      payload.iss || ''
    );


  const destination =
    String(
      payload.dest || ''
    );


  const subject =
    String(
      payload.sub || ''
    );


  const sessionId =
    payload.sid
      ? String(
          payload.sid
        )
      : undefined;


  if (
    !issuer
    ||
    !destination
    ||
    !subject
  ) {

    throw new Error(
      'Shopify ID token is missing required claims'
    );

  }


  let issuerHost =
    '';


  let destinationHost =
    '';


  try {

    issuerHost =
      normalizeShopDomain(
        new URL(
          issuer
        ).hostname
      );


    destinationHost =
      normalizeShopDomain(
        new URL(
          destination
        ).hostname
      );

  } catch {

    throw new Error(
      'Invalid Shopify issuer or destination'
    );

  }


  if (
    !issuerHost
    ||
    !destinationHost
  ) {

    throw new Error(
      'Invalid Shopify token hostname'
    );

  }


  if (
    issuerHost !==
    destinationHost
  ) {

    throw new Error(
      'Shopify issuer and destination do not match'
    );

  }


  if (
    !destinationHost.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'Shopify destination is not a myshopify.com domain'
    );

  }


  return {

    userId:
      subject,

    sessionId,

    shopDomain:
      destinationHost,

  };

}


// ============================================================
// NORMAL SHOPIFY AUTH
//
// Existing development/current-store authorization path.
//
// JWT gives us verified shop domain.
//
// Server-side registry maps:
//
// verified domain
//       ↓
// canonical Shopify Shop ID
//       ↓
// Growth OS tenant
//
// IMPORTANT:
//
// This remains for current compatibility.
//
// Future SaaS tenant resolution will eventually resolve through
// growthos_control rather than environment-backed registry.
// ============================================================

export async function verifyShopifyIdToken(
  token: string
):

  Promise<
    ShopifyIdentity
  > {

  const verified =
    await verifyShopifyTokenClaims(
      token
    );


  const tenant =
    requireConfiguredShopifyTenant(
      verified.shopDomain
    );


  return {

    authSource:
      'shopify',

    userId:
      `shopify:${verified.userId}`,

    tenantId:
      tenant.tenantId,

    shopId:
      tenant.shopId,

    shopDomain:
      tenant.shopDomain,

    sessionId:
      verified.sessionId,

  };

}


// ============================================================
// ONLINE TOKEN EXCHANGE
//
// Existing compatibility path.
//
// Used ONLY when we need short-lived Shopify Admin access tied
// to the authenticated Shopify session.
//
// Shopify ID token
//       ↓
// token exchange
//       ↓
// online Admin access token
//
// Do not use this token for background Growth OS ingestion.
// ============================================================

async function exchangeIdTokenForOnlineAccessToken(
  idToken: string,
  shopDomain: string
) {

  const response =
    await fetch(

      `https://${shopDomain}/admin/oauth/access_token`,

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
          new URLSearchParams(
            {

              client_id:
                getShopifyClientId(),

              client_secret:
                getShopifyClientSecret(),

              grant_type:
                'urn:ietf:params:oauth:grant-type:token-exchange',

              subject_token:
                idToken,

              subject_token_type:
                'urn:ietf:params:oauth:token-type:id_token',

              requested_token_type:
                'urn:shopify:params:oauth:token-type:online-access-token',

            }
          ),

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

    // Leave empty object.

  }


  if (!response.ok) {

    console.error(
      'SHOPIFY_TOKEN_EXCHANGE_FAILED',
      response.status,
      {
        error:
          json?.error
          ??
          null,

        error_description:
          json?.error_description
          ??
          null,
      }
    );


    throw new Error(
      `Shopify token exchange failed (${response.status})`
    );

  }


  const accessToken =
    String(
      json.access_token
      ||
      ''
    );


  if (!accessToken) {

    throw new Error(
      'Shopify token exchange returned no access token'
    );

  }


  return accessToken;

}


// ============================================================
// OFFLINE TOKEN EXCHANGE
//
// Canonical Growth OS installation credential.
//
// Shopify ID token
//        ↓
// token exchange
//        ↓
// expiring OFFLINE Admin API credential
//
// This credential will later power:
//
// Shopify Admin API backfill
// incremental sync
// reconciliation
// provisioning
// webhook setup
// Web Pixel setup
//
// STEP 1C:
// obtain and validate
//
// STEP 1D:
// persist securely in Secret Manager
// ============================================================

export async function exchangeIdTokenForOfflineAccessToken(
  idToken: string,
  shopDomain: string
):

  Promise<
    ShopifyOfflineCredential
  > {

  const normalizedShopDomain =
    normalizeShopDomain(
      shopDomain
    );


  if (
    !normalizedShopDomain
    ||
    !normalizedShopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'Invalid Shopify shop domain for offline token exchange'
    );

  }


  const response =
    await fetch(

      `https://${normalizedShopDomain}/admin/oauth/access_token`,

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
          new URLSearchParams(
            {

              client_id:
                getShopifyClientId(),

              client_secret:
                getShopifyClientSecret(),

              grant_type:
                'urn:ietf:params:oauth:grant-type:token-exchange',

              subject_token:
                idToken,

              subject_token_type:
                'urn:ietf:params:oauth:token-type:id_token',

              requested_token_type:
                'urn:shopify:params:oauth:token-type:offline-access-token',

              expiring:
                '1',

            }
          ),

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
      'Shopify offline token exchange returned invalid JSON'
    );

  }


  if (!response.ok) {

    console.error(
      'SHOPIFY_OFFLINE_TOKEN_EXCHANGE_FAILED',
      response.status,
      {

        error:
          json?.error
          ??
          null,

        error_description:
          json?.error_description
          ??
          null,

      }
    );


    if (
      response.status ===
      400
    ) {

      throw new Error(
        'SHOPIFY_INVALID_ID_TOKEN'
      );

    }


    if (
      response.status ===
      401
    ) {

      throw new Error(
        'SHOPIFY_OFFLINE_TOKEN_UNAUTHORIZED'
      );

    }


    throw new Error(
      `Shopify offline token exchange failed (${response.status})`
    );

  }


  const accessToken =
    String(
      json?.access_token
      ||
      ''
    );


  if (!accessToken) {

    throw new Error(
      'Shopify offline token exchange returned no access token'
    );

  }


  const refreshToken =
    json?.refresh_token
      ? String(
          json.refresh_token
        )
      : null;


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


  return {

    accessToken,

    refreshToken,

    expiresIn,

    refreshTokenExpiresIn,

    scope:
      String(
        json?.scope
        ||
        ''
      ),

  };

}


// ============================================================
// SHOPIFY ADMIN QUERY
//
// Canonical Shopify shop identity.
//
// Uses whichever Admin API token is supplied:
//
// online token
// or
// offline token
//
// Returns:
//
// Shopify Shop GID
// myshopify domain
// shop name
// ============================================================

export async function queryCurrentShop(
  shopDomain: string,
  accessToken: string
):

  Promise<
    ShopifyResolvedShop
  > {

  const normalizedShopDomain =
    normalizeShopDomain(
      shopDomain
    );


  if (
    !normalizedShopDomain
    ||
    !normalizedShopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'Invalid Shopify shop domain'
    );

  }


  if (!accessToken) {

    throw new Error(
      'Missing Shopify Admin access token'
    );

  }


  const apiVersion =
    getShopifyApiVersion();


  const response =
    await fetch(

      `https://${normalizedShopDomain}/admin/api/${apiVersion}/graphql.json`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'X-Shopify-Access-Token':
            accessToken,

        },

        body:
          JSON.stringify(
            {

              query:
                `
                  query GrowthOsResolveShop {
                    shop {
                      id
                      myshopifyDomain
                      name
                    }
                  }
                `,

            }
          ),

        cache:
          'no-store',

      }

    );


  const raw =
    await response.text();


  let json:
    any;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'Shopify Admin API returned invalid JSON'
    );

  }


  if (!response.ok) {

    console.error(
      'SHOPIFY_ADMIN_QUERY_FAILED',
      response.status,
      json
    );


    throw new Error(
      `Shopify Admin API failed (${response.status})`
    );

  }


  if (
    Array.isArray(
      json.errors
    )
    &&
    json.errors.length > 0
  ) {

    console.error(
      'SHOPIFY_GRAPHQL_ERRORS',
      json.errors
    );


    throw new Error(
      'Shopify GraphQL returned errors'
    );

  }


  const shop =
    json?.data?.shop;


  const shopId =
    String(
      shop?.id
      ||
      ''
    );


  const shopDomainFromApi =
    normalizeShopDomain(
      String(
        shop?.myshopifyDomain
        ||
        ''
      )
    );


  const shopName =
    String(
      shop?.name
      ||
      ''
    );


  if (
    !shopId
    ||
    !shopDomainFromApi
  ) {

    throw new Error(
      'Shopify Shop query returned incomplete identity'
    );

  }


  if (
    shopDomainFromApi !==
    normalizedShopDomain
  ) {

    throw new Error(
      'Shopify Admin API shop domain does not match authenticated shop'
    );

  }


  return {

    shopId,

    shopDomain:
      shopDomainFromApi,

    shopName,

  };

}

// ============================================================
// QUERY EARLIEST SHOPIFY ORDER
//
// Read-only source-coverage probe.
//
// Used by Growth OS during connector bootstrap to determine the
// actual beginning of accessible Shopify Orders history.
//
// No warehouse writes.
// No Bulk Operation.
// ============================================================

export type ShopifyEarliestOrder = {

  id:
    string;

  legacyResourceId:
    string | null;

  name:
    string | null;

  createdAt:
    string;

  updatedAt:
    string | null;

};


export async function queryEarliestShopifyOrder(
  shopDomain: string,
  accessToken: string
):
  Promise<
    ShopifyEarliestOrder | null
  > {

  const normalizedShopDomain =
    normalizeShopDomain(
      shopDomain
    );


  if (
    !normalizedShopDomain
    ||
    !normalizedShopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_SHOP_DOMAIN_INVALID'
    );

  }


  if (!accessToken) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_ACCESS_TOKEN_MISSING'
    );

  }


  const apiVersion =
    getShopifyApiVersion();


  const response =
    await fetch(

      `https://${normalizedShopDomain}/admin/api/${apiVersion}/graphql.json`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'X-Shopify-Access-Token':
            accessToken,

        },

        body:
          JSON.stringify({

            query:
              `
                query GrowthOsEarliestOrder {

                  orders(
                    first: 1
                    sortKey: CREATED_AT
                    reverse: false
                  ) {

                    nodes {

                      id
                      legacyResourceId
                      name
                      createdAt
                      updatedAt

                    }

                  }

                }
              `,

          }),

        cache:
          'no-store',

      }

    );


  const raw =
    await response.text();


  let json:
    any;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_RESPONSE_INVALID'
    );

  }


  if (!response.ok) {

    console.error(
      'SHOPIFY_EARLIEST_ORDER_HTTP_FAILED',
      {
        status:
          response.status,
      }
    );


    throw new Error(
      `SHOPIFY_EARLIEST_ORDER_HTTP_${response.status}`
    );

  }


  if (
    Array.isArray(
      json?.errors
    )
    &&
    json.errors.length > 0
  ) {

    console.error(
      'SHOPIFY_EARLIEST_ORDER_GRAPHQL_FAILED',
      json.errors
    );


    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_GRAPHQL_FAILED'
    );

  }


  const nodes =
    Array.isArray(
      json?.data?.orders?.nodes
    )
      ?
        json.data.orders.nodes
      :
        [];


  const order =
    nodes[0]
    ??
    null;


  // Empty Shopify store is valid.
  if (!order) {

    return null;

  }


  const id =
    String(
      order?.id
      ||
      ''
    ).trim();


  const createdAt =
    String(
      order?.createdAt
      ||
      ''
    ).trim();


  if (
    !id
    ||
    !createdAt
  ) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_INCOMPLETE'
    );

  }


  return {

    id,

    legacyResourceId:
      order?.legacyResourceId
        ?
          String(
            order.legacyResourceId
          )
        :
          null,

    name:
      order?.name
        ?
          String(
            order.name
          )
        :
          null,

    createdAt,

    updatedAt:
      order?.updatedAt
        ?
          String(
            order.updatedAt
          )
        :
          null,

  };

}


// ============================================================
// EARLIEST SHOPIFY CUSTOMER
//
// READ ONLY.
//
// Used during Shopify onboarding / reconnection to discover
// the true beginning of accessible Customer history.
//
// No warehouse writes.
// No Bulk Operation.
// ============================================================

export type ShopifyEarliestCustomer = {

  id:
    string;

  legacyResourceId:
    string | null;

  createdAt:
    string;

  updatedAt:
    string | null;

};


export async function queryEarliestShopifyCustomer(
  shopDomain: string,
  accessToken: string
):
  Promise<
    ShopifyEarliestCustomer | null
  > {

  const normalizedShopDomain =
    normalizeShopDomain(
      shopDomain
    );


  // ==========================================================
  // SHOP DOMAIN
  // ==========================================================

  if (
    !normalizedShopDomain
    ||
    !normalizedShopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'SHOPIFY_EARLIEST_CUSTOMER_SHOP_DOMAIN_INVALID'
    );

  }


  // ==========================================================
  // ACCESS TOKEN
  // ==========================================================

  if (!accessToken) {

    throw new Error(
      'SHOPIFY_EARLIEST_CUSTOMER_ACCESS_TOKEN_MISSING'
    );

  }


  const apiVersion =
    getShopifyApiVersion();


  // ==========================================================
  // SHOPIFY ADMIN GRAPHQL
  // ==========================================================

  const response =
    await fetch(

      `https://${normalizedShopDomain}/admin/api/${apiVersion}/graphql.json`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'X-Shopify-Access-Token':
            accessToken,

        },

        body:
          JSON.stringify({

            query:
              `

                query GrowthOsEarliestCustomer {

                  customers(
                    first: 1
                    sortKey: CREATED_AT
                    reverse: false
                  ) {

                    nodes {

                      id
                      legacyResourceId

                      createdAt
                      updatedAt

                    }

                  }

                }

              `,

          }),

        cache:
          'no-store',

      }

    );


  const raw =
    await response.text();


  let json:
    any;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_EARLIEST_CUSTOMER_RESPONSE_INVALID'
    );

  }


  // ==========================================================
  // HTTP FAILURE
  // ==========================================================

  if (!response.ok) {

    console.error(
      'SHOPIFY_EARLIEST_CUSTOMER_HTTP_FAILED',
      {

        status:
          response.status,

      }
    );


    throw new Error(
      `SHOPIFY_EARLIEST_CUSTOMER_HTTP_${response.status}`
    );

  }


  // ==========================================================
  // GRAPHQL FAILURE
  // ==========================================================

  if (
    Array.isArray(
      json?.errors
    )
    &&
    json.errors.length >
      0
  ) {

    console.error(
      'SHOPIFY_EARLIEST_CUSTOMER_GRAPHQL_FAILED',
      json.errors
    );


    throw new Error(
      'SHOPIFY_EARLIEST_CUSTOMER_GRAPHQL_FAILED'
    );

  }


  const nodes =
    Array.isArray(
      json?.data?.customers?.nodes
    )
      ?
        json.data.customers.nodes
      :
        [];


  const customer =
    nodes[0]
    ??
    null;


  // ==========================================================
  // EMPTY SHOPIFY CUSTOMER BASE IS VALID
  // ==========================================================

  if (!customer) {

    return null;

  }


  const id =
    String(
      customer?.id
      ||
      ''
    ).trim();


  const createdAt =
    String(
      customer?.createdAt
      ||
      ''
    ).trim();


  if (
    !id
    ||
    !createdAt
  ) {

    throw new Error(
      'SHOPIFY_EARLIEST_CUSTOMER_INCOMPLETE'
    );

  }


  return {

    id,

    legacyResourceId:
      customer?.legacyResourceId
        ?
          String(
            customer.legacyResourceId
          )
        :
          null,

    createdAt,

    updatedAt:
      customer?.updatedAt
        ?
          String(
            customer.updatedAt
          )
        :
          null,

  };

}

// ============================================================
// RESOLVE CANONICAL SHOP ID
//
// EXISTING SETUP / VERIFICATION PATH.
//
// Uses ONLINE access token.
//
// Retained for current development / compatibility.
//
// Do not call on every Growth OS API request.
// ============================================================

export async function resolveShopifyShopIdentity(
  idToken: string
):

  Promise<
    ShopifyResolvedShop
  > {

  // ==========================================================
  // 1. VERIFY SHOPIFY ID TOKEN
  // ==========================================================

  const verified =
    await verifyShopifyTokenClaims(
      idToken
    );


  // ==========================================================
  // 2. EXCHANGE FOR ONLINE ADMIN ACCESS TOKEN
  // ==========================================================

  const accessToken =
    await exchangeIdTokenForOnlineAccessToken(

      idToken,

      verified.shopDomain

    );


  // ==========================================================
  // 3. QUERY CANONICAL SHOP
  // ==========================================================

  return queryCurrentShop(

    verified.shopDomain,

    accessToken

  );

}


// ============================================================
// RESOLVE SHOPIFY INSTALLATION BOOTSTRAP
//
// CANONICAL STEP 1C FUNCTION.
//
// Shopify-managed installation
//        ↓
// App Bridge ID token
//        ↓
// verify Shopify JWT
//        ↓
// verified myshopify domain
//        ↓
// expiring offline Admin credential
//        ↓
// canonical Shopify shop query
//
// Returns:
//
// shop identity
// +
// credential
//
// IMPORTANT:
//
// This function does NOT:
//
// create workspace
// create brand
// create integration connection
// create integration account
// store credential
// provision App Embed
// provision Web Pixel
// register webhook
// start Shopify sync
//
// Those happen in later locked steps.
// ============================================================

export async function resolveShopifyInstallationBootstrap(
  idToken: string
):

  Promise<
    ShopifyInstallationBootstrap
  > {

  // ==========================================================
  // 1. VERIFY AUTHENTIC SHOPIFY TOKEN
  // ==========================================================

  const verified =
    await verifyShopifyTokenClaims(
      idToken
    );


  // ==========================================================
  // 2. OBTAIN OFFLINE ADMIN CREDENTIAL
  // ==========================================================

  const credential =
    await exchangeIdTokenForOfflineAccessToken(

      idToken,

      verified.shopDomain

    );


  // ==========================================================
  // 3. VERIFY CANONICAL SHOP THROUGH ADMIN API
  // ==========================================================

  const shop =
    await queryCurrentShop(

      verified.shopDomain,

      credential.accessToken

    );


  // ==========================================================
  // 4. DEFENCE-IN-DEPTH DOMAIN CHECK
  // ==========================================================

  if (
    shop.shopDomain !==
    verified.shopDomain
  ) {

    throw new Error(
      'Resolved Shopify shop does not match authenticated Shopify shop'
    );

  }


  return {

    shop,

    credential,

  };

}