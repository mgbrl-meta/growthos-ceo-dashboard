import {
  NextResponse,
} from 'next/server';

import {
  resolveTenantContext,
} from '@/lib/tenancy/context';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    const tenant =
      await resolveTenantContext();


    return NextResponse.json(
      {

        ok:
          true,

        data: {

          tenant,

        },

        meta: {

          mode:
            'development',

          tenantResolver:
            'environment_default',

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'TENANT_CONTEXT_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Unable to resolve Growth OS tenant',

      },
      {
        status:
          500,
      }
    );

  }

}