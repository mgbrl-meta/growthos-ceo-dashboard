import 'server-only';

import {
  SignJWT,
  jwtVerify,
} from 'jose';

import {
  cookies,
} from 'next/headers';

import {
  SESSION_AUDIENCE,
  SESSION_COOKIE_NAME,
  SESSION_ISSUER,
  SESSION_TTL_SECONDS,
  getSessionSecret,
} from './config';


// ============================================================
// SESSION ROLE
//
// Mirrors Growth OS brand membership roles.
//
// Eventually authorization checks throughout Growth OS will
// use this field.
// ============================================================

export type GrowthOsSessionRole =
  | 'owner'
  | 'admin'
  | 'analyst'
  | 'viewer';


// ============================================================
// AUTH METHOD
//
// password:
// user entered Growth OS through direct/public login.
//
// shopify:
// session was created from a verified Shopify launch.
//
// authSource remains "public" because once established,
// both methods use the same signed Growth OS cookie.
// ============================================================

export type GrowthOsSessionAuthMethod =
  | 'password'
  | 'shopify';


// ============================================================
// CANONICAL GROWTH OS SESSION
//
// V2 SESSION MODEL
//
// user
//      ↓
// workspace
//      ↓
// brand
//      ↓
// role
//
// tenantId remains temporarily as a compatibility alias.
//
// It will eventually be removed after all old callers have
// migrated to workspaceId + brandId.
// ============================================================

export type GrowthOsSession = {

  sessionVersion:
    1 | 2 | 3;

  userId:
    string;

  sessionId?:
    string;

  email?:
    string;

  workspaceId:
    string;

  brandId:
    string;

  role:
    GrowthOsSessionRole;

  authMethod:
    GrowthOsSessionAuthMethod;

  // ----------------------------------------------------------
  // TEMPORARY BACKWARD COMPATIBILITY
  //
  // Old Growth OS code expects tenantId.
  //
  // For the current architecture we map it to brandId.
  // ----------------------------------------------------------

  tenantId:
    string;

  authSource:
    'public';

};


// ============================================================
// SESSION INPUT
//
// New callers should provide:
//
// workspaceId
// brandId
// role
// authMethod
//
// Old callers can temporarily continue providing:
//
// tenantId
//
// This allows AUTH 3 to land without breaking the existing
// ENV-backed login route before AUTH 4 replaces it.
// ============================================================

export type GrowthOsSessionInput = {

  userId:
    string;

  sessionId?:
    string;

  email?:
    string;

  workspaceId?:
    string;

  brandId?:
    string;

  role?:
    GrowthOsSessionRole;

  authMethod?:
    GrowthOsSessionAuthMethod;

  tenantId?:
    string;

  authSource:
    'public';

};


// ============================================================
// KEY
// ============================================================

function signingKey() {

  return new TextEncoder()
    .encode(
      getSessionSecret()
    );

}


// ============================================================
// ROLE VALIDATION
// ============================================================

function isValidRole(
  value: string
):
  value is GrowthOsSessionRole {

  return (
    value ===
      'owner'
    ||
    value ===
      'admin'
    ||
    value ===
      'analyst'
    ||
    value ===
      'viewer'
  );

}


// ============================================================
// AUTH METHOD VALIDATION
// ============================================================

function isValidAuthMethod(
  value: string
):
  value is GrowthOsSessionAuthMethod {

  return (
    value ===
      'password'
    ||
    value ===
      'shopify'
  );

}


// ============================================================
// NORMALIZE SESSION INPUT
//
// Supports both:
//
// LEGACY
//
// {
//   userId,
//   email,
//   tenantId,
//   authSource: 'public'
// }
//
// NEW
//
// {
//   userId,
//   email,
//   workspaceId,
//   brandId,
//   role,
//   authMethod,
//   authSource: 'public'
// }
//
// Legacy support is temporary and exists only until AUTH 4.
// ============================================================

function normalizeSessionInput(
  input: GrowthOsSessionInput
):

  Omit<
    GrowthOsSession,
    'sessionVersion'
  > {

  const userId =
    String(
      input.userId
      ||
      ''
    ).trim();


  if (!userId) {

    throw new Error(
      'Growth OS session requires userId'
    );

  }


  const sessionId =
    String(
      input.sessionId
      ||
      ''
    ).trim();


  // ==========================================================
  // WORKSPACE
  //
  // Legacy:
  // tenantId → workspaceId
  // ==========================================================

  const workspaceId =
    String(
      input.workspaceId
      ||
      input.tenantId
      ||
      ''
    ).trim();


  // ==========================================================
  // BRAND
  //
  // Legacy:
  // tenantId → brandId
  //
  // This matches the current Brillare development architecture
  // where workspace and brand currently share the same ID.
  //
  // AUTH 4 will always pass the real membership values.
  // ==========================================================

  const brandId =
    String(
      input.brandId
      ||
      input.tenantId
      ||
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'Growth OS session requires workspaceId and brandId'
    );

  }


  const role =
    input.role
    ||
    'owner';


  if (
    !isValidRole(
      role
    )
  ) {

    throw new Error(
      'Invalid Growth OS session role'
    );

  }


  const authMethod =
    input.authMethod
    ||
    'password';


  if (
    !isValidAuthMethod(
      authMethod
    )
  ) {

    throw new Error(
      'Invalid Growth OS session auth method'
    );

  }


  const email =
    String(
      input.email
      ||
      ''
    )
      .trim()
      .toLowerCase();


  return {

    userId,

    sessionId:
      sessionId
        ? sessionId
        : undefined,

    email:
      email
        ? email
        : undefined,

    workspaceId,

    brandId,

    role,

    authMethod,

    // --------------------------------------------------------
    // Compatibility alias.
    // --------------------------------------------------------

    tenantId:
      brandId,

    authSource:
      'public',

  };

}


// ============================================================
// CREATE JWT
//
// All newly created cookies are V2 sessions.
//
// JWT payload:
//
// sub             = user ID
//
// workspaceId     = active Growth OS workspace
// brandId         = active Growth OS brand
// role            = membership role
// authMethod      = password | shopify
//
// tenantId remains temporarily for compatibility.
// ============================================================

export async function createGrowthOsSession(
  input: GrowthOsSessionInput
) {

  const session =
    normalizeSessionInput(
      input
    );


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  return new SignJWT(
    {

      sessionVersion:
        3,

      sid:
        session.sessionId
        ||
        '',

      email:
        session.email
        ||
        '',

      workspaceId:
        session.workspaceId,

      brandId:
        session.brandId,

      role:
        session.role,

      authMethod:
        session.authMethod,

      // ------------------------------------------------------
      // TEMPORARY LEGACY CLAIM
      // ------------------------------------------------------

      tenantId:
        session.tenantId,

      authSource:
        'public',

    }
  )

    .setProtectedHeader(
      {

        alg:
          'HS256',

        typ:
          'JWT',

      }
    )

    .setSubject(
      session.userId
    )

    .setIssuer(
      SESSION_ISSUER
    )

    .setAudience(
      SESSION_AUDIENCE
    )

    .setIssuedAt(
      now
    )

    .setNotBefore(
      now
    )

    .setExpirationTime(
      now +
      SESSION_TTL_SECONDS
    )

    .sign(
      signingKey()
    );

}


// ============================================================
// VERIFY JWT
//
// Supports:
//
// V2 sessions
//   workspaceId + brandId + role + authMethod
//
// V1 sessions
//   tenantId only
//
// V1 compatibility means existing browser sessions do not
// instantly break during the migration.
//
// After AUTH 4 / AUTH 5 stabilize, V1 support can be removed.
// ============================================================

