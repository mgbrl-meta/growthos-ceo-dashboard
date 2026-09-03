import {
  NextResponse,
} from 'next/server';

import {
  resolveTenantContext,
} from '@/lib/tenancy/context';

import {
  auditWarehouse,
} from '@/lib/warehouse/auditor';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    const tenant =
      await resolveTenantContext();


    const audit =
      await auditWarehouse();


    return NextResponse.json(
      {

        ok:
          true,

        data: {

          tenant,

          audit,

        },

        meta: {

          mode:
            'read_only',

          destructive:
            false,

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'WAREHOUSE_AUDIT_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Warehouse audit failed',

      },
      {
        status:
          500,
      }
    );

  }

}