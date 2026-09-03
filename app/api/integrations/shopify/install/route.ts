import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  buildShopifyAuthorizationUrl,
  generateShopifyOAuthState,
  validateShopifyOAuthShop,
} from '@/lib/integrations/providers/shopify-oauth';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY INSTALL
//
// GET /api/integrations/shopify/install?shop=xxx.myshopify.com
//
// STEP 1C.1:
//
// 1. Validate Shopify domain
// 2. Generate anti-CSRF state
// 3. Bind state to shop in HttpOnly cookies
// 4. Redirect merchant to Shopify authorization
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const shopParam =
      request
        .nextUrl
        .searchParams
        .get(
          'shop'
        );


    if (!shopParam) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Missing Shopify shop parameter',

        },
        {
          status:
            400,
        }
      );

    }


    const shop =
      validateShopifyOAuthShop(
        shopParam
      );


    const state =
      generateShopifyOAuthState();


    const authorizationUrl =
      buildShopifyAuthorizationUrl(

        shop,

        state

      );


    const response =
      NextResponse.redirect(
        authorizationUrl
      );


    const cookieOptions = {

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


    // ========================================================
    // ANTI-CSRF STATE
    // ========================================================

    response.cookies.set(
      'growthos_shopify_oauth_state',
      state,
      cookieOptions
    );


    // ========================================================
    // BIND OAUTH REQUEST TO ORIGINAL SHOP
    //
    // We will verify this again in callback.
    // ========================================================

    response.cookies.set(
      'growthos_shopify_oauth_shop',
      shop,
      cookieOptions
    );


    return response;


  } catch (
    error: any
  ) {

    console.error(
      'SHOPIFY_INSTALL_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Unable to start Shopify authorization',

      },
      {
        status:
          400,
      }
    );

  }

}