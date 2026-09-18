import { NextRequest, NextResponse } from 'next/server';
import { discoverPayloadFields, normalizeCallingPayload } from '@/lib/call-commerce/mapping';
import {
  getActiveMapping,
  getCallingConnectionById,
  ingestCanonicalEvent,
  insertRawEvent,
  storeTestEvent,
} from '@/lib/call-commerce/repository';
import { processMetaQueue } from '@/lib/call-commerce/meta-worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readJson(value: any, fallback: any) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

export async function POST(request: NextRequest, context: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await context.params;
  const connection = await getCallingConnectionById(connectionId);
  if (!connection) return NextResponse.json({ ok: false, error: 'CALLING_CONNECTION_NOT_FOUND' }, { status: 404 });

  const suppliedSecret = request.headers.get('x-growthos-webhook-secret') || new URL(request.url).searchParams.get('secret') || '';
  if (String(connection.webhook_secret || '') !== String(suppliedSecret)) {
    return NextResponse.json({ ok: false, error: 'INVALID_WEBHOOK_SECRET' }, { status: 401 });
  }

  const payload = await request.json().catch(async () => ({ raw: await request.text().catch(() => '') }));

  if (connection.status !== 'active' || !connection.active_mapping_version_id) {
    const discoveredFields = discoverPayloadFields(payload);
    const testEventId = await storeTestEvent({ connection, payload, discoveredFields });
    return NextResponse.json({ ok: true, mode: 'test', testEventId, discoveredFields });
  }

  const mapping = await getActiveMapping(connectionId);
  if (!mapping) return NextResponse.json({ ok: false, error: 'CALLING_MAPPING_NOT_ACTIVE' }, { status: 409 });

  try {
    const event = normalizeCallingPayload({
      workspaceId: connection.workspace_id,
      brandId: connection.brand_id,
      connectionId: connection.connection_id,
      providerKey: connection.provider_key,
      payload,
      fieldMappings: readJson(mapping.field_mappings, []),
      valueMappings: readJson(mapping.value_mappings, []),
    });

    await insertRawEvent({ event, connection, payload, mappingVersionId: mapping.mapping_version_id, status: event.eventType === 'RINGING' ? 'raw_only' : 'processed' });

    if (event.eventType === 'RINGING') {
      return NextResponse.json({ ok: true, ignoredOperationally: true });
    }

    const result = await ingestCanonicalEvent(event);
    try { await processMetaQueue(connection.workspace_id, connection.brand_id); } catch (metaError) { console.error('CALLING_WEBHOOK_META_INLINE_ERROR', metaError); }
    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    await insertRawEvent({ event: null, connection, payload, mappingVersionId: mapping.mapping_version_id, status: 'failed', error: error?.message || 'NORMALIZATION_FAILED' });
    console.error('CALLING_WEBHOOK_PROCESS_ERROR', error);
    return NextResponse.json({ ok: false, error: error?.message || 'NORMALIZATION_FAILED' }, { status: 422 });
  }
}
