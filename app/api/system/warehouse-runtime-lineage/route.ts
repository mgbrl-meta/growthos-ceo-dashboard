import {
  NextResponse,
} from 'next/server';

import {
  scanRuntimeLineage,
} from '@/lib/warehouse/runtime-lineage';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    const runtime =
      await scanRuntimeLineage();


    return NextResponse.json(
      {

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

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'WAREHOUSE_RUNTIME_LINEAGE_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Runtime lineage scan failed',

      },
      {
        status:
          500,
      }
    );

  }

}