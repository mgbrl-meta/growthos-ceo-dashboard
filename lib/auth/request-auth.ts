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


    return {

      authSource:
        'public',

      userId:
        session.userId,

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