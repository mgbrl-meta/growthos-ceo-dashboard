import 'server-only';

import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  SESSION_TTL_SECONDS,
} from './config';

import {
  ensureGrowthOSAuthStore,
} from './user-store';


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


const PASSWORD_RESET_TTL_SECONDS =
  30 * 60;


const INVITE_TTL_SECONDS =
  72 * 60 * 60;


const TOKEN_REISSUE_COOLDOWN_SECONDS =
  60;


function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS security store requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// TYPES
// ============================================================

export type GrowthOSSecuritySession = {

  session_id:
    string;

  user_id:
    string;

  workspace_id:
    string;

  brand_id:
    string;

  auth_method:
    string;

  status:
    string;

  created_at:
    string | null;

  last_seen_at:
    string | null;

  expires_at:
    string | null;

  revoked_at:
    string | null;

  ip_address:
    string | null;

  user_agent:
    string | null;

};


export type GrowthOSAuthTokenPurpose =
  | 'password_reset'
  | 'invite';


export type GrowthOSResolvedAuthToken = {

  token_id:
    string;

  user_id:
    string;

  email:
    string;

  purpose:
    GrowthOSAuthTokenPurpose;

  expires_at:
    string | null;

};


// ============================================================
// SCHEMA BOOTSTRAP
// ============================================================

let securityStoreReady =
  false;


let securityStorePromise:
  Promise<void> | null =
    null;


export async function ensureGrowthOSSecurityStore() {

  if (securityStoreReady) {

    return;

  }


  if (securityStorePromise) {

    return securityStorePromise;

  }


  securityStorePromise =
    (async () => {

      await ensureGrowthOSAuthStore();


      const projectId =
        requireProjectId();


      await bigquery.query({

        query: `

          CREATE TABLE IF NOT EXISTS
            \`${projectId}.${DATASET_ID}.auth_sessions\`
          (

            session_id STRING NOT NULL,
            user_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            auth_method STRING NOT NULL,
            status STRING NOT NULL,
            created_at TIMESTAMP,
            last_seen_at TIMESTAMP,
            expires_at TIMESTAMP,
            revoked_at TIMESTAMP,
            ip_address STRING,
            user_agent STRING

          )

          CLUSTER BY
            user_id,
            status,
            workspace_id,
            brand_id

        `,

        location:
          LOCATION,

      });


      await bigquery.query({

        query: `

          CREATE TABLE IF NOT EXISTS
            \`${projectId}.${DATASET_ID}.auth_tokens\`
          (

            token_id STRING NOT NULL,
            user_id STRING NOT NULL,
            email STRING NOT NULL,
            purpose STRING NOT NULL,
            token_hash STRING NOT NULL,
            status STRING NOT NULL,
            created_at TIMESTAMP,
            expires_at TIMESTAMP,
            consumed_at TIMESTAMP,
            created_by_user_id STRING

          )

          CLUSTER BY
            user_id,
            purpose,
            status

        `,

        location:
          LOCATION,

      });


      securityStoreReady =
        true;

    })();


  try {

    await securityStorePromise;

  } catch (
    error
  ) {

    securityStorePromise =
      null;


    securityStoreReady =
      false;


    throw error;

  }


  securityStorePromise =
    null;

}


// ============================================================
// HELPERS
// ============================================================

function hashToken(
  token:
    string
) {

  return crypto
    .createHash(
      'sha256'
    )
    .update(
      token
    )
    .digest(
      'hex'
    );

}


function expiryFromNow(
  seconds:
    number
) {

  return new Date(
    Date.now()
    +
    seconds * 1000
  );

}


function normalizeMeta(
  value:
    string | null | undefined,
  maxLength:
    number
) {

  const normalized =
    String(
      value
      ||
      ''
    ).trim();


  if (!normalized) {

    return null;

  }


  return normalized.slice(
    0,
    maxLength
  );

}


// ============================================================
// SESSION CREATION
// ============================================================

export async function createGrowthOSSecuritySession(
  input: {

    userId:
      string;

    workspaceId:
      string;

    brandId:
      string;

    authMethod:
      'password';

    ipAddress?:
      string | null;

    userAgent?:
      string | null;

  }
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  const sessionId =
    `ses_${crypto.randomUUID()}`;


  const expiresAt =
    expiryFromNow(
      SESSION_TTL_SECONDS
    );


  await bigquery.query({

    query: `

      INSERT INTO
        \`${projectId}.${DATASET_ID}.auth_sessions\`
      (
        session_id,
        user_id,
        workspace_id,
        brand_id,
        auth_method,
        status,
        created_at,
        last_seen_at,
        expires_at,
        revoked_at,
        ip_address,
        user_agent
      )

      VALUES
      (
        @session_id,
        @user_id,
        @workspace_id,
        @brand_id,
        @auth_method,
        'active',
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        @expires_at,
        NULL,
        @ip_address,
        @user_agent
      )

    `,

    location:
      LOCATION,

    params: {

      session_id:
        sessionId,

      user_id:
        input.userId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      auth_method:
        input.authMethod,

      expires_at:
        expiresAt,

      ip_address:
        normalizeMeta(
          input.ipAddress,
          160
        ),

      user_agent:
        normalizeMeta(
          input.userAgent,
          1024
        ),

    },

  });


  return {

    sessionId,

    expiresAt:
      expiresAt.toISOString(),

  };

}


