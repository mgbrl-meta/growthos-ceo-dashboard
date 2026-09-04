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

import {
  setGrowthOsSessionCookie,
} from '@/lib/auth/session';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY INSTALLATION / OAUTH CALLBACK
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
//        ↓
// Growth OS Shopify session
//        ↓
// generic connector setup router
//
// RESULT:
//
// Successful Shopify installation never shows raw JSON.
//
// It redirects to:
//
// /integrations/setup?connectionId=...
//
// That page reads the stored provider and renders the correct
// provider-specific setup experience.
//
// Shopify:
//   App Embed / Cart Bridge instructions
//
// Custom Website:
//   JS installation / verification
//
// Future:
//   Meta / Google / other connector setup
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
    // These bind this callback to the exact OAuth request
    // initiated by Growth OS.
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
    // Shopify must return exactly the same store that
    // initiated authorization.
    // ========================================================

    const verifiedShop =
      verifyShopifyOAuthShop(
        shop,
        expectedShop
      );


    // ========================================================
    // 6. VERIFY SHOPIFY HMAC
    //
    // Proves the callback parameters were signed by Shopify.
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
    // B. Current legacy adoption if still required
    //       ↓
    //    reuse existing workspace + brand
    //
    // C. Brand-new Shopify installation
    //       ↓
    //    automatically provision SaaS workspace + brand
    // ========================================================

    const tenant =
      await resolveOrProvisionShopifyTenant(
        canonicalShop
      );


    // ========================================================
    // 11. STORE SHOPIFY OFFLINE CREDENTIAL
    //
    // Secret Manager stores:
    //
    // access token
    // refresh token
    // scope
    // canonical Shopify identity
    // issued_at
    // expiry metadata
    //
    // BigQuery receives only the Secret Manager pointer.
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
    // 12. READ-BACK + VERIFY STORED CREDENTIAL
    //
    // Proves:
    //
    // Secret Manager secret exists
    // latest version is readable
    // access token exists
    // Shop GID matches
    // shop domain matches
    //
    // We intentionally do not retain the verification result
    // because merchant-facing diagnostic JSON is no longer
    // returned.
    // ========================================================

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
    // 14. CREATE GROWTH OS SHOPIFY SESSION
    //
    // Shopify installation is now complete.
    //
    // The verified Shopify store determines:
    //
    // workspace
    // brand
    //
    // No Growth OS email/password is required.
    // ========================================================

    await setGrowthOsSessionCookie({

      userId:
        `shopify:${canonicalShop.shopId}`,

      workspaceId:
        tenant.workspaceId,

      brandId:
        tenant.brandId,

      role:
        'admin',

      authMethod:
        'shopify',

      authSource:
        'public',

    });


    // ========================================================
    // 15. GENERIC CONNECTOR SETUP ROUTER
    //
    // IMPORTANT:
    //
    // The Shopify callback does NOT render Shopify-specific UI.
    //
    // It sends only the connection identity.
    //
    // /integrations/setup
    //        ↓
    // integration_connections
    //        ↓
    // provider
    //        ↓
    // ShopifySetup
    // CustomWebSetup
    // MetaSetup
    // GoogleSetup
    // future connectors
    // ========================================================

    const setupUrl =
      new URL(
        '/integrations/setup',
        request.nextUrl.origin
      );


    setupUrl.searchParams.set(
      'connectionId',
      registration.connectionId
    );


    const response =
      NextResponse.redirect(
        setupUrl
      );


    // ========================================================
    // 16. CLEAR ONE-TIME AUTH COOKIES
    //
    // These must not remain reusable after successful OAuth.
    // ========================================================

    response.cookies.delete(
      'growthos_shopify_oauth_state'
    );


    response.cookies.delete(
      'growthos_shopify_oauth_shop'
    );


    response.cookies.delete(
      'growthos_shopify_launch_flow'
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


    // ========================================================
    // ERROR RESPONSE
    //
    // Engineering failures may return JSON.
    //
    // Successful merchant installations never do.
    // ========================================================

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