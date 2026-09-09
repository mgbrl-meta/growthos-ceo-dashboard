import {
  NextResponse,
} from 'next/server';

import {
  scanWarehouseLineage,
} from '@/lib/admin/warehouse/lineage';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    const lineage =
        await scanWarehouseLineage();


    return NextResponse.json(
      {

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

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'WAREHOUSE_LINEAGE_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Warehouse lineage scan failed',

      },
      {
        status:
          500,
      }
    );

  }

}
