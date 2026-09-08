import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  ensureGrowthOSAdminControlPlane,
  listGrowthOSModules,
  listGrowthOSPlans,
} from '@/lib/admin/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN CONTROL-PLANE BOOTSTRAP
//
// Development:
//   Can be called directly.
//
// Production:
//   Requires GROWTHOS_ADMIN_BOOTSTRAP_SECRET.
//
// This endpoint only:
//
// - ensures schema
// - seeds canonical plans
// - seeds canonical modules
// - seeds plan-module mappings
//
// It DOES NOT:
// - create clients
// - change subscriptions
// - change users
// - alter Shopify ingestion
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // PRODUCTION PROTECTION
    // ========================================================

    if (
      process.env.NODE_ENV ===
      'production'
    ) {

      const expectedSecret =
        String(
          process.env.GROWTHOS_ADMIN_BOOTSTRAP_SECRET
          ||
          ''
        ).trim();


      if (!expectedSecret) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'ADMIN_BOOTSTRAP_DISABLED',
          },
          {
            status:
              403,
          }
        );

      }


      const authorization =
        String(
          request.headers.get(
            'authorization'
          )
          ||
          ''
        ).trim();


      const expectedAuthorization =
        `Bearer ${expectedSecret}`;


      if (
        authorization !==
        expectedAuthorization
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'UNAUTHORIZED',
          },
          {
            status:
              401,
          }
        );

      }

    }


    // ========================================================
    // ENSURE CONTROL PLANE
    // ========================================================

    await ensureGrowthOSAdminControlPlane();


    // ========================================================
    // VERIFY SEEDED CATALOG
    // ========================================================

    const [
      plans,
      modules,
    ] =
      await Promise.all([

        listGrowthOSPlans(),

        listGrowthOSModules(),

      ]);


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      controlPlane: {

        ready:
          true,

        plans:
          plans.length,

        modules:
          modules.length,

      },

      seeded: {

        plans:
          plans.map(
            plan => ({

              planId:
                plan.plan_id,

              name:
                plan.plan_name,

              monthlyOrderLimit:
                plan.monthly_order_limit,

              maxUsers:
                plan.max_users,

              status:
                plan.status,

            })
          ),

        modules:
          modules.map(
            module => ({

              moduleId:
                module.module_id,

              name:
                module.module_name,

              routeKey:
                module.route_key,

              category:
                module.category,

              status:
                module.status,

            })
          ),

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to bootstrap Growth OS admin control plane'
      );


    console.error(
      'GROWTHOS_ADMIN_CONTROL_PLANE_BOOTSTRAP_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          message,

      },
      {
        status:
          500,
      }
    );

  }

}