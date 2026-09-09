import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  auditWarehouse,
} from '@/lib/admin/warehouse/auditor';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// GLOBAL WAREHOUSE INFRASTRUCTURE AUDIT
//
// GET /api/admin/warehouse/audit
//
// PLATFORM ADMIN ONLY.
// READ ONLY.
//
// PURPOSE:
//
// Inspect the configured Growth OS BigQuery warehouse:
//
// - datasets
// - tables
// - row counts
// - storage size
// - partitioning
// - clustering
// - version chains
// - possible temporary / legacy objects
//
// IMPORTANT:
//
// This is a SYSTEM-LEVEL audit.
//
// It is NOT:
//
// - workspace-specific
// - brand-specific
// - provider-specific
//
// auditWarehouse() reads:
//
// GROWTHOS_AUDIT_DATASETS
//
// and audits those datasets globally.
//
// Therefore this route must NOT use:
//
// resolveRequestTenantContext()
//
// Authorization:
//
// authenticated Growth OS session
//        ↓
// growthos_control.platform_admins
//        ↓
// active platform admin
//        ↓
// global warehouse audit allowed
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // 1. PLATFORM ADMIN AUTHORIZATION
    //
    // requirePlatformAdmin already rejects:
    //
    // - unauthenticated requests
    // - Shopify embedded identities
    // - authenticated client-only users
    // - inactive / missing platform admins
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. RUN GLOBAL READ-ONLY WAREHOUSE AUDIT
    //
    // No workspace / brand is passed because the auditor
    // intentionally audits configured platform infrastructure.
    // ========================================================

    const audit =
      await auditWarehouse();


    // ========================================================
    // 3. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      data: {

        audit,

      },

      meta: {

        scope:
          'global_warehouse',

        mode:
          'read_only',

        destructive:
          false,

        authorization:
          'platform_admin',

        platformRole:
          admin.platformRole,

        durationMs:
          Date.now()
          -
          startedAt,

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
        'Warehouse audit failed'
      );


    // ========================================================
    // 4. UNAUTHENTICATED
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
    // 5. AUTHENTICATED BUT NOT PLATFORM ADMIN
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
    // 6. CONFIGURATION FAILURE
    // ========================================================

    if (
      message.includes(
        'GROWTHOS_AUDIT_DATASETS'
      )
      ||
      message.includes(
        'GCP_PROJECT_ID'
      )
      ||
      message.includes(
        'BQ_PROJECT_ID'
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'WAREHOUSE_AUDIT_NOT_CONFIGURED',

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


    // ========================================================
    // 7. INTERNAL FAILURE
    // ========================================================

    console.error(
      'WAREHOUSE_AUDIT_ERROR',
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
          'Warehouse audit failed',

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