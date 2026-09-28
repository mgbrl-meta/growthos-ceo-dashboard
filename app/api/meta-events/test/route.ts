import crypto from 'crypto';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  emitMetaSourceEvent,
} from '@/lib/meta-events/publisher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest
) {
  try {
    const access =
      await requireGrowthOSApiAccess(
        request
      );

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const source =
      String(
        body?.source
        ||
        'call_commerce'
      ).trim();

    const sourceEvent =
      String(
        body?.sourceEvent
        ||
        'call_commerce.__queue_test'
      ).trim();

    const sourceEventId =
      `metest_${crypto
        .randomUUID()
        .replace(/-/g, '')}`;

    const published =
      await emitMetaSourceEvent({
        sourceEventId,
        workspaceId:
          access.workspaceId,
        brandId:
          access.brandId,
        source,
        sourceEvent,
        sourceEntityId:
          sourceEventId,
        occurredAt:
          new Date()
            .toISOString(),
        identity: {
          externalId:
            sourceEventId,
        },
        data: {
          source_module:
            'meta_events',
          test_event:
            true,
          value:
            Number(
              body?.value
              ||
              0
            ),
          currency:
            String(
              body?.currency
              ||
              'INR'
            ),
        },
      });

    return NextResponse.json({
      ok: true,
      data: {
        sourceEventId,
        messageId:
          published.messageId,
      },
    });
  } catch (error: unknown) {
    const accessResponse =
      runtimeAccessErrorResponse(
        error
      );
    if (accessResponse) {
      return accessResponse;
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'META_EVENTS_TEST_ERROR',
      },
      { status: 500 }
    );
  }
}
