import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  listPlanMappings,
  upsertPlanMapping,
} from '@/lib/billing/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin(request);
    return NextResponse.json({ ok: true, mappings: await listPlanMappings() });
  } catch (error: any) {
    const message = String(error?.message || 'Unable to load mappings');
    return NextResponse.json({ ok: false, error: message }, { status: message === 'ADMIN_ACCESS_REQUIRED' ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin(request);
    const body = await request.json();
    const planId = String(body?.planId || '').trim();
    const channel = String(body?.channel || '').trim();
    const provider = channel === 'shopify' ? 'shopify_app_pricing' : channel === 'direct' ? 'razorpay' : '';
    const externalPlanId = String(body?.externalPlanId || '').trim();
    if (!planId || !provider || !externalPlanId) {
      return NextResponse.json({ ok: false, error: 'INVALID_PLAN_MAPPING' }, { status: 400 });
    }
    const mapping = await upsertPlanMapping({
      planId,
      channel: channel as any,
      provider: provider as any,
      externalPlanId,
      currency: body?.currency ? String(body.currency) : channel === 'direct' ? 'INR' : null,
      billingCycle: body?.billingCycle === 'yearly' ? 'yearly' : 'monthly',
    });
    return NextResponse.json({ ok: true, mapping });
  } catch (error: any) {
    const message = String(error?.message || 'Unable to save mapping');
    return NextResponse.json({ ok: false, error: message }, { status: message === 'ADMIN_ACCESS_REQUIRED' ? 403 : 500 });
  }
}
