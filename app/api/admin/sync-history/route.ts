import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getAdminSyncHistory,
} from '@/lib/admin/sync-history';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN SYNC HISTORY
//
// Global cross-client execution history.
//
// Read only.
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  try {

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


    const snapshot =
      await getAdminSyncHistory();


    return NextResponse.json({

      ok:
        true,

      scope:
        'global',

      summary:
        snapshot.summary,

      runs:
        snapshot.runs,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          'growthos_control.integration_sync_runs',

        limit:
          500,

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
        'Unable to load Sync History'
      );


    console.error(
      'ADMIN_SYNC_HISTORY_ERROR',
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
          'Unable to load Sync History',

      },
      {
        status:
          500,
      }
    );

  }

}