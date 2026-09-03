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
// SHOPIFY STANDALONE APP LAUNCH
//
// Shopify Admin
//       ↓
// merchant clicks Growth OS
//       ↓
// Shopify signed launch request
//       ↓
// verify HMAC + timestamp + shop
//       ↓
// locate existing Growth OS integration
//       ↓
// workspace + brand
//       ↓
// Growth OS session
//       ↓
// dashboard
//
// If the shop has never been registered:
//
// redirect into existing Shopify OAuth installation flow.
//
// IMPORTANT:
//
// This is for the NON-EMBEDDED Growth OS application.
//
// It intentionally does NOT use App Bridge or Shopify ID
// tokens.
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
    // 2. VERIFY SIGNED SHOPIFY LAUNCH
    //
    // Never trust ?shop= merely because it appears in the URL.
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
    // 3. FIND EXISTING SHOP → GROWTH OS MAPPING
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        verifiedShop
      );


    // ========================================================
    // 4. NEW / UNREGISTERED SHOP
    //
    // Reuse our already-working authorization-code flow.
    //
    // Before redirecting, mark this as an app-launch flow so
    // callback can eventually return directly to dashboard.
    // ========================================================

    if (!account) {

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


      const installUrl =
        new URL(
          '/api/integrations/shopify/install',
          appUrl
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
    // 5. RESOLVE CANONICAL GROWTH OS TENANT
    // ========================================================

    const tenant =
      await resolveTenantContextById(

        account.workspace_id,

        account.brand_id

      );


    // ========================================================
    // 6. CREATE SHOPIFY-AUTHENTICATED GROWTH OS SESSION
    //
    // For standalone Shopify entry, Shopify authenticates the
    // merchant/store before launching the app.
    //
    // Brand access therefore comes from the verified Shopify
    // installation, not from email/password.
    //
    // Later we can map individual Shopify staff identities if
    // we need staff-level roles.
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
    // 7. DASHBOARD
    // ========================================================

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


    return NextResponse.redirect(
      `${appUrl}/`
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