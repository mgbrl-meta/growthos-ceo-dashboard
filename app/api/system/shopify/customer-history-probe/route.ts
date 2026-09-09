import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  getIntegrationConnection,
} from '@/lib/integrations/store';

import {
  inspectShopifyInitialCustomersHistory,
} from '@/lib/integrations/providers/shopify-history-bootstrap';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY CUSTOMER HISTORY PROBE
//
// READ ONLY.
//
// Authenticated Growth OS tenant
//        ↓
// Shopify connection
//        ↓
// Customer source boundary
//        ↓
// Customer warehouse coverage
//        ↓
// covering Customer backfill
//        ↓
// bootstrap decision
//
// IMPORTANT:
//
// This endpoint DOES NOT:
//
// - create a Customer backfill
// - publish Pub/Sub
// - mutate backfill state
// - write Customer warehouse data
//
// It is only the verification gate before automatic
// installation bootstrap is enabled.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATED TENANT
    // ========================================================

    const {
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 2. SHOPIFY CONNECTION
    // ========================================================

    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        'shopify'

      );


    if (!connection) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_CUSTOMER_HISTORY_CONNECTION_NOT_FOUND',

        },
        {
          status:
            404,
        }
      );

    }


    if (
      connection.status !==
        'connected'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_CUSTOMER_HISTORY_CONNECTION_NOT_CONNECTED',

          connectionStatus:
            connection.status,

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 3. READ-ONLY CUSTOMER HISTORY INSPECTION
    // ========================================================

    const result =
      await inspectShopifyInitialCustomersHistory({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId:
          connection.connection_id,

      });


    // ========================================================
    // 4. SAFE RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      step:
        'SHOPIFY_INITIAL_CUSTOMERS_HISTORY_INSPECTED',

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
        'Shopify Customer history inspection failed'
      );


    console.error(
      'SHOPIFY_CUSTOMER_HISTORY_PROBE_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_CUSTOMER_HISTORY_PROBE_FAILED',

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