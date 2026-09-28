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

    const data =
      await listMetaEventLog(
        access.workspaceId,
        access.brandId,
        {
          limit:
            Number(
              url.searchParams.get(
                'limit'
              )
              ||
              200
            ),
          source:
            url.searchParams.get(
              'source'
            ),
          status:
            url.searchParams.get(
              'status'
            ),
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
            : 'META_EVENTS_LOG_ERROR',
      },
      { status: 500 }
    );
  }
}
