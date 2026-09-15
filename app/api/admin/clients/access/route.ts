import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getGrowthOSWorkspaceSubscriptionSnapshot,
} from '@/lib/admin/control-plane';

import {
  updateGrowthOSBrandCapabilityOverrides,
} from '@/lib/admin/capability-control';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

import {
  invalidateAdminSnapshots,
} from '@/lib/admin/snapshot-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


function normalizeOverride(value: unknown) {
  const normalized = String(value || 'default').trim().toLowerCase();

  if (
    normalized === 'default'
    ||
    normalized === 'enabled'
    ||
    normalized === 'disabled'
  ) {
    return normalized as 'default' | 'enabled' | 'disabled';
  }

  throw new Error('INVALID_ACCESS_OVERRIDE');
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requirePlatformAdmin(request);
    const url = new URL(request.url);
    const workspaceId = String(url.searchParams.get('workspaceId') || '').trim();
    const brandId = String(url.searchParams.get('brandId') || '').trim();

    if (!workspaceId || !brandId) {
      return NextResponse.json(
        { ok: false, error: 'workspaceId and brandId are required' },
        { status: 400 }
      );
    }

    const access = await getGrowthOSWorkspaceSubscriptionSnapshot(
      workspaceId,
      brandId
    );

    return NextResponse.json({
      ok: true,
      access,
      meta: {
        authorization: 'platform_admin',
        platformRole: admin.platformRole,
      },
    });
  } catch (error: any) {
    return adminErrorResponse(error, 'Unable to load client access');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requirePlatformAdmin(request);
    const body = await request.json();
    const workspaceId = String(body?.workspaceId || '').trim();
    const brandId = String(body?.brandId || '').trim();
    const moduleOverrides = Array.isArray(body?.moduleOverrides)
      ? body.moduleOverrides
      : [];
    const submoduleOverrides = Array.isArray(body?.submoduleOverrides)
      ? body.submoduleOverrides
      : [];

    if (!workspaceId || !brandId) {
      return NextResponse.json(
        { ok: false, error: 'workspaceId and brandId are required' },
        { status: 400 }
      );
    }

    await updateGrowthOSBrandCapabilityOverrides({
      workspaceId,
      brandId,
      moduleOverrides: moduleOverrides
        .map((item: any) => ({
          moduleId: String(item?.moduleId || '').trim(),
          override: normalizeOverride(item?.override),
        }))
        .filter((item: any) => item.moduleId),
      submoduleOverrides: submoduleOverrides
        .map((item: any) => ({
          moduleId: String(item?.moduleId || '').trim(),
          submoduleId: String(item?.submoduleId || '').trim(),
          override: normalizeOverride(item?.override),
        }))
        .filter((item: any) => item.moduleId && item.submoduleId),
    });

    invalidateAdminSnapshots('admin:modules', 'admin:client-options');

    await writeGrowthOSAuditEventSafe({
      workspaceId,
      brandId,
      category: 'workspace',
      action: 'admin.client_access_overrides_updated',
      actorUserId: admin.userId,
      actorRole: admin.platformRole,
      targetType: 'brand',
      targetId: brandId,
      after: {
        moduleOverrides,
        submoduleOverrides,
      },
      request,
    });

    const access = await getGrowthOSWorkspaceSubscriptionSnapshot(
      workspaceId,
      brandId
    );

    return NextResponse.json({
      ok: true,
      access,
      meta: {
        authorization: 'platform_admin',
        platformRole: admin.platformRole,
      },
    });
  } catch (error: any) {
    return adminErrorResponse(error, 'Unable to update client access');
  }
}

function adminErrorResponse(error: any, fallback: string) {
  const message = String(error?.message || fallback);

  if (message === 'UNAUTHENTICATED') {
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  if (message === 'ADMIN_ACCESS_REQUIRED') {
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }

  if (
    message.startsWith('INVALID_') ||
    message.includes('required') ||
    message.includes('does not exist')
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  console.error('ADMIN_CLIENT_ACCESS_ERROR', { message });

  return NextResponse.json(
    { ok: false, error: fallback },
    { status: 500 }
  );
}
