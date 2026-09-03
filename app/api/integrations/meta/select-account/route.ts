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
  upsertIntegrationConnection,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';


export async function POST(
  req: Request
) {

  try {

    const body =
      await req.json();


    const accountId =
      String(
        body?.account_id
        ||
        ''
      ).trim();


    if (!accountId) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'account_id is required',
        },
        {
          status:
            400,
        }
      );

    }


    const workspaceId =
      getWorkspaceId();


    const connection =
      await getIntegrationConnection(
        workspaceId,
        'meta_ads'
      );


    if (
      !connection?.secret_name
    ) {

      throw new Error(
        'Meta authorization does not exist'
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


    const selected =
      accounts.find(
        (account: any) =>
          String(
            account.id
          ) ===
          accountId
      );


    if (!selected) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'Selected Meta account is not available to this user',
        },
        {
          status:
            400,
        }
      );

    }


    await upsertIntegrationConnection({

      workspaceId,

      provider:
        'meta_ads',

      status:
        'connected',

      providerUserId:
        connection.provider_user_id,

      providerUserName:
        connection.provider_user_name,

      providerAccountId:
        selected.id,

      providerAccountName:
        selected.name
        ||
        selected.account_id
        ||
        selected.id,

      secretName:
        connection.secret_name,

      error:
        null,

    });


    return NextResponse.json(
      {
        ok:
          true,

        data: {
          account:
            selected,
        },
      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'META_SELECT_ACCOUNT_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error?.message
          ||
          'Unable to select Meta account',
      },
      {
        status:
          500,
      }
    );

  }

}