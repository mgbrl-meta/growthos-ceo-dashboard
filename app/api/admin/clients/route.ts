import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

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
// One client row represents:
//
// workspace + brand
//
// READ ONLY.
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // AUTHENTICATE
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
    // GLOBAL READ
    // ========================================================

    const snapshot =
      await getAdminClientsSnapshot();


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