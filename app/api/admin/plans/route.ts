import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getAdminPlansSnapshot,
} from '@/lib/admin/plans';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN PLANS
//
// GLOBAL COMMERCIAL ENTITLEMENT REGISTRY.
//
// READ ONLY.
//
// Source:
//
// plans
// plan_modules
// modules
// brand_subscriptions
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
      await getAdminPlansSnapshot();


    return NextResponse.json({

      ok:
        true,

      scope:
        'global',

      summary:
        snapshot.summary,

      plans:
        snapshot.plans,

      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

        source:
          [
            'growthos_control.plans',
            'growthos_control.plan_modules',
            'growthos_control.modules',
            'growthos_control.brand_subscriptions',
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
        'Unable to load Admin Plans'
      );


    console.error(
      'ADMIN_PLANS_ERROR',
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
          'Unable to load Admin Plans',

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