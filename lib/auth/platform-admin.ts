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

export async function getPlatformAdminByUserId(

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

  const identity =
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

