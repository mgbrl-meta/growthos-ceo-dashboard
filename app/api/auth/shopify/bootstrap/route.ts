import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveShopifyInstallationBootstrap,
} from '@/lib/auth/shopify';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY INSTALLATION AUTH BOOTSTRAP
//
// STEP 1C ONLY.
//
// Shopify App Bridge
//        ↓
// ID token
//        ↓
// verify Shopify identity
//        ↓
// obtain expiring offline Admin credential
//        ↓
// query canonical Shopify shop
//
// NO credential persistence here.
// NO tenant creation here.
// NO connection creation here.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const authorization =
      request.headers.get(
        'authorization'
      );


    if (
      !authorization
      ||
      !authorization
        .toLowerCase()
        .startsWith(
          'bearer '
        )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Missing Shopify ID token',

        },
        {
          status:
            401,
        }
      );

    }


    const idToken =
      authorization
        .slice(
          7
        )
        .trim();


    if (!idToken) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Missing Shopify ID token',

        },
        {
          status:
            401,
        }
      );

    }


    const installation =
      await resolveShopifyInstallationBootstrap(
        idToken
      );


    // ========================================================
    // NEVER EXPOSE TOKENS
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        shop: {

          id:
            installation.shop.shopId,

          domain:
            installation.shop.shopDomain,

          name:
            installation.shop.shopName,

        },

        credential: {

          mode:
            'offline_expiring',

          scope:
            installation.credential.scope,

          expiresIn:
            installation.credential.expiresIn,

          refreshTokenPresent:
            Boolean(
              installation
                .credential
                .refreshToken
            ),

          refreshTokenExpiresIn:
            installation
              .credential
              .refreshTokenExpiresIn,

        },

        step:
          'SHOPIFY_INSTALL_AUTH_VERIFIED',

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'SHOPIFY_INSTALL_BOOTSTRAP_ERROR',
      error
    );


    const message =
      error?.message
      ||
      'Shopify installation authentication failed';


    if (
      message ===
      'SHOPIFY_INVALID_ID_TOKEN'
    ) {

      const response =
        NextResponse.json(
          {

            ok:
              false,

            error:
              'Shopify ID token expired or invalid',

          },
          {
            status:
              401,
          }
        );


      response.headers.set(
        'X-Shopify-Retry-Invalid-Session-Request',
        '1'
      );


      return response;

    }


    return NextResponse.json(
      {

        ok:
          false,

        error:
          message,

      },
      {
        status:
          500,
      }
    );

  }

}