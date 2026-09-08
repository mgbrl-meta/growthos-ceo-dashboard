import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSBrandSubscription,
  upsertGrowthOSBrandSubscription,
} from '@/lib/admin/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// BRAND SUBSCRIPTION
//
// Temporary authorization rule:
//
// development:
//   authenticated Growth OS user may call this endpoint.
//
// production:
//   disabled until platform-admin authorization is wired.
//
// This prevents brand owners from changing their own commercial
// entitlement in production.
// ============================================================


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest
) {

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


    const workspaceId =
      String(
        identity.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        identity.brandId
        ||
        ''
      ).trim();


    if (
      !workspaceId
      ||
      !brandId
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'ACTIVE_BRAND_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    const subscription =
      await getGrowthOSBrandSubscription(
        workspaceId,
        brandId
      );


    return NextResponse.json({

      ok:
        true,

      subscription,

    });

  } catch (
    error: any
  ) {

    console.error(
      'ADMIN_BRAND_SUBSCRIPTION_GET_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          String(
            error?.message
            ||
            'Unable to load subscription'
          ),
      },
      {
        status:
          500,
      }
    );

  }

}


// ============================================================
// POST
//
// DEV-ONLY FOR NOW.
//
// Later:
// platform-admin authorization.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    if (
      process.env.NODE_ENV ===
      'production'
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'ADMIN_SUBSCRIPTION_WRITE_DISABLED',
        },
        {
          status:
            403,
        }
      );

    }


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


    const workspaceId =
      String(
        identity.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        identity.brandId
        ||
        ''
      ).trim();


    if (
      !workspaceId
      ||
      !brandId
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'ACTIVE_BRAND_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    const body =
      await request.json();


    const planId =
      String(
        body?.planId
        ||
        ''
      )
        .trim()
        .toLowerCase();


    if (!planId) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'planId is required',
        },
        {
          status:
            400,
        }
      );

    }


    const result =
      await upsertGrowthOSBrandSubscription({

        workspaceId,

        brandId,

        planId,

        status:
          'active',

        orderLimitOverrideMode:
          'inherit',

      });


    return NextResponse.json({

      ok:
        true,

      subscription:
        result,

    });

  } catch (
    error: any
  ) {

    console.error(
      'ADMIN_BRAND_SUBSCRIPTION_WRITE_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          String(
            error?.message
            ||
            'Unable to update subscription'
          ),
      },
      {
        status:
          500,
      }
    );

  }

}