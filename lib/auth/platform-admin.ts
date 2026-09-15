import 'server-only';

import type {
  NextRequest,
} from 'next/server';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  requireRequestAuth,
  type AuthIdentity,
} from '@/lib/auth/request-auth';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


const CONTROL_DATASET =
  process.env.GROWTHOS_CONTROL_DATASET
  ||
  'growthos_control';


const LOCATION =
  process.env.GCP_BQ_LOCATION
  ||
  'asia-south1';


type PlatformAdminCacheEntry = {
  value: PlatformAdminRecord | null;
  expiresAt: number;
  promise?: Promise<PlatformAdminRecord | null>;
};

type GlobalWithPlatformAdminCache = typeof globalThis & {
  __growthosPlatformAdminCache?: Map<string, PlatformAdminCacheEntry>;
};

const platformAdminGlobal = globalThis as GlobalWithPlatformAdminCache;
const platformAdminCache =
  platformAdminGlobal.__growthosPlatformAdminCache
  || new Map<string, PlatformAdminCacheEntry>();
platformAdminGlobal.__growthosPlatformAdminCache = platformAdminCache;

const PLATFORM_ADMIN_CACHE_TTL_MS = Math.max(
  5000,
  Number(process.env.GROWTHOS_PLATFORM_ADMIN_CACHE_TTL_MS || 60000)
);

function adminAuthDebug(message: string) {
  if (String(process.env.GROWTHOS_ADMIN_CACHE_DEBUG || '').trim().toLowerCase() === 'true') {
    console.log(message);
  }
}

function readProxyAuthIdentity(request: NextRequest): AuthIdentity | null {
  if (request.headers.get('x-growthos-proxy-authenticated') !== '1') {
    return null;
  }

  const authSource = request.headers.get('x-growthos-auth-source');
  const userId = request.headers.get('x-growthos-user-id');
  const tenantId = request.headers.get('x-growthos-tenant-id');

  if ((authSource !== 'public' && authSource !== 'shopify') || !userId || !tenantId) {
    return null;
  }

  return {
    authSource,
    userId,
    tenantId,
    workspaceId: request.headers.get('x-growthos-workspace-id') || undefined,
    brandId: request.headers.get('x-growthos-brand-id') || undefined,
    role: (request.headers.get('x-growthos-role') || undefined) as AuthIdentity['role'],
    authMethod: (request.headers.get('x-growthos-auth-method') || undefined) as AuthIdentity['authMethod'],
    shopId: request.headers.get('x-growthos-shop-id') || undefined,
    shopDomain: request.headers.get('x-growthos-shop-domain') || undefined,
  };
}


// ============================================================
// TYPES
// ============================================================

export type PlatformAdminRole =
  | 'super_admin'
  | 'admin';


export type PlatformAdminRecord = {

  userId:
    string;

  platformRole:
    PlatformAdminRole;

  status:
    'active';

  createdAt:
    string | null;

  updatedAt:
    string | null;

};


export type PlatformAdminIdentity =

  AuthIdentity
  & {

    platformRole:
      PlatformAdminRole;

  };


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Platform Admin authorization requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// GET PLATFORM ADMIN
//
// Canonical platform-level authorization lookup.
//
// IMPORTANT:
//
// brand_memberships.role
//
// is NOT used here.
//
// Client roles:
//
// owner
// admin
// analyst
// viewer
//
// are completely separate from:
//
// platform_admins.platform_role
//
// super_admin
// admin
// ============================================================

