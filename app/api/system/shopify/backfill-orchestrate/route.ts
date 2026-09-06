import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  runShopifyBackfillOrchestrator,
} from '@/lib/integrations/providers/shopify-backfill-orchestrator';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY BACKFILL ORCHESTRATOR
//
// POST
//
// {
//   "backfillRunId": "bfr_..."
// }
//
// IMPORTANT:
//
// Exact run ID is required.
//
// This prevents a manual/test request from dispatching an
// unrelated historical run.
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


    const backfillRunId =
      String(
        body?.backfillRunId
        ||
        ''
      ).trim();


    if (!backfillRunId) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_BACKFILL_RUN_ID_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    const {
      tenant,
      identity,
    } =
      await resolveRequestTenantContext(
        request
      );


    const result =
      await runShopifyBackfillOrchestrator({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        backfillRunId,

        requestedBy:
          identity?.userId
          ??
          null,

      });


    return NextResponse.json({

      ok:
        true,

      step:
        result.dispatched
          ?
            'SHOPIFY_BACKFILL_WINDOW_DISPATCHED'
          :
            'SHOPIFY_BACKFILL_ORCHESTRATOR_IDLE',

      data:
        result,

      tenant: {

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify backfill orchestration failed'
      );


    console.error(
      'SHOPIFY_BACKFILL_ORCHESTRATOR_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_BACKFILL_ORCHESTRATOR_FAILED',

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