// ============================================================
// FAST LIVE SESSION CHECK
//
// NO schema/bootstrap work here.
// ============================================================

export async function getGrowthOSSecuritySessionFast(
  sessionId:
    string,
  userId:
    string
):

  Promise<
    GrowthOSSecuritySession | null
  > {

  const projectId =
    requireProjectId();


  const normalizedSessionId =
    String(
      sessionId
      ||
      ''
    ).trim();


  const normalizedUserId =
    String(
      userId
      ||
      ''
    ).trim();


  if (
    !normalizedSessionId
    ||
    !normalizedUserId
  ) {

    return null;

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          session_id,
          user_id,
          workspace_id,
          brand_id,
          auth_method,
          status,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            created_at
          ) AS created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            last_seen_at
          ) AS last_seen_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            expires_at
          ) AS expires_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            revoked_at
          ) AS revoked_at,

          ip_address,
          user_agent

        FROM
          \`${projectId}.${DATASET_ID}.auth_sessions\`

        WHERE

          session_id =
            @session_id

          AND user_id =
            @user_id

          AND status =
            'active'

          AND expires_at >
            CURRENT_TIMESTAMP()

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        session_id:
          normalizedSessionId,

        user_id:
          normalizedUserId,

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    GrowthOSSecuritySession
    |
    null;

}


// ============================================================
// LIST ACTIVE SESSIONS
// ============================================================

export async function listGrowthOSSecuritySessions(
  userId:
    string
):

  Promise<
    GrowthOSSecuritySession[]
  > {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          session_id,
          user_id,
          workspace_id,
          brand_id,
          auth_method,
          status,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            created_at
          ) AS created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            last_seen_at
          ) AS last_seen_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            expires_at
          ) AS expires_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            revoked_at
          ) AS revoked_at,

          ip_address,
          user_agent

        FROM
          \`${projectId}.${DATASET_ID}.auth_sessions\`

        WHERE

          user_id =
            @user_id

          AND status =
            'active'

          AND expires_at >
            CURRENT_TIMESTAMP()

        ORDER BY
          created_at DESC

      `,

      location:
        LOCATION,

      params: {

        user_id:
          userId,

      },

    });


  return (
    rows
    ||
    []
  ) as GrowthOSSecuritySession[];

}


// ============================================================
// SESSION CONTEXT UPDATE
//
// Used when a password user switches brand.
// ============================================================

export async function updateGrowthOSSecuritySessionContext(
  input: {

    sessionId:
      string;

    userId:
      string;

    workspaceId:
      string;

    brandId:
      string;

  }
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.auth_sessions\`

      SET
        workspace_id =
          @workspace_id,

        brand_id =
          @brand_id,

        last_seen_at =
          CURRENT_TIMESTAMP()

      WHERE
        session_id =
          @session_id

        AND user_id =
          @user_id

        AND status =
          'active'

    `,

    location:
      LOCATION,

    params: {

      session_id:
        input.sessionId,

      user_id:
        input.userId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

    },

  });

}


// ============================================================
// REVOKE ONE SESSION
// ============================================================

export async function revokeGrowthOSSecuritySession(
  userId:
    string,
  sessionId:
    string
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.auth_sessions\`

      SET
        status =
          'revoked',

        revoked_at =
          CURRENT_TIMESTAMP(),

        last_seen_at =
          CURRENT_TIMESTAMP()

      WHERE
        user_id =
          @user_id

        AND session_id =
          @session_id

        AND status =
          'active'

    `,

    location:
      LOCATION,

    params: {

      user_id:
        userId,

      session_id:
        sessionId,

    },

  });

}


// ============================================================
// REVOKE ALL / ALL OTHER SESSIONS
// ============================================================

export async function revokeGrowthOSSecuritySessions(
  input: {

    userId:
      string;

    exceptSessionId?:
      string | null;

  }
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  const exceptSessionId =
    String(
      input.exceptSessionId
      ||
      ''
    ).trim();


  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.auth_sessions\`

      SET
        status =
          'revoked',

        revoked_at =
          CURRENT_TIMESTAMP(),

        last_seen_at =
          CURRENT_TIMESTAMP()

      WHERE
        user_id =
          @user_id

        AND status =
          'active'

        AND
        (
          @except_session_id =
            ''
          OR
          session_id !=
            @except_session_id
        )

    `,

    location:
      LOCATION,

    params: {

      user_id:
        input.userId,

      except_session_id:
        exceptSessionId,

    },

  });

}


// ============================================================
// PASSWORD UPDATE
// ============================================================

