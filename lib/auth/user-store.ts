import 'server-only';

import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  ensureGrowthOSControlPlane,
} from '@/lib/tenancy/control-plane';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';


// ============================================================
// TYPES
// ============================================================

export type GrowthOSUserStatus =
  | 'active'
  | 'inactive'
  | 'suspended';


export type GrowthOSBrandRole =
  | 'owner'
  | 'admin'
  | 'analyst'
  | 'viewer';


export type GrowthOSMembershipStatus =
  | 'active'
  | 'inactive';


export type StoredGrowthOSUser = {

  user_id:
    string;

  email:
    string;

  password_hash:
    string | null;

  full_name:
    string | null;

  status:
    GrowthOSUserStatus;

  created_at:
    string | null;

  updated_at:
    string | null;

  last_login_at:
    string | null;

};


export type StoredBrandMembership = {

  membership_id:
    string;

  user_id:
    string;

  workspace_id:
    string;

  brand_id:
    string;

  role:
    GrowthOSBrandRole;

  status:
    GrowthOSMembershipStatus;

  is_default:
    boolean;

  created_at:
    string | null;

  updated_at:
    string | null;

};


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
// IN-PROCESS SCHEMA CACHE
// ============================================================

let authStoreReady =
  false;


let authStorePromise:
  Promise<void> | null =
    null;


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS auth store requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// NORMALIZE EMAIL
// ============================================================

function normalizeEmail(
  email: string
) {

  const normalized =
    String(
      email
      ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    !normalized
    ||
    !normalized.includes(
      '@'
    )
  ) {

    throw new Error(
      'Valid email is required'
    );

  }


  return normalized;

}


// ============================================================
// DETERMINISTIC USER ID
//
// Same email always maps to the same Growth OS user.
//
// Example:
//
// usr_6bd947d21f5...
//
// This prevents duplicate users if provisioning is retried.
// ============================================================

function buildUserId(
  email: string
) {

  return (
    'usr_' +
    crypto
      .createHash(
        'sha256'
      )
      .update(
        normalizeEmail(
          email
        )
      )
      .digest(
        'hex'
      )
      .slice(
        0,
        24
      )
  );

}


// ============================================================
// DETERMINISTIC MEMBERSHIP ID
// ============================================================

function buildMembershipId(
  userId: string,
  workspaceId: string,
  brandId: string
) {

  const source =
    [
      userId,
      workspaceId,
      brandId,
    ].join(
      ':'
    );


  return (
    'mem_' +
    crypto
      .createHash(
        'sha256'
      )
      .update(
        source
      )
      .digest(
        'hex'
      )
      .slice(
        0,
        24
      )
  );

}


// ============================================================
// ENSURE AUTH STORE
//
// Creates:
//
// growthos_control.users
// growthos_control.brand_memberships
//
// Idempotent.
// ============================================================

export async function ensureGrowthOSAuthStore() {

  if (
    authStoreReady
  ) {

    return;

  }


  if (
    authStorePromise
  ) {

    return authStorePromise;

  }


  authStorePromise =
    (async () => {

      await ensureGrowthOSControlPlane();


      const projectId =
        requireProjectId();


      // ======================================================
      // USERS
      // ======================================================

      await bigquery.query({

        query: `

          CREATE TABLE IF NOT EXISTS
            \`${projectId}.${DATASET_ID}.users\`
          (

            user_id STRING NOT NULL,

            email STRING NOT NULL,

            password_hash STRING,

            full_name STRING,

            status STRING NOT NULL,

            created_at TIMESTAMP,

            updated_at TIMESTAMP,

            last_login_at TIMESTAMP

          )

          CLUSTER BY
            user_id,
            email,
            status

        `,

        location:
          LOCATION,

      });


      // ======================================================
      // BRAND MEMBERSHIPS
      //
      // One user can belong to:
      //
      // workspace A / brand A
      // workspace A / brand B
      // workspace B / brand C
      //
      // independently.
      // ======================================================

      await bigquery.query({

        query: `

          CREATE TABLE IF NOT EXISTS
            \`${projectId}.${DATASET_ID}.brand_memberships\`
          (

            membership_id STRING NOT NULL,

            user_id STRING NOT NULL,

            workspace_id STRING NOT NULL,

            brand_id STRING NOT NULL,

            role STRING NOT NULL,

            status STRING NOT NULL,

            is_default BOOL,

            created_at TIMESTAMP,

            updated_at TIMESTAMP

          )

          CLUSTER BY
            user_id,
            workspace_id,
            brand_id,
            status

        `,

        location:
          LOCATION,

      });


      authStoreReady =
        true;

    })();


  try {

    await authStorePromise;

  } catch (
    error
  ) {

    authStorePromise =
      null;

    authStoreReady =
      false;

    throw error;

  }


  authStorePromise =
    null;

}


