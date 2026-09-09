import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  scanRuntimeLineage,
} from '@/lib/admin/warehouse/runtime-lineage';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN WAREHOUSE RUNTIME LINEAGE
//
// PLATFORM ADMIN ONLY.
// READ ONLY.
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  try {

    // ========================================================
    // 1. PLATFORM ADMIN
    // ========================================================

    const admin =
      await requirePlatformAdmin(
        request
      );


    // ========================================================
    // 2. RUNTIME LINEAGE
    // ========================================================

    const runtime =
      await scanRuntimeLineage();


    return NextResponse.json({

      ok:
        true,

      data: {

        runtime,

      },

      meta: {

        mode:
          'read_only',

        source:
          'bigquery_information_schema',

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
        'Runtime lineage scan failed'
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
      'WAREHOUSE_RUNTIME_LINEAGE_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Runtime lineage scan failed',

      },
      {
        status:
          500,
      }
    );

  }

}