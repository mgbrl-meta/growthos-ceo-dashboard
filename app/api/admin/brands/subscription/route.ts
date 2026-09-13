import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getGrowthOSBrandSubscription,
  upsertGrowthOSBrandSubscription,
} from '@/lib/admin/control-plane';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN BRAND SUBSCRIPTION
//
// PLATFORM ADMIN ONLY.
//
// GET:
// reads the subscription for the active authenticated brand.
//
// POST:
// updates the active authenticated brand subscription.
//
// Production write protection remains intentionally enabled.
// ============================================================


// ============================================================
// GET
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  try {

    // ========================================================
    // 1. PLATFORM ADMIN AUTHORIZATION
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. ACTIVE BRAND
    // ========================================================

    const workspaceId =
      String(
        admin.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        admin.brandId
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


    // ========================================================
    // 3. SUBSCRIPTION
    // ========================================================

    const subscription =
      await getGrowthOSBrandSubscription(
        workspaceId,
        brandId
      );


    return NextResponse.json({

      ok:
        true,

      subscription,

      meta: {

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
        'Unable to load subscription'
      );


    // ========================================================
    // AUTH
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


    console.error(
      'ADMIN_BRAND_SUBSCRIPTION_GET_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to load subscription',

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
// PLATFORM ADMIN ONLY.
//
// Production writes remain disabled until we explicitly enable
// real Admin subscription mutation in a later phase.
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  try {

    // ========================================================
    // 1. PLATFORM ADMIN AUTHORIZATION
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. KEEP CURRENT PRODUCTION WRITE LOCK
    // ========================================================

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


    // ========================================================
    // 3. ACTIVE BRAND
    // ========================================================

    const workspaceId =
      String(
        admin.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        admin.brandId
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


    // ========================================================
    // 4. INPUT
    // ========================================================

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


    // ========================================================
    // 5. UPDATE
    // ========================================================

    const beforeSubscription =
      await getGrowthOSBrandSubscription(
        workspaceId,
        brandId
      );


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


    await writeGrowthOSAuditEventSafe({
      request,
      workspaceId,
      brandId,
      category:
        'billing',
      action:
        'billing.plan_changed',
      actorUserId:
        admin.userId,
      actorEmail:
        admin.email
        ?? null,
      actorRole:
        admin.platformRole,
      targetType:
        'subscription',
      targetId:
        result.subscriptionId,
      targetLabel:
        brandId,
      before:
        beforeSubscription,
      after:
        result,
    });


    return NextResponse.json({

      ok:
        true,

      subscription:
        result,

      meta: {

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
        'Unable to update subscription'
      );


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


    console.error(
      'ADMIN_BRAND_SUBSCRIPTION_WRITE_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to update subscription',

      },
      {
        status:
          500,
      }
    );

  }

}