// ============================================================
// GET USER BY EMAIL
// ============================================================

export async function getGrowthOSUserByEmail(
  email: string
):

  Promise<
    StoredGrowthOSUser | null
  > {

  await ensureGrowthOSAuthStore();


  const projectId =
    requireProjectId();


  const normalizedEmail =
    normalizeEmail(
      email
    );


  const query = `

    SELECT

      user_id,

      email,

      password_hash,

      full_name,

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
        AS updated_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_login_at
      )
        AS last_login_at

    FROM
      \`${projectId}.${DATASET_ID}.users\`

    WHERE

      LOWER(email) =
        @email

    ORDER BY
      updated_at DESC

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        LOCATION,

      params: {

        email:
          normalizedEmail,

      },

      types: {

        email:
          'STRING',

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredGrowthOSUser
    | null;

}


// ============================================================
// GET USER BY ID
// ============================================================

export async function getGrowthOSUserById(
  userId: string
):

  Promise<
    StoredGrowthOSUser | null
  > {

  await ensureGrowthOSAuthStore();


  const projectId =
    requireProjectId();


  const normalizedUserId =
    String(
      userId
      ||
      ''
    ).trim();


  if (!normalizedUserId) {

    throw new Error(
      'userId is required'
    );

  }


  const query = `

    SELECT

      user_id,

      email,

      password_hash,

      full_name,

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
        AS updated_at,

      FORMAT_TIMESTAMP(
        '%Y-%m-%dT%H:%M:%SZ',
        last_login_at
      )
        AS last_login_at

    FROM
      \`${projectId}.${DATASET_ID}.users\`

    WHERE

      user_id =
        @user_id

    ORDER BY
      updated_at DESC

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

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


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredGrowthOSUser
    | null;

}


// ============================================================
// UPSERT USER
//
// Password must already be bcrypt hashed before calling.
//
// This function NEVER accepts a plain-text password.
// ============================================================

export async function upsertGrowthOSUser(
  input: {

    email:
      string;

    passwordHash?:
      string | null;

    fullName?:
      string | null;

    status?:
      GrowthOSUserStatus;

  }
) {

  await ensureGrowthOSAuthStore();


  const projectId =
    requireProjectId();


  const email =
    normalizeEmail(
      input.email
    );


  const userId =
    buildUserId(
      email
    );


  const fullName =
    String(
      input.fullName
      ||
      ''
    ).trim();


  const status =
    input.status
    ||
    'active';


  const query = `

    MERGE
      \`${projectId}.${DATASET_ID}.users\`
      AS target

    USING
    (

      SELECT

        @user_id
          AS user_id,

        @email
          AS email,

        @password_hash
          AS password_hash,

        @full_name
          AS full_name,

        @status
          AS status

    )
    AS source


    ON
      target.user_id =
      source.user_id


    WHEN MATCHED THEN

      UPDATE SET

        email =
          source.email,

        password_hash =
          COALESCE(
            source.password_hash,
            target.password_hash
          ),

        full_name =
          source.full_name,

        status =
          source.status,

        updated_at =
          CURRENT_TIMESTAMP()


    WHEN NOT MATCHED THEN

      INSERT
      (

        user_id,

        email,

        password_hash,

        full_name,

        status,

        created_at,

        updated_at,

        last_login_at

      )

      VALUES
      (

        source.user_id,

        source.email,

        source.password_hash,

        source.full_name,

        source.status,

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP(),

        NULL

      )

  `;


  await bigquery.query({

    query,

    location:
      LOCATION,

    params: {

      user_id:
        userId,

      email,

      password_hash:
        input.passwordHash
        ??
        null,

      full_name:
        fullName
        ||
        null,

      status,

    },

    types: {

      user_id:
        'STRING',

      email:
        'STRING',

      password_hash:
        'STRING',

      full_name:
        'STRING',

      status:
        'STRING',

    },

  });


  return {

    userId,

    email,

    fullName:
      fullName
      ||
      null,

    status,

  };

}


