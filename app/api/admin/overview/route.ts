import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminOverviewSnapshot,
} from '@/lib/admin/overview';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN OVERVIEW
//
// GLOBAL CROSS-CLIENT AGGREGATION.
//
// PLATFORM ADMIN ONLY.
//
// This route does NOT establish a new source of truth.
// It aggregates canonical Admin readers.
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
    // Authentication alone is insufficient.
    //
    // User must exist as ACTIVE in:
    //
    // growthos_control.platform_admins
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. LOAD OVERVIEW
    // ========================================================

    const overview =
      await getAdminOverviewSnapshot();


    // ========================================================
    // 3. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      scope:
        'global',

      overview,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          [
            'admin.clients',
            'admin.plans',
            'admin.modules',
            'admin.users',
            'admin.integrations',
            'admin.data-health',
            'admin.sync-history',
            'admin.system',
          ].join(
            ' + '
          ),

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
        'Unable to load Admin Overview'
      );


    // ========================================================
    // UNAUTHENTICATED
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
    // AUTHENTICATED BUT NOT PLATFORM ADMIN
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
    // INTERNAL FAILURE
    // ========================================================

    console.error(
      'ADMIN_OVERVIEW_ERROR',
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
          'Unable to load Admin Overview',

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