import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

import {
  getBillingSnapshot,
  GrowthOSBillingError,
  startAdminBillingMigration,
} from '@/lib/billing/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function idsFromUrl(request: NextRequest) {
  return {
    workspaceId: String(request.nextUrl.searchParams.get('workspaceId') || '').trim(),
    brandId: String(request.nextUrl.searchParams.get('brandId') || '').trim(),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin(request);
    const { workspaceId, brandId } = idsFromUrl(request);
    if (!workspaceId || !brandId) {
      return NextResponse.json({ ok: false, error: 'TARGET_TENANT_REQUIRED' }, { status: 400 });
    }
    const snapshot = await getBillingSnapshot(workspaceId, brandId);
    return NextResponse.json({ ok: true, workspaceId, brandId, ...snapshot });
  } catch (error: any) {
    const message = String(error?.message || 'Unable to load billing');
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ ok: false, error: message }, { status: 401 });
    if (message === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ ok: false, error: message }, { status: 403 });
    if (error instanceof GrowthOSBillingError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    console.error('ADMIN_BILLING_GET_ERROR', error);
    return NextResponse.json({ ok: false, error: 'ADMIN_BILLING_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePlatformAdmin(request);
    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const brandId = String(body?.brandId || '').trim();
    const targetChannel = String(body?.targetChannel || '').trim();
    const targetPlanId = String(body?.targetPlanId || '').trim();
    const targetExternalPlanId = String(body?.targetExternalPlanId || '').trim() || null;

    if (!workspaceId || !brandId || !targetPlanId || !['shopify', 'direct'].includes(targetChannel)) {
      return NextResponse.json({ ok: false, error: 'INVALID_MIGRATION_REQUEST' }, { status: 400 });
    }

    const result = await startAdminBillingMigration({
      workspaceId,
      brandId,
      startedBy: admin.userId,
      targetChannel: targetChannel as 'shopify' | 'direct',
      targetPlanId,
      targetExternalPlanId,
    });

    await writeGrowthOSAuditEventSafe({
      request,
      workspaceId,
      brandId,
      category:
        'billing',
      action:
        'billing.migration_started',
      actorUserId:
        admin.userId,
      actorEmail:
        admin.email
        ?? null,
      actorRole:
        admin.platformRole,
      targetType:
        'billing_migration',
      targetId:
        (result as any)?.migration?.migrationId
        ?? (result as any)?.migrationId
        ?? brandId,
      targetLabel:
        `${targetChannel}:${targetPlanId}`,
      after: {
        targetChannel,
        targetPlanId,
        targetExternalPlanId,
      },
      metadata:
        result,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const message = String(error?.message || 'Unable to start migration');
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ ok: false, error: message }, { status: 401 });
    if (message === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ ok: false, error: message }, { status: 403 });
    if (error instanceof GrowthOSBillingError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    console.error('ADMIN_BILLING_MIGRATION_ERROR', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
