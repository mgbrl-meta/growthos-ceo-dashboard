import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  listMetaEventLog,
} from '@/lib/meta-events/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Backward-compatible Call Commerce view.
//
// Delivery ownership now lives in the dedicated Meta Events
// module. This route simply presents Call Commerce-filtered
// Meta Events outbox rows in the legacy Call Commerce shape.
export async function GET(
  request: NextRequest
) {
  try {
    const access =
      await requireGrowthOSApiAccess(
        request
      );

    const url =
      new URL(
        request.url
      );

    const rows =
      await listMetaEventLog(
        access.workspaceId,
        access.brandId,
        {
          source:
            'call_commerce',
          limit:
            Number(
              url.searchParams.get(
                'limit'
              )
              ||
              100
            ),
        }
      );

    const data =
      rows.map(
        (row: any) => ({
          queue_id:
            row.outbox_id,
          workspace_id:
            row.workspace_id,
          brand_id:
            row.brand_id,
          lead_id:
            row.source_entity_id,
          call_id:
            null,
          event_key:
            row.source_event,
          event_name:
            row.meta_event_name,
          event_id:
            row.event_id,
          payload:
            row.custom_data,
          status:
            row.status,
          attempts:
            row.attempts,
          next_attempt_at:
            row.next_attempt_at,
          last_error:
            row.last_error,
          created_at:
            row.created_at,
          updated_at:
            row.updated_at,
        })
      );

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error: unknown) {
    const accessResponse =
      runtimeAccessErrorResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      'CALL_COMMERCE_META_EVENTS_ERROR',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_ERROR',
      },
      {
        status: 500,
      }
    );
  }
}
