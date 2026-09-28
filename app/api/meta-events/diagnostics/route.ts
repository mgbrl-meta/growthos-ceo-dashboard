import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  getMetaEventsDiagnostics,
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
      await getMetaEventsDiagnostics(
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
            : 'META_EVENTS_DIAGNOSTICS_ERROR',
      },
      { status: 500 }
    );
  }
}
