import {
  NextResponse,
} from 'next/server';

import {
  bootstrapDevelopmentConnections,
} from '@/lib/integrations/development-bootstrap';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    const result =
      await bootstrapDevelopmentConnections();


    return NextResponse.json(
      {

        ok:
          true,

        data:
          result,

        meta: {

          environment:
            'development',

          purpose:
            'register_existing_pipelines',

          safeToRerun:
            true,

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'DEVELOPMENT_CONNECTION_BOOTSTRAP_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Unable to register development connections',

      },
      {
        status:
          500,
      }
    );

  }

}