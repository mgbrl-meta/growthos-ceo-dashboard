import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

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
// This endpoint defines the canonical Growth OS capabilities.
//
// It does NOT mutate:
//
// plans
// client overrides
// user permissions
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
      await getAdminModulesSnapshot();


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