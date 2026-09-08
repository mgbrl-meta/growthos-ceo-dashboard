import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  bootstrapShopifyOrdersWebhooks,
} from '@/lib/integrations/providers/shopify-webhook-bootstrap';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY ORDERS WEBHOOK BOOTSTRAP
//
// Authenticated tenant only.
//
// Creates / reuses / repairs:
//
// ORDERS_CREATE
// ORDERS_UPDATED
//
// Idempotent.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // AUTHENTICATED TENANT
    // ========================================================

    const {
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // CURRENT PRODUCTION ORIGIN
    // ========================================================

    const origin =
      request
        .nextUrl
        .origin;


    // ========================================================
    // BOOTSTRAP
    // ========================================================

    const result =
      await bootstrapShopifyOrdersWebhooks({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        origin,

      });


    return NextResponse.json({

      ok:
        true,

      step:
        'SHOPIFY_ORDERS_WEBHOOKS_BOOTSTRAPPED',

      data:
        result,

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify Orders webhook bootstrap failed'
      );


    console.error(
      'SHOPIFY_ORDERS_WEBHOOK_BOOTSTRAP_ERROR',
      {

        message,

      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_ORDERS_WEBHOOK_BOOTSTRAP_FAILED',

        message:
          process.env.NODE_ENV ===
            'development'
            ?
              message
            :
              undefined,

      },
      {

        status:
          500,

      }
    );

  }

}