// ============================================================
// UPSERT BRAND MEMBERSHIP
//
// Validates that workspace + brand already exist.
//
// User:
//
// usr_x
//
// can have:
//
// brand A → owner
// brand B → analyst
// brand C → viewer
// ============================================================

export async function upsertBrandMembership(
  input: {

    userId:
      string;

    workspaceId:
      string;

    brandId:
      string;

    role:
      GrowthOSBrandRole;

    status?:
      GrowthOSMembershipStatus;

    isDefault?:
      boolean;

  }
) {

  await ensureGrowthOSAuthStore();


  const projectId =
    requireProjectId();


  const userId =
    String(
      input.userId
      ||
      ''
    ).trim();


  const workspaceId =
    String(
      input.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      input.brandId
      ||
      ''
    ).trim();


  if (
    !userId
    ||
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'User, workspace and brand are required'
    );

  }


  // ==========================================================
  // VERIFY USER EXISTS
  // ==========================================================

  const user =
    await getGrowthOSUserById(
      userId
    );


  if (!user) {

    throw new Error(
      'Growth OS user does not exist'
    );

  }


  // ==========================================================
  // VERIFY TENANT EXISTS
  // ==========================================================

  await resolveTenantContextById(
    workspaceId,
    brandId
  );


  const membershipId =
    buildMembershipId(
      userId,
      workspaceId,
      brandId
    );


  const role =
    input.role;


  const status =
    input.status
    ||
    'active';


  const isDefault =
    input.isDefault
    ??
    false;


  // ==========================================================
  // ONLY ONE DEFAULT BRAND PER USER
  // ==========================================================

  if (isDefault) {

    await bigquery.query({

      query: `

        UPDATE
          \`${projectId}.${DATASET_ID}.brand_memberships\`

        SET

          is_default =
            FALSE,

          updated_at =
            CURRENT_TIMESTAMP()

        WHERE

          user_id =
            @user_id

          AND membership_id !=
            @membership_id

      `,

      location:
        LOCATION,

      params: {

        user_id:
          userId,

        membership_id:
          membershipId,

      },

      types: {

        user_id:
          'STRING',

        membership_id:
          'STRING',

      },

    });

  }


  // ==========================================================
  // UPSERT MEMBERSHIP
  // ==========================================================

  const query = `

    MERGE
      \`${projectId}.${DATASET_ID}.brand_memberships\`
      AS target

    USING
    (

      SELECT

        @membership_id
          AS membership_id,

        @user_id
          AS user_id,

        @workspace_id
          AS workspace_id,

        @brand_id
          AS brand_id,

        @role
          AS role,

        @status
          AS status,

        @is_default
          AS is_default

    )
    AS source


    ON
      target.membership_id =
      source.membership_id


    WHEN MATCHED THEN

      UPDATE SET

        workspace_id =
          source.workspace_id,

        brand_id =
          source.brand_id,

        role =
          source.role,

        status =
          source.status,

        is_default =
          source.is_default,

        updated_at =
          CURRENT_TIMESTAMP()


    WHEN NOT MATCHED THEN

      INSERT
      (

        membership_id,

        user_id,

        workspace_id,

        brand_id,

        role,

        status,

        is_default,

        created_at,

        updated_at

      )

      VALUES
      (

        source.membership_id,

        source.user_id,

        source.workspace_id,

        source.brand_id,

        source.role,

        source.status,

        source.is_default,

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP()

      )

  `;


  await bigquery.query({

    query,

    location:
      LOCATION,

    params: {

      membership_id:
        membershipId,

      user_id:
        userId,

      workspace_id:
        workspaceId,

      brand_id:
        brandId,

      role,

      status,

      is_default:
        isDefault,

    },

    types: {

      membership_id:
        'STRING',

      user_id:
        'STRING',

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      role:
        'STRING',

      status:
        'STRING',

      is_default:
        'BOOL',

    },

  });


  return {

    membershipId,

    userId,

    workspaceId,

    brandId,

    role,

    status,

    isDefault,

  };

}

