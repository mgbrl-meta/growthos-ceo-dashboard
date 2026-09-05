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
  publishShopifyQueueTest,
} from '@/lib/integrations/providers/shopify-jobs';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY PUB/SUB QUEUE TEST
//
// POST /api/system/shopify/queue-test
//
// This endpoint:
//
// authenticates Growth OS
// resolves active brand
// resolves selected Shopify integration
// publishes a harmless queue test message
//
// It does NOT:
//
// call Shopify API
// start backfill
// write BigQuery data
// expose credentials
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


    // ========================================================
    // SELECTED SHOPIFY STORE
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
    // DEFENCE-IN-DEPTH
    // ========================================================

    if (
      account.connection_id !==
        connection.connection_id
    ) {

      throw new Error(
        'SHOPIFY_CONNECTION_ACCOUNT_MISMATCH'
      );

    }


    // ========================================================
    // PUBLISH TEST MESSAGE
    // ========================================================

    const published =
      await publishShopifyQueueTest({

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

      });


    return NextResponse.json(
      {

        ok:
          true,

        step:
          'SHOPIFY_PUBSUB_PUBLISH_VERIFIED',

        data: {

          messageId:
            published.messageId,

          jobId:
            published.jobId,

          topic:
            published.topic,

        },

        tenant: {

          workspaceId:
            tenant.workspaceId,

          brandId:
            tenant.brandId,

        },

        shopify: {

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
        'Shopify queue test failed'
      );


    console.error(
      'SHOPIFY_QUEUE_TEST_ERROR',
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
          'SHOPIFY_QUEUE_TEST_FAILED',

      },
      {
        status:
          500,
      }
    );

  }

}