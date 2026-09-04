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
} from '@/lib/integrations/store';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// META AD ACCOUNTS
//
// GET /api/integrations/meta/accounts
//
// Growth OS dashboard
//        ↓
// authenticated active workspace + brand
//        ↓
// Meta integration_connection for that brand
//        ↓
// Secret Manager credential
//        ↓
// Meta Graph API
//        ↓
// accessible ad accounts
//
// IMPORTANT:
//
// This route is ALWAYS Growth OS initiated.
//
// It does NOT use:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// It uses only the active authenticated Growth OS tenant.
// ============================================================

export async function GET(
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
    // 2. CURRENT META CONNECTION
    //
    // Strictly scoped to:
    //
    // active workspace
    // active brand
    // provider = meta_ads
    // ========================================================

    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        'meta_ads'

      );


    // ========================================================
    // 3. META MUST ALREADY BE AUTHORIZED
    //
    // OAuth callback stores the Secret Manager pointer.
    //
    // If there is no connection or no credential pointer,
    // account discovery cannot run.
    // ========================================================

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
    // Actual access token lives only in Secret Manager.
    //
    // Never return it to the browser.
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
    // 5. DISCOVER META AD ACCOUNTS
    //
    // Meta user may have:
    //
    // one ad account
    // multiple ad accounts
    // agency access to many accounts
    //
    // Growth OS must let the user choose which account belongs
    // to the active brand.
    // ========================================================

    const accounts =
      await getMetaAdAccounts(
        accessToken
      );


    // ========================================================
    // 6. SAFE RESPONSE
    //
    // No credential material is exposed.
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        data: {

          accounts,

        },

        meta: {

          workspaceId:
            tenant.workspaceId,

          brandId:
            tenant.brandId,

          provider:
            'meta_ads',

          connectionId:
            connection.connection_id,

          accountCount:
            Array.isArray(
              accounts
            )
              ? accounts.length
              : 0,

        },

      }
    );


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load Meta accounts'
      );


    console.error(
      'META_ACCOUNTS_ERROR',
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
    // INTERNAL / META API FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to load Meta accounts',

      },
      {
        status:
          500,
      }
    );

  }

}