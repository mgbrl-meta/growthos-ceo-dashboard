import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  validateShopifyOAuthShop,
  verifyShopifyOAuthHmac,
  verifyShopifyOAuthTimestamp,
} from '@/lib/integrations/providers/shopify-oauth';

import {
  getShopifyIntegrationAccountByDomain,
} from '@/lib/integrations/store';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import {
  buildShopifyUserAuthorizationUrl,
  generateShopifyUserOAuthState,
} from '@/lib/auth/shopify-user-access';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// METADATA NORMALIZER
//
// BigQuery JSON may arrive as:
//
// - object
// - serialized JSON string
//
// Normalize both into one safe object.
// ============================================================

function normalizeMetadata(
  value: unknown
):
  Record<string, any> {

  if (
    value
    &&
    typeof value ===
      'object'
    &&
    !Array.isArray(
      value
    )
  ) {

    return value as
      Record<string, any>;

  }


  if (
    typeof value ===
      'string'
  ) {

    try {

      const parsed =
        JSON.parse(
          value
        );


      if (
        parsed
        &&
        typeof parsed ===
          'object'
        &&
        !Array.isArray(
          parsed
        )
      ) {

        return parsed as
          Record<string, any>;

      }

    } catch {

      // Ignore invalid compatibility metadata.

    }

  }


  return {};

}


// ============================================================
// GROWTH OS APP URL
// ============================================================

function getGrowthOSAppUrl() {

  return String(
    process.env.GROWTHOS_APP_URL
    ||
    'http://localhost:3000'
  )
    .trim()
    .replace(
      /\/+$/,
      ''
    );

}


// ============================================================
// SHOPIFY STANDALONE APP LAUNCH
//
// Shopify Admin
//       ↓
// signed Shopify launch
//       ↓
// verify HMAC
// verify timestamp
// verify shop domain
//       ↓
// integration account lookup
//
// UNKNOWN SHOP
//       ↓
// Shopify installation OAuth
//
// EXISTING + UNINSTALLED
//       ↓
// Shopify reinstallation OAuth
//
// EXISTING ACTIVE INSTALLATION
//       ↓
// Shopify PER-USER OAuth
//       ↓
// Shopify associated_user
//       ↓
// Growth OS usr_*
//       ↓
// active workspace/brand membership
//       ↓
// actual Growth OS role
//
// IMPORTANT:
//
// A signed Shopify launch proves the STORE.
//
// It does NOT prove that the current actor is an authorized
// Growth OS human.
//
// Therefore this route never creates a synthetic Shopify
// browser session.
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
    // 1. SHOPIFY LAUNCH PARAMETERS
    // ========================================================

    const shop =
      String(
        params.get(
          'shop'
        )
        ||
        ''
      )
        .trim();


    const timestamp =
      String(
        params.get(
          'timestamp'
        )
        ||
        ''
      )
        .trim();


    if (!shop) {

      throw new Error(
        'SHOPIFY_LAUNCH_SHOP_MISSING'
      );

    }


    // ========================================================
    // 2. VERIFY SHOPIFY-SIGNED LAUNCH
    // ========================================================

    verifyShopifyOAuthHmac(
      params
    );


    verifyShopifyOAuthTimestamp(
      timestamp
    );


    const verifiedShop =
      validateShopifyOAuthShop(
        shop
      );


    // ========================================================
    // 3. RESOLVE SHOPIFY STORE IN GROWTH OS
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        verifiedShop
      );


    // ========================================================
    // 4. UNKNOWN STORE -> INSTALL
    // ========================================================

    if (!account) {

      const installUrl =
        new URL(
          '/api/integrations/shopify/install',
          getGrowthOSAppUrl()
        );


      installUrl.searchParams.set(
        'shop',
        verifiedShop
      );


      const response =
        NextResponse.redirect(
          installUrl
        );


      response.cookies.set(

        'growthos_shopify_launch_flow',

        '1',

        {

          httpOnly:
            true,

          secure:
            process.env.NODE_ENV ===
            'production',

          sameSite:
            'lax',

          path:
            '/',

          maxAge:
            10 * 60,

        }

      );


      return response;

    }


    // ========================================================
    // 5. VALIDATE EXISTING ACCOUNT MAPPING
    // ========================================================

    const connectionId =
      String(
        account.connection_id
        ||
        ''
      )
        .trim();


    const workspaceId =
      String(
        account.workspace_id
        ||
        ''
      )
        .trim();


    const brandId =
      String(
        account.brand_id
        ||
        ''
      )
        .trim();


    if (!connectionId) {

      throw new Error(
        'SHOPIFY_LAUNCH_CONNECTION_ID_MISSING'
      );

    }


    if (
      !workspaceId
      ||
      !brandId
    ) {

      throw new Error(
        'SHOPIFY_LAUNCH_TENANT_IDENTITY_MISSING'
      );

    }


    // ========================================================
    // 6. VERIFY CANONICAL GROWTH OS TENANT EXISTS
    //
    // We intentionally do NOT create a user session here.
    // ========================================================

    await resolveTenantContextById(
      workspaceId,
      brandId
    );


    // ========================================================
    // 7. CONNECTOR LIFECYCLE STATE
    // ========================================================

    const metadata =
      normalizeMetadata(
        account.metadata
      );


    const installationStatus =
      String(
        metadata.installation_status
        ||
        ''
      )
        .trim()
        .toLowerCase();


    // ========================================================
    // 8. UNINSTALLED -> REAUTHORIZE STORE
    // ========================================================

    if (
      installationStatus ===
        'uninstalled'
    ) {

      const installUrl =
        new URL(
          '/api/integrations/shopify/install',
          getGrowthOSAppUrl()
        );


      installUrl.searchParams.set(
        'shop',
        verifiedShop
      );


      const response =
        NextResponse.redirect(
          installUrl
        );


      response.cookies.set(

        'growthos_shopify_launch_flow',

        '1',

        {

          httpOnly:
            true,

          secure:
            process.env.NODE_ENV ===
            'production',

          sameSite:
            'lax',

          path:
            '/',

          maxAge:
            10 * 60,

        }

      );


      return response;

    }


    // ========================================================
    // 9. REQUIRE SHOPIFY HUMAN IDENTITY
    //
    // Store identity is now proven.
    //
    // Next prove WHICH Shopify staff member is opening
    // Growth OS.
    //
    // grant_options[]=per-user
    //        ↓
    // associated_user
    //        ↓
    // verified email
    //        ↓
    // Growth OS user + membership
    // ========================================================

    const userOAuthState =
      generateShopifyUserOAuthState();


    const userAuthorizationUrl =
      buildShopifyUserAuthorizationUrl(
        verifiedShop,
        userOAuthState
      );


    const response =
      NextResponse.redirect(
        userAuthorizationUrl
      );


    const oauthCookieOptions = {

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
          'production',

      sameSite:
        'lax' as const,

      path:
        '/',

      maxAge:
        10 * 60,

    };


    response.cookies.set(

      'growthos_shopify_user_oauth_state',

      userOAuthState,

      oauthCookieOptions

    );


    response.cookies.set(

      'growthos_shopify_user_oauth_shop',

      verifiedShop,

      oauthCookieOptions

    );


    return response;


  } catch (
    error: any
  ) {

    // ========================================================
    // SAFE ERROR HANDLING
    //
    // Never log:
    //
    // access token
    // refresh token
    // Shopify secret
    // OAuth state
    // HMAC
    // ========================================================

    const message =
      String(
        error?.message
        ||
        'Shopify app launch authentication failed'
      );


    console.error(
      'SHOPIFY_APP_LAUNCH_ERROR',
      {
        message,
      }
    );


    let status =
      403;


    if (
      message.includes(
        'CONNECTION_ID_MISSING'
      )
      ||
      message.includes(
        'TENANT_IDENTITY_MISSING'
      )
    ) {

      status =
        500;

    }


    return NextResponse.json(
      {

        ok:
          false,

        authenticated:
          false,

        step:
          'SHOPIFY_APP_LAUNCH',

        error:
          message,

      },
      {
        status,
      }
    );

  }

}