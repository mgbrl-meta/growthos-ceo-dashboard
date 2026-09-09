import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

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
// Cross-client integration registry.
//
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
// Customer connection actions continue to use the existing
// /api/integrations/* provider routes.
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // AUTHENTICATION
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
    // SHOPIFY EMBEDDED SESSION CANNOT ACCESS GLOBAL ADMIN DATA
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
    // READ GLOBAL CONNECTION STATE
    // ========================================================

    const snapshot =
      await getAdminIntegrationsSnapshot();


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
          'growthos_control.integration_connections + integration_accounts',

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
        'Unable to load Admin Integrations'
      );


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

      },
      {
        status:
          500,
      }
    );

  }

}