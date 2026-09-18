import { NextRequest, NextResponse } from 'next/server';
import { requireGrowthOSApiAccess, runtimeAccessErrorResponse } from '@/lib/auth/runtime-guard';
import { listLeads } from '@/lib/call-commerce/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const access = await requireGrowthOSApiAccess(request);
    const url = new URL(request.url);
    const pageSize = Math.min(Number(url.searchParams.get('limit') || 50), 500);
    const page = Math.max(Number(url.searchParams.get('page') || 1), 1);
    const data = await listLeads({
      workspaceId: access.workspaceId,
      brandId: access.brandId,
      archived: false,
      status: url.searchParams.get('status') || '',
      search: url.searchParams.get('search') || '',
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return NextResponse.json({ ok: true, data, meta: { page, pageSize } });
  } catch (error: unknown) {
    const accessResponse = runtimeAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error('CALL_COMMERCE_CALLS_ERROR', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'CALL_COMMERCE_ERROR' },
      { status: 500 }
    );
  }
}