async function loadPlatformAdminByUserId(

  userId:
    string

):

  Promise<
    PlatformAdminRecord |
    null
  > {

  const projectId =
    requireProjectId();


  const normalizedUserId =
    String(
      userId
      ||
      ''
    ).trim();


  if (!normalizedUserId) {

    return null;

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          user_id,

          platform_role,

          status,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            created_at
          )
            AS created_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            updated_at
          )
            AS updated_at


        FROM
          \`${projectId}.${CONTROL_DATASET}.platform_admins\`


        WHERE

          user_id =
            @user_id

          AND LOWER(
            status
          ) =
            'active'


        ORDER BY
          updated_at DESC


        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        user_id:
          normalizedUserId,

      },

      types: {

        user_id:
          'STRING',

      },

    });


  const row =
    rows?.[0];


  if (!row) {

    return null;

  }


  const platformRole =
    String(
      row.platform_role
      ||
      ''
    )
      .trim()
      .toLowerCase();


  // ==========================================================
  // DENY UNKNOWN ROLES
  //
  // Fail closed.
  // ==========================================================

  if (
    platformRole !==
      'super_admin'
    &&
    platformRole !==
      'admin'
  ) {

    return null;

  }


  return {

    userId:
      String(
        row.user_id
      ),

    platformRole:
      platformRole as PlatformAdminRole,

    status:
      'active',

    createdAt:
      row.created_at
      ??
      null,

    updatedAt:
      row.updated_at
      ??
      null,

  };

}


export async function getPlatformAdminByUserId(
  userId: string
): Promise<PlatformAdminRecord | null> {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  const now = Date.now();
  const existing = platformAdminCache.get(normalizedUserId);

  if (existing?.value !== undefined && existing.expiresAt > now) {
    adminAuthDebug(`[ADMIN_AUTH] PLATFORM_ADMIN HIT user=${normalizedUserId}`);
    return existing.value;
  }

  if (existing?.promise) {
    adminAuthDebug(`[ADMIN_AUTH] PLATFORM_ADMIN INFLIGHT user=${normalizedUserId}`);
    return existing.promise;
  }

  adminAuthDebug(`[ADMIN_AUTH] PLATFORM_ADMIN MISS user=${normalizedUserId}`);

  const promise = loadPlatformAdminByUserId(normalizedUserId)
    .then(value => {
      platformAdminCache.set(normalizedUserId, {
        value,
        expiresAt: Date.now() + PLATFORM_ADMIN_CACHE_TTL_MS,
      });
      return value;
    })
    .catch(error => {
      platformAdminCache.delete(normalizedUserId);
      throw error;
    });

  platformAdminCache.set(normalizedUserId, {
    value: existing?.value ?? null,
    expiresAt: existing?.expiresAt || 0,
    promise,
  });

  return promise;
}

export function invalidatePlatformAdminCache(userId?: string) {
  if (userId) {
    platformAdminCache.delete(String(userId).trim());
    return;
  }

  platformAdminCache.clear();
}


// ============================================================
// IS PLATFORM ADMIN
// ============================================================

export async function isPlatformAdminUser(

  userId:
    string

) {

  const admin =
    await getPlatformAdminByUserId(
      userId
    );


  return Boolean(
    admin
  );

}


// ============================================================
// REQUIRE PLATFORM ADMIN USER
//
// Useful later for server-side page authorization where we
// already have a verified Growth OS user_id.
// ============================================================

export async function requirePlatformAdminUser(

  userId:
    string

):

  Promise<
    PlatformAdminRecord
  > {

  const admin =
    await getPlatformAdminByUserId(
      userId
    );


  if (!admin) {

    throw new Error(
      'ADMIN_ACCESS_REQUIRED'
    );

  }


  return admin;

}


// ============================================================
// REQUIRE PLATFORM ADMIN REQUEST
//
// API authorization flow:
//
// request
//   â†“
// Growth OS authentication
//   â†“
// reject Shopify embedded identity
//   â†“
// platform_admins lookup
//   â†“
// active super_admin/admin
//   â†“
// authorized
// ============================================================

export async function requirePlatformAdmin(

  request:
    NextRequest

):

  Promise<
    PlatformAdminIdentity
  > {

  // ==========================================================
  // 1. REQUIRE AUTHENTICATED SESSION
  // ==========================================================

  const proxyIdentity = readProxyAuthIdentity(request);

  if (proxyIdentity) {
    adminAuthDebug(`[ADMIN_AUTH] PROXY_IDENTITY user=${proxyIdentity.userId}`);
  }

  const identity =
    proxyIdentity
    ||
    await requireRequestAuth(
      request
    );


  // ==========================================================
  // 2. ADMIN MUST USE GROWTH OS PUBLIC SESSION
  //
  // Shopify embedded identity can never grant platform admin.
  // ==========================================================

  if (
    identity.authSource !==
      'public'
    ||
    identity.authMethod ===
      'shopify'
  ) {

    throw new Error(
      'ADMIN_ACCESS_REQUIRED'
    );

  }


  // ==========================================================
  // 3. PLATFORM ADMIN LOOKUP
  // ==========================================================

  const admin =
    await requirePlatformAdminUser(
      identity.userId
    );


  // ==========================================================
  // 4. AUTHORIZED IDENTITY
  // ==========================================================

  return {

    ...identity,

    platformRole:
      admin.platformRole,

  };

}

// ============================================================
// REQUIRE PLATFORM SUPER ADMIN
//
// Reserved for highly privileged infrastructure operations.
//
// Examples:
//
// control-plane bootstrap
// destructive platform maintenance
// future platform-admin management
// ============================================================

export async function requirePlatformSuperAdmin(

  request:
    NextRequest

):

  Promise<
    PlatformAdminIdentity
  > {

  const identity =
    await requirePlatformAdmin(
      request
    );


  if (
    identity.platformRole !==
      'super_admin'
  ) {

    throw new Error(
      'SUPER_ADMIN_ACCESS_REQUIRED'
    );

  }


  return identity;

}

