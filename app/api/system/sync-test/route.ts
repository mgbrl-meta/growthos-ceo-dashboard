import {
  NextResponse,
} from 'next/server';

import {
  resolveTenantContext,
} from '@/lib/tenancy/context';

import {
  getIntegrationConnection,
} from '@/lib/integrations/store';

import {
  runIntegrationSync,
} from '@/lib/integrations/sync-engine';


export const dynamic =
  'force-dynamic';


export async function GET(
  req: Request
) {

  try {

    const {
      searchParams,
    } =
      new URL(
        req.url
      );


    const provider =
      searchParams.get(
        'provider'
      )
      ||
      'meta_ads';


    const entity =
      searchParams.get(
        'entity'
      )
      ||
      'campaigns';


    const tenant =
      await resolveTenantContext();


    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        provider

      );


    if (!connection) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            `No connection registered for ${provider}`,

        },
        {
          status:
            404,
        }
      );

    }


    const result =
      await runIntegrationSync({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId:
          connection.connection_id,

        providerId:
          provider,

        providerAccountId:
          connection.provider_account_id
          ??
          null,

        entity,

        syncType:
          'manual',

      });


    return NextResponse.json(
      result
    );


  } catch (
    error: any
  ) {

    console.error(
      'SYNC_TEST_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Sync test failed',

      },
      {
        status:
          500,
      }
    );

  }

}