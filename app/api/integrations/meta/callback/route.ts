import {
  cookies,
} from 'next/headers';

import {
  NextResponse,
} from 'next/server';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import {
  exchangeForLongLivedMetaToken,
  exchangeMetaAuthorizationCode,
  fetchMetaUser,
} from '@/lib/integrations/providers/meta';

import {
  storeIntegrationSecret,
} from '@/lib/integrations/secrets';

import {
  upsertIntegrationConnection,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// META OAUTH CALLBACK
//
// ARCHITECTURE:
//
// Meta connection is ALWAYS initiated from Growth OS.
//
// Authenticated Growth OS dashboard
//        ↓
// active workspace + brand
//        ↓
// /api/integrations/meta/connect
//        ↓
// freeze tenant in HttpOnly OAuth cookies
//        ↓
// Meta authorization
//        ↓
// THIS CALLBACK
//        ↓
// verify OAuth state
//        ↓
// resolve EXACT frozen workspace + brand
//        ↓
// exchange authorization code
//        ↓
// long-lived Meta token
//        ↓
// verify Meta user
//        ↓
// Secret Manager
//        ↓
// integration_connection
//        ↓
// return to Growth OS dashboard
//
//
// IMPORTANT:
//
// Unlike Shopify:
//
// Meta does NOT create a tenant.
//
// Meta connects TO an already-authenticated Growth OS brand.
//
// The callback must NEVER use:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
// query-string workspace ID
// query-string brand ID
// current ENV tenant
//
// Shopify installation logic does NOT belong here.
// ============================================================

export async function GET(
  req: Request
) {

  // ==========================================================
  // GROWTH OS APP URL
  // ==========================================================

  const appUrl =
    String(
      process.env.GROWTHOS_APP_URL
      ||
      'http://localhost:3000'
    )
      .trim()
      .replace(
        /\/+$/,
        ''
      );


  try {

    const {
      searchParams,
    } =
      new URL(
        req.url
      );


    // ========================================================
    // 1. HANDLE META AUTHORIZATION ERROR
    //
    // Examples:
    //
    // user denied permission
    // authorization cancelled
    // Meta authorization failure
    // ========================================================

    const metaError =
      searchParams.get(
        'error'
      );


    if (metaError) {

      throw new Error(

        searchParams.get(
          'error_description'
        )
        ||
        metaError

      );

    }


    // ========================================================
    // 2. CALLBACK PARAMETERS
    // ========================================================

    const code =
      String(
        searchParams.get(
          'code'
        )
        ||
        ''
      );


    const returnedState =
      String(
        searchParams.get(
          'state'
        )
        ||
        ''
      );


    if (
      !code
      ||
      !returnedState
    ) {

      throw new Error(
        'META_OAUTH_CALLBACK_PARAMETERS_MISSING'
      );

    }


    // ========================================================
    // 3. READ SECURE OAUTH COOKIES
    //
    // Created by:
    //
    // /api/integrations/meta/connect
    //
    // Before leaving Growth OS we freeze:
    //
    // OAuth state
    // workspace
    // brand
    //
    // These values become the authoritative tenant context
    // for this OAuth transaction.
    // ========================================================

    const cookieStore =
      await cookies();


    const expectedState =
      cookieStore
        .get(
          'growthos_meta_state'
        )
        ?.value
      ||
      '';


    const expectedWorkspace =
      cookieStore
        .get(
          'growthos_meta_workspace'
        )
        ?.value
      ||
      '';


    const expectedBrand =
      cookieStore
        .get(
          'growthos_meta_brand'
        )
        ?.value
      ||
      '';


    // ========================================================
    // 4. VERIFY OAUTH STATE
    //
    // Anti-CSRF protection.
    //
    // State returned by Meta must exactly match the secret
    // state created before authorization began.
    // ========================================================

    if (
      !expectedState
      ||
      expectedState !==
        returnedState
    ) {

      throw new Error(
        'META_OAUTH_STATE_INVALID'
      );

    }


    // ========================================================
    // 5. REQUIRE FROZEN TENANT CONTEXT
    //
    // Meta must always be attached to the Growth OS brand
    // from which authorization started.
    // ========================================================

    if (
      !expectedWorkspace
      ||
      !expectedBrand
    ) {

      throw new Error(
        'META_OAUTH_TENANT_CONTEXT_MISSING'
      );

    }


    // ========================================================
    // 6. RESOLVE EXACT OAUTH TENANT
    //
    // IMPORTANT:
    //
    // This deliberately does NOT call:
    //
    // because that function may use development ENV defaults.
    //
    // Instead we resolve exactly:
    //
    // expectedWorkspace
    // expectedBrand
    //
    // captured before leaving Growth OS.
    // ========================================================

    const tenant =
      await resolveTenantContextById(

        expectedWorkspace,

        expectedBrand

      );


    // ========================================================
    // 7. DEFENCE-IN-DEPTH TENANT CHECK
    //
    // resolveTenantContextById() should already guarantee
    // this mapping.
    //
    // Keep explicit verification because OAuth tenant binding
    // is security-sensitive.
    // ========================================================

    if (
      tenant.workspaceId !==
        expectedWorkspace
      ||
      tenant.brandId !==
        expectedBrand
    ) {

      throw new Error(
        'META_OAUTH_TENANT_CONTEXT_MISMATCH'
      );

    }


    // ========================================================
    // 8. EXCHANGE AUTHORIZATION CODE
    //
    // Meta authorization code
    //        ↓
    // short-lived user token
    //
    // Token never goes to the browser.
    // ========================================================

    const shortToken =
      await exchangeMetaAuthorizationCode(
        code
      );


    // ========================================================
    // 9. EXCHANGE FOR LONG-LIVED TOKEN
    // ========================================================

    const longToken =
      await exchangeForLongLivedMetaToken(
        shortToken.accessToken
      );


    // ========================================================
    // 10. VERIFY META USER
    //
    // Confirms:
    //
    // credential works
    // Meta API is reachable
    // provider-native user identity
    // ========================================================

    const metaUser =
      await fetchMetaUser(
        longToken.accessToken
      );


    // ========================================================
    // 11. STORE META CREDENTIAL SECURELY
    //
    // Google Secret Manager stores credential material.
    //
    // BigQuery stores only:
    //
    // secret pointer
    // connection metadata
    //
    // NEVER the access token.
    // ========================================================

    const now =
      new Date()
        .toISOString();


    const secretName =
      await storeIntegrationSecret({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        provider:
          'meta_ads',

        value: {

          schema_version:
            1,

          credential_type:
            'meta_long_lived_user_token',

          provider:
            'meta_ads',

          access_token:
            longToken.accessToken,

          expires_in:
            longToken.expiresIn,

          meta_user_id:
            metaUser.id,

          meta_user_name:
            metaUser.name,

          issued_at:
            now,

          updated_at:
            now,

        },

      });


    // ========================================================
    // 12. UPSERT META CONNECTION
    //
    // OAuth is now complete.
    //
    // But Meta can expose multiple ad accounts.
    //
    // Therefore connection remains:
    //
    // needs_attention
    //
    // until user selects the desired account from Growth OS.
    //
    //
    // Growth OS dashboard
    //       ↓
    // GET /api/integrations/meta/accounts
    //       ↓
    // select account
    //       ↓
    // POST /api/integrations/meta/select-account
    //       ↓
    // connected
    // ========================================================

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
        'needs_attention',

      providerUserId:
        metaUser.id,

      providerUserName:
        metaUser.name,

      providerAccountId:
        null,

      providerAccountName:
        null,

      secretName,

      error:
        null,

    });


    // ========================================================
    // 13. RETURN TO GROWTH OS
    //
    // Meta setup continues inside Growth OS.
    //
    // We do NOT send the user to a Meta-hosted setup screen.
    //
    // Next Growth OS UI step:
    //
    // choose Meta ad account.
    // ========================================================

    const response =
      NextResponse.redirect(

        `${appUrl}/?integration=meta_ads&connection=authorized`

      );


    // ========================================================
    // 14. CLEAR ONE-TIME OAUTH COOKIES
    //
    // State + tenant binding are single-use.
    // ========================================================

    response.cookies.delete(
      'growthos_meta_state'
    );


    response.cookies.delete(
      'growthos_meta_workspace'
    );


    response.cookies.delete(
      'growthos_meta_brand'
    );


    return response;


  } catch (
    error: any
  ) {

    // ========================================================
    // SAFE ERROR LOGGING
    //
    // NEVER log:
    //
    // Meta access token
    // client secret
    // OAuth code
    // OAuth state value
    // Secret Manager payload
    // ========================================================

    const message =
      String(
        error?.message
        ||
        'Meta authorization failed'
      );


    console.error(
      'META_CALLBACK_ERROR',
      {
        message,
      }
    );


    // ========================================================
    // SAFE FAILURE REDIRECT
    //
    // Do not expose internal error messages in browser URL.
    //
    // Detailed error remains in server logs.
    // ========================================================

    const response =
      NextResponse.redirect(

        `${appUrl}/?integration=meta_ads&connection=failed`

      );


    // ========================================================
    // CLEAR OAUTH COOKIES EVEN ON FAILURE
    //
    // Prevent stale state / tenant context from surviving.
    // ========================================================

    response.cookies.delete(
      'growthos_meta_state'
    );


    response.cookies.delete(
      'growthos_meta_workspace'
    );


    response.cookies.delete(
      'growthos_meta_brand'
    );


    return response;

  }

}