import {
  NextResponse,
} from 'next/server';

import {
  getMetaAdAccounts,
} from '@/lib/integrations/providers/meta';

import {
  readIntegrationSecret,
} from '@/lib/integrations/secrets';

import {
  getIntegrationConnection,
  getWorkspaceId,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    const workspaceId =
      getWorkspaceId();


    const connection =
      await getIntegrationConnection(
        workspaceId,
        'meta_ads'
      );


    if (
      !connection ||
      !connection.secret_name
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'Meta is not authorized',
        },
        {
          status:
            404,
        }
      );

    }


    const secret =
      await readIntegrationSecret<{
        access_token: string;
      }>(
        connection.secret_name
      );


    const accounts =
      await getMetaAdAccounts(
        secret.access_token
      );


    return NextResponse.json(
      {
        ok:
          true,

        data: {
          accounts,
        },
      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'META_ACCOUNTS_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error?.message
          ||
          'Unable to load Meta accounts',
      },
      {
        status:
          500,
      }
    );

  }

}