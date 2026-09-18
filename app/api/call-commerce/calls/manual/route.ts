import { NextRequest, NextResponse } from 'next/server';
import { requireGrowthOSApiAccess, runtimeAccessErrorResponse } from '@/lib/auth/runtime-guard';
import { createManualLead } from '@/lib/call-commerce/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const access = await requireGrowthOSApiAccess(request);
    const body = await request.json().catch(() => ({}));
    const data = await createManualLead({
      workspaceId: access.workspaceId,
      brandId: access.brandId,
      actorUserId: access.identity.userId,
      phone: String(body?.phone || ''),
      customerName: body?.customerName,
      email: body?.email,
      product: body?.product,
      notes: body?.notes,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const accessResponse = runtimeAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error('CALL_COMMERCE_MANUAL_CALL_ERROR', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'CALL_COMMERCE_ERROR' },
      { status: 500 }
    );
  }
}
