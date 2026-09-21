import { NextRequest, NextResponse } from 'next/server';
import { discoverPayloadFields } from '@/lib/call-commerce/mapping';
import {
  getCallingConnectionByIdFast,
  storeTestEvent,
} from '@/lib/call-commerce/repository';
import { enqueueCallingEvent, newCallDeliveryId } from '@/lib/call-commerce/queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function readPayload(request: NextRequest) {
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { raw: text }; }
}

export async function POST(request: NextRequest, context: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await context.params;

  // IMPORTANT: live webhooks deliberately skip schema provisioning here.
  // Connections are created/activated only after Call Commerce provisioned its warehouse.
  const connection = await getCallingConnectionByIdFast(connectionId);
  if (!connection || connection.status === 'deleted') {
    return NextResponse.json({ ok: false, error: 'CALLING_CONNECTION_NOT_FOUND' }, { status: 404 });
  }

  const suppliedSecret = request.headers.get('x-growthos-webhook-secret')
    || new URL(request.url).searchParams.get('secret')
    || '';

  if (String(connection.webhook_secret || '') !== String(suppliedSecret)) {
    return NextResponse.json({ ok: false, error: 'INVALID_WEBHOOK_SECRET' }, { status: 401 });
  }

  const payload = await readPayload(request);

  // Setup/test mode remains synchronous because it is user-initiated and needed for field discovery.
  if (connection.status !== 'active' || !connection.active_mapping_version_id) {
    const discoveredFields = discoverPayloadFields(payload);
    const testEventId = await storeTestEvent({ connection, payload, discoveredFields });
    return NextResponse.json({ ok: true, mode: 'test', testEventId, discoveredFields });
  }

  const deliveryId = newCallDeliveryId();
  const acceptedAt = new Date().toISOString();

  try {
    const published = await enqueueCallingEvent({
      deliveryId,
      acceptedAt,
      connectionId: connection.connection_id,
      workspaceId: connection.workspace_id,
      brandId: connection.brand_id,
      providerKey: connection.provider_key,
      mappingVersionId: connection.active_mapping_version_id,
      payload,
    });

    // Provider acknowledgement happens immediately after durable Pub/Sub enqueue.
    return NextResponse.json({
      ok: true,
      queued: true,
      deliveryId,
      messageId: published.messageId,
    });
  } catch (error: any) {
    console.error('CALLING_WEBHOOK_QUEUE_ERROR', error);
    // A non-2xx response intentionally asks the provider to retry when queueing itself failed.
    return NextResponse.json(
      { ok: false, error: error?.message || 'CALLING_QUEUE_FAILED' },
      { status: 503 }
    );
  }
}