export async function updateGrowthOSPasswordHash(
  userId:
    string,
  passwordHash:
    string
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.users\`

      SET
        password_hash =
          @password_hash,

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
        userId,

      password_hash:
        passwordHash,

    },

  });

}


// ============================================================
// TOKEN CREATION
//
// Returns null during the resend cooldown.
// ============================================================

export async function createGrowthOSAuthToken(
  input: {

    userId:
      string;

    email:
      string;

    purpose:
      GrowthOSAuthTokenPurpose;

    createdByUserId?:
      string | null;

  }
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  const [
    recentRows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          token_id

        FROM
          \`${projectId}.${DATASET_ID}.auth_tokens\`

        WHERE
          user_id =
            @user_id

          AND purpose =
            @purpose

          AND status =
            'active'

          AND expires_at >
            CURRENT_TIMESTAMP()

          AND created_at >
            TIMESTAMP_SUB(
              CURRENT_TIMESTAMP(),
              INTERVAL ${TOKEN_REISSUE_COOLDOWN_SECONDS} SECOND
            )

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        user_id:
          input.userId,

        purpose:
          input.purpose,

      },

    });


  if (
    recentRows?.length
  ) {

    return null;

  }


  // Invalidate older active tokens for this purpose.

  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.auth_tokens\`

      SET
        status =
          'revoked'

      WHERE
        user_id =
          @user_id

        AND purpose =
          @purpose

        AND status =
          'active'

    `,

    location:
      LOCATION,

    params: {

      user_id:
        input.userId,

      purpose:
        input.purpose,

    },

  });


  const rawToken =
    crypto
      .randomBytes(
        32
      )
      .toString(
        'base64url'
      );


  const tokenId =
    `tok_${crypto.randomUUID()}`;


  const ttlSeconds =
    input.purpose ===
      'invite'

      ? INVITE_TTL_SECONDS

      : PASSWORD_RESET_TTL_SECONDS;


  const expiresAt =
    expiryFromNow(
      ttlSeconds
    );


  await bigquery.query({

    query: `

      INSERT INTO
        \`${projectId}.${DATASET_ID}.auth_tokens\`
      (
        token_id,
        user_id,
        email,
        purpose,
        token_hash,
        status,
        created_at,
        expires_at,
        consumed_at,
        created_by_user_id
      )

      VALUES
      (
        @token_id,
        @user_id,
        @email,
        @purpose,
        @token_hash,
        'active',
        CURRENT_TIMESTAMP(),
        @expires_at,
        NULL,
        @created_by_user_id
      )

    `,

    location:
      LOCATION,

    params: {

      token_id:
        tokenId,

      user_id:
        input.userId,

      email:
        input.email,

      purpose:
        input.purpose,

      token_hash:
        hashToken(
          rawToken
        ),

      expires_at:
        expiresAt,

      created_by_user_id:
        input.createdByUserId
        ||
        null,

    },

  });


  return {

    tokenId,

    rawToken,

    expiresAt:
      expiresAt.toISOString(),

  };

}


// ============================================================
// RESOLVE VALID TOKEN
// ============================================================

export async function resolveGrowthOSAuthToken(
  rawToken:
    string,
  purpose:
    GrowthOSAuthTokenPurpose
):

  Promise<
    GrowthOSResolvedAuthToken | null
  > {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  const normalizedToken =
    String(
      rawToken
      ||
      ''
    ).trim();


  if (!normalizedToken) {

    return null;

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          token_id,
          user_id,
          email,
          purpose,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            expires_at
          ) AS expires_at

        FROM
          \`${projectId}.${DATASET_ID}.auth_tokens\`

        WHERE
          token_hash =
            @token_hash

          AND purpose =
            @purpose

          AND status =
            'active'

          AND expires_at >
            CURRENT_TIMESTAMP()

        LIMIT 1

      `,

      location:
        LOCATION,

      params: {

        token_hash:
          hashToken(
            normalizedToken
          ),

        purpose,

      },

    });


  return (
    rows?.[0]
    ??
    null
  ) as
    GrowthOSResolvedAuthToken
    |
    null;

}


// ============================================================
// CONSUME TOKEN
// ============================================================

export async function consumeGrowthOSAuthToken(
  tokenId:
    string
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.auth_tokens\`

      SET
        status =
          'consumed',

        consumed_at =
          CURRENT_TIMESTAMP()

      WHERE
        token_id =
          @token_id

        AND status =
          'active'

    `,

    location:
      LOCATION,

    params: {

      token_id:
        tokenId,

    },

  });

}


// ============================================================
// REVOKE ACTIVE AUTH TOKENS FOR USER
//
// Used after any successful password change so previously
// issued reset/invite links cannot later overwrite the new
// credential.
// ============================================================

export async function revokeGrowthOSAuthTokens(
  userId:
    string
) {

  await ensureGrowthOSSecurityStore();


  const projectId =
    requireProjectId();


  await bigquery.query({

    query: `

      UPDATE
        \`${projectId}.${DATASET_ID}.auth_tokens\`

      SET
        status =
          'revoked'

      WHERE
        user_id =
          @user_id

        AND status =
          'active'

    `,

    location:
      LOCATION,

    params: {

      user_id:
        userId,

    },

  });

}
