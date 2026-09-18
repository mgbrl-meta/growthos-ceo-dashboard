import { NextRequest, NextResponse } from 'next/server';
import { requireGrowthOSApiAccess, runtimeAccessErrorResponse } from '@/lib/auth/runtime-guard';
import { listMetaEvents } from '@/lib/call-commerce/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const access = await requireGrowthOSApiAccess(request);
    const url = new URL(request.url);
    const data = await listMetaEvents(
      access.workspaceId,
      access.brandId,
      Number(url.searchParams.get('limit') || 100)
    );
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const accessResponse = runtimeAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error('CALL_COMMERCE_META_EVENTS_ERROR', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'CALL_COMMERCE_ERROR' },
      { status: 500 }
    );
  }
}
