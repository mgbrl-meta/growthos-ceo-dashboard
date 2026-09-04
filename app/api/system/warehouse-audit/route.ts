import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  auditWarehouse,
} from '@/lib/warehouse/auditor';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// GLOBAL WAREHOUSE INFRASTRUCTURE AUDIT
//
// GET /api/system/warehouse-audit
//
// PURPOSE:
//
// Inspect the configured Growth OS BigQuery warehouse:
//
// datasets
// tables
// row counts
// storage size
// partitioning
// clustering
// version chains
// possible temporary / legacy objects
//
// IMPORTANT:
//
// This is a SYSTEM-LEVEL audit.
//
// It is NOT:
//
// workspace-specific
// brand-specific
// provider-specific
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
// The authenticated user is verified only to ensure this
// system endpoint is not anonymously accessible.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. REQUIRE AUTHENTICATION
    //
    // The warehouse audit is global, but it is still an
    // internal Growth OS system operation.
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


    // ========================================================
    // 2. RUN GLOBAL READ-ONLY WAREHOUSE AUDIT
    //
    // No workspace / brand is passed because the auditor
    // intentionally audits configured infrastructure.
    // ========================================================

    const audit =
      await auditWarehouse();


    // ========================================================
    // 3. RESPONSE
    // ========================================================

    return NextResponse.json(
      {

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

          authenticated:
            true,

        },

      }
    );


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Warehouse audit failed'
      );


    console.error(
      'WAREHOUSE_AUDIT_ERROR',
      {
        message,
      }
    );


    // ========================================================
    // AUTH FAILURE
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
    // CONFIGURATION FAILURE
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

        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // INTERNAL FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Warehouse audit failed',

      },
      {
        status:
          500,
      }
    );

  }

}