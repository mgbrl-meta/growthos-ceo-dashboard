import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSBrandSubscription,
  listGrowthOSPlanModules,
  listGrowthOSPlans,
} from '@/lib/admin/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// CURRENT WORKSPACE SUBSCRIPTION
//
// READ ONLY.
//
// Tenant identity comes exclusively from the authenticated
// Growth OS session.
//
// Browser cannot request another brand's subscription.
// ============================================================

export async function GET(
  request: NextRequest
) {

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


    // ========================================================
    // SUBSCRIPTION
    // ========================================================

    const subscription =
      await getGrowthOSBrandSubscription(
        workspaceId,
        brandId
      );


    if (!subscription) {

      return NextResponse.json({

        ok:
          true,

        configured:
          false,

        subscription:
          null,

        plan:
          null,

        modules:
          [],

      });

    }


    // ========================================================
    // PLAN
    // ========================================================

    const plans =
      await listGrowthOSPlans();


    const plan =
      plans.find(
        item =>
          item.plan_id ===
          subscription.plan_id
      )
      ||
      null;


    if (!plan) {

      throw new Error(
        'SUBSCRIPTION_PLAN_NOT_FOUND'
      );

    }


    // ========================================================
    // PLAN MODULES
    // ========================================================

    const planModules =
      await listGrowthOSPlanModules(
        plan.plan_id
      );


    // ========================================================
    // EFFECTIVE ORDER LIMIT
    // ========================================================

    let effectiveMonthlyOrderLimit:
      number |
      null;


    if (
      subscription.order_limit_override_mode ===
      'unlimited'
    ) {

      effectiveMonthlyOrderLimit =
        null;

    }

    else if (
      subscription.order_limit_override_mode ===
      'custom'
    ) {

      effectiveMonthlyOrderLimit =
        subscription.monthly_order_limit_override;

    }

    else {

      effectiveMonthlyOrderLimit =
        plan.monthly_order_limit;

    }


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      configured:
        true,


      subscription: {

        subscriptionId:
          subscription.subscription_id,

        status:
          subscription.status,

        planId:
          subscription.plan_id,

        orderLimitOverrideMode:
          subscription.order_limit_override_mode,

        monthlyOrderLimitOverride:
          subscription.monthly_order_limit_override,

        createdAt:
          subscription.created_at,

        updatedAt:
          subscription.updated_at,

      },


      plan: {

        planId:
          plan.plan_id,

        name:
          plan.plan_name,

        description:
          plan.description,

        status:
          plan.status,

        monthlyOrderLimit:
          plan.monthly_order_limit,

        effectiveMonthlyOrderLimit,

        maxUsers:
          plan.max_users,

      },


      modules:
        planModules.map(
          module => ({

            moduleId:
              module.module_id,

            name:
              module.module_name,

            description:
              module.description,

            category:
              module.category,

            routeKey:
              module.route_key,

            enabled:
              Boolean(
                module.enabled
              ),

            status:
              module.module_status,

            setupRequired:
              Boolean(
                module.setup_required
              ),

          })
        ),

    });

  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load workspace subscription'
      );


    console.error(
      'WORKSPACE_SUBSCRIPTION_ERROR',
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