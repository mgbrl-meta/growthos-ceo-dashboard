import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  exchangeShopifyAuthorizationCode,
  verifyShopifyOAuthHmac,
  verifyShopifyOAuthShop,
  verifyShopifyOAuthState,
  verifyShopifyOAuthTimestamp,
} from '@/lib/integrations/providers/shopify-oauth';

import {
  queryCurrentShop,
} from '@/lib/auth/shopify';

import {
  storeShopifyOfflineCredential,
  verifyStoredShopifyCredential,
} from '@/lib/integrations/providers/shopify-credentials';

import {
  registerShopifyIntegration,
  resolveOrProvisionShopifyTenant,
} from '@/lib/integrations/providers/shopify-installation';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY INSTALLATION / OAUTH CALLBACK
//
// STEP 1E
//
// Shopify authorization
//        ↓
// callback
//        ↓
// verify state
// verify originating shop
// verify Shopify HMAC
// verify timestamp
//        ↓
// authorization-code exchange
//        ↓
// expiring OFFLINE credential
//        ↓
// Shopify Admin API
//        ↓
// canonical Shop identity
//        ↓
// resolve / provision Growth OS tenant
//        ↓
// Secret Manager credential storage
//        ↓
// credential read-back verification
//        ↓
// integration_connection
//        ↓
// integration_account
//
// RESULT:
//
// A Shopify installation becomes a fully registered
// Growth OS provider connection.
//
// IMPORTANT:
//
// This route DOES NOT YET:
//
// - enable App Embed automatically
// - provision Web Pixel automatically
// - register all Shopify webhooks
// - initialize historical Admin API backfill
// - initialize incremental sync
// - initialize Pub/Sub routing
//
// Those belong to the following installation/data-flow steps.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const params =
      request
        .nextUrl
        .searchParams;


    // ========================================================
    // 1. CALLBACK PARAMETERS
    // ========================================================

    const code =
      String(
        params.get(
          'code'
        )
        ||
        ''
      );


    const state =
      String(
        params.get(
          'state'
        )
        ||
        ''
      );


    const shop =
      String(
        params.get(
          'shop'
        )
        ||
        ''
      );


    const timestamp =
      String(
        params.get(
          'timestamp'
        )
        ||
        ''
      );


    // ========================================================
    // 2. ORIGINAL OAUTH COOKIES
    //
    // Created by:
    //
    // /api/integrations/shopify/install
    //
    // These bind this callback to the exact authorization
    // request initiated by Growth OS.
    // ========================================================

    const expectedState =
      request
        .cookies
        .get(
          'growthos_shopify_oauth_state'
        )
        ?.value
      ||
      '';


    const expectedShop =
      request
        .cookies
        .get(
          'growthos_shopify_oauth_shop'
        )
        ?.value
      ||
      '';


    // ========================================================
    // 3. REQUIRE AUTHORIZATION CODE
    // ========================================================

    if (!code) {

      throw new Error(
        'SHOPIFY_OAUTH_CODE_MISSING'
      );

    }


    // ========================================================
    // 4. VERIFY OAUTH STATE
    //
    // Anti-CSRF protection.
    // ========================================================

    verifyShopifyOAuthState(
      state,
      expectedState
    );


    // ========================================================
    // 5. VERIFY ORIGINAL SHOP
    //
    // Shopify must return exactly the store that initiated
    // authorization.
    // ========================================================

    const verifiedShop =
      verifyShopifyOAuthShop(
        shop,
        expectedShop
      );


    // ========================================================
    // 6. VERIFY SHOPIFY HMAC
    //
    // Proves Shopify signed the callback parameters.
    // ========================================================

    verifyShopifyOAuthHmac(
      params
    );


    // ========================================================
    // 7. VERIFY CALLBACK TIMESTAMP
    //
    // Additional replay protection.
    // ========================================================

    verifyShopifyOAuthTimestamp(
      timestamp
    );


    // ========================================================
    // 8. EXCHANGE AUTHORIZATION CODE
    //
    // Returns server-side:
    //
    // accessToken
    // refreshToken
    // scope
    // expiresIn
    // refreshTokenExpiresIn
    //
    // NEVER expose token values.
    // ========================================================

    const credential =
      await exchangeShopifyAuthorizationCode(
        verifiedShop,
        code
      );


    // ========================================================
    // 9. VERIFY CANONICAL SHOPIFY IDENTITY
    //
    // OAuth gives us the shop domain.
    //
    // Shopify Admin API independently provides:
    //
    // canonical Shop GID
    // canonical myshopify domain
    // shop name
    // ========================================================

    const canonicalShop =
      await queryCurrentShop(
        verifiedShop,
        credential.accessToken
      );


    // ========================================================
    // 10. RESOLVE OR PROVISION GROWTH OS TENANT
    //
    // Priority:
    //
    // A. Existing Shopify integration_account
    //       ↓
    //    reuse mapped workspace + brand
    //
    // B. Current Brillare legacy adoption
    //       ↓
    //    reuse existing brillare workspace + brand
    //
    // C. Brand-new Shopify installation
    //       ↓
    //    automatically provision SaaS workspace + brand
    //
    // This removes the Brillare-only dependency from normal
    // future Shopify installations.
    // ========================================================

    const tenant =
      await resolveOrProvisionShopifyTenant(
        canonicalShop
      );


    // ========================================================
    // 11. STORE SHOPIFY OFFLINE CREDENTIAL
    //
    // Google Secret Manager stores:
    //
    // access token
    // refresh token
    // scope
    // canonical Shopify identity
    // issued_at
    // access-token expiry
    // refresh-token expiry
    //
    // BigQuery receives no token material.
    // ========================================================

    const storedCredential =
      await storeShopifyOfflineCredential({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        shop:
          canonicalShop,

        credential,

      });


    // ========================================================
    // 12. READ BACK + VERIFY STORED CREDENTIAL
    //
    // Proves:
    //
    // Secret Manager secret exists
    // latest version can be read
    // schema is valid
    // access token exists
    // stored Shop GID matches
    // stored domain matches
    //
    // No token value is returned.
    // ========================================================

    const verifiedStoredCredential =
      await verifyStoredShopifyCredential({

        secretName:
          storedCredential.secretName,

        expectedShopId:
          canonicalShop.shopId,

        expectedShopDomain:
          canonicalShop.shopDomain,

      });


    // ========================================================
    // 13. REGISTER SHOPIFY IN GROWTH OS CONTROL PLANE
    //
    // Writes / upserts:
    //
    // growthos_control.integration_connections
    //
    // growthos_control.integration_accounts
    //
    // The connection stores only the Secret Manager pointer.
    // ========================================================

    const registration =
      await registerShopifyIntegration({

        tenant: {

          workspaceId:
            tenant.workspaceId,

          brandId:
            tenant.brandId,

        },

        shop:
          canonicalShop,

        secretName:
          storedCredential.secretName,

      });


    // ========================================================
    // 14. SAFE RESPONSE
    //
    // NEVER return:
    //
    // access token
    // refresh token
    // authorization code
    // OAuth state
    // HMAC
    // Shopify client secret
    // Secret Manager secret payload
    // Secret Manager secret name
    // ========================================================

    const response =
      NextResponse.json(
        {

          ok:
            true,

          step:
            'SHOPIFY_INTEGRATION_REGISTERED',

          shop: {

            id:
              canonicalShop.shopId,

            domain:
              canonicalShop.shopDomain,

            name:
              canonicalShop.shopName,

          },

          tenant: {

            workspaceId:
              tenant.workspaceId,

            workspaceName:
              tenant.workspaceName,

            workspaceSlug:
              tenant.workspaceSlug,

            brandId:
              tenant.brandId,

            brandName:
              tenant.brandName,

            brandSlug:
              tenant.brandSlug,

            currency:
              tenant.currency,

            timezone:
              tenant.timezone,

          },

          checks: {

            code:
              'EXCHANGED',

            state:
              'VERIFIED',

            oauthShop:
              'VERIFIED',

            hmac:
              'VERIFIED',

            timestamp:
              'VERIFIED',

            canonicalShop:
              'VERIFIED',

            tenant:
              'RESOLVED',

            secretStored:
              'VERIFIED',

            secretReadBack:
              'VERIFIED',

            integrationConnection:
              'REGISTERED',

            integrationAccount:
              'REGISTERED',

          },

          credential: {

            mode:
              'offline_expiring',

            scope:
              credential.scope,

            expiresIn:
              credential.expiresIn,

            refreshTokenPresent:
              Boolean(
                credential.refreshToken
              ),

            refreshTokenExpiresIn:
              credential.refreshTokenExpiresIn,

          },

          storage: {

            provider:
              'google_secret_manager',

            stored:
              true,

            readBackVerified:
              true,

            schemaVersion:
              verifiedStoredCredential
                .schemaVersion,

            credentialType:
              verifiedStoredCredential
                .credentialType,

            accessTokenExpiresAt:
              verifiedStoredCredential
                .accessTokenExpiresAt,

            refreshTokenPresent:
              verifiedStoredCredential
                .refreshTokenPresent,

            refreshTokenExpiresAt:
              verifiedStoredCredential
                .refreshTokenExpiresAt,

          },

          integration: {

            provider:
              'shopify',

            status:
              'connected',

            connectionMode:
              'oauth',

            ingestionAdapter:
              'shopify_hybrid_v1',

            connectionId:
              registration.connectionId,

            integrationAccountId:
              registration.integrationAccountId,

          },

        }
      );


    // ========================================================
    // 15. CLEAR ONE-TIME OAUTH COOKIES
    //
    // Successful OAuth state must never remain reusable.
    // ========================================================

    response.cookies.delete(
      'growthos_shopify_oauth_state'
    );


    response.cookies.delete(
      'growthos_shopify_oauth_shop'
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
    // access token
    // refresh token
    // authorization code
    // HMAC
    // OAuth state
    // Shopify client secret
    // Secret Manager payload
    // ========================================================

    const message =
      String(
        error?.message
        ||
        'Unknown Shopify installation error'
      );


    console.error(
      'SHOPIFY_OAUTH_CALLBACK_ERROR',
      {
        message,
      }
    );


    let status =
      400;


    // ========================================================
    // SECURITY VALIDATION FAILURE
    // ========================================================

    if (
      message.includes(
        'STATE'
      )
      ||
      message.includes(
        'HMAC'
      )
      ||
      message.includes(
        'SHOP_MISMATCH'
      )
    ) {

      status =
        403;

    }


    // ========================================================
    // SHOPIFY TOKEN ENDPOINT FAILURE
    // ========================================================

    if (
      message.includes(
        'TOKEN_EXCHANGE'
      )
      ||
      message.includes(
        'REFRESH'
      )
    ) {

      status =
        502;

    }


    // ========================================================
    // SHOPIFY ADMIN API FAILURE
    // ========================================================

    if (
      message.includes(
        'Shopify Admin API'
      )
      ||
      message.includes(
        'Shopify GraphQL'
      )
    ) {

      status =
        502;

    }


    // ========================================================
    // SECRET MANAGER FAILURE
    // ========================================================

    if (
      message.includes(
        'Secret Manager'
      )
      ||
      message.includes(
        'SHOPIFY_CREDENTIAL'
      )
      ||
      message.includes(
        'SHOPIFY_STORED'
      )
      ||
      message.includes(
        'Integration credential'
      )
    ) {

      status =
        500;

    }


    // ========================================================
    // TENANT PROVISIONING FAILURE
    // ========================================================

    if (
      message.includes(
        'TENANT'
      )
      ||
      message.includes(
        'tenant'
      )
      ||
      message.includes(
        'Growth OS tenant'
      )
    ) {

      status =
        500;

    }


    // ========================================================
    // INTEGRATION CONTROL-PLANE FAILURE
    // ========================================================

    if (
      message.includes(
        'integration'
      )
      ||
      message.includes(
        'Integration'
      )
    ) {

      status =
        500;

    }


    return NextResponse.json(
      {

        ok:
          false,

        step:
          'SHOPIFY_INSTALLATION_CALLBACK',

        error:
          message,

      },
      {
        status,
      }
    );

  }

}