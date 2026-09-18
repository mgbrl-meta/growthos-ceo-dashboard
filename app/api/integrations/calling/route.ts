import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestTenantContext } from '@/lib/tenancy/request-context';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { upsertIntegrationConnection } from '@/lib/integrations/store';
import {
  createCallingConnection,
  getLatestTestEvent,
  listCallingConnections,
  saveMappingVersion,
} from '@/lib/call-commerce/repository';
import { getCallingProviderPreset, CALLING_PROVIDER_PRESETS } from '@/lib/call-commerce/presets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { tenant } = await resolveRequestTenantContext(request);
    const connections = await listCallingConnections(tenant.workspaceId, tenant.brandId);
    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId');
    const latestTestEvent = connectionId ? await getLatestTestEvent(connectionId) : null;
    const selectedConnection = connectionId ? connections.find((item:any) => item.connection_id === connectionId) : null;
    const suggestedPreset = selectedConnection ? getCallingProviderPreset(String(selectedConnection.provider_key || '')) : null;
    return NextResponse.json({ ok: true, data: { connections, presets: CALLING_PROVIDER_PRESETS.map(({ key, name }) => ({ key, name })), latestTestEvent, suggestedPreset } });
  } catch (error: any) {
    console.error('CALLING_INTEGRATION_GET_ERROR', error);
    return NextResponse.json({ ok: false, error: error?.message || 'CALLING_INTEGRATION_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await authenticateRequest(request);
    if (!identity) return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    const { tenant } = await resolveRequestTenantContext(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '');

    if (action === 'create') {
      // platformName is intentionally free text. providerKey remains accepted for
      // backward compatibility with the first Call Commerce UI implementation.
      const platformName = String(body?.platformName || body?.providerKey || '').trim();
      if (!platformName) return NextResponse.json({ ok: false, error: 'Calling platform name is required' }, { status: 400 });
      if (platformName.length > 120) return NextResponse.json({ ok: false, error: 'Calling platform name is too long' }, { status: 400 });

      const connectionName = String(body?.connectionName || `${platformName} Calling`).trim();
      if (!connectionName) return NextResponse.json({ ok: false, error: 'Connection name is required' }, { status: 400 });
      if (connectionName.length > 120) return NextResponse.json({ ok: false, error: 'Connection name is too long' }, { status: 400 });

      // Existing provider_key storage is reused deliberately so this remains a
      // backward-compatible Call Commerce change with no BigQuery schema migration.
      const created = await createCallingConnection({ workspaceId: tenant.workspaceId, brandId: tenant.brandId, connectionName, providerKey: platformName });
      const appUrl = process.env.GROWTHOS_APP_URL || new URL(request.url).origin;
      await upsertIntegrationConnection({
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        provider: 'calling',
        connectionMode: 'webhook',
        ingestionAdapter: 'generic_calling',
        status: 'connected',
        providerAccountId: created.connectionId,
        providerAccountName: connectionName,
      });
      const preset = getCallingProviderPreset(platformName);
      if (preset) {
        await saveMappingVersion({ workspaceId: tenant.workspaceId, brandId: tenant.brandId, connectionId: created.connectionId, fieldMappings: preset.fieldMappings, valueMappings: preset.valueMappings, activate: false });
      }
      return NextResponse.json({ ok: true, data: { ...created, platformName, presetDetected: preset?.name || null, webhookUrl: `${appUrl}/api/webhooks/calling/${created.connectionId}?secret=${encodeURIComponent(created.webhookSecret)}` } });
    }

    if (action === 'save_mapping' || action === 'activate_mapping') {
      const data = await saveMappingVersion({
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        connectionId: String(body?.connectionId || ''),
        fieldMappings: Array.isArray(body?.fieldMappings) ? body.fieldMappings : [],
        valueMappings: Array.isArray(body?.valueMappings) ? body.valueMappings : [],
        activate: action === 'activate_mapping',
      });
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('CALLING_INTEGRATION_POST_ERROR', error);
    return NextResponse.json({ ok: false, error: error?.message || 'CALLING_INTEGRATION_ERROR' }, { status: 500 });
  }
}
