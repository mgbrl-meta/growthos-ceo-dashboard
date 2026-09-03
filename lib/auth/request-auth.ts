import 'server-only';

import type {
  NextRequest,
} from 'next/server';

import {
  SESSION_COOKIE_NAME,
} from './config';

import {
  verifyGrowthOsSession,
} from './session';

import {
  getBearerToken,
  verifyShopifyIdToken,
} from './shopify';


// ============================================================
// AUTH IDENTITY
// ============================================================

export type AuthIdentity = {

  authSource:
    'shopify'
    |
    'public';

  userId: string;

  tenantId: string;

  email?: string;

  shopId?: string;

  shopDomain?: string;

  sessionId?: string;

};


// ============================================================
// AUTHENTICATE
//
// Priority:
//
// Shopify Bearer token
//        ↓
// Public signed cookie
// ============================================================

export async function authenticateRequest(
  request: NextRequest
):

  Promise<
    AuthIdentity | null
  > {


  // ==========================================================
  // SHOPIFY EMBEDDED AUTH
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
  // PUBLIC GROWTH OS LOGIN
  // ==========================================================

  const sessionToken =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value;


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

      tenantId:
        session.tenantId,

      email:
        session.email,

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