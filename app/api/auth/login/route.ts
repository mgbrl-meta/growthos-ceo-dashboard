import {
  NextRequest,
  NextResponse,
} from 'next/server';

import bcrypt from 'bcryptjs';

import {
  getDefaultBrandMembership,
  getGrowthOSUserByEmail,
  listActiveBrandMemberships,
  touchGrowthOSUserLogin,
} from '@/lib/auth/user-store';

import {
  setGrowthOsSessionCookie,
} from '@/lib/auth/session';

import {
  createGrowthOSSecuritySession,
  revokeGrowthOSSecuritySession,
} from '@/lib/auth/security-store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// DUMMY BCRYPT HASH
//
// Used when the email does not exist.
//
// We still execute bcrypt.compare() so invalid-email and
// invalid-password requests follow approximately the same
// expensive password verification path.
//
// This hash is not used for authentication.
// ============================================================

const DUMMY_BCRYPT_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5HFc5VcYm3ENQRZuaDNIai1kyRCnpwC';


// ============================================================
// DATABASE-BACKED GROWTH OS LOGIN
//
// External Growth OS:
//
// email + password
//       ↓
// growthos_control.users
//       ↓
// bcrypt verification
//       ↓
// brand_memberships
//       ↓
// default / active brand
//       ↓
// Growth OS V2 session
//
// Shopify users do NOT use this route.
// Shopify automatic authentication is AUTH 5.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. READ REQUEST
    // ========================================================

    let body:
      any;


    try {

      body =
        await request.json();

    } catch {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Invalid request body',

        },
        {
          status:
            400,
        }
      );

    }


    const email =
      String(
        body?.email
        ||
        ''
      )
        .trim()
        .toLowerCase();


    const password =
      String(
        body?.password
        ||
        ''
      );


    if (
      !email
      ||
      !password
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Email and password are required',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 2. LOAD DATABASE USER
    // ========================================================

    const user =
      await getGrowthOSUserByEmail(
        email
      );


    // ========================================================
    // 3. PASSWORD VERIFICATION
    //
    // Always execute bcrypt.compare().
    //
    // If user doesn't exist or has no password:
    // compare against dummy bcrypt hash instead.
    // ========================================================

    const passwordHash =
      user?.password_hash
      ||
      DUMMY_BCRYPT_HASH;


    const passwordValid =
      await bcrypt.compare(
        password,
        passwordHash
      );


    // ========================================================
    // 4. AUTHENTICATION VALIDATION
    // ========================================================

    if (
      !user
      ||
      user.status !==
        'active'
      ||
      !user.password_hash
      ||
      !passwordValid
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Invalid email or password',

        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // 5. LOAD ACTIVE BRAND ACCESS
    //
    // A Growth OS user can belong to:
    //
    // one brand
    //
    // or
    //
    // many brands across one/multiple workspaces.
    // ========================================================

    const memberships =
      await listActiveBrandMemberships(
        user.user_id
      );


    if (
      memberships.length ===
      0
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'No active Growth OS brand access is assigned to this user',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 6. SELECT DEFAULT BRAND
    //
    // Current behavior:
    //
    // explicitly default membership
    //        ↓
    // otherwise first active membership
    //
    // AUTH 6 will provide the brand selector / switching UI.
    // ========================================================

    const membership =
      await getDefaultBrandMembership(
        user.user_id
      );


    if (!membership) {

      throw new Error(
        'DEFAULT_BRAND_MEMBERSHIP_NOT_FOUND'
      );

    }


    // ========================================================
    // 7. CREATE BRAND-AWARE V2 SESSION
    //
    // This is the critical change.
    //
    // No tenant is taken from ENV.
    //
    // Session context comes entirely from:
    //
    // users
    // +
    // brand_memberships
    // ========================================================

    const forwardedFor =
      request.headers.get(
        'x-forwarded-for'
      );


    const ipAddress =
      forwardedFor
        ?.split(',')[0]
        ?.trim()
      ||
      request.headers.get(
        'x-real-ip'
      )
      ||
      null;


    const userAgent =
      request.headers.get(
        'user-agent'
      );


    const securitySession =
      await createGrowthOSSecuritySession({

        userId:
          user.user_id,

        workspaceId:
          membership.workspace_id,

        brandId:
          membership.brand_id,

        authMethod:
          'password',

        ipAddress,

        userAgent,

      });


    try {

      await setGrowthOsSessionCookie({

        userId:
          user.user_id,

        sessionId:
          securitySession.sessionId,

        email:
          user.email,

        workspaceId:
          membership.workspace_id,

        brandId:
          membership.brand_id,

        role:
          membership.role,

        authMethod:
          'password',

        authSource:
          'public',

      });

    } catch (
      error
    ) {

      await revokeGrowthOSSecuritySession(
        user.user_id,
        securitySession.sessionId
      );


      throw error;

    }


    // ========================================================
    // 8. UPDATE LAST LOGIN
    //
    // Non-critical.
    //
    // Login should not fail merely because last-login metadata
    // couldn't be updated.
    // ========================================================

    try {

      await touchGrowthOSUserLogin(
        user.user_id
      );

    } catch (
      error
    ) {

      console.error(
        'GROWTHOS_LAST_LOGIN_UPDATE_FAILED',
        {
          userId:
            user.user_id,
        }
      );

    }


    // ========================================================
    // 9. SAFE RESPONSE
    //
    // NEVER return:
    //
    // password
    // password hash
    // JWT
    // session secret
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      user: {

        userId:
          user.user_id,

        email:
          user.email,

        fullName:
          user.full_name
          ??
          null,

      },

      activeContext: {

        workspaceId:
          membership.workspace_id,

        brandId:
          membership.brand_id,

        role:
          membership.role,

      },

      access: {

        brandCount:
          memberships.length,

        hasMultipleBrands:
          memberships.length >
          1,

      },

      auth: {

        method:
          'password',

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Growth OS login failed'
      );


    console.error(
      'GROWTHOS_LOGIN_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Login failed',

      },
      {
        status:
          500,
      }
    );

  }

}