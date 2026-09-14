import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminPlansSnapshot,
} from '@/lib/admin/plans';

import {
  updateGrowthOSPlanCapabilityEntitlements,
} from '@/lib/admin/capability-control';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const admin = await requirePlatformAdmin(request);
    const snapshot = await getAdminPlansSnapshot();

    return NextResponse.json({
      ok: true,
      scope: 'global',
      summary: snapshot.summary,
      plans: snapshot.plans,
      meta: {
        durationMs: Date.now() - startedAt,
        source: [
          'growthos_control.plans',
          'growthos_control.plan_modules',
          'growthos_control.plan_submodules',
          'growthos_control.modules',
          'growthos_control.submodules',
          'growthos_control.brand_subscriptions',
        ].join(' + '),
        readOnly: false,
        authorization: 'platform_admin',
        platformRole: admin.platformRole,
      },
    });
  } catch (error: any) {
    return adminErrorResponse(error, 'Unable to load Admin Plans', startedAt);
  }
}

export async function PATCH(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const admin = await requirePlatformAdmin(request);
    const body = await request.json();
    const planId = String(body?.planId || '').trim();
    const modules = Array.isArray(body?.modules) ? body.modules : [];

    if (!planId) {
      return NextResponse.json(
        { ok: false, error: 'planId is required' },
        { status: 400 }
      );
    }

    await updateGrowthOSPlanCapabilityEntitlements({
      planId,
      modules,
    });

    await writeGrowthOSAuditEventSafe({
      workspaceId: '__platform__',
      brandId: '__platform__',
      category: 'system',
      action: 'admin.plan_entitlements_updated',
      actorUserId: admin.userId,
      actorRole: admin.platformRole,
      targetType: 'plan',
      targetId: planId,
      after: { modules },
      request,
    });

    const snapshot = await getAdminPlansSnapshot();

    return NextResponse.json({
      ok: true,
      summary: snapshot.summary,
      plans: snapshot.plans,
      meta: {
        durationMs: Date.now() - startedAt,
        authorization: 'platform_admin',
        platformRole: admin.platformRole,
      },
    });
  } catch (error: any) {
    return adminErrorResponse(error, 'Unable to update plan entitlements', startedAt);
  }
}

function adminErrorResponse(error: any, fallback: string, startedAt: number) {
  const message = String(error?.message || fallback);

  if (message === 'UNAUTHENTICATED') {
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  if (message === 'ADMIN_ACCESS_REQUIRED') {
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }

  if (message.startsWith('INVALID_') || message.includes('required')) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  console.error('ADMIN_PLANS_ERROR', {
    message,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    {
      ok: false,
      error: fallback,
      meta: { durationMs: Date.now() - startedAt },
    },
    { status: 500 }
  );
}
