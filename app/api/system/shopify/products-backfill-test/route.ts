import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  getIntegrationConnection,
  getSelectedIntegrationAccount,
} from '@/lib/integrations/store';

import {
  createShopifyProductsBackfill,
} from '@/lib/integrations/providers/shopify-backfill';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY PRODUCTS BACKFILL TEST
//
// POST
// /api/system/shopify/products-backfill-test
//
// Body:
//
// {
//   "from": "...",
//   "to": "..."
// }
//
// Creates:
//
// Product backfill run
//        ↓
// Product backfill windows
//
// IMPORTANT:
//
// This endpoint ONLY creates the persisted historical plan.
//
// It does NOT dispatch the run.
//
// Controlled execution happens separately through:
//
// /api/system/shopify/backfill-orchestrate
//
// using the exact returned backfillRunId.
//
// This keeps Product automation fail-closed while we validate
// the first complete Product historical window.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. REQUEST BODY
    // ========================================================

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const from =
      String(
        body?.from
        ??
        ''
      ).trim();


    const to =
      String(
        body?.to
        ??
        ''
      ).trim();


    if (
      !from
      ||
      !to
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'from and to are required',

        },
        {

          status:
            400,

        }
      );

    }


    // ========================================================
    // 2. AUTHENTICATED TENANT
    // ========================================================

    const {
      tenant,
      identity,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 3. SHOPIFY CONNECTION
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
            'SHOPIFY_CONNECTION_NOT_FOUND',

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
            'SHOPIFY_CONNECTION_NOT_CONNECTED',

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
    // 4. SELECTED SHOPIFY ACCOUNT
    // ========================================================

    const account =
      await getSelectedIntegrationAccount(

        tenant.workspaceId,

        tenant.brandId,

        'shopify'

      );


    if (!account) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_ACCOUNT_NOT_FOUND',

        },
        {

          status:
            404,

        }
      );

    }


    // ========================================================
    // 5. CONNECTION / ACCOUNT INTEGRITY
    // ========================================================

    if (
      account.connection_id !==
        connection.connection_id
    ) {

      throw new Error(
        'SHOPIFY_CONNECTION_ACCOUNT_MISMATCH'
      );

    }


    if (
      connection.provider_account_id
      &&
      account.provider_account_id !==
        connection.provider_account_id
    ) {

      throw new Error(
        'SHOPIFY_PROVIDER_ACCOUNT_MISMATCH'
      );

    }


    // ========================================================
    // 6. CREATE PRODUCT HISTORICAL PLAN
    //
    // No dispatch occurs here.
    //
    // Persists:
    //
    // growthos_ops.shopify_backfill_runs
    // growthos_ops.shopify_backfill_windows
    //
    // with:
    //
    // entity = products
    // ========================================================

    const result =
      await createShopifyProductsBackfill({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId:
          connection.connection_id,

        integrationAccountId:
          account.integration_account_id,

        providerAccountId:
          account.provider_account_id,

        from,

        to,

        requestedBy:
          identity?.userId
          ??
          null,

      });


    // ========================================================
    // 7. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      step:
        'SHOPIFY_PRODUCTS_BACKFILL_PLANNED',

      data:
        result,

      tenant: {

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

      },

      shopify: {

        connectionId:
          connection.connection_id,

        integrationAccountId:
          account.integration_account_id,

        providerAccountId:
          account.provider_account_id,

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ??
        'Unable to create Shopify Products backfill'
      );


    console.error(
      'SHOPIFY_PRODUCTS_BACKFILL_TEST_ERROR',
      {

        message,

      }
    );


    if (
      message ===
        'UNAUTHENTICATED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'UNAUTHENTICATED',

        },
        {

          status:
            401,

        }
      );

    }


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_PRODUCTS_BACKFILL_TEST_FAILED',

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