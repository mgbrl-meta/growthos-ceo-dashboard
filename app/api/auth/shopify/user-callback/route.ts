import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  verifyShopifyOAuthHmac,
  verifyShopifyOAuthShop,
  verifyShopifyOAuthState,
  verifyShopifyOAuthTimestamp,
} from '@/lib/integrations/providers/shopify-oauth';

import {
  exchangeShopifyUserAuthorizationCode,
} from '@/lib/auth/shopify-user-access';

import {
  getShopifyIntegrationAccountByDomain,
} from '@/lib/integrations/store';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import {
  getActiveBrandMembershipFast,
  getGrowthOSUserByEmail,
  touchGrowthOSUserLogin,
} from '@/lib/auth/user-store';

import {
  setGrowthOsSessionCookie,
} from '@/lib/auth/session';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// APP URL
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
// METADATA NORMALIZER
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
// CLEAR ONE-TIME USER OAUTH COOKIES
// ============================================================

function clearShopifyUserOAuthCookies(
  response: NextResponse
) {

  response.cookies.delete(
    'growthos_shopify_user_oauth_state'
  );

  response.cookies.delete(
    'growthos_shopify_user_oauth_shop'
  );


  return response;

}


// ============================================================
// SHOPIFY HUMAN AUTH CALLBACK
//
// Shopify online OAuth
//      ↓
// associated_user
//      ↓
// verified email
//      ↓
// Growth OS users
//      ↓
// CURRENT brand membership
//      ↓
// real usr_* Growth OS Shopify session
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const params =
      request
        .nextUrl
        .searchParams;


    const code =
      String(
        params.get(
          'code'
        )
        ||
        ''
      ).trim();


    const state =
      String(
        params.get(
          'state'
        )
        ||
        ''
      ).trim();


    const shop =
      String(
        params.get(
          'shop'
        )
        ||
        ''
      ).trim();


    const timestamp =
      String(
        params.get(
          'timestamp'
        )
        ||
        ''
      ).trim();


    const expectedState =
      request
        .cookies
        .get(
          'growthos_shopify_user_oauth_state'
        )
        ?.value
      ||
      '';


    const expectedShop =
      request
        .cookies
        .get(
          'growthos_shopify_user_oauth_shop'
        )
        ?.value
      ||
      '';


    // ========================================================
    // VERIFY THIS EXACT USER AUTHORIZATION FLOW
    // ========================================================

    verifyShopifyOAuthState(
      state,
      expectedState
    );


    const verifiedShop =
      verifyShopifyOAuthShop(
        shop,
        expectedShop
      );


    verifyShopifyOAuthHmac(
      params
    );


    verifyShopifyOAuthTimestamp(
      timestamp
    );


    // ========================================================
    // SHOPIFY HUMAN IDENTITY
    // ========================================================

    const shopifyHuman =
      await exchangeShopifyUserAuthorizationCode(
        verifiedShop,
        code
      );


    // ========================================================
    // STORE → GROWTH OS TENANT
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        verifiedShop
      );


    if (!account) {

      throw new Error(
        'SHOPIFY_USER_INTEGRATION_ACCOUNT_NOT_FOUND'
      );

    }


    const connectionId =
      String(
        account.connection_id
        ||
        ''
      ).trim();


    const workspaceId =
      String(
        account.workspace_id
        ||
        ''
      ).trim();


    const brandId =
      String(
        account.brand_id
        ||
        ''
      ).trim();


    if (!connectionId) {

      throw new Error(
        'SHOPIFY_USER_CONNECTION_ID_MISSING'
      );

    }


    if (
      !workspaceId
      ||
      !brandId
    ) {

      throw new Error(
        'SHOPIFY_USER_TENANT_IDENTITY_MISSING'
      );

    }


    const tenant =
      await resolveTenantContextById(
        workspaceId,
        brandId
      );


    // ========================================================
    // CONNECTOR MUST STILL BE ACTIVE
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


    if (
      installationStatus ===
        'uninstalled'
    ) {

      throw new Error(
        'SHOPIFY_USER_INSTALLATION_INACTIVE'
      );

    }


    // ========================================================
    // SHOPIFY EMAIL → GROWTH OS USER
    //
    // Shopify proves the HUMAN email.
    //
    // Growth OS decides whether that human is allowed.
    // ========================================================

    const user =
      await getGrowthOSUserByEmail(
        shopifyHuman.email
      );


    if (
      !user
      ||
      user.status !==
        'active'
    ) {

      throw new Error(
        'SHOPIFY_USER_ACCESS_NOT_GRANTED'
      );

    }


    // ========================================================
    // EXACT BRAND MEMBERSHIP
    //
    // A user who belongs to another Growth OS brand must NOT
    // gain access merely because they can open this Shopify app.
    // ========================================================

    const membership =
      await getActiveBrandMembershipFast(

        user.user_id,

        tenant.workspaceId,

        tenant.brandId

      );


    if (!membership) {

      throw new Error(
        'SHOPIFY_USER_BRAND_ACCESS_NOT_GRANTED'
      );

    }


    // ========================================================
    // CREATE REAL HUMAN SHOPIFY SESSION
    //
    // This is the important difference:
    //
    // OLD:
    //
    // shopify:gid://shopify/Shop/...
    //
    // NEW:
    //
    // usr_...
    //
    // request-auth.ts will therefore resolve this as:
    //
    // principalType = human
    // role = LIVE membership role
    // ========================================================

    await setGrowthOsSessionCookie({

      userId:
        user.user_id,

      email:
        user.email,

      workspaceId:
        membership.workspace_id,

      brandId:
        membership.brand_id,

      role:
        membership.role,

      authMethod:
        'shopify',

      authSource:
        'public',

    });


    // ========================================================
    // LAST LOGIN
    //
    // Non-critical.
    // ========================================================

    try {

      await touchGrowthOSUserLogin(
        user.user_id
      );

    } catch (
      error
    ) {

      console.error(
        'SHOPIFY_USER_LAST_LOGIN_UPDATE_FAILED',
        {
          userId:
            user.user_id,
        }
      );

    }


    // ========================================================
    // SETUP ROUTING
    //
    // Human authorization happens BEFORE setup access.
    // ========================================================

    const setupStatus =
      String(
        metadata.setup_status
        ||
        ''
      )
        .trim()
        .toLowerCase();


    if (
      setupStatus !==
        'ready'
    ) {

      const setupUrl =
        new URL(
          '/integrations/setup',
          getGrowthOSAppUrl()
        );


      setupUrl.searchParams.set(
        'connectionId',
        connectionId
      );


      return clearShopifyUserOAuthCookies(
        NextResponse.redirect(
          setupUrl
        )
      );

    }


    return clearShopifyUserOAuthCookies(
      NextResponse.redirect(
        `${getGrowthOSAppUrl()}/`
      )
    );


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify user authentication failed'
      );


    console.error(
      'SHOPIFY_USER_AUTH_CALLBACK_ERROR',
      {
        message,
      }
    );


    let status =
      400;


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
      ||
      message.includes(
        'EMAIL_NOT_VERIFIED'
      )
      ||
      message.includes(
        'ACCESS_NOT_GRANTED'
      )
      ||
      message.includes(
        'INSTALLATION_INACTIVE'
      )
    ) {

      status =
        403;

    }


    if (
      message.includes(
        'TOKEN_EXCHANGE'
      )
    ) {

      status =
        502;

    }


    if (
      message.includes(
        'TENANT_IDENTITY'
      )
      ||
      message.includes(
        'CONNECTION_ID'
      )
      ||
      message.includes(
        'INTEGRATION_ACCOUNT'
      )
    ) {

      status =
        500;

    }


    return clearShopifyUserOAuthCookies(
      NextResponse.json(
        {

          ok:
            false,

          authenticated:
            false,

          step:
            'SHOPIFY_USER_AUTH',

          error:
            message,

        },
        {
          status,
        }
      )
    );

  }

}