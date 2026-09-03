import {
  cookies,
} from 'next/headers';

import {
  NextResponse,
} from 'next/server';

import {
  resolveTenantContext,
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
// Meta authorization
//        ↓
// callback
//        ↓
// verify OAuth state
// verify Growth OS tenant
//        ↓
// authorization-code exchange
//        ↓
// long-lived Meta token
//        ↓
// verify Meta user
//        ↓
// Secret Manager
//        ↓
// Growth OS integration_connection
//
// IMPORTANT:
//
// Shopify installation logic does NOT belong here.
// Shopify has its own independent callback.
// ============================================================

export async function GET(
  req: Request
) {

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
        'Meta callback is missing authorization code or state'
      );

    }


    // ========================================================
    // 3. READ SECURE OAUTH COOKIES
    //
    // These were created by the Meta connect route.
    //
    // They bind authorization to:
    //
    // OAuth state
    // workspace
    // brand
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
    // 4. STATE VALIDATION
    //
    // Protect against OAuth CSRF.
    // ========================================================

    if (
      !expectedState
      ||
      expectedState !==
        returnedState
    ) {

      throw new Error(
        'Meta OAuth state validation failed'
      );

    }


    // ========================================================
    // 5. RESOLVE CURRENT GROWTH OS TENANT
    //
    // Meta OAuth is initiated FROM an existing Growth OS
    // workspace / brand.
    //
    // Unlike Shopify installation, Meta does not create a new
    // tenant here.
    // ========================================================

    const tenant =
      await resolveTenantContext();


    // ========================================================
    // 6. VERIFY TENANT DID NOT CHANGE DURING OAUTH
    //
    // Never trust workspace / brand IDs supplied through URL
    // query parameters.
    //
    // Compare against secure HttpOnly cookies created before
    // redirecting to Meta.
    // ========================================================

    if (
      !expectedWorkspace
      ||
      !expectedBrand
      ||
      expectedWorkspace !==
        tenant.workspaceId
      ||
      expectedBrand !==
        tenant.brandId
    ) {

      throw new Error(
        'Meta OAuth tenant context changed during authorization'
      );

    }


    // ========================================================
    // 7. EXCHANGE AUTHORIZATION CODE
    //
    // Meta authorization code
    //        ↓
    // short-lived token
    // ========================================================

    const shortToken =
      await exchangeMetaAuthorizationCode(
        code
      );


    // ========================================================
    // 8. EXCHANGE FOR LONG-LIVED TOKEN
    // ========================================================

    const longToken =
      await exchangeForLongLivedMetaToken(
        shortToken.accessToken
      );


    // ========================================================
    // 9. VERIFY META USER
    //
    // Confirms the credential actually works and obtains the
    // provider-native user identity.
    // ========================================================

    const metaUser =
      await fetchMetaUser(
        longToken.accessToken
      );


    // ========================================================
    // 10. SECURE SECRET STORAGE
    //
    // Secret Manager stores the credential.
    //
    // BigQuery never receives the access token.
    // ========================================================

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
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString(),

        },

      });


    // ========================================================
    // 11. UPSERT META CONNECTION
    //
    // OAuth itself is complete.
    //
    // Meta may expose multiple ad accounts, therefore the
    // connection remains needs_attention until the merchant
    // selects the account Growth OS should use.
    //
    // This replaces the old Brillare legacy Google Sheets
    // connection with the new OAuth / Graph API connection.
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
    // 12. REDIRECT BACK TO GROWTH OS
    //
    // Next UI step:
    //
    // GET /api/integrations/meta/accounts
    //        ↓
    // merchant selects Meta ad account
    // ========================================================

    const response =
      NextResponse.redirect(

        `${appUrl}/?integration=meta_ads&connection=authorized`

      );


    // ========================================================
    // 13. CLEAR ONE-TIME OAUTH COOKIES
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
    // Do not log Meta access tokens.
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


    return NextResponse.redirect(

      `${appUrl}/?integration=meta_ads&connection=failed&error=${encodeURIComponent(
        message
      )}`

    );

  }

}