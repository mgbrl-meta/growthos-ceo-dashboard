import {
  NextResponse,
} from 'next/server';

import {
  listProviders,
} from '@/lib/integrations/provider-registry';

import {
  registerBuiltInProviders,
} from '@/lib/integrations/providers';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    registerBuiltInProviders();


    const providers =
      listProviders();


    return NextResponse.json(
      {

        ok:
          true,


        data: {

          providers:
            providers.map(
              provider => ({

                id:
                  provider.id,

                name:
                  provider.name,

                connectionModes:
                  provider.connectionModes,

                entities:
                  provider.entities,

              })
            ),

        },


        meta: {

          providerCount:
            providers.length,

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'PROVIDER_REGISTRY_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Unable to load provider registry',

      },
      {
        status:
          500,
      }
    );

  }

}