// ============================================================
// FAST ACTIVE BRAND MEMBERSHIP
//
// HOT RUNTIME AUTH READ.
//
// NO:
//
// - schema creation
// - bootstrap
// - migrations
//
// Verifies:
//
// user is active
// membership is active
// workspace + brand match
//
// Returns the LIVE role so request authorization does not
// trust a stale role stored in the session cookie.
// ============================================================

export async function getActiveBrandMembershipFast(
  userId: string,
  workspaceId: string,
  brandId: string
):

  Promise<
    StoredBrandMembership | null
  > {

  const projectId =
    requireProjectId();


  const normalizedUserId =
    String(
      userId
      ||
      ''
    ).trim();


  const normalizedWorkspaceId =
    String(
      workspaceId
      ||
      ''
    ).trim();


  const normalizedBrandId =
    String(
      brandId
      ||
      ''
    ).trim();


  if (
    !normalizedUserId
    ||
    !normalizedWorkspaceId
    ||
    !normalizedBrandId
  ) {

    return null;

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        WITH latest_membership AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_memberships\`

          WHERE

            user_id =
              @user_id

            AND workspace_id =
              @workspace_id

            AND brand_id =
              @brand_id

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

        latest_user AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.users\`

          WHERE
            user_id =
              @user_id

          QUALIFY

            ROW_NUMBER() OVER
            (

              PARTITION BY
                user_id

              ORDER BY
                updated_at DESC,
                created_at DESC

            ) = 1

        )

        SELECT

          m.membership_id,

          m.user_id,

          m.workspace_id,

          m.brand_id,

          m.role,

          m.status,

          m.is_default,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            m.created_at
          )
            AS created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            m.updated_at
          )
            AS updated_at

        FROM
          latest_membership
          AS m

        INNER JOIN
          latest_user
          AS u

        ON
          u.user_id =
            m.user_id

        WHERE

          m.status =
            'active'

          AND u.status =
            'active'

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        user_id:
          normalizedUserId,

        workspace_id:
          normalizedWorkspaceId,

        brand_id:
          normalizedBrandId,

      },

      types: {

        user_id:
          'STRING',

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    StoredBrandMembership
    | null;

}


// ============================================================
// LIST ACTIVE BRAND MEMBERSHIPS
// ============================================================

export async function listActiveBrandMemberships(
  userId: string
):

  Promise<
    StoredBrandMembership[]
  > {

  await ensureGrowthOSAuthStore();


  const projectId =
    requireProjectId();


  const normalizedUserId =
    String(
      userId
      ||
      ''
    ).trim();


  if (!normalizedUserId) {

    throw new Error(
      'userId is required'
    );

  }


  const query = `

    SELECT

      membership_id,

      user_id,

      workspace_id,

      brand_id,

      role,

      status,

      is_default,

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
      \`${projectId}.${DATASET_ID}.brand_memberships\`

    WHERE

      user_id =
        @user_id

      AND status =
        'active'

    ORDER BY

      is_default DESC,

      created_at ASC

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

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


  return (
    rows
    ||
    []
  ) as StoredBrandMembership[];

}


// ============================================================
// DEFAULT BRAND MEMBERSHIP
//
// If explicitly configured:
// use is_default.
//
// Otherwise:
// use first active membership.
//
// This lets single-brand users enter immediately.
// ============================================================

export async function getDefaultBrandMembership(
  userId: string
):

  Promise<
    StoredBrandMembership | null
  > {

  const memberships =
    await listActiveBrandMemberships(
      userId
    );


  if (
    memberships.length ===
    0
  ) {

    return null;

  }


  return (
    memberships.find(
      membership =>
        membership.is_default
    )
    ||
    memberships[0]
  );

}


// ============================================================
// TOUCH LAST LOGIN
// ============================================================

export async function touchGrowthOSUserLogin(
  userId: string
) {

  await ensureGrowthOSAuthStore();


  const projectId =
    requireProjectId();


  const normalizedUserId =
    String(
      userId
      ||
      ''
    ).trim();


  if (!normalizedUserId) {

    return;

  }


  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.users\`

      SET

        last_login_at =
          CURRENT_TIMESTAMP(),

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE

        user_id =
          @user_id

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

}

// ============================================================
// RUNTIME WORKSPACE USERS
//
// FAST CLIENT RUNTIME READ.
//
// IMPORTANT:
//
// This function intentionally DOES NOT call:
//
// ensureGrowthOSAuthStore()
//
// Normal client requests must NEVER perform:
//
// - CREATE TABLE
// - schema checks
// - bootstrap
//
// Returns the latest logical membership for every user in the
// requested workspace + brand, joined to the latest user row.
// ============================================================

export type GrowthOSWorkspaceUser = {

  membership_id:
    string;

  user_id:
    string;

  email:
    string | null;

  full_name:
    string | null;

  user_status:
    GrowthOSUserStatus | null;

  role:
    GrowthOSBrandRole;

  membership_status:
    GrowthOSMembershipStatus;

  is_default:
    boolean;

  membership_created_at:
    string | null;

  membership_updated_at:
    string | null;

  last_login_at:
    string | null;

};


export async function listGrowthOSWorkspaceUsersFast(

  workspaceId:
    string,

  brandId:
    string

):

  Promise<
    GrowthOSWorkspaceUser[]
  > {

  const projectId =
    requireProjectId();


  const normalizedWorkspaceId =
    String(
      workspaceId
      ||
      ''
    ).trim();


  const normalizedBrandId =
    String(
      brandId
      ||
      ''
    ).trim();


  if (
    !normalizedWorkspaceId
    ||
    !normalizedBrandId
  ) {

    throw new Error(
      'workspaceId and brandId are required'
    );

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        WITH latest_memberships AS
        (

          SELECT
            *

          FROM
            \`${projectId}.${DATASET_ID}.brand_memberships\`

          WHERE

            workspace_id =
              @workspace_id

            AND brand_id =
              @brand_id

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


        latest_users AS
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

        )


        SELECT

          m.membership_id,

          m.user_id,

          u.email,

          u.full_name,

          u.status
            AS user_status,

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
            AS membership_updated_at,


          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            u.last_login_at
          )
            AS last_login_at


        FROM
          latest_memberships
          AS m


        LEFT JOIN
          latest_users
          AS u

        ON
          u.user_id =
            m.user_id


        ORDER BY

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
            u.full_name,
            u.email,
            m.user_id
          )

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          normalizedWorkspaceId,

        brand_id:
          normalizedBrandId,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

      },

    });


  return (
    rows
    ||
    []
  ) as GrowthOSWorkspaceUser[];

}