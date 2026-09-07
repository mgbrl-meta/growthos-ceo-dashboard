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
// inspect historical Orders coverage
//      ↓
// missing history?
//      ↓
// create/ensure quarterly backfill
//      ↓
// Scheduler + Supervisor execute asynchronously
//
// IMPORTANT:
//
// Historical bootstrap is NON-BLOCKING from the merchant's
// setup perspective.
//
// Once connector setup has successfully become READY, a
// temporary Shopify / BigQuery bootstrap failure must not
// force the merchant to repeat setup.
//
// Bootstrap can be safely retried because:
//
// - coverage inspection is read-only
// - existing covering runs are detected
// - bootstrap run IDs are deterministic
// - window IDs are deterministic
// - BigQuery creation uses MERGE
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
    // brand simply by supplying a connectionId.
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
    // It must succeed before provider bootstrap begins.
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
    // ensure initial Orders history.
    //
    // IMPORTANT:
    //
    // Failure here does NOT roll setup_status back from ready.
    // ========================================================

    let bootstrap:
      any =
        null;


    let bootstrapError:
      string | null =
        null;


    if (
      connection.provider ===
        'shopify'
    ) {

      try {

        bootstrap =
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
          'SHOPIFY_INITIAL_HISTORY_BOOTSTRAP_RESULT',
          {

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            decision:
              bootstrap?.decision
              ??
              null,

            backfillRequired:
              bootstrap?.backfillRequired
              ??
              false,

            created:
              bootstrap?.created
              ??
              false,

            backfillRunId:
              bootstrap
                ?.backfill
                ?.backfillRunId
              ??
              bootstrap
                ?.existingBackfill
                ?.backfillRunId
              ??
              null,

          }
        );


      } catch (
        bootstrapFailure: any
      ) {

        bootstrapError =
          String(
            bootstrapFailure?.message
            ||
            'Shopify initial history bootstrap failed'
          );


        console.error(
          'SHOPIFY_INITIAL_HISTORY_BOOTSTRAP_NON_FATAL',
          {

            workspaceId:
              identity.workspaceId,

            brandId:
              identity.brandId,

            connectionId,

            message:
              bootstrapError,

          }
        );

      }

    }


    // ========================================================
    // 7. SUCCESS
    //
    // Connector setup is complete regardless of whether a
    // non-fatal provider bootstrap needs retrying later.
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      connectionId,

      provider:
        connection.provider,

      setupStatus:
        'ready',

      bootstrap:
        connection.provider ===
          'shopify'
          ?
            {

              attempted:
                true,

              ok:
                !bootstrapError,

              decision:
                bootstrap?.decision
                ??
                null,

              backfillRequired:
                bootstrap?.backfillRequired
                ??
                null,

              created:
                bootstrap?.created
                ??
                false,

              backfillRunId:
                bootstrap
                  ?.backfill
                  ?.backfillRunId
                ??
                bootstrap
                  ?.existingBackfill
                  ?.backfillRunId
                ??
                null,

              totalWindows:
                bootstrap
                  ?.backfill
                  ?.totalWindows
                ??
                bootstrap
                  ?.plannedBackfill
                  ?.totalWindows
                ??
                null,

              error:
                bootstrapError,

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