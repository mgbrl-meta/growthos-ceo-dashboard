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
// SHOPIFY CUSTOMERS MANUAL SYNC TEST
//
// DEVELOPMENT / VALIDATION STEP.
//
// Growth OS authenticated tenant
//          ↓
// selected Shopify connection/account
//          ↓
// existing Pub/Sub job contract
//          ↓
// Shopify worker
//          ↓
// latest 25 canonical Customers
//          ↓
// shopify_customers_raw_json
//          ↓
// shopify_customers_state
//          ↓
// shopify_customers_current
//
// IMPORTANT:
//
// Final production Customer ingestion will be automatic.
//
// This endpoint exists only to prove the canonical Customer
// path before historical/incremental/webhook automation.
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
      identity,
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
    // 3. SELECTED SHOPIFY ACCOUNT
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
    // 4. CONNECTION / ACCOUNT INTEGRITY
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
    // 5. PUBLISH CUSTOMER MANUAL JOB
    //
    // No Shopify credential enters Pub/Sub.
    //
    // Worker resolves:
    //
    // connection
    // account
    // Secret Manager credential
    //
    // again before contacting Shopify.
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
          'customers',

        syncType:
          'manual',

        requestedBy:
          identity?.userId
          ??
          null,

        from:
          null,

        to:
          null,

        cursor:
          null,

      });


    // ========================================================
    // 6. SAFE RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      step:
        'SHOPIFY_CUSTOMERS_MANUAL_SYNC_QUEUED',

      data: {

        topic:
          published.topic,

        messageId:
          published.messageId,

        jobId:
          published.job.jobId,

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId:
          connection.connection_id,

        integrationAccountId:
          account.integration_account_id,

        entity:
          'customers',

        syncType:
          'manual',

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify Customers sync test failed'
      );


    console.error(
      'SHOPIFY_CUSTOMERS_SYNC_TEST_ERROR',
      {

        message,

      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_CUSTOMERS_SYNC_TEST_FAILED',

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