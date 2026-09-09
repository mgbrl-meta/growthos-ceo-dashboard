import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminIntegrationsSnapshot,
} from '@/lib/admin/integrations';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN INTEGRATIONS
//
// GLOBAL CROSS-CLIENT INTEGRATION REGISTRY.
//
// PLATFORM ADMIN ONLY.
// READ ONLY.
//
// This endpoint does not:
//
// - create connections
// - reconnect providers
// - disconnect providers
// - modify selected accounts
// - bootstrap integration tables
//
// Customer connection actions continue to use:
//
// /api/integrations/*
//
// Authorization:
//
// authenticated Growth OS session
//        ↓
// growthos_control.platform_admins
//        ↓
// active platform admin
//        ↓
// access granted
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
    // This already rejects:
    //
    // - unauthenticated requests
    // - Shopify embedded authentication
    // - normal client users
    // - inactive / missing platform admins
    //
    // Therefore no additional authMethod check is required.
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. READ GLOBAL CONNECTION STATE
    // ========================================================

    const snapshot =
      await getAdminIntegrationsSnapshot();


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

      integrations:
        snapshot.integrations,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          [
            'growthos_control.integration_connections',
            'growthos_control.integration_accounts',
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
        'Unable to load Admin Integrations'
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
      'ADMIN_INTEGRATIONS_ERROR',
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
          'Unable to load Admin Integrations',

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