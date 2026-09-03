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
// PUBLIC SESSION
// ============================================================

export type GrowthOsSession = {

  userId: string;

  email?: string;

  tenantId: string;

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
// CREATE JWT
// ============================================================

export async function createGrowthOsSession(
  session: GrowthOsSession
) {

  const now =
    Math.floor(
      Date.now() / 1000
    );


  return new SignJWT(
    {

      email:
        session.email || '',

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


  const userId =
    String(
      payload.sub || ''
    );


  const tenantId =
    String(
      payload.tenantId || ''
    );


  const authSource =
    String(
      payload.authSource || ''
    );


  if (
    !userId ||
    !tenantId ||
    authSource !==
      'public'
  ) {

    throw new Error(
      'Invalid Growth OS session'
    );

  }


  return {

    userId,

    email:
      payload.email
        ? String(
            payload.email
          )
        : undefined,

    tenantId,

    authSource:
      'public',

  };

}


// ============================================================
// WRITE COOKIE
// ============================================================

export async function setGrowthOsSessionCookie(
  session: GrowthOsSession
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