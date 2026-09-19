import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestTenantContext } from '@/lib/tenancy/request-context';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { upsertIntegrationConnection } from '@/lib/integrations/store';
import {
  createCallingConnection,
  deleteCallingConnection,
  getCallingConnectionById,
  getLatestTestEvent,
  listCallingConnections,
  saveMappingVersion,
  storeTestEvent,
} from '@/lib/call-commerce/repository';
import { getCallingProviderPreset, CALLING_PROVIDER_PRESETS } from '@/lib/call-commerce/presets';
import { discoverPayloadFields } from '@/lib/call-commerce/mapping';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function syncCallingIntegrationSummary(workspaceId: string, brandId: string) {
  const connections = await listCallingConnections(workspaceId, brandId);
  const active = connections.find((item:any) => item.status === 'active');
  const failed = connections.find((item:any) => item.status === 'failed' || item.last_error);
  const current = active || failed || connections[0] || null;
  const status = active ? 'connected' : failed ? 'failed' : connections.length ? 'needs_attention' : 'not_connected';

  await upsertIntegrationConnection({
    workspaceId,
    brandId,
    provider: 'calling',
    connectionMode: 'webhook',
    ingestionAdapter: 'generic_calling',
    status,
    providerAccountId: current?.connection_id || null,
    providerAccountName: current?.connection_name || null,
    error: failed?.last_error || null,
  });

  return { status, connections };
}

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
      await syncCallingIntegrationSummary(tenant.workspaceId, tenant.brandId);
      const preset = getCallingProviderPreset(platformName);
      if (preset) {
        await saveMappingVersion({ workspaceId: tenant.workspaceId, brandId: tenant.brandId, connectionId: created.connectionId, fieldMappings: preset.fieldMappings, valueMappings: preset.valueMappings, activate: false });
      }
      return NextResponse.json({ ok: true, data: { ...created, platformName, presetDetected: preset?.name || null, webhookUrl: `${appUrl}/api/webhooks/calling/${created.connectionId}` } });
    }

    if (action === 'capture_test_payload') {
      const connectionId = String(body?.connectionId || '').trim();
      if (!connectionId) return NextResponse.json({ ok: false, error: 'Connection ID is required' }, { status: 400 });

      const connection = await getCallingConnectionById(connectionId);
      if (!connection || connection.workspace_id !== tenant.workspaceId || connection.brand_id !== tenant.brandId || connection.status === 'deleted') {
        return NextResponse.json({ ok: false, error: 'CALLING_CONNECTION_NOT_FOUND' }, { status: 404 });
      }

      let payload = body?.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); }
        catch { return NextResponse.json({ ok: false, error: 'Sample payload must be valid JSON' }, { status: 400 }); }
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return NextResponse.json({ ok: false, error: 'Sample payload must be a JSON object' }, { status: 400 });
      }

      const discoveredFields = discoverPayloadFields(payload);
      const testEventId = await storeTestEvent({ connection, payload, discoveredFields });
      return NextResponse.json({ ok: true, data: { testEventId, discoveredFields } });
    }


    if (action === 'delete') {
      const connectionId = String(body?.connectionId || '').trim();
      if (!connectionId) return NextResponse.json({ ok: false, error: 'Connection ID is required' }, { status: 400 });

      const connection = await getCallingConnectionById(connectionId);
      if (!connection || connection.workspace_id !== tenant.workspaceId || connection.brand_id !== tenant.brandId || connection.status === 'deleted') {
        return NextResponse.json({ ok: false, error: 'CALLING_CONNECTION_NOT_FOUND' }, { status: 404 });
      }

      await deleteCallingConnection({ workspaceId: tenant.workspaceId, brandId: tenant.brandId, connectionId });
      const summary = await syncCallingIntegrationSummary(tenant.workspaceId, tenant.brandId);
      return NextResponse.json({ ok: true, data: { connectionId, deleted: true, integrationStatus: summary.status } });
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
      let integrationStatus: string | null = null;
      if (action === 'activate_mapping') {
        integrationStatus = (await syncCallingIntegrationSummary(tenant.workspaceId, tenant.brandId)).status;
      }
      return NextResponse.json({ ok: true, data: { ...data, integrationStatus } });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('CALLING_INTEGRATION_POST_ERROR', error);
    return NextResponse.json({ ok: false, error: error?.message || 'CALLING_INTEGRATION_ERROR' }, { status: 500 });
  }
}
