import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminDataHealthSnapshot,
} from '@/lib/admin/data-health';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN DATA HEALTH
//
// GLOBAL CROSS-CLIENT READ.
//
// PLATFORM ADMIN ONLY.
// READ ONLY.
//
// Source of truth:
//
// growthos_control.integration_connections
// growthos_control.integration_accounts
// growthos_control.integration_sync_state
//
// IMPORTANT:
//
// This route:
//
// - does not bootstrap infrastructure
// - does not mutate sync state
// - does not run retries
// - does not change connections
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
    // 2. LOAD GLOBAL DATA HEALTH
    // ========================================================

    const snapshot =
      await getAdminDataHealthSnapshot();


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

      rows:
        snapshot.rows,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          'growthos_control.integration_sync_state',

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
        'Unable to load Admin Data Health'
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
      'ADMIN_DATA_HEALTH_ERROR',
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
          'Unable to load Data Health',

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