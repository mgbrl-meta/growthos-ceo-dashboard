import 'server-only';

import type {
  NextRequest,
} from 'next/server';

import {
  SESSION_COOKIE_NAME,
} from './config';

import {
  verifyGrowthOsSession,
  type GrowthOsSessionRole,
  type GrowthOsSessionAuthMethod,
} from './session';

import {
  getBearerToken,
  verifyShopifyIdToken,
} from './shopify';

import {
  getActiveBrandMembershipFast,
} from './user-store';

import {
  getGrowthOSSecuritySessionFast,
} from './security-store';


// ============================================================
// AUTH IDENTITY
//
// Canonical request identity.
//
// Public/password sessions now carry:
//
// workspaceId
// brandId
// role
// authMethod
//
// Shopify bearer authentication remains supported while we
// migrate it to dynamic integration-account resolution in
// AUTH 5.
// ============================================================

export type AuthIdentity = {

  authSource:
    'shopify'
    |
    'public';

  userId:
    string;

  authSessionId?:
    string;

  email?:
    string;

  // ----------------------------------------------------------
  // CURRENT ACTIVE GROWTH OS CONTEXT
  // ----------------------------------------------------------

  workspaceId?:
    string;

  brandId?:
    string;

  role?:
    GrowthOsSessionRole;

  authMethod?:
    GrowthOsSessionAuthMethod;

  // ----------------------------------------------------------
  // TEMPORARY LEGACY COMPATIBILITY
  // ----------------------------------------------------------

  tenantId:
    string;

  // ----------------------------------------------------------
  // SHOPIFY IDENTITY
  // ----------------------------------------------------------

  shopId?:
    string;

  shopDomain?:
    string;

  sessionId?:
    string;

};


// ============================================================
// AUTHENTICATE
//
// Priority:
//
// Shopify Bearer token
//        ↓
// Growth OS signed session cookie
// ============================================================

export async function authenticateRequest(
  request: NextRequest
):

  Promise<
    AuthIdentity | null
  > {


  // ==========================================================
  // 1. SHOPIFY ADMIN AUTH
  //
  // AUTH 5 will replace its remaining legacy tenant lookup
  // with integration_accounts.
  // ==========================================================

  const bearerToken =
    getBearerToken(
      request.headers.get(
        'authorization'
      )
    );


  if (bearerToken) {

    try {

      const identity =
        await verifyShopifyIdToken(
          bearerToken
        );


      return {

        authSource:
          'shopify',

        userId:
          identity.userId,

        tenantId:
          identity.tenantId,

        authMethod:
          'shopify',

        shopId:
          identity.shopId,

        shopDomain:
          identity.shopDomain,

        sessionId:
          identity.sessionId,

      };

    } catch (
      error
    ) {

      console.error(
        'SHOPIFY_REQUEST_AUTH_FAILED',
        error
      );


      return null;

    }

  }


  // ==========================================================
  // 2. GROWTH OS SESSION COOKIE
  // ==========================================================

  const sessionToken =
    request
      .cookies
      .get(
        SESSION_COOKIE_NAME
      )
      ?.value;


  if (!sessionToken) {

    return null;

  }


  try {

  const session =
  await verifyGrowthOsSession(
    sessionToken
  );


// ==========================================================
// SHOPIFY-LAUNCHED GROWTH OS SESSION
//
// Shopify installation sessions use a synthetic Shopify user
// identity and do not require a normal brand_memberships row.
// ==========================================================

if (
  session.authMethod ===
    'shopify'
) {

  return {

    authSource:
      'public',

    userId:
      session.userId,

    authSessionId:
      session.sessionId,

    email:
      session.email,

    workspaceId:
      session.workspaceId,

    brandId:
      session.brandId,

    role:
      session.role,

    authMethod:
      session.authMethod,

    tenantId:
      session.tenantId,

  };

}


// ==========================================================
// PASSWORD SESSION → LIVE SESSION CHECK
//
// V3 password sessions are registered server-side so logout,
// sign-out-all and session revocation take effect immediately.
//
// Legacy password sessions without a sessionId are rejected
// after Security V1 deploy and must sign in again.
// ==========================================================

if (!session.sessionId) {

  return null;

}


const liveSecuritySession =
  await getGrowthOSSecuritySessionFast(

    session.sessionId,

    session.userId

  );


if (
  !liveSecuritySession
  ||
  liveSecuritySession.workspace_id !==
    session.workspaceId
  ||
  liveSecuritySession.brand_id !==
    session.brandId
) {

  return null;

}


// ==========================================================
// PASSWORD SESSION → LIVE ACCESS CHECK
//
// Session proves identity.
//
// Control plane proves CURRENT authorization.
// ==========================================================

const membership =
  await getActiveBrandMembershipFast(

    session.userId,

    session.workspaceId,

    session.brandId

  );


if (!membership) {

  return null;

}


// ==========================================================
// RETURN LIVE ROLE
//
// Do NOT trust session.role because it may have changed since
// login.
// ==========================================================

return {

  authSource:
    'public',

  userId:
    session.userId,

  authSessionId:
    session.sessionId,

  email:
    session.email,

  workspaceId:
    membership.workspace_id,

  brandId:
    membership.brand_id,

  role:
    membership.role,

  authMethod:
    session.authMethod,

  tenantId:
    session.tenantId,

};

  } catch (
    error
  ) {

    console.error(
      'PUBLIC_REQUEST_AUTH_FAILED',
      error
    );


    return null;

  }

}


// ============================================================
// REQUIRE AUTH
// ============================================================

export async function requireRequestAuth(
  request: NextRequest
):

  Promise<
    AuthIdentity
  > {

  const identity =
    await authenticateRequest(
      request
    );


  if (!identity) {

    throw new Error(
      'UNAUTHENTICATED'
    );

  }


  return identity;

}