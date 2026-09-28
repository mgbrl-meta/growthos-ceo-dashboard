import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  getMetaEventsSettings,
  updateMetaEventsSettings,
} from '@/lib/meta-events/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest
) {
  try {
    const access =
      await requireGrowthOSApiAccess(
        request
      );

    const data =
      await getMetaEventsSettings(
        access.workspaceId,
        access.brandId
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

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'META_EVENTS_SETTINGS_ERROR',
      },
      { status: 500 }
    );
  }
}

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

    const data =
      await updateMetaEventsSettings(
        access.workspaceId,
        access.brandId,
        {
          maxAttempts:
            body?.maxAttempts,
          retryDelaySeconds:
            body?.retryDelaySeconds,
          batchSize:
            body?.batchSize,
          defaultActionSource:
            body?.defaultActionSource,
        }
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

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'META_EVENTS_SETTINGS_WRITE_ERROR',
      },
      { status: 500 }
    );
  }
}