export async function verifyGrowthOsSession(
  token: string
):

  Promise<
    GrowthOsSession
  > {

  const {
    payload,
  } =
    await jwtVerify(

      token,

      signingKey(),

      {

        algorithms: [
          'HS256',
        ],

        issuer:
          SESSION_ISSUER,

        audience:
          SESSION_AUDIENCE,

        clockTolerance:
          5,

      }

    );


  // ==========================================================
  // COMMON IDENTITY
  // ==========================================================

  const userId =
    String(
      payload.sub
      ||
      ''
    ).trim();


  const authSource =
    String(
      payload.authSource
      ||
      ''
    );


  if (
    !userId
    ||
    authSource !==
      'public'
  ) {

    throw new Error(
      'Invalid Growth OS session'
    );

  }


  const email =
    String(
      payload.email
      ||
      ''
    )
      .trim()
      .toLowerCase();


  // ==========================================================
  // SESSION VERSION
  // ==========================================================

  const sessionVersion =
    Number(
      payload.sessionVersion
      ||
      1
    );


  if (
    sessionVersion ===
    3
  ) {

    const workspaceId =
      String(
        payload.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        payload.brandId
        ||
        ''
      ).trim();


    const role =
      String(
        payload.role
        ||
        ''
      );


    const authMethod =
      String(
        payload.authMethod
        ||
        ''
      );


    const sessionId =
      String(
        payload.sid
        ||
        ''
      ).trim();


    if (
      !workspaceId
      ||
      !brandId
      ||
      !isValidRole(
        role
      )
      ||
      !isValidAuthMethod(
        authMethod
      )
      ||
      (
        authMethod ===
          'password'
        &&
        !sessionId
      )
    ) {

      throw new Error(
        'Invalid Growth OS V3 session'
      );

    }


    return {

      sessionVersion:
        3,

      userId,

      sessionId:
        sessionId
          ? sessionId
          : undefined,

      email:
        email
          ? email
          : undefined,

      workspaceId,

      brandId,

      role,

      authMethod,

      tenantId:
        brandId,

      authSource:
        'public',

    };

  }


  if (
    sessionVersion ===
    2
  ) {

    const workspaceId =
      String(
        payload.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        payload.brandId
        ||
        ''
      ).trim();


    const role =
      String(
        payload.role
        ||
        ''
      );


    const authMethod =
      String(
        payload.authMethod
        ||
        ''
      );


    if (
      !workspaceId
      ||
      !brandId
      ||
      !isValidRole(
        role
      )
      ||
      !isValidAuthMethod(
        authMethod
      )
    ) {

      throw new Error(
        'Invalid Growth OS V2 session'
      );

    }


    return {

      sessionVersion:
        2,

      userId,

      email:
        email
          ? email
          : undefined,

      workspaceId,

      brandId,

      role,

      authMethod,

      tenantId:
        brandId,

      authSource:
        'public',

    };

  }


  // ==========================================================
  // LEGACY V1 SESSION
  //
  // Existing session payload:
  //
  // {
  //   sub,
  //   email,
  //   tenantId,
  //   authSource: "public"
  // }
  //
  // Temporary compatibility assumption:
  //
  // workspaceId = tenantId
  // brandId     = tenantId
  // role        = owner
  // authMethod  = password
  //
  // This keeps current Brillare sessions functioning until
  // AUTH 4 switches login to brand_memberships.
  // ==========================================================

  const tenantId =
    String(
      payload.tenantId
      ||
      ''
    ).trim();


  if (!tenantId) {

    throw new Error(
      'Invalid Growth OS legacy session'
    );

  }


  return {

    sessionVersion:
      1,

    userId,

    email:
      email
        ? email
        : undefined,

    workspaceId:
      tenantId,

    brandId:
      tenantId,

    role:
      'owner',

    authMethod:
      'password',

    tenantId,

    authSource:
      'public',

  };

}


// ============================================================
// WRITE COOKIE
//
// Same cookie for:
//
// external/password login
//
// and eventually:
//
// verified Shopify launch.
//
// Only authMethod differs inside the signed session.
// ============================================================

export async function setGrowthOsSessionCookie(
  session: GrowthOsSessionInput
) {

  const token =
    await createGrowthOsSession(
      session
    );


  const store =
    await cookies();


  store.set(

    SESSION_COOKIE_NAME,

    token,

    {

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        'production',

      sameSite:
        'lax',

      path:
        '/',

      maxAge:
        SESSION_TTL_SECONDS,

    }

  );

}


// ============================================================
// READ COOKIE
// ============================================================

export async function readGrowthOsSessionCookie():

  Promise<
    GrowthOsSession | null
  > {

  try {

    const store =
      await cookies();


    const token =
      store.get(
        SESSION_COOKIE_NAME
      )?.value;


    if (!token) {

      return null;

    }


    return await verifyGrowthOsSession(
      token
    );

  } catch {

    return null;

  }

}


// ============================================================
// CLEAR COOKIE
// ============================================================

export async function clearGrowthOsSessionCookie() {

  const store =
    await cookies();


  store.set(

    SESSION_COOKIE_NAME,

    '',

    {

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        'production',

      sameSite:
        'lax',

      path:
        '/',

      maxAge:
        0,

    }

  );

}