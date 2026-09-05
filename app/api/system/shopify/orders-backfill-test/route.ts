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
  createShopifyOrdersBackfill,
} from '@/lib/integrations/providers/shopify-backfill';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY ORDERS BACKFILL TEST
//
// POST
// /api/system/shopify/orders-backfill-test
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
// backfill run
//      ↓
// backfill windows
//      ↓
// publishes ONLY first window
//
// Historical execution itself happens in Cloud Run.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // REQUEST BODY
    // ========================================================

    const body =
      await request.json();


    const from =
      String(
        body?.from
        ||
        ''
      ).trim();


    const to =
      String(
        body?.to
        ||
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
    // TENANT
    // ========================================================

    const {
      tenant,
      identity,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // SHOPIFY CONNECTION
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
    // SELECTED SHOPIFY ACCOUNT
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
    // CONNECTION / ACCOUNT INTEGRITY
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
    // CREATE HISTORICAL BACKFILL PLAN
    //
    // IMPORTANT:
    //
    // This does NOT execute all windows.
    //
    // It creates:
    //
    // growthos_ops.shopify_backfill_runs
    // growthos_ops.shopify_backfill_windows
    //
    // and publishes only the first window.
    // ========================================================

    const result =
      await createShopifyOrdersBackfill({

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
    // RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      step:
        'SHOPIFY_ORDERS_BACKFILL_PLANNED',

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
        ||
        'Unable to create Shopify backfill'
      );


    console.error(
      'SHOPIFY_BACKFILL_TEST_ERROR',
      {
        message,
      }
    );


    // ========================================================
    // AUTH
    // ========================================================

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


    // ========================================================
    // SAFE ERROR
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_BACKFILL_TEST_FAILED',

        message:
          process.env.NODE_ENV ===
            'development'

            ? message

            : undefined,

      },
      {
        status:
          500,
      }
    );

  }

}