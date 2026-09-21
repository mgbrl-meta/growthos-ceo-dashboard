import { NextRequest, NextResponse } from 'next/server';
import { normalizeCallingPayload } from '@/lib/call-commerce/mapping';
import { processMetaQueue } from '@/lib/call-commerce/meta-worker';
import { enqueueMetaFlush, type CallCommerceJob } from '@/lib/call-commerce/queue';
import {
  beginRawEventDelivery,
  finalizeRawEventDelivery,
  getCallingMappingById,
  ingestCanonicalEvent,
  markCallingConnectionProcessingResult,
} from '@/lib/call-commerce/repository';
import { verifyCallCommercePubSubRequest } from '@/lib/call-commerce/pubsub-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function readJson(value: unknown, fallback: any) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function decodeJob(body: any): { job: CallCommerceJob; messageId: string | null } {
  const encoded = body?.message?.data;
  if (!encoded || typeof encoded !== 'string') throw new Error('PUBSUB_MESSAGE_DATA_MISSING');
  const json = Buffer.from(encoded, 'base64').toString('utf8');
  const job = JSON.parse(json) as CallCommerceJob;
  if (!job || job.version !== 1 || !job.jobType) throw new Error('CALL_COMMERCE_JOB_INVALID');
  return { job, messageId: String(body?.message?.messageId || body?.message?.message_id || '') || null };
}

export async function POST(request: NextRequest) {
  try {
    await verifyCallCommercePubSubRequest(request);
  } catch (error: any) {
    console.error('CALL_COMMERCE_PUBSUB_AUTH_ERROR', error);
    return NextResponse.json({ ok: false, error: error?.message || 'PUBSUB_UNAUTHENTICATED' }, { status: 401 });
  }

  let decoded: { job: CallCommerceJob; messageId: string | null };
  try {
    decoded = decodeJob(await request.json());
  } catch (error: any) {
    console.error('CALL_COMMERCE_PUBSUB_DECODE_ERROR', error);
    // Malformed messages are poison messages. Ack them after logging so Pub/Sub does not retry forever.
    return NextResponse.json({ ok: false, acknowledged: true, error: error?.message || 'PUBSUB_MESSAGE_INVALID' });
  }

  const { job, messageId } = decoded;

  if (job.jobType === 'meta_flush') {
    try {
      const data = await processMetaQueue(job.workspaceId, job.brandId);
      return NextResponse.json({ ok: true, jobType: job.jobType, data });
    } catch (error: any) {
      console.error('CALL_COMMERCE_META_JOB_ERROR', error);
      return NextResponse.json({ ok: false, error: error?.message || 'META_JOB_FAILED' }, { status: 500 });
    }
  }

  let rawEventId: string | null = null;
  try {
    rawEventId = await beginRawEventDelivery({
      deliveryId: job.deliveryId,
      pubsubMessageId: messageId,
      acceptedAt: job.acceptedAt,
      workspaceId: job.workspaceId,
      brandId: job.brandId,
      connectionId: job.connectionId,
      providerKey: job.providerKey,
      mappingVersionId: job.mappingVersionId,
      payload: job.payload,
    });

    const mapping = await getCallingMappingById(job.mappingVersionId);
    if (!mapping) {
      await finalizeRawEventDelivery({
        rawEventId,
        status: 'failed',
        error: 'CALLING_MAPPING_VERSION_NOT_FOUND',
      });
      await markCallingConnectionProcessingResult({
        connectionId: job.connectionId,
        acceptedAt: job.acceptedAt,
        success: false,
        error: 'CALLING_MAPPING_VERSION_NOT_FOUND',
      });
      // Permanent configuration error: acknowledge the message after preserving failure state.
      return NextResponse.json({ ok: false, acknowledged: true, error: 'CALLING_MAPPING_VERSION_NOT_FOUND' });
    }

    let event;
    try {
      event = normalizeCallingPayload({
        workspaceId: job.workspaceId,
        brandId: job.brandId,
        connectionId: job.connectionId,
        providerKey: job.providerKey,
        payload: job.payload,
        fieldMappings: readJson(mapping.field_mappings, []),
        valueMappings: readJson(mapping.value_mappings, []),
      });
    } catch (error: any) {
      const message = error?.message || 'NORMALIZATION_FAILED';
      await finalizeRawEventDelivery({ rawEventId, status: 'failed', error: message });
      await markCallingConnectionProcessingResult({
        connectionId: job.connectionId,
        acceptedAt: job.acceptedAt,
        success: false,
        error: message,
      });
      // Mapping/validation failures will not improve with Pub/Sub retry.
      return NextResponse.json({ ok: false, acknowledged: true, error: message });
    }

    await finalizeRawEventDelivery({
      rawEventId,
      event,
      status: event.eventType === 'RINGING' ? 'raw_only' : 'processing',
      error: null,
    });

    if (event.eventType === 'RINGING') {
      await markCallingConnectionProcessingResult({
        connectionId: job.connectionId,
        acceptedAt: job.acceptedAt,
        success: true,
      });
      return NextResponse.json({ ok: true, jobType: job.jobType, rawOnly: true, rawEventId });
    }

    const data = await ingestCanonicalEvent(event, 'calling-pubsub', { skipSchemaEnsure: true });

    await finalizeRawEventDelivery({
      rawEventId,
      event,
      status: 'processed',
      error: null,
    });

    await markCallingConnectionProcessingResult({
      connectionId: job.connectionId,
      acceptedAt: job.acceptedAt,
      success: true,
    });

    // Meta delivery is intentionally a second queue hop. A Meta outage must never hold up call ingestion.
    try {
      await enqueueMetaFlush(job.workspaceId, job.brandId);
    } catch (metaQueueError) {
      console.error('CALL_COMMERCE_META_ENQUEUE_ERROR', metaQueueError);
    }

    return NextResponse.json({ ok: true, jobType: job.jobType, rawEventId, data });
  } catch (error: any) {
    console.error('CALL_COMMERCE_CALL_JOB_ERROR', error);
    // Infrastructure/transient errors return 500 so Pub/Sub retries the exact same deliveryId.
    if (rawEventId) {
      try {
        await finalizeRawEventDelivery({
          rawEventId,
          status: 'retry',
          error: error?.message || 'CALL_JOB_FAILED',
        });
      } catch (finalizeError) {
        console.error('CALL_COMMERCE_RAW_FINALIZE_ERROR', finalizeError);
      }
    }
    try {
      await markCallingConnectionProcessingResult({
        connectionId: job.connectionId,
        acceptedAt: job.acceptedAt,
        success: false,
        error: error?.message || 'CALL_JOB_FAILED',
      });
    } catch (healthError) {
      console.error('CALL_COMMERCE_CONNECTION_HEALTH_ERROR', healthError);
    }
    return NextResponse.json({ ok: false, error: error?.message || 'CALL_JOB_FAILED' }, { status: 500 });
  }
}
