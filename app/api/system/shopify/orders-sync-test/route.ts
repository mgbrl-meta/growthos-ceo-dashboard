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
// Shopify connection/account
//      ↓
// Pub/Sub
//      ↓
// Growth OS Shopify worker
//
// Supports:
//
// manual
// incremental
// reconciliation
//
// manual:
//
// latest Orders page only.
//
// incremental / reconciliation:
//
// bounded UPDATED_AT window
//      ↓
// worker paginates until exhausted.
//
// No Shopify credential enters Pub/Sub.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. TENANT
    // ========================================================

    const {
      tenant,
      identity,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 2. REQUEST BODY
    // ========================================================

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const syncType =
      String(
        body?.syncType
        ||
        'manual'
      )
        .trim()
        .toLowerCase();


    const allowedSyncTypes =
      new Set([
        'manual',
        'incremental',
        'reconciliation',
      ]);


    if (
      !allowedSyncTypes.has(
        syncType
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_ORDERS_SYNC_TYPE_INVALID',

          allowedSyncTypes:
            Array.from(
              allowedSyncTypes
            ),

        },
        {
          status:
            400,
        }
      );

    }


    const isWindowedSync =
      syncType ===
        'incremental'
      ||
      syncType ===
        'reconciliation';


    let from:
      string | null =
        null;


    let to:
      string | null =
        null;


    let cursor:
      string | null =
        null;


    // ========================================================
    // 3. WINDOWED SYNC VALIDATION
    // ========================================================

    if (
      isWindowedSync
    ) {

      from =
        String(
          body?.from
          ||
          ''
        ).trim();


      to =
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
              'SHOPIFY_ORDERS_SYNC_WINDOW_REQUIRED',

            required: {

              from:
                true,

              to:
                true,

            },

          },
          {
            status:
              400,
          }
        );

      }


      const fromTime =
        Date.parse(
          from
        );


      const toTime =
        Date.parse(
          to
        );


      if (
        Number.isNaN(
          fromTime
        )
        ||
        Number.isNaN(
          toTime
        )
      ) {

        return NextResponse.json(
          {

            ok:
              false,

            error:
              'SHOPIFY_ORDERS_SYNC_WINDOW_INVALID',

          },
          {
            status:
              400,
          }
        );

      }


      if (
        fromTime >=
          toTime
      ) {

        return NextResponse.json(
          {

            ok:
              false,

            error:
              'SHOPIFY_ORDERS_SYNC_WINDOW_RANGE_INVALID',

          },
          {
            status:
              400,
          }
        );

      }


      // Canonicalize timestamps before Pub/Sub.
      from =
        new Date(
          fromTime
        ).toISOString();


      to =
        new Date(
          toTime
        ).toISOString();


      cursor =
        String(
          body?.cursor
          ||
          ''
        ).trim()
        ||
        null;

    }


    // ========================================================
    // 4. SHOPIFY CONNECTION
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
    // 5. SELECTED SHOPIFY ACCOUNT
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
    // 6. CONNECTION / ACCOUNT INTEGRITY
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
    // 7. PUBLISH ORDERS JOB
    //
    // manual:
    //
    // window = null/null
    //
    // incremental/reconciliation:
    //
    // window.from
    // window.to
    // cursor
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
          syncType as
            | 'manual'
            | 'incremental'
            | 'reconciliation',

        requestedBy:
          identity?.userId
          ??
          null,

        from,

        to,

        cursor,

      });


    // ========================================================
    // 8. RESPONSE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        step:
          isWindowedSync
            ?
              'SHOPIFY_ORDERS_WINDOW_SYNC_QUEUED'
            :
              'SHOPIFY_ORDERS_MANUAL_SYNC_QUEUED',

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

          window:
            published.job.window,

          cursor:
            published.job.cursor,

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