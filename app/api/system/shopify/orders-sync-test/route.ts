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
  publishShopifySyncJob,
} from '@/lib/integrations/providers/shopify-jobs';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY ORDERS SYNC TEST
//
// Growth OS
//      ↓
// authenticated tenant
//      ↓
// Shopify connection
//      ↓
// selected Shopify account
//      ↓
// Pub/Sub
//      ↓
// Cloud Run Shopify worker
//
// Q3C:
// Worker fetches first real Shopify Orders page.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // TENANT
    // ========================================================

    const {
      tenant,
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
      account.provider_account_id !==
        connection.provider_account_id
    ) {

      throw new Error(
        'SHOPIFY_PROVIDER_ACCOUNT_MISMATCH'
      );

    }


    // ========================================================
    // PUBLISH REAL ORDERS JOB
    //
    // No Shopify credential enters Pub/Sub.
    // ========================================================

    const published =
      await publishShopifySyncJob({

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

        entity:
          'orders',

        syncType:
          'manual',

        requestedBy:
          null,

      });


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        step:
          'SHOPIFY_ORDERS_CONTEXT_TEST_QUEUED',

        data: {

          topic:
            published.topic,

          messageId:
            published.messageId,

          jobId:
            published.job.jobId,

          entity:
            published.job.entity,

          syncType:
            published.job.syncType,

        },

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

      }
    );


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify Orders test failed'
      );


    console.error(
      'SHOPIFY_ORDERS_CONTEXT_TEST_ERROR',
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
          'SHOPIFY_ORDERS_CONTEXT_TEST_FAILED',

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