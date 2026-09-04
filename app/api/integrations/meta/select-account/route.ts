import {
  NextRequest,
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
  upsertIntegrationAccount,
  upsertIntegrationConnection,
} from '@/lib/integrations/store';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SELECT META AD ACCOUNT
//
// POST /api/integrations/meta/select-account
//
// ARCHITECTURE:
//
// Growth OS dashboard
//        ↓
// authenticated active workspace + brand
//        ↓
// current brand's Meta connection
//        ↓
// Secret Manager credential
//        ↓
// fetch accounts from Meta again
//        ↓
// verify requested account is authorized
//        ↓
// integration_connection
//        +
// integration_account
//
//
// IMPORTANT:
//
// This action is ALWAYS initiated from Growth OS.
//
// It does NOT use:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// The active authenticated brand determines which Meta
// connection is modified.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATED ACTIVE TENANT
    // ========================================================

    const {
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 2. REQUEST BODY
    // ========================================================

    let body:
      any;


    try {

      body =
        await request.json();

    } catch {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'INVALID_REQUEST_BODY',

        },
        {
          status:
            400,
        }
      );

    }


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
            'ACCOUNT_ID_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 3. CURRENT META CONNECTION
    //
    // Strictly scoped to the currently active:
    //
    // workspace
    // brand
    // provider = meta_ads
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

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'META_NOT_AUTHORIZED',

        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 4. READ META CREDENTIAL
    //
    // Credential material remains in Secret Manager.
    // ========================================================

    const secret =
      await readIntegrationSecret<{

        access_token:
          string;

      }>(
        connection.secret_name
      );


    const accessToken =
      String(
        secret?.access_token
        ||
        ''
      ).trim();


    if (!accessToken) {

      throw new Error(
        'META_CREDENTIAL_ACCESS_TOKEN_MISSING'
      );

    }


    // ========================================================
    // 5. RE-FETCH ACCESSIBLE META ACCOUNTS
    //
    // SECURITY:
    //
    // Never trust account_id merely because the browser sent
    // it.
    //
    // Re-query Meta and verify that the currently authorized
    // Meta credential genuinely has access to that account.
    // ========================================================

    const accounts =
      await getMetaAdAccounts(
        accessToken
      );


    // ========================================================
    // 6. FIND REQUESTED ACCOUNT
    //
    // Meta may expose:
    //
    // id         = act_123456789
    // account_id = 123456789
    //
    // Accept either representation from the UI.
    // ========================================================

    const selected =
      accounts.find(
        account => {

          const id =
            String(
              account?.id
              ||
              ''
            ).trim();


          const nativeAccountId =
            String(
              account?.account_id
              ||
              ''
            ).trim();


          return (
            id ===
              accountId
            ||
            nativeAccountId ===
              accountId
          );

        }
      );


    if (!selected) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'META_ACCOUNT_NOT_ACCESSIBLE',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 7. CANONICAL META ACCOUNT ID
    //
    // Prefer Meta Graph's canonical account object ID.
    // ========================================================

    const providerAccountId =
      String(
        selected.id
        ||
        selected.account_id
        ||
        ''
      ).trim();


    if (!providerAccountId) {

      throw new Error(
        'META_SELECTED_ACCOUNT_ID_MISSING'
      );

    }


    const providerAccountName =
      String(
        selected.name
        ||
        selected.account_id
        ||
        providerAccountId
      ).trim();


    // ========================================================
    // 8. UPDATE META CONNECTION
    //
    // OAuth + account selection are now complete.
    //
    // needs_attention
    //        ↓
    // connected
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

        providerAccountId,

        providerAccountName,

        secretName:
          connection.secret_name,

        error:
          null,

      });


    // ========================================================
    // 9. REGISTER SELECTED META ACCOUNT
    //
    // Same provider-account architecture as Shopify.
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

        providerAccountId,

        providerAccountName,

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
            selected.account_id
            ??
            null,

          graph_account_id:
            selected.id
            ??
            null,

          account_status:
            selected.account_status
            ??
            null,

          selection_source:
            'meta_oauth',

        },

      });


    // ========================================================
    // 10. SAFE RESPONSE
    //
    // No credential material is returned.
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      data: {

        account: {

          id:
            providerAccountId,

          accountId:
            selected.account_id
            ??
            null,

          name:
            providerAccountName,

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

          provider:
            'meta_ads',

          connectionId,

          integrationAccountId,

          status:
            'connected',

        },

      },


      meta: {

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

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


    // ========================================================
    // AUTHENTICATION FAILURE
    // ========================================================

    if (
      message ===
      'UNAUTHENTICATED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'UNAUTHENTICATED',

        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // TENANT FAILURE
    // ========================================================

    if (
      message ===
        'AUTHENTICATED_TENANT_CONTEXT_MISSING'
      ||
      message.includes(
        'Growth OS tenant could not be resolved'
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'TENANT_CONTEXT_INVALID',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // CREDENTIAL FAILURE
    // ========================================================

    if (
      message.includes(
        'META_CREDENTIAL'
      )
      ||
      message.includes(
        'Integration credential'
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'META_CREDENTIAL_INVALID',

        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // INTERNAL FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to select Meta account',

      },
      {
        status:
          500,
      }
    );

  }

}