import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  inspectShopifyInitialOrdersHistory,
} from '@/lib/integrations/providers/shopify-history-bootstrap';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY INITIAL HISTORY INSPECTION
//
// READ ONLY.
//
// This endpoint:
//
// - resolves authenticated Growth OS tenant
// - inspects Shopify earliest Order
// - inspects Growth OS earliest stored Order
// - checks existing covering backfill
// - returns the bootstrap decision
//
// IMPORTANT:
//
// It does NOT create a backfill.
// It does NOT publish Pub/Sub.
// It does NOT mutate backfill state.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const connectionId =
      String(
        body?.connectionId
        ||
        ''
      ).trim();


    if (!connectionId) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_HISTORY_CONNECTION_ID_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


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
    // READ-ONLY INSPECTION
    // ========================================================

    const result =
      await inspectShopifyInitialOrdersHistory({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId,

      });


    return NextResponse.json({

      ok:
        true,

      step:
        'SHOPIFY_INITIAL_HISTORY_INSPECTED',

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
        'Shopify history inspection failed'
      );


    console.error(
      'SHOPIFY_HISTORY_BOOTSTRAP_INSPECT_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_HISTORY_BOOTSTRAP_INSPECT_FAILED',

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