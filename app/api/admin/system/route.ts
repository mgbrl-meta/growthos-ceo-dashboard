import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getAdminSystemSnapshot,
} from '@/lib/admin/system';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN SYSTEM
//
// GLOBAL READ-ONLY INFRASTRUCTURE SNAPSHOT.
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // AUTH
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
    // SNAPSHOT
    // ========================================================

    const snapshot =
      await getAdminSystemSnapshot();


    return NextResponse.json({

      ok:
        true,

      scope:
        'global',

      system:
        snapshot,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          'runtime configuration + BigQuery INFORMATION_SCHEMA',

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
        'Unable to load Admin System'
      );


    console.error(
      'ADMIN_SYSTEM_ERROR',
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
          'Unable to load Admin System',

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