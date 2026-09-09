import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminModulesSnapshot,
} from '@/lib/admin/modules';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN MODULE REGISTRY
//
// GLOBAL READ ONLY.
//
// PLATFORM ADMIN ONLY.
//
// This endpoint defines the canonical Growth OS capabilities.
//
// It does NOT mutate:
//
// - plans
// - client overrides
// - user permissions
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
    // requirePlatformAdmin already handles:
    //
    // - unauthenticated requests
    // - Shopify embedded identities
    // - authenticated client users
    // - inactive / missing platform admins
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. LOAD MODULE REGISTRY
    // ========================================================

    const snapshot =
      await getAdminModulesSnapshot();


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

      modules:
        snapshot.modules,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          [
            'growthos_control.modules',
            'growthos_control.plan_modules',
            'growthos_control.brand_module_overrides',
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
        'Unable to load Admin Modules'
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
      'ADMIN_MODULES_ERROR',
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
          'Unable to load Admin Modules',

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