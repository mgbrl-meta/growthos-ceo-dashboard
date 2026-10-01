import {
  PubSub,
} from '@google-cloud/pubsub';

const PROJECT_ID = String(
  process.env.GCP_PROJECT_ID
  || process.env.GOOGLE_CLOUD_PROJECT
  || ''
).trim();

const TOPIC = String(
  process.env.GROWTHOS_META_EVENTS_TOPIC
  || 'growthos-meta-events'
).trim();

if (!PROJECT_ID) {
  throw new Error('CALL_COMMERCE_META_PROJECT_MISSING');
}

const pubsub = new PubSub({
  projectId: PROJECT_ID,
});

export async function publishCallCommerceMetaSourceEvent(input) {
  const payload = {
    version: 1,
    jobType: 'source_event',
    eventVersion: 1,
    sourceEventId: input.sourceEventId,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    source: 'call_commerce',
    sourceEvent: input.sourceEvent,
    sourceEntityId: input.leadId,
    occurredAt: input.occurredAt || new Date().toISOString(),
    identity: {
      phone: input.phone || null,
      email: input.email || null,
      externalId: input.leadId,
    },
    commerce: input.commerce || null,
    data: {
      ...(input.data || {}),
      source_module: 'call_commerce',
      lead_id: input.leadId,
      call_id: input.callId || null,
    },
    metadata: {
      sourceSystem: 'growthos_call_commerce',
      sourceRecordId: input.providerCallId || input.callId || input.leadId,
    },
  };

  const messageId = await pubsub
    .topic(TOPIC)
    .publishMessage({
      data: Buffer.from(JSON.stringify(payload), 'utf8'),
      attributes: {
        job_type: 'source_event',
        event_version: '1',
        workspace_id: String(input.workspaceId),
        brand_id: String(input.brandId),
        source: 'call_commerce',
        source_event: String(input.sourceEvent),
        source_event_id: String(input.sourceEventId),
      },
    });

  return {
    messageId,
    topic: TOPIC,
  };
}
