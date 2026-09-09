import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

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
// Source of truth:
//
// growthos_control.integration_connections
// growthos_control.integration_accounts
// growthos_control.integration_sync_state
//
// IMPORTANT:
//
// This route:
// - does not bootstrap infrastructure
// - does not mutate sync state
// - does not run retries
// - does not change connections
//
// It is an operational read only.
// ============================================================

export async function GET(
  request: NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // 1. REQUIRE AUTHENTICATION
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
    // 2. DO NOT ALLOW SHOPIFY EMBEDDED SESSION
    //
    // Data Health is platform-wide Admin functionality.
    //
    // NOTE:
    // Dedicated platform-admin authorization should eventually
    // replace this interim boundary across all /api/admin/*
    // routes.
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
    // 3. LOAD GLOBAL HEALTH
    // ========================================================

    const snapshot =
      await getAdminDataHealthSnapshot();


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

      },

    });

  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load Admin Data Health'
      );


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