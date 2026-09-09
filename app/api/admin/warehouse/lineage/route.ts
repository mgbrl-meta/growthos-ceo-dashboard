import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  scanWarehouseLineage,
} from '@/lib/admin/warehouse/lineage';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// ADMIN WAREHOUSE LINEAGE
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
    // 2. LINEAGE
    // ========================================================

    const lineage =
      await scanWarehouseLineage();


    return NextResponse.json({

      ok:
        true,

      data: {

        lineage,

      },

      meta: {

        mode:
          'read_only',

        source:
          'growth_os_repository',

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
        'Warehouse lineage scan failed'
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
      'WAREHOUSE_LINEAGE_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Warehouse lineage scan failed',

      },
      {
        status:
          500,
      }
    );

  }

}