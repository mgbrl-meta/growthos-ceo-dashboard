import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requirePlatformAdmin,
} from '@/lib/auth/platform-admin';

import {
  getAdminModulesSnapshot,
} from '@/lib/admin/modules';

import {
  replaceGrowthOSCapabilityReleaseAudience,
  updateGrowthOSModuleControl,
  updateGrowthOSSubmoduleControl,
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
    const snapshot = await getAdminModulesSnapshot();

    return NextResponse.json({
      ok: true,
      scope: 'global',
      summary: snapshot.summary,
      modules: snapshot.modules,
      meta: {
        durationMs: Date.now() - startedAt,
        source: [
          'growthos_control.modules',
          'growthos_control.submodules',
          'growthos_control.plan_modules',
          'growthos_control.plan_submodules',
          'growthos_control.brand_module_overrides',
          'growthos_control.brand_submodule_overrides',
          'growthos_control.capability_release_audience',
        ].join(' + '),
        readOnly: false,
        authorization: 'platform_admin',
        platformRole: admin.platformRole,
      },
    });
  } catch (error: any) {
    return adminErrorResponse(error, 'Unable to load Admin Modules', startedAt);
  }
}

export async function PATCH(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const admin = await requirePlatformAdmin(request);
    const body = await request.json();
    const scope = String(body?.scope || 'module').trim().toLowerCase();
    const moduleId = String(body?.moduleId || '').trim();

    if (!moduleId) {
      return NextResponse.json(
        { ok: false, error: 'moduleId is required' },
        { status: 400 }
      );
    }

    let result: any;
    let targetType = 'module';
    let targetId = moduleId;

    if (scope === 'submodule') {
      const submoduleId = String(body?.submoduleId || '').trim();

      if (!submoduleId) {
        return NextResponse.json(
          { ok: false, error: 'submoduleId is required' },
          { status: 400 }
        );
      }

      result = await updateGrowthOSSubmoduleControl({
        moduleId,
        submoduleId,
        accessMode: body?.accessMode,
        releaseStage: body?.releaseStage,
        status: body?.status || 'active',
      });

      await replaceGrowthOSCapabilityReleaseAudience({
        capabilityType: 'submodule',
        moduleId,
        submoduleId,
        audience: Array.isArray(body?.audience) ? body.audience : [],
      });

      targetType = 'submodule';
      targetId = `${moduleId}:${submoduleId}`;
    } else {
      result = await updateGrowthOSModuleControl({
        moduleId,
        accessMode: body?.accessMode,
        releaseStage: body?.releaseStage,
        status: body?.status || 'active',
        setupRequired: Boolean(body?.setupRequired),
      });

      await replaceGrowthOSCapabilityReleaseAudience({
        capabilityType: 'module',
        moduleId,
        audience: Array.isArray(body?.audience) ? body.audience : [],
      });
    }

    await writeGrowthOSAuditEventSafe({
      workspaceId: '__platform__',
      brandId: '__platform__',
      category: 'system',
      action: 'admin.capability_control_updated',
      actorUserId: admin.userId,
      actorRole: admin.platformRole,
      targetType,
      targetId,
      after: {
        ...result,
        audience: Array.isArray(body?.audience) ? body.audience : [],
      },
      request,
    });

    const snapshot = await getAdminModulesSnapshot();

    return NextResponse.json({
      ok: true,
      result,
      summary: snapshot.summary,
      modules: snapshot.modules,
      meta: {
        durationMs: Date.now() - startedAt,
        authorization: 'platform_admin',
        platformRole: admin.platformRole,
      },
    });
  } catch (error: any) {
    return adminErrorResponse(error, 'Unable to update Growth OS capability', startedAt);
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

  if (
    message.startsWith('INVALID_') ||
    message.includes('required')
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  console.error('ADMIN_MODULES_ERROR', {
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
