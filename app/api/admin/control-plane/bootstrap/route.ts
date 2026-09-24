import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin';

import {
  invalidateAdminSnapshots,
} from '@/lib/admin/snapshot-cache';

import {
  migrateGrowthOSAdminControlPlane,
  listGrowthOSModules,
  listGrowthOSPlans,
} from '@/lib/admin/control-plane';

import {
  registerCallCommerceCapabilities,
} from '@/lib/call-commerce/admin-registration';


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
// - ensures the core Growth OS control-plane schema
// - seeds canonical plans
// - seeds canonical modules
// - seeds plan-module mappings
// - registers module-specific capabilities/submodules
//
// It DOES NOT:
//
// - create clients
// - change subscriptions
// - change users
// - alter Shopify ingestion
//
// IMPORTANT:
//
// Module-specific registration happens AFTER the core control
// plane has been migrated.
//
// This makes the bootstrap portable:
//
// new BigQuery project
//        ↓
// configure environment
//        ↓
// run this bootstrap
//        ↓
// core control plane created
//        ↓
// module-specific capabilities registered from code
//
// No manual BigQuery inserts should be required.
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
    //
    // Platform authentication already uses the normal Growth OS
    // session mechanism, so the bootstrap secret deliberately
    // uses its own header.
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
    // 3. MIGRATE CORE GROWTH OS CONTROL PLANE
    //
    // This must happen first because module-specific
    // registrations depend on core tables such as:
    //
    // - modules
    // - plans
    // - plan_modules
    //
    // The migration is expected to be idempotent and safe to
    // rerun against an existing Growth OS installation.
    // ========================================================

    await migrateGrowthOSAdminControlPlane();


    // ========================================================
    // 4. REGISTER CALL COMMERCE CAPABILITIES
    //
    // Call Commerce remains isolated from the global capability
    // migration implementation.
    //
    // Its registration reads the Call Commerce submodules from:
    //
    // GROWTHOS_SUBMODULES
    //
    // and reconciles them into:
    //
    // growthos_control.modules
    // growthos_control.submodules
    // growthos_control.plan_submodules
    //
    // Therefore adding a future Call Commerce capability to the
    // code registry does NOT require a manual BigQuery insert.
    //
    // Example:
    //
    // call-commerce/settings
    //
    // will automatically be registered when this bootstrap runs.
    //
    // Existing Admin-owned configuration is preserved by the
    // registration MERGE logic.
    // ========================================================

    await registerCallCommerceCapabilities();


    // ========================================================
    // 5. INVALIDATE ADMIN SNAPSHOTS
    //
    // Registration may have changed modules/submodules or plan
    // capability mappings, so cached Admin state must not be
    // reused after bootstrap.
    // ========================================================

    invalidateAdminSnapshots();


    // ========================================================
    // 6. VERIFY SEEDED CATALOG
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
    // 7. RESPONSE
    // ========================================================

    return NextResponse.json(
      {

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

          bootstrap:
            'complete',

          safeToRerun:
            true,

          moduleRegistration: {

            callCommerce:
              true,

          },

        },

      }
    );


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


    // ========================================================
    // BOOTSTRAP FAILURE
    // ========================================================

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