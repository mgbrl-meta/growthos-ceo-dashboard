import 'server-only';

import crypto from 'crypto';

import {
  getShopifyClientId,
  getShopifyClientSecret,
} from '@/lib/auth/config';

import {
  getShopifyOAuthScopes,
  validateShopifyOAuthShop,
} from '@/lib/integrations/providers/shopify-oauth';


// ============================================================
// SHOPIFY HUMAN / STAFF IDENTITY
//
// This OAuth flow is deliberately separate from the Shopify
// installation / offline credential flow.
//
// Installation OAuth:
//   store identity + offline backend credential
//
// User OAuth:
//   current Shopify staff identity
//
// The online token returned here is NOT persisted.
// We use it only as proof of the current Shopify human.
// ============================================================

export type ShopifyHumanIdentity = {

  shopifyUserId:
    string;

  email:
    string;

  emailVerified:
    boolean;

  firstName:
    string | null;

  lastName:
    string | null;

  locale:
    string | null;

  accountOwner:
    boolean;

  collaborator:
    boolean;

  associatedUserScope:
    string;

  expiresIn:
    number | null;

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
// SHOPIFY USER CALLBACK URL
//
// Optional override:
//
// SHOPIFY_USER_OAUTH_CALLBACK_URL
//
// Otherwise:
//
// {GROWTHOS_APP_URL}/api/auth/shopify/user-callback
// ============================================================

export function getShopifyUserOAuthCallbackUrl() {

  const configured =
    String(
      process.env.SHOPIFY_USER_OAUTH_CALLBACK_URL
      ||
      ''
    ).trim();


  if (configured) {

    return configured;

  }


  return (
    `${getGrowthOSAppUrl()}` +
    `/api/auth/shopify/user-callback`
  );

}


// ============================================================
// USER OAUTH STATE
//
// Separate state namespace from installation OAuth.
// ============================================================

export function generateShopifyUserOAuthState() {

  return crypto
    .randomBytes(
      32
    )
    .toString(
      'hex'
    );

}


// ============================================================
// BUILD SHOPIFY PER-USER AUTHORIZATION URL
//
// IMPORTANT:
//
// grant_options[]=per-user
//
// tells Shopify that this authorization is for the currently
// logged-in Shopify staff member rather than an offline store
// credential.
// ============================================================

export function buildShopifyUserAuthorizationUrl(
  shop: string,
  state: string
) {

  const normalizedShop =
    validateShopifyOAuthShop(
      shop
    );


  const normalizedState =
    String(
      state
      ||
      ''
    ).trim();


  if (!normalizedState) {

    throw new Error(
      'SHOPIFY_USER_OAUTH_STATE_MISSING'
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
        getShopifyUserOAuthCallbackUrl(),

      state:
        normalizedState,

    });


  params.append(
    'grant_options[]',
    'per-user'
  );


  return (
    `https://${normalizedShop}` +
    `/admin/oauth/authorize?` +
    params.toString()
  );

}


// ============================================================
// EXCHANGE PER-USER AUTHORIZATION CODE
//
// IMPORTANT:
//
// We deliberately DO NOT return or persist the online access
// token.
//
// The token response is used only to prove:
//
// - Shopify user ID
// - verified Shopify email
// - current Shopify user context
//
// Growth OS authorization still comes exclusively from:
//
// users
// +
// brand_memberships
// ============================================================

export async function exchangeShopifyUserAuthorizationCode(
  shop: string,
  code: string
):
  Promise<ShopifyHumanIdentity> {

  const normalizedShop =
    validateShopifyOAuthShop(
      shop
    );


  const normalizedCode =
    String(
      code
      ||
      ''
    ).trim();


  if (!normalizedCode) {

    throw new Error(
      'SHOPIFY_USER_OAUTH_CODE_MISSING'
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

            code:
              normalizedCode,

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
      'SHOPIFY_USER_OAUTH_RESPONSE_INVALID'
    );

  }


  // ==========================================================
  // TOKEN EXCHANGE FAILURE
  //
  // Never log access_token.
  // ==========================================================

  if (!response.ok) {

    console.error(
      'SHOPIFY_USER_OAUTH_TOKEN_EXCHANGE_FAILED',
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
      `SHOPIFY_USER_OAUTH_TOKEN_EXCHANGE_FAILED_${response.status}`
    );

  }


  // ==========================================================
  // ONLINE TOKEN MUST EXIST
  //
  // We verify its existence and immediately discard it.
  // ==========================================================

  const accessToken =
    String(
      json?.access_token
      ||
      ''
    ).trim();


  if (!accessToken) {

    throw new Error(
      'SHOPIFY_USER_OAUTH_ACCESS_TOKEN_MISSING'
    );

  }


  // ==========================================================
  // ASSOCIATED SHOPIFY HUMAN
  // ==========================================================

  const associatedUser =
    json?.associated_user;


  if (
    !associatedUser
    ||
    typeof associatedUser !==
      'object'
  ) {

    throw new Error(
      'SHOPIFY_ASSOCIATED_USER_MISSING'
    );

  }


  const shopifyUserId =
    String(
      associatedUser.id
      ??
      ''
    ).trim();


  if (!shopifyUserId) {

    throw new Error(
      'SHOPIFY_ASSOCIATED_USER_ID_MISSING'
    );

  }


  const email =
    String(
      associatedUser.email
      ||
      ''
    )
      .trim()
      .toLowerCase();


  if (!email) {

    throw new Error(
      'SHOPIFY_ASSOCIATED_USER_EMAIL_MISSING'
    );

  }


  const emailVerified =
    associatedUser.email_verified ===
      true;


  if (!emailVerified) {

    throw new Error(
      'SHOPIFY_ASSOCIATED_USER_EMAIL_NOT_VERIFIED'
    );

  }


  const firstName =
    String(
      associatedUser.first_name
      ||
      ''
    ).trim()
    ||
    null;


  const lastName =
    String(
      associatedUser.last_name
      ||
      ''
    ).trim()
    ||
    null;


  const locale =
    String(
      associatedUser.locale
      ||
      ''
    ).trim()
    ||
    null;


  const expiresInRaw =
    Number(
      json?.expires_in
    );


  return {

    shopifyUserId,

    email,

    emailVerified,

    firstName,

    lastName,

    locale,

    accountOwner:
      associatedUser.account_owner ===
        true,

    collaborator:
      associatedUser.collaborator ===
        true,

    associatedUserScope:
      String(
        json?.associated_user_scope
        ||
        ''
      ),

    expiresIn:
      Number.isFinite(
        expiresInRaw
      )
        ? expiresInRaw
        : null,

  };

}