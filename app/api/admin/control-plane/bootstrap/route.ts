import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin';

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
// SUPER ADMIN ONLY.
//
// Production additionally requires:
//
// GROWTHOS_ADMIN_BOOTSTRAP_SECRET
//
// This endpoint:
//
// - ensures schema
// - seeds canonical plans
// - seeds canonical modules
// - seeds plan-module mappings
//
// It DOES NOT:
//
// - create clients
// - change subscriptions
// - change users
// - alter Shopify ingestion
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  try {

    // ========================================================
    // 1. SUPER ADMIN AUTHORIZATION
    // ========================================================

    const admin =
      await requirePlatformSuperAdmin(
        request
      );


    // ========================================================
    // 2. PRODUCTION BOOTSTRAP SECRET
    //
    // Existing additional protection is preserved.
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


      // ------------------------------------------------------
      // IMPORTANT
      //
      // Platform auth already uses the normal Growth OS
      // session cookie.
      //
      // Therefore the bootstrap secret uses a separate header
      // instead of Authorization, avoiding conflict with
      // Shopify / bearer authentication semantics.
      // ------------------------------------------------------

      const providedSecret =
        String(
          request.headers.get(
            'x-growthos-bootstrap-secret'
          )
          ||
          ''
        ).trim();


      if (
        providedSecret !==
        expectedSecret
      ) {

        return NextResponse.json(
          {

            ok:
              false,

            error:
              'ADMIN_BOOTSTRAP_SECRET_REQUIRED',

          },
          {
            status:
              403,
          }
        );

      }

    }


    // ========================================================
    // 3. ENSURE CONTROL PLANE
    // ========================================================

    await ensureGrowthOSAdminControlPlane();


    // ========================================================
    // 4. VERIFY SEEDED CATALOG
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
    // 5. RESPONSE
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


      meta: {

        authorization:
          'platform_super_admin',

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
        'Unable to bootstrap Growth OS admin control plane'
      );


    // ========================================================
    // AUTHENTICATION
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


    // ========================================================
    // PLATFORM ADMIN
    // ========================================================

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


    // ========================================================
    // SUPER ADMIN
    // ========================================================

    if (
      message ===
      'SUPER_ADMIN_ACCESS_REQUIRED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SUPER_ADMIN_ACCESS_REQUIRED',

        },
        {
          status:
            403,
        }
      );

    }


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
          'Unable to bootstrap Growth OS admin control plane',

      },
      {
        status:
          500,
      }
    );

  }

}