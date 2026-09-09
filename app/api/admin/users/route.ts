import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

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
// Source:
//
// growthos_control.users
// growthos_control.brand_memberships
//
// Important:
//
// NEVER returns:
//
// password_hash
// session credentials
// JWT
// provider tokens
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
    // 1. AUTHENTICATE
    // ========================================================

    const identity =
      await authenticateRequest(
        request
      );


    if (!identity) {

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
    // 2. SHOPIFY EMBEDDED SESSION CANNOT READ GLOBAL USERS
    // ========================================================

    if (
      identity.authMethod ===
        'shopify'
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
    // 3. GLOBAL FAST READ
    // ========================================================

    const snapshot =
      await getAdminUsersSnapshot();


    // ========================================================
    // 4. RESPONSE
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