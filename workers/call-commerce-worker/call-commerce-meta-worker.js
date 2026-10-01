import { pgQuery } from './postgres.js';
import { publishCallCommerceMetaSourceEvent } from './call-commerce-meta-publisher.js';

const MAX_ATTEMPTS = Math.max(1, Number(process.env.CALL_COMMERCE_META_MAX_ATTEMPTS || 5));
const RETRY_DELAY_MINUTES = Math.max(1, Number(process.env.CALL_COMMERCE_META_RETRY_DELAY_MINUTES || 5));

const SOURCE_EVENT_MAP = {
  CALL_LEAD_CONNECTED: 'call_commerce.connected',
  CALL_LEAD_QUALIFIED: 'call_commerce.qualified',
  CALL_LEAD_UNQUALIFIED: 'call_commerce.unqualified',
  CALL_LEAD_CONVERTED: 'call_commerce.purchased',
};

export async function processMetaQueue(workspaceId, brandId) {
  const claimId = `meta_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Recover claims abandoned by a crashed/terminated worker. The publish is
  // still protected downstream by the stable sourceEventId/event_id dedupe key.
  await pgQuery(
    `UPDATE call_commerce.meta_event_queue
     SET status='RETRY',next_attempt_at=NOW(),last_error=COALESCE(last_error,'STALE_PROCESSING_RECOVERED'),updated_at=NOW()
     WHERE workspace_id=$1 AND brand_id=$2
       AND status='PROCESSING'
       AND updated_at < NOW() - INTERVAL '10 minutes'`,
    [workspaceId, brandId]
  );

  // Claim rows atomically so concurrent Pub/Sub flush messages cannot duplicate
  // the publish operation. SKIP LOCKED keeps workers non-blocking.
  const claimed = await pgQuery(
    `WITH picked AS (
       SELECT queue_id
       FROM call_commerce.meta_event_queue
       WHERE workspace_id=$1
         AND brand_id=$2
         AND status IN ('PENDING','RETRY')
         AND (next_attempt_at IS NULL OR next_attempt_at<=NOW())
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 100
     )
     UPDATE call_commerce.meta_event_queue q
     SET status='PROCESSING',updated_at=NOW(),last_error=NULL
     FROM picked
     WHERE q.queue_id=picked.queue_id
     RETURNING q.*`,
    [workspaceId, brandId]
  );

  let processed = 0;
  let routed = 0;
  let retry = 0;
  let needsAttention = 0;

  for (const row of claimed.rows) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const sourceEvent = SOURCE_EVENT_MAP[row.event_key] || `call_commerce.${String(row.event_key || '').toLowerCase()}`;
    const attempts = Number(row.attempts || 0) + 1;

    try {
      await publishCallCommerceMetaSourceEvent({
        sourceEventId: row.event_id,
        workspaceId,
        brandId,
        sourceEvent,
        leadId: row.lead_id,
        callId: row.call_id || null,
        providerCallId: payload.provider_call_id || null,
        occurredAt: payload.occurred_at || row.created_at || new Date().toISOString(),
        phone: payload.phone || null,
        email: payload.email || null,
        commerce:
          row.event_key === 'CALL_LEAD_CONVERTED'
            ? {
                orderId: payload.order_id || null,
                value: payload.value ?? payload.amount ?? null,
                currency: payload.currency || 'INR',
              }
            : null,
        data: {
          ...payload,
          event_key: row.event_key,
          configured_meta_event_name: row.event_name,
        },
      });

      await pgQuery(
        `UPDATE call_commerce.meta_event_queue
         SET status='ROUTED',attempts=$2,next_attempt_at=NULL,last_error=NULL,updated_at=NOW()
         WHERE queue_id=$1`,
        [row.queue_id, attempts]
      );
      routed += 1;
    } catch (error) {
      const message = String(error?.message || 'META_SOURCE_PUBLISH_FAILED').slice(0, 4000);
      const terminal = attempts >= MAX_ATTEMPTS;

      await pgQuery(
        `UPDATE call_commerce.meta_event_queue
         SET
           status=$2,
           attempts=$3,
           next_attempt_at=CASE WHEN $2='RETRY' THEN NOW()+($4::text || ' minutes')::interval ELSE NULL END,
           last_error=$5,
           updated_at=NOW()
         WHERE queue_id=$1`,
        [
          row.queue_id,
          terminal ? 'NEEDS_ATTENTION' : 'RETRY',
          attempts,
          RETRY_DELAY_MINUTES,
          message,
        ]
      );

      if (terminal) needsAttention += 1;
      else retry += 1;
    }

    processed += 1;
  }

  return {
    processed,
    routed,
    retry,
    needsAttention,
    claimId,
  };
}
