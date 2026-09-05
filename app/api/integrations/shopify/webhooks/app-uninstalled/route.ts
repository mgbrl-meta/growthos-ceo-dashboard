import {
  NextRequest,
  NextResponse,
} from 'next/server';

import crypto from 'crypto';

import {
  getShopifyClientSecret,
  normalizeShopDomain,
} from '@/lib/auth/config';

import {
  markShopifyInstallationUninstalled,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// VERIFY SHOPIFY WEBHOOK HMAC
//
// Shopify webhook HMAC:
//
// HMAC-SHA256(
//   exact raw request body,
//   Shopify client secret
// )
//
// Result is Base64 encoded.
// ============================================================

function verifyWebhookHmac(
  rawBody: string,
  receivedHmac: string
) {

  if (
    !rawBody
    ||
    !receivedHmac
  ) {

    return false;

  }


  const calculated =
    crypto
      .createHmac(
        'sha256',
        getShopifyClientSecret()
      )
      .update(
        rawBody,
        'utf8'
      )
      .digest(
        'base64'
      );


  const left =
    Buffer.from(
      calculated,
      'utf8'
    );


  const right =
    Buffer.from(
      receivedHmac,
      'utf8'
    );


  if (
    left.length !==
    right.length
  ) {

    return false;

  }


  return crypto.timingSafeEqual(
    left,
    right
  );

}


// ============================================================
// APP UNINSTALLED
//
// Shopify
//      ↓
// app/uninstalled
//      ↓
// verify HMAC
//      ↓
// shop domain
//      ↓
// preserve Growth OS tenant/history
//      ↓
// connection = disconnected
// installation_status = uninstalled
// setup_status = required
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // RAW BODY
    //
    // Must be read BEFORE JSON parsing because Shopify HMAC
    // covers the exact raw request payload.
    // ========================================================

    const rawBody =
      await request.text();


    const receivedHmac =
      String(
        request.headers.get(
          'x-shopify-hmac-sha256'
        )
        ||
        ''
      );


    if (
      !verifyWebhookHmac(
        rawBody,
        receivedHmac
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'SHOPIFY_WEBHOOK_HMAC_INVALID',
        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // VERIFIED SHOP DOMAIN
    // ========================================================

    const shopDomain =
      normalizeShopDomain(
        String(
          request.headers.get(
            'x-shopify-shop-domain'
          )
          ||
          ''
        )
      );


    if (
      !shopDomain
      ||
      !shopDomain.endsWith(
        '.myshopify.com'
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'SHOPIFY_WEBHOOK_SHOP_INVALID',
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // STATE TRANSITION
    // ========================================================

    const result =
      await markShopifyInstallationUninstalled(
        shopDomain
      );


    // ========================================================
    // ACKNOWLEDGE
    //
    // Do not expose credentials or internal secret pointers.
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      handled:
        result.found,

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify uninstall webhook failed'
      );


    console.error(
      'SHOPIFY_APP_UNINSTALLED_WEBHOOK_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'SHOPIFY_APP_UNINSTALLED_WEBHOOK_FAILED',
      },
      {
        status:
          500,
      }
    );

  }

}