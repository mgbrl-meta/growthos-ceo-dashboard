import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getIntegrationConnectionById,
  markIntegrationSetupReady,
} from '@/lib/integrations/store';

import {
  ensureShopifyInitialCustomersHistory,
  ensureShopifyInitialOrdersHistory,
} from '@/lib/integrations/providers/shopify-history-bootstrap';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// COMPLETE CONNECTOR SETUP
//
// Browser
//      ↓
// authenticated Growth OS session
//      ↓
// connection lookup
//      ↓
// verify workspace + brand ownership
//      ↓
// setup_status = ready
//      ↓
// provider-specific post-setup bootstrap
//
// Shopify:
//
// setup ready
//      ↓
// ┌───────────────────────────────┐
// │ Orders history ensure         │
// │ Customers history ensure      │
// └───────────────────────────────┘
//      ↓
// growthos_ops queued windows
//      ↓
// Scheduler + shared Supervisor
//      ↓
// one Shopify Bulk pipeline per integration account
//
// IMPORTANT:
//
// Historical bootstrap is NON-FATAL from the merchant's
// setup perspective.
//
// Once setup_status becomes ready, a temporary Shopify,
// BigQuery, Secret Manager, Pub/Sub or bootstrap failure must
// not force the merchant to repeat connector setup.
//
// Orders and Customers are attempted independently.
//
// Therefore:
//
// Orders bootstrap failure
//      ≠
// Customers bootstrap skipped
//
// Customers bootstrap failure
//      ≠
// Orders bootstrap failure
//
// Both paths are independently idempotent and may be retried.
//
// Provider is NOT trusted from browser input.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATION
    // ========================================================

    const identity =
      await authenticateRequest(
        request
      );


    if (
      !identity
      ||
      !identity.workspaceId
      ||
      !identity.brandId
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
    // 2. REQUEST
    // ========================================================

    let body:
      any;


    try {

      body =
        await request.json();

    } catch {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Invalid request body',

        },
        {
          status:
            400,
        }
      );

    }


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
            'connectionId is required',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 3. CONNECTION
    // ========================================================

    const connection =
      await getIntegrationConnectionById(
        connectionId
      );


    if (!connection) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Integration connection not found',

        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 4. TENANT AUTHORIZATION
    //
    // Browser cannot complete setup for another workspace or
    // brand simply by supplying another connectionId.
    // ========================================================

    if (
      connection.workspace_id !==
        identity.workspaceId
      ||
      connection.brand_id !==
        identity.brandId
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'FORBIDDEN',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 5. MARK CONNECTOR READY
    //
    // This is the authoritative connector setup transition.
    //
    // Provider-specific ingestion bootstrap begins ONLY after
    // this transition succeeds.
    // ========================================================

    await markIntegrationSetupReady({

      connectionId,

      workspaceId:
        identity.workspaceId,

      brandId:
        identity.brandId,

    });


    // ========================================================
    // 6. PROVIDER POST-SETUP BOOTSTRAP
    //
    // Default:
    //
    // no provider-specific bootstrap.
    //
    // Shopify:
    //
    // Orders history
    // Customers history
    //
    // They are intentionally isolated from each other.
    // ========================================================

    let ordersBootstrap:
      any =
        null;


    let customersBootstrap:
      any =
        null;


    let ordersBootstrapError:
      string | null =
        null;


    let customersBootstrapError:
      string | null =
        null;


    if (
      connection.provider ===
        'shopify'
    ) {

      // ======================================================
      // 6A. ORDERS HISTORY
      // ======================================================

      try {

        ordersBootstrap =
          await ensureShopifyInitialOrdersHistory({

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            requestedBy:
              identity.userId
              ??
              null,

          });


        console.log(
          'SHOPIFY_INITIAL_ORDERS_HISTORY_BOOTSTRAP_RESULT',
          {

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            decision:
              ordersBootstrap?.decision
              ??
              null,

            backfillRequired:
              ordersBootstrap?.backfillRequired
              ??
              false,

            created:
              ordersBootstrap?.created
              ??
              false,

            backfillRunId:
              ordersBootstrap
                ?.backfill
                ?.backfillRunId
              ??
              ordersBootstrap
                ?.existingBackfill
                ?.backfillRunId
              ??
              null,

          }
        );


      } catch (
        bootstrapFailure: any
      ) {

        ordersBootstrapError =
          String(
            bootstrapFailure?.message
            ||
            'Shopify initial Orders history bootstrap failed'
          );


        console.error(
          'SHOPIFY_INITIAL_ORDERS_HISTORY_BOOTSTRAP_NON_FATAL',
          {

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            message:
              ordersBootstrapError,

          }
        );

      }


      // ======================================================
      // 6B. CUSTOMERS HISTORY
      //
      // IMPORTANT:
      //
      // This is a separate try/catch from Orders.
      //
      // A temporary Orders problem must never prevent Customer
      // history from being planned.
      // ======================================================

      try {

        customersBootstrap =
          await ensureShopifyInitialCustomersHistory({

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            requestedBy:
              identity.userId
              ??
              null,

          });


        console.log(
          'SHOPIFY_INITIAL_CUSTOMERS_HISTORY_BOOTSTRAP_RESULT',
          {

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            decision:
              customersBootstrap?.decision
              ??
              null,

            backfillRequired:
              customersBootstrap?.backfillRequired
              ??
              false,

            created:
              customersBootstrap?.created
              ??
              false,

            backfillRunId:
              customersBootstrap
                ?.backfill
                ?.backfillRunId
              ??
              customersBootstrap
                ?.existingBackfill
                ?.backfillRunId
              ??
              null,

          }
        );


      } catch (
        bootstrapFailure: any
      ) {

        customersBootstrapError =
          String(
            bootstrapFailure?.message
            ||
            'Shopify initial Customers history bootstrap failed'
          );


        console.error(
          'SHOPIFY_INITIAL_CUSTOMERS_HISTORY_BOOTSTRAP_NON_FATAL',
          {

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            message:
              customersBootstrapError,

          }
        );

      }

    }


    // ========================================================
    // 7. SUCCESS
    //
    // Setup is complete regardless of any non-fatal historical
    // bootstrap failure.
    //
    // BACKWARD COMPATIBILITY:
    //
    // bootstrap keeps the existing Orders response contract.
    //
    // customerBootstrap is additive.
    //
    // Existing setup clients that ignore bootstrap remain
    // completely unaffected.
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      connectionId,

      provider:
        connection.provider,

      setupStatus:
        'ready',


      // ======================================================
      // EXISTING ORDERS BOOTSTRAP RESPONSE
      // ======================================================

      bootstrap:
        connection.provider ===
          'shopify'
          ?
            {

              attempted:
                true,

              ok:
                !ordersBootstrapError,

              decision:
                ordersBootstrap?.decision
                ??
                null,

              backfillRequired:
                ordersBootstrap?.backfillRequired
                ??
                null,

              created:
                ordersBootstrap?.created
                ??
                false,

              backfillRunId:
                ordersBootstrap
                  ?.backfill
                  ?.backfillRunId
                ??
                ordersBootstrap
                  ?.existingBackfill
                  ?.backfillRunId
                ??
                null,

              totalWindows:
                ordersBootstrap
                  ?.backfill
                  ?.totalWindows
                ??
                ordersBootstrap
                  ?.plannedBackfill
                  ?.totalWindows
                ??
                null,

              error:
                ordersBootstrapError,

            }
          :
            {

              attempted:
                false,

              ok:
                true,

            },


      // ======================================================
      // CUSTOMER BOOTSTRAP RESPONSE
      //
      // Additive response field.
      //
      // Does not change the existing Orders bootstrap contract.
      // ======================================================

      customerBootstrap:
        connection.provider ===
          'shopify'
          ?
            {

              attempted:
                true,

              ok:
                !customersBootstrapError,

              decision:
                customersBootstrap?.decision
                ??
                null,

              backfillRequired:
                customersBootstrap?.backfillRequired
                ??
                null,

              created:
                customersBootstrap?.created
                ??
                false,

              backfillRunId:
                customersBootstrap
                  ?.backfill
                  ?.backfillRunId
                ??
                customersBootstrap
                  ?.existingBackfill
                  ?.backfillRunId
                ??
                null,

              totalWindows:
                customersBootstrap
                  ?.backfill
                  ?.totalWindows
                ??
                customersBootstrap
                  ?.plannedBackfill
                  ?.totalWindows
                ??
                null,

              error:
                customersBootstrapError,

            }
          :
            {

              attempted:
                false,

              ok:
                true,

            },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Integration setup completion failed'
      );


    console.error(
      'INTEGRATION_SETUP_COMPLETE_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          message,

      },
      {
        status:
          500,
      }
    );

  }

}