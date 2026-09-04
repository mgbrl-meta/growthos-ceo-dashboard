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
  setGrowthOsSessionCookie,
} from '@/lib/auth/session';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// METADATA
// ============================================================

function normalizeMetadata(
  value: unknown
):

  Record<
    string,
    any
  > {

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
      Record<
        string,
        any
      >;

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
      ) {

        return parsed;

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
// verified shop
//       ↓
// integration account lookup
//
// UNKNOWN SHOP:
//       ↓
// Shopify OAuth installation
//
// EXISTING SHOP + SETUP REQUIRED:
//       ↓
// connector setup page
//
// EXISTING SHOP + SETUP READY:
//       ↓
// Growth OS dashboard
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
    // 1. SHOPIFY PARAMETERS
    // ========================================================

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
    // 3. SHOP → GROWTH OS ACCOUNT
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        verifiedShop
      );


    // ========================================================
    // 4. UNKNOWN SHOP
    //
    // Send through canonical OAuth installation.
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
    // 5. CANONICAL TENANT
    // ========================================================

    const tenant =
      await resolveTenantContextById(

        account.workspace_id,

        account.brand_id

      );


    // ========================================================
    // 6. CREATE GROWTH OS SHOPIFY SESSION
    // ========================================================

    await setGrowthOsSessionCookie({

      userId:
        `shopify:${account.provider_account_id}`,

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
    // 7. CONNECTOR SETUP STATE
    //
    // Legacy existing installations have no setup_status.
    //
    // IMPORTANT:
    //
    // Missing status is treated as READY so Brillare and other
    // established connections are not suddenly forced through
    // onboarding.
    //
    // New installations explicitly receive:
    //
    // setup_status = required
    // ========================================================

    const metadata =
      normalizeMetadata(
        account.metadata
      );


    const setupStatus =
      String(
        metadata.setup_status
        ||
        ''
      )
        .trim()
        .toLowerCase();


    // ========================================================
    // 8. NEW INSTALL — SETUP REQUIRED
    // ========================================================

    if (
      setupStatus ===
      'required'
    ) {

      const setupUrl =
        new URL(
          '/integrations/setup',
          getGrowthOSAppUrl()
        );


      setupUrl.searchParams.set(
        'connectionId',
        account.connection_id
      );


      return NextResponse.redirect(
        setupUrl
      );

    }


    // ========================================================
    // 9. NORMAL EXISTING STORE
    //
    // setup_status = ready
    //
    // OR
    //
    // legacy account with no setup_status.
    // ========================================================

    return NextResponse.redirect(
      `${getGrowthOSAppUrl()}/`
    );


  } catch (
    error: any
  ) {

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


    return NextResponse.json(
      {

        ok:
          false,

        authenticated:
          false,

        error:
          message,

      },
      {
        status:
          403,
      }
    );

  }

}