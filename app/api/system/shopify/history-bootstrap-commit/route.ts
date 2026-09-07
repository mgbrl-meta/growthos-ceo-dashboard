import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  ensureShopifyInitialOrdersHistory,
} from '@/lib/integrations/providers/shopify-history-bootstrap';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY INITIAL HISTORY BOOTSTRAP — COMMIT
//
// CONTROLLED WRITE PATH.
//
// Performs:
//
// inspect coverage
//      ↓
// detect missing historical prefix
//      ↓
// detect existing covering backfill
//      ↓
// create parent run + quarterly queued windows if required
//
// IMPORTANT:
//
// This route does NOT dispatch anything.
//
// Scheduler / Supervisor remain the execution authority.
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
      identity,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // ENSURE INITIAL HISTORY
    // ========================================================

    const result =
      await ensureShopifyInitialOrdersHistory({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId,

        requestedBy:
          identity?.userId
          ??
          null,

      });


    return NextResponse.json({

      ok:
        true,

      step:
        result.created
          ?
            'SHOPIFY_INITIAL_HISTORY_BACKFILL_CREATED'
          :
            'SHOPIFY_INITIAL_HISTORY_NO_ACTION',

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
        'Shopify history bootstrap failed'
      );


    console.error(
      'SHOPIFY_HISTORY_BOOTSTRAP_COMMIT_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_HISTORY_BOOTSTRAP_COMMIT_FAILED',

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