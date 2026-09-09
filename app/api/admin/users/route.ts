import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminUsersSnapshot,
} from '@/lib/admin/users';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN USERS
//
// GLOBAL READ-ONLY VIEW.
//
// PLATFORM ADMIN ONLY.
//
// Source:
//
// growthos_control.users
// growthos_control.brand_memberships
//
// IMPORTANT:
//
// NEVER returns:
//
// - password_hash
// - session credentials
// - JWT
// - provider tokens
//
// User/member mutations remain separate from this endpoint.
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // 1. PLATFORM ADMIN AUTHORIZATION
    //
    // requirePlatformAdmin already rejects:
    //
    // - unauthenticated requests
    // - Shopify embedded identities
    // - authenticated client-only users
    // - inactive / missing platform admins
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. GLOBAL USER READ
    // ========================================================

    const snapshot =
      await getAdminUsersSnapshot();


    // ========================================================
    // 3. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      scope:
        'global',

      summary:
        snapshot.summary,

      users:
        snapshot.users,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          'growthos_control.users + brand_memberships',

        readOnly:
          true,

        authorization:
          'platform_admin',

        platformRole:
          admin.platformRole,

      },

    });

  } catch (
    error:
      any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load Admin Users'
      );


    // ========================================================
    // 4. UNAUTHENTICATED
    // ========================================================

    if (
      message ===
      'UNAUTHENTICATED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'UNAUTHENTICATED',

        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // 5. AUTHENTICATED BUT NOT PLATFORM ADMIN
    // ========================================================

    if (
      message ===
      'ADMIN_ACCESS_REQUIRED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'ADMIN_ACCESS_REQUIRED',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 6. INTERNAL FAILURE
    // ========================================================

    console.error(
      'ADMIN_USERS_ERROR',
      {

        message,

        durationMs:
          Date.now()
          -
          startedAt,

      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to load Admin Users',

        meta: {

          durationMs:
            Date.now()
            -
            startedAt,

        },

      },
      {
        status:
          500,
      }
    );

  }

}