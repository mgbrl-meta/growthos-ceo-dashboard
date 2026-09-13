import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  confirmShopifyBilling,
  GrowthOSBillingError,
} from '@/lib/billing/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const identity = await authenticateRequest(request);
    if (!identity) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const planHandle = String(request.nextUrl.searchParams.get('plan_handle') || '').trim();
    const shop = String(request.nextUrl.searchParams.get('shop') || '').trim() || null;

    if (!planHandle) {
      return NextResponse.json({ ok: false, error: 'PLAN_HANDLE_REQUIRED' }, { status: 400 });
    }

    const snapshot = await confirmShopifyBilling({ identity, planHandle, shopDomain: shop });

    const redirectTo = new URL('/', request.url);
    redirectTo.searchParams.set('billing', 'confirmed');
    return NextResponse.redirect(redirectTo);
  } catch (error: any) {
    if (error instanceof GrowthOSBillingError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    console.error('SHOPIFY_BILLING_CONFIRM_ERROR', error);
    return NextResponse.json({ ok: false, error: 'SHOPIFY_BILLING_CONFIRM_ERROR' }, { status: 500 });
  }
}
