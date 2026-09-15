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


type AdminLiveAuthCacheEntry = {
  identity?: AuthIdentity;
  expiresAt: number;
  promise?: Promise<AuthIdentity | null>;
  sessionId?: string;
  userId?: string;
};

type GlobalWithAdminLiveAuthCache = typeof globalThis & {
  __growthosAdminLiveAuthCache?: Map<string, AdminLiveAuthCacheEntry>;
};

const adminLiveAuthGlobal = globalThis as GlobalWithAdminLiveAuthCache;
const adminLiveAuthCache =
  adminLiveAuthGlobal.__growthosAdminLiveAuthCache
  || new Map<string, AdminLiveAuthCacheEntry>();
adminLiveAuthGlobal.__growthosAdminLiveAuthCache = adminLiveAuthCache;

const ADMIN_LIVE_AUTH_TTL_MS = Math.max(
  5000,
  Number(process.env.GROWTHOS_ADMIN_AUTH_CACHE_TTL_MS || 120000)
);

function isAdminRequestPath(request: NextRequest) {
  const pathname = request.nextUrl?.pathname || '';
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
}

function adminAuthDebug(message: string) {
  if (String(process.env.GROWTHOS_ADMIN_CACHE_DEBUG || '').trim().toLowerCase() === 'true') {
    console.log(message);
  }
}

async function authenticateAdminPasswordSessionFast(
  request: NextRequest,
  session: Awaited<ReturnType<typeof verifyGrowthOsSession>>
): Promise<AuthIdentity | null> {
  if (!isAdminRequestPath(request) || !session.sessionId) {
    return null;
  }

  const cacheKey = [
    session.sessionId,
    session.userId,
    session.workspaceId,
    session.brandId,
  ].join(':');

  const now = Date.now();
  const existing = adminLiveAuthCache.get(cacheKey);

  if (existing?.identity && existing.expiresAt > now) {
    adminAuthDebug(`[ADMIN_AUTH] LIVE_IDENTITY HIT user=${session.userId}`);
    return existing.identity;
  }

  if (existing?.promise) {
    adminAuthDebug(`[ADMIN_AUTH] LIVE_IDENTITY INFLIGHT user=${session.userId}`);
    return existing.promise;
  }

  adminAuthDebug(`[ADMIN_AUTH] LIVE_IDENTITY MISS user=${session.userId}`);

  const promise = Promise.all([
    getGrowthOSSecuritySessionFast(session.sessionId, session.userId),
    getActiveBrandMembershipFast(
      session.userId,
      session.workspaceId,
      session.brandId
    ),
  ])
    .then(([liveSecuritySession, membership]) => {
      if (
        !liveSecuritySession
        || liveSecuritySession.workspace_id !== session.workspaceId
        || liveSecuritySession.brand_id !== session.brandId
        || !membership
      ) {
        adminLiveAuthCache.delete(cacheKey);
        return null;
      }

      const identity: AuthIdentity = {
        authSource: 'public',
        userId: session.userId,
        authSessionId: session.sessionId,
        email: session.email,
        workspaceId: membership.workspace_id,
        brandId: membership.brand_id,
        role: membership.role,
        authMethod: session.authMethod,
        tenantId: session.tenantId,
      };

      adminLiveAuthCache.set(cacheKey, {
        identity,
        expiresAt: Date.now() + ADMIN_LIVE_AUTH_TTL_MS,
        sessionId: session.sessionId,
        userId: session.userId,
      });

      return identity;
    })
    .catch(error => {
      adminLiveAuthCache.delete(cacheKey);
      throw error;
    });

  adminLiveAuthCache.set(cacheKey, {
    expiresAt: 0,
    promise,
    sessionId: session.sessionId,
    userId: session.userId,
  });

  return promise;
}


export function invalidateAdminLiveAuthCache(options?: {
  sessionId?: string;
  userId?: string;
}) {
  const sessionId = String(options?.sessionId || '').trim();
  const userId = String(options?.userId || '').trim();

  if (!sessionId && !userId) {
    adminAuthDebug('[ADMIN_AUTH] LIVE_IDENTITY INVALIDATE all');
    adminLiveAuthCache.clear();
    return;
  }

  for (const [key, entry] of adminLiveAuthCache.entries()) {
    const matchesSession = !sessionId || entry.sessionId === sessionId;
    const matchesUser = !userId || entry.userId === userId;

    if (matchesSession && matchesUser) {
      adminAuthDebug(
        `[ADMIN_AUTH] LIVE_IDENTITY INVALIDATE user=${entry.userId || userId || 'unknown'} session=${entry.sessionId || sessionId || 'unknown'}`
      );
      adminLiveAuthCache.delete(key);
    }
  }
}


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


const adminIdentity =
  await authenticateAdminPasswordSessionFast(
    request,
    session
  );

if (adminIdentity) {
  return adminIdentity;
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