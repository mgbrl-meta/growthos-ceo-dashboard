import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

import type {
  GrowthOSBrandRole,
  GrowthOSMembershipStatus,
  GrowthOSUserStatus,
} from '@/lib/auth/user-store';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


const DATASET_ID =
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

export type AdminUserMembership = {

  membershipId:
    string;

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  role:
    GrowthOSBrandRole;

  status:
    GrowthOSMembershipStatus;

  isDefault:
    boolean;

  createdAt:
    string | null;

  updatedAt:
    string | null;

};


export type AdminGrowthOSUser = {

  userId:
    string;

  email:
    string | null;

  fullName:
    string | null;

  status:
    GrowthOSUserStatus | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

  lastLoginAt:
    string | null;

  memberships:
    AdminUserMembership[];

};


export type AdminUsersSnapshot = {

  summary: {

    totalUsers:
      number;

    activeUsers:
      number;

    inactiveUsers:
      number;

    suspendedUsers:
      number;

    memberships:
      number;

    activeMemberships:
      number;

    clients:
      number;

  };

  users:
    AdminGrowthOSUser[];

};


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Admin Users requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// ADMIN USERS
//
// GLOBAL FAST READ.
//
// IMPORTANT:
//
// This function:
//
// - does NOT call ensureGrowthOSAuthStore()
// - does NOT call ensureGrowthOSControlPlane()
// - does NOT mutate users
// - does NOT mutate memberships
// - does NOT expose password_hash
//
// Source of truth:
//
// growthos_control.users
// growthos_control.brand_memberships
// growthos_control.workspaces
// growthos_control.brands
//
// We start from USERS rather than memberships so a valid user
// remains visible even if they currently have zero memberships.
// ============================================================

export async function getAdminUsersSnapshot():

  Promise<
    AdminUsersSnapshot
  > {

  const projectId =
    requireProjectId();


  const [
    rawRows,
  ] =
    await bigquery.query({

      query: `

        -- ====================================================
        -- LATEST LOGICAL USERS
        -- ====================================================

        WITH latest_users AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.users\`

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY
                user_id

              ORDER BY

                updated_at DESC,

                created_at DESC,

                user_id DESC

            ) = 1

        ),


        -- ====================================================
        -- LATEST LOGICAL MEMBERSHIPS
        -- ====================================================

        latest_memberships AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_memberships\`

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY

                user_id,

                workspace_id,

                brand_id

              ORDER BY

                updated_at DESC,

                created_at DESC,

                membership_id DESC

            ) = 1

        ),


        -- ====================================================
        -- LATEST WORKSPACES
        -- ====================================================

        latest_workspaces AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.workspaces\`

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY
                workspace_id

              ORDER BY

                updated_at DESC,

                created_at DESC

            ) = 1

        ),


        -- ====================================================
        -- LATEST BRANDS
        -- ====================================================

        latest_brands AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brands\`

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY

                workspace_id,

                brand_id

              ORDER BY

                updated_at DESC,

                created_at DESC

            ) = 1

        )


        -- ====================================================
        -- FINAL USER + MEMBERSHIP ROWS
        -- ====================================================

        SELECT

          u.user_id,

          u.email,

          u.full_name,

          u.status
            AS user_status,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            u.created_at
          )
            AS user_created_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            u.updated_at
          )
            AS user_updated_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            u.last_login_at
          )
            AS last_login_at,


          m.membership_id,

          m.workspace_id,

          w.workspace_name,

          m.brand_id,

          b.brand_name,

          m.role,

          m.status
            AS membership_status,

          COALESCE(
            m.is_default,
            FALSE
          )
            AS is_default,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            m.created_at
          )
            AS membership_created_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            m.updated_at
          )
            AS membership_updated_at


        FROM
          latest_users
          AS u


        LEFT JOIN
          latest_memberships
          AS m

        ON
          m.user_id =
            u.user_id


        LEFT JOIN
          latest_workspaces
          AS w

        ON
          w.workspace_id =
            m.workspace_id


        LEFT JOIN
          latest_brands
          AS b

        ON
          b.workspace_id =
            m.workspace_id

          AND b.brand_id =
            m.brand_id


        ORDER BY

          CASE u.status

            WHEN 'active'
              THEN 1

            WHEN 'inactive'
              THEN 2

            WHEN 'suspended'
              THEN 3

            ELSE 99

          END,

          COALESCE(
            u.full_name,
            u.email,
            u.user_id
          ),

          CASE m.role

            WHEN 'owner'
              THEN 1

            WHEN 'admin'
              THEN 2

            WHEN 'analyst'
              THEN 3

            WHEN 'viewer'
              THEN 4

            ELSE 99

          END,

          COALESCE(
            b.brand_name,
            w.workspace_name,
            m.brand_id,
            m.workspace_id
          )

      `,

      location:
        LOCATION,

    });


  const rows =
    (
      rawRows
      ||
      []
    ) as any[];


  // ==========================================================
  // GROUP MEMBERSHIP ROWS INTO ONE LOGICAL USER
  // ==========================================================

  const userMap =
    new Map<
      string,
      AdminGrowthOSUser
    >();


  for (
    const row
    of rows
  ) {

    const userId =
      String(
        row.user_id
        ||
        ''
      );


    if (!userId) {

      continue;

    }


    let user =
      userMap.get(
        userId
      );


    if (!user) {

      user = {

        userId,

        email:
          row.email
          ??
          null,

        fullName:
          row.full_name
          ??
          null,

        status:
          row.user_status
          ??
          null,

        createdAt:
          row.user_created_at
          ??
          null,

        updatedAt:
          row.user_updated_at
          ??
          null,

        lastLoginAt:
          row.last_login_at
          ??
          null,

        memberships:
          [],

      };


      userMap.set(
        userId,
        user
      );

    }


    // --------------------------------------------------------
    // USER MAY HAVE NO MEMBERSHIP
    // --------------------------------------------------------

    if (
      !row.membership_id
    ) {

      continue;

    }


    user.memberships.push({

      membershipId:
        String(
          row.membership_id
        ),

      workspaceId:
        String(
          row.workspace_id
          ||
          ''
        ),

      workspaceName:
        row.workspace_name
        ??
        null,

      brandId:
        String(
          row.brand_id
          ||
          ''
        ),

      brandName:
        row.brand_name
        ??
        null,

      role:
        row.role as
          GrowthOSBrandRole,

      status:
        row.membership_status as
          GrowthOSMembershipStatus,

      isDefault:
        Boolean(
          row.is_default
        ),

      createdAt:
        row.membership_created_at
        ??
        null,

      updatedAt:
        row.membership_updated_at
        ??
        null,

    });

  }


  const users =
    Array.from(
      userMap.values()
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const activeUsers =
    users.filter(
      user =>
        user.status ===
          'active'
    ).length;


  const inactiveUsers =
    users.filter(
      user =>
        user.status ===
          'inactive'
    ).length;


  const suspendedUsers =
    users.filter(
      user =>
        user.status ===
          'suspended'
    ).length;


  const memberships =
    users.reduce(
      (
        total,
        user
      ) =>
        total
        +
        user.memberships.length,
      0
    );


  const activeMemberships =
    users.reduce(
      (
        total,
        user
      ) =>
        total
        +
        user.memberships.filter(
          membership =>
            membership.status ===
              'active'
        ).length,
      0
    );


  const clients =
    new Set(
      users.flatMap(
        user =>
          user.memberships.map(
            membership =>
              [
                membership.workspaceId,
                membership.brandId,
              ].join(
                ':'
              )
          )
      )
    ).size;


  return {

    summary: {

      totalUsers:
        users.length,

      activeUsers,

      inactiveUsers,

      suspendedUsers,

      memberships,

      activeMemberships,

      clients,

    },

    users,

  };

}