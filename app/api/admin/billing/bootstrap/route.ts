import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  ensureGrowthOSBillingStore,
} from '@/lib/billing/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePlatformAdmin(request);
    await ensureGrowthOSBillingStore();
    return NextResponse.json({
      ok: true,
      message: 'Growth OS billing control-plane tables are ready.',
      meta: {
        authorization: 'platform_admin',
        platformRole: admin.platformRole,
      },
    });
  } catch (error: any) {
    const message = String(error?.message || 'Billing bootstrap failed');
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ ok: false, error: message }, { status: 401 });
    }
    if (message === 'ADMIN_ACCESS_REQUIRED') {
      return NextResponse.json({ ok: false, error: message }, { status: 403 });
    }
    console.error('ADMIN_BILLING_BOOTSTRAP_ERROR', error);
    return NextResponse.json({ ok: false, error: 'BILLING_BOOTSTRAP_FAILED' }, { status: 500 });
  }
}
