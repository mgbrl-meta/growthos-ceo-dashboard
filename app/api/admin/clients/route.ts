import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminClientsSnapshot,
} from '@/lib/admin/clients';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN CLIENTS
//
// GLOBAL CROSS-CLIENT READ.
//
// PLATFORM ADMIN ONLY.
// READ ONLY.
//
// One client row represents:
//
// workspace + brand
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
    // 2. GLOBAL CLIENT READ
    // ========================================================

    const snapshot =
      await getAdminClientsSnapshot();


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

      clients:
        snapshot.clients,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          [
            'growthos_control.workspaces',
            'growthos_control.brands',
            'growthos_control.brand_subscriptions',
            'growthos_control.plans',
            'growthos_control.brand_memberships',
            'growthos_control.integration_connections',
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
        'Unable to load Admin Clients'
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
      'ADMIN_CLIENTS_ERROR',
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
          'Unable to load Admin Clients',

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