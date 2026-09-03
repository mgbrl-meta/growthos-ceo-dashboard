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
  resolveTenantContext,
} from '@/lib/tenancy/context';

import {
  getIntegrationConnection,
  upsertIntegrationAccount,
  upsertIntegrationConnection,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SELECT META AD ACCOUNT
//
// OAuth authorization gives Growth OS access to Meta.
//
// This route lets the current Growth OS brand select which
// Meta ad account belongs to it.
//
// Meta user
//      ↓
// available ad accounts
//      ↓
// selected account
//      ↓
// integration_connection
//      +
// integration_account
// ============================================================

export async function POST(
  req: Request
) {

  try {

    // ========================================================
    // REQUEST
    // ========================================================

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


    // ========================================================
    // TENANT
    // ========================================================

    const tenant =
      await resolveTenantContext();


    // ========================================================
    // CURRENT META CONNECTION
    // ========================================================

    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        'meta_ads'

      );


    if (
      !connection
      ||
      !connection.secret_name
    ) {

      throw new Error(
        'Meta authorization does not exist'
      );

    }


    // ========================================================
    // READ META CREDENTIAL
    // ========================================================

    const secret =
      await readIntegrationSecret<{

        access_token:
          string;

      }>(
        connection.secret_name
      );


    if (
      !secret.access_token
    ) {

      throw new Error(
        'Meta credential contains no access token'
      );

    }


    // ========================================================
    // VERIFY ACCOUNT BELONGS TO AUTHORIZED META USER
    // ========================================================

    const accounts =
      await getMetaAdAccounts(
        secret.access_token
      );


    const selected =
      accounts.find(
        account =>

          String(
            account.id
          ) ===
          accountId

          ||

          String(
            account.account_id
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


    // ========================================================
    // UPDATE CONNECTION
    //
    // OAuth + account selection are now complete.
    // ========================================================

    const connectionId =
      await upsertIntegrationConnection({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        provider:
          'meta_ads',

        connectionMode:
          'oauth',

        ingestionAdapter:
          'meta_graph_api',

        status:
          'connected',

        providerUserId:
          connection.provider_user_id
          ??
          null,

        providerUserName:
          connection.provider_user_name
          ??
          null,

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


    // ========================================================
    // UPSERT PROVIDER ACCOUNT
    //
    // Same architecture now used by Shopify.
    // ========================================================

    const integrationAccountId =
      await upsertIntegrationAccount({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId,

        provider:
          'meta_ads',

        providerAccountId:
          selected.id,

        providerAccountName:
          selected.name
          ||
          selected.account_id
          ||
          selected.id,

        accountType:
          'ad_account',

        isSelected:
          true,

        currency:
          selected.currency
          ??
          null,

        timezone:
          selected.timezone_name
          ??
          null,

        metadata: {

          account_id:
            selected.account_id,

          account_status:
            selected.account_status
            ??
            null,

          selection_source:
            'meta_oauth',

        },

      });


    // ========================================================
    // SAFE RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      data: {

        account: {

          id:
            selected.id,

          accountId:
            selected.account_id,

          name:
            selected.name,

          currency:
            selected.currency
            ??
            null,

          timezone:
            selected.timezone_name
            ??
            null,

        },

        integration: {

          connectionId,

          integrationAccountId,

          status:
            'connected',

        },

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to select Meta account'
      );


    console.error(
      'META_SELECT_ACCOUNT_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          message,

      },
      {
        status:
          500,
      }
    );

  }

}