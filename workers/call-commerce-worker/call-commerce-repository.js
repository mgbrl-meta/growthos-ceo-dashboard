import crypto from 'crypto';
import { pgQuery, pgTransaction, getPostgresConfig } from './postgres.js';

const PROJECT_ID = String(
  process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || ''
).trim();

const DEFAULT_REOPEN_GRACE_MINUTES = Number(
  process.env.CALL_COMMERCE_REOPEN_GRACE_MINUTES || 30
);

const DEFAULT_CONTACT_MIN_DURATION_SECONDS = Number(
  process.env.CALL_COMMERCE_CONTACT_MIN_DURATION_SECONDS || 20
);

const id = prefix => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
const deterministic = (prefix, parts) => `${prefix}_${crypto
  .createHash('sha256')
  .update(parts.map(value => String(value ?? '')).join(':'))
  .digest('hex')
  .slice(0, 24)}`;

const OPEN_LEAD_STATUSES = new Set(['NEW', 'QUALIFIED', 'FOLLOW_UP']);
const TERMINAL_LEAD_STATUSES = new Set(['PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST']);
const SETTINGS_CACHE_TTL_MS = 60_000;
const settingsCache = new Map();

function normalizePhone(value) {
  return String(value ?? '').replace(/[^0-9+]/g, '').trim();
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function earlierIso(a, b) {
  const da = asDate(a);
  const db = asDate(b);
  if (!da) return db?.toISOString() || null;
  if (!db) return da.toISOString();
  return (da.getTime() <= db.getTime() ? da : db).toISOString();
}

function laterIso(a, b) {
  const da = asDate(a);
  const db = asDate(b);
  if (!da) return db?.toISOString() || null;
  if (!db) return da.toISOString();
  return (da.getTime() >= db.getTime() ? da : db).toISOString();
}

function callStatusRank(status) {
  const ranks = {
    '': 0,
    UNKNOWN: 1,
    RINGING: 10,
    MANUAL_CREATED: 20,
    MISSED: 60,
    NO_ANSWER: 65,
    BUSY: 65,
    REJECTED: 65,
    FAILED: 65,
    ANSWERED: 100,
  };
  return ranks[String(status || '').toUpperCase()] ?? 30;
}

function isAnswered(status) {
  return String(status || '').toUpperCase() === 'ANSWERED';
}

function normalizeAcceptedAt(value) {
  return asDate(value)?.toISOString() || new Date().toISOString();
}

async function run(client, text, values = []) {
  return client ? client.query(text, values) : pgQuery(text, values);
}

async function getRuntimeSettings(workspaceId, brandId, client = null) {
  const key = `${workspaceId}:${brandId}`;
  const cached = settingsCache.get(key);
  if (!client && cached && cached.expiresAt > Date.now()) return cached.value;

  const result = await run(
    client,
    `SELECT contact_min_duration_seconds,reopen_grace_minutes
     FROM call_commerce.settings
     WHERE workspace_id=$1 AND brand_id=$2
     LIMIT 1`,
    [workspaceId, brandId]
  );

  const value = {
    contactMinDurationSeconds: Number(
      result.rows[0]?.contact_min_duration_seconds ?? DEFAULT_CONTACT_MIN_DURATION_SECONDS
    ),
    reopenGraceMinutes: Number(
      result.rows[0]?.reopen_grace_minutes ?? DEFAULT_REOPEN_GRACE_MINUTES
    ),
  };

  if (!client) {
    settingsCache.set(key, {
      expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
      value,
    });
  }

  return value;
}

export async function resolveCallingContext(job) {
  const result = await pgQuery(
    `SELECT
       c.connection_id,
       c.workspace_id,
       c.brand_id,
       c.provider_key,
       c.status,
       c.active_mapping_version_id,
       m.mapping_version_id,
       m.status AS mapping_status,
       m.field_mappings,
       m.value_mappings
     FROM call_commerce.calling_connections c
     LEFT JOIN call_commerce.calling_mapping_versions m
       ON m.mapping_version_id=c.active_mapping_version_id
     WHERE c.connection_id=$1
     LIMIT 1`,
    [job.connectionId]
  );

  const row = result.rows[0] || null;
  if (!row) throw new Error('CALLING_CONNECTION_NOT_FOUND');
  if (String(row.status || '').toLowerCase() !== 'active') {
    throw new Error('CALLING_CONNECTION_NOT_ACTIVE');
  }

  if (
    String(row.workspace_id || '') !== String(job.workspaceId || '') ||
    String(row.brand_id || '') !== String(job.brandId || '') ||
    String(row.provider_key || '') !== String(job.providerKey || '')
  ) {
    throw new Error('CALLING_JOB_TENANT_MISMATCH');
  }

  if (
    !row.active_mapping_version_id ||
    String(row.active_mapping_version_id) !== String(job.mappingVersionId || '') ||
    String(row.mapping_version_id || '') !== String(job.mappingVersionId || '')
  ) {
    throw new Error('CALLING_MAPPING_VERSION_MISMATCH');
  }

  if (String(row.mapping_status || '').toLowerCase() !== 'active') {
    throw new Error('CALLING_MAPPING_NOT_ACTIVE');
  }

  return row;
}

export async function beginRawEventDelivery(input) {
  const receivedAt = normalizeAcceptedAt(input.acceptedAt);
  const rawEventId = deterministic('raw', [
    input.workspaceId,
    input.brandId,
    input.connectionId,
    input.deliveryId,
  ]);

  await pgQuery(
    `INSERT INTO call_commerce.raw_call_events (
       raw_event_id,delivery_id,pubsub_message_id,workspace_id,brand_id,
       connection_id,provider_key,payload,mapping_version_id,
       processing_status,processing_error,received_at,processed_at
     ) VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8::jsonb,$9,'processing',NULL,$10::timestamptz,NULL)
     ON CONFLICT (delivery_id) DO UPDATE SET
       pubsub_message_id=COALESCE(NULLIF(EXCLUDED.pubsub_message_id,''),call_commerce.raw_call_events.pubsub_message_id),
       processing_status=CASE
         WHEN call_commerce.raw_call_events.processing_status='processed'
           THEN call_commerce.raw_call_events.processing_status
         ELSE 'processing'
       END,
       processing_error=CASE
         WHEN call_commerce.raw_call_events.processing_status='processed'
           THEN call_commerce.raw_call_events.processing_error
         ELSE NULL
       END`,
    [
      rawEventId,
      input.deliveryId,
      input.pubsubMessageId || '',
      input.workspaceId,
      input.brandId,
      input.connectionId,
      input.providerKey,
      JSON.stringify(input.payload ?? {}),
      input.mappingVersionId,
      receivedAt,
    ]
  );

  return rawEventId;
}

export async function finalizeRawEventDelivery(input) {
  await pgQuery(
    `UPDATE call_commerce.raw_call_events
     SET
       provider_call_id=COALESCE(NULLIF($2,''),provider_call_id),
       provider_event_id=COALESCE(NULLIF($3,''),provider_event_id),
       raw_event_type=COALESCE(NULLIF($4,''),raw_event_type),
       raw_status=COALESCE(NULLIF($5,''),raw_status),
       processing_status=$6,
       processing_error=NULLIF($7,''),
       processed_at=CASE
         WHEN $6 IN ('processed','raw_only','failed') THEN NOW()
         ELSE processed_at
       END
     WHERE raw_event_id=$1`,
    [
      input.rawEventId,
      input.event?.providerCallId || '',
      input.event?.providerEventId || '',
      input.event?.rawEventType || '',
      input.event?.rawStatus || '',
      input.status,
      input.error || '',
    ]
  );
}

export async function markCallingConnectionProcessingResult(input) {
  const acceptedAt = normalizeAcceptedAt(input.acceptedAt);
  await pgQuery(
    `UPDATE call_commerce.calling_connections
     SET
       last_event_at=CASE
         WHEN last_event_at IS NULL OR last_event_at < $2::timestamptz THEN $2::timestamptz
         ELSE last_event_at
       END,
       last_success_at=CASE WHEN $3::boolean THEN NOW() ELSE last_success_at END,
       last_error=CASE WHEN $3::boolean THEN NULL ELSE NULLIF($4,'') END,
       updated_at=NOW()
     WHERE connection_id=$1`,
    [input.connectionId, acceptedAt, Boolean(input.success), input.error || '']
  );
}

async function getProviderAttempt(event, client = null) {
  const result = await run(
    client,
    `SELECT *
     FROM call_commerce.call_attempts
     WHERE workspace_id=$1
       AND brand_id=$2
       AND connection_id=$3
       AND provider_call_id=$4
     LIMIT 1`,
    [event.workspaceId, event.brandId, event.connectionId, event.providerCallId]
  );
  return result.rows[0] || null;
}

async function findAttachableLead(input, settings, client) {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const result = await run(
    client,
    `SELECT lead_id,status,status_changed_at,latest_call_at,updated_at,created_at
     FROM call_commerce.call_leads
     WHERE workspace_id=$1
       AND brand_id=$2
       AND phone=$3
       AND is_archived=FALSE
       AND status IN ('NEW','QUALIFIED','FOLLOW_UP','PURCHASED','UNQUALIFIED','CLOSED_LOST')
     ORDER BY COALESCE(latest_call_at,updated_at,created_at) DESC
     LIMIT 50`,
    [input.workspaceId, input.brandId, phone]
  );

  const candidates = result.rows || [];
  const open = candidates.find(row => OPEN_LEAD_STATUSES.has(String(row.status || '').toUpperCase()));
  if (open) return open;

  const callAt = asDate(input.callAt) || new Date();
  const graceMs = Number(settings.reopenGraceMinutes || 0) * 60_000;
  let bestTerminal = null;
  let bestTerminalAt = -1;

  for (const row of candidates) {
    const status = String(row.status || '').toUpperCase();
    if (!TERMINAL_LEAD_STATUSES.has(status)) continue;
    const terminalAt = asDate(row.status_changed_at) || asDate(row.updated_at);
    if (!terminalAt) continue;
    const delta = callAt.getTime() - terminalAt.getTime();
    if (delta >= 0 && delta <= graceMs && terminalAt.getTime() > bestTerminalAt) {
      bestTerminal = row;
      bestTerminalAt = terminalAt.getTime();
    }
  }

  return bestTerminal;
}

async function createCallLead(input, client) {
  const leadId = id('CL');
  const startedAt = asDate(input.startedAt)?.toISOString() || new Date().toISOString();

  await run(
    client,
    `INSERT INTO call_commerce.call_leads (
       lead_id,workspace_id,brand_id,phone,customer_name,email,product,status,
       notes,currency,status_changed_at,first_call_at,latest_call_at,
       call_attempt_count,answered_attempt_count,unanswered_attempt_count,
       is_archived,created_at,updated_at,created_by,updated_by
     ) VALUES (
       $1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),'NEW',
       NULLIF($8,''),'INR',NOW(),$9::timestamptz,$9::timestamptz,
       0,0,0,FALSE,NOW(),NOW(),$10,$10
     )`,
    [
      leadId,
      input.workspaceId,
      input.brandId,
      normalizePhone(input.phone),
      input.customerName || '',
      input.email || '',
      input.product || '',
      input.notes || '',
      startedAt,
      input.actor,
    ]
  );

  return leadId;
}

async function upsertCallAttempt(event, leadId, existingAttempt, client) {
  const created = !existingAttempt;
  const attemptId = existingAttempt?.attempt_id || deterministic('CA', [
    event.workspaceId,
    event.brandId,
    event.connectionId,
    event.providerCallId,
  ]);

  const oldStatus = String(existingAttempt?.call_status || '');
  const incomingStatus = String(event.callStatus || '');
  const oldUpdatedAt = asDate(existingAttempt?.provider_updated_at);
  const incomingUpdatedAt =
    asDate(event.updatedAt) || asDate(event.endedAt) || asDate(event.startedAt) || new Date();

  const incomingWins =
    !oldStatus ||
    callStatusRank(incomingStatus) > callStatusRank(oldStatus) ||
    (
      callStatusRank(incomingStatus) === callStatusRank(oldStatus) &&
      (!oldUpdatedAt || incomingUpdatedAt.getTime() >= oldUpdatedAt.getTime())
    );

  const values = {
    attempt_id: attemptId,
    workspace_id: event.workspaceId,
    brand_id: event.brandId,
    connection_id: event.connectionId,
    provider_key: event.callingProvider,
    provider_call_id: event.providerCallId,
    lead_id: existingAttempt?.lead_id || leadId,
    phone: normalizePhone(existingAttempt?.phone || event.customerPhone),
    business_number: event.businessNumber || existingAttempt?.business_number || null,
    event_type: incomingWins ? event.eventType : (existingAttempt?.event_type || event.eventType),
    call_status: incomingWins ? incomingStatus : oldStatus,
    direction: incomingWins ? event.direction : (existingAttempt?.direction || event.direction),
    agent_id: event.agentId || existingAttempt?.agent_id || null,
    agent_name: event.agentName || existingAttempt?.agent_name || null,
    agent_phone: event.agentPhone || existingAttempt?.agent_phone || null,
    started_at: earlierIso(existingAttempt?.call_started_at, event.startedAt),
    answered_at: earlierIso(existingAttempt?.call_answered_at, event.answeredAt),
    ended_at: laterIso(existingAttempt?.call_ended_at, event.endedAt),
    provider_updated_at: laterIso(existingAttempt?.provider_updated_at, incomingUpdatedAt),
    duration_seconds: Math.max(
      Number(existingAttempt?.duration_seconds || 0),
      Number(event.durationSeconds || 0)
    ),
    disconnected_by: incomingWins
      ? (event.disconnectedBy || existingAttempt?.disconnected_by || null)
      : (existingAttempt?.disconnected_by || null),
    disconnect_party: incomingWins
      ? (event.disconnectParty || existingAttempt?.disconnect_party || null)
      : (existingAttempt?.disconnect_party || null),
    end_reason: incomingWins
      ? (event.endReason || existingAttempt?.end_reason || null)
      : (existingAttempt?.end_reason || null),
    outcome_source: incomingWins
      ? (event.outcomeSource || existingAttempt?.outcome_source || null)
      : (existingAttempt?.outcome_source || null),
    recording_url: event.recordingUrl || existingAttempt?.recording_url || null,
    reason: incomingWins
      ? (event.reason || existingAttempt?.reason || null)
      : (existingAttempt?.reason || null),
    ivr_inputs: event.ivrInputs ?? existingAttempt?.ivr_inputs ?? null,
    raw_event_type: incomingWins
      ? (event.rawEventType || existingAttempt?.raw_event_type || null)
      : (existingAttempt?.raw_event_type || null),
    raw_status: incomingWins
      ? (event.rawStatus || existingAttempt?.raw_status || null)
      : (existingAttempt?.raw_status || null),
  };

  const result = await run(
    client,
    `INSERT INTO call_commerce.call_attempts (
       attempt_id,workspace_id,brand_id,connection_id,provider_key,provider_call_id,
       lead_id,phone,business_number,event_type,call_status,direction,agent_id,agent_name,
       agent_phone,call_started_at,call_answered_at,call_ended_at,provider_updated_at,
       duration_seconds,disconnected_by,disconnect_party,end_reason,outcome_source,
       recording_url,reason,ivr_inputs,raw_event_type,raw_status,created_at,updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
       $16::timestamptz,$17::timestamptz,$18::timestamptz,$19::timestamptz,
       $20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28,$29,NOW(),NOW()
     )
     ON CONFLICT (workspace_id,brand_id,connection_id,provider_call_id)
     DO UPDATE SET
       lead_id=EXCLUDED.lead_id,
       business_number=COALESCE(EXCLUDED.business_number,call_commerce.call_attempts.business_number),
       event_type=EXCLUDED.event_type,
       call_status=EXCLUDED.call_status,
       direction=EXCLUDED.direction,
       agent_id=EXCLUDED.agent_id,
       agent_name=EXCLUDED.agent_name,
       agent_phone=EXCLUDED.agent_phone,
       call_started_at=COALESCE(EXCLUDED.call_started_at,call_commerce.call_attempts.call_started_at),
       call_answered_at=COALESCE(EXCLUDED.call_answered_at,call_commerce.call_attempts.call_answered_at),
       call_ended_at=COALESCE(EXCLUDED.call_ended_at,call_commerce.call_attempts.call_ended_at),
       provider_updated_at=COALESCE(EXCLUDED.provider_updated_at,call_commerce.call_attempts.provider_updated_at),
       duration_seconds=GREATEST(COALESCE(call_commerce.call_attempts.duration_seconds,0),COALESCE(EXCLUDED.duration_seconds,0)),
       disconnected_by=EXCLUDED.disconnected_by,
       disconnect_party=EXCLUDED.disconnect_party,
       end_reason=EXCLUDED.end_reason,
       outcome_source=EXCLUDED.outcome_source,
       recording_url=COALESCE(EXCLUDED.recording_url,call_commerce.call_attempts.recording_url),
       reason=EXCLUDED.reason,
       ivr_inputs=EXCLUDED.ivr_inputs,
       raw_event_type=EXCLUDED.raw_event_type,
       raw_status=EXCLUDED.raw_status,
       updated_at=NOW()
     RETURNING *`,
    [
      values.attempt_id,
      values.workspace_id,
      values.brand_id,
      values.connection_id,
      values.provider_key,
      values.provider_call_id,
      values.lead_id,
      values.phone,
      values.business_number,
      values.event_type,
      values.call_status,
      values.direction,
      values.agent_id,
      values.agent_name,
      values.agent_phone,
      values.started_at,
      values.answered_at,
      values.ended_at,
      values.provider_updated_at,
      values.duration_seconds,
      values.disconnected_by,
      values.disconnect_party,
      values.end_reason,
      values.outcome_source,
      values.recording_url,
      values.reason,
      JSON.stringify(values.ivr_inputs ?? null),
      values.raw_event_type,
      values.raw_status,
    ]
  );

  return {
    created,
    attempt: result.rows[0] || values,
  };
}

async function refreshLeadCallSummary(input, client) {
  const summaryResult = await run(
    client,
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE call_status='ANSWERED')::int AS answered,
       COUNT(*) FILTER (WHERE call_status IN ('MISSED','NO_ANSWER','BUSY','REJECTED','FAILED'))::int AS unanswered,
       MIN(COALESCE(call_started_at,created_at)) AS first_call_at
     FROM call_commerce.call_attempts
     WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3`,
    [input.workspaceId, input.brandId, input.leadId]
  );

  const latestResult = await run(
    client,
    `SELECT
       attempt_id,provider_call_id,business_number,call_status,agent_name,duration_seconds,
       disconnect_party,end_reason,COALESCE(call_started_at,created_at) AS activity_at,
       call_ended_at,provider_updated_at
     FROM call_commerce.call_attempts
     WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
     ORDER BY COALESCE(call_started_at,created_at) DESC,COALESCE(provider_updated_at,updated_at) DESC
     LIMIT 1`,
    [input.workspaceId, input.brandId, input.leadId]
  );

  const summary = summaryResult.rows[0] || {};
  const latest = latestResult.rows[0] || {};

  await run(
    client,
    `UPDATE call_commerce.call_leads
     SET
       first_call_at=COALESCE($4::timestamptz,first_call_at),
       latest_call_at=$5::timestamptz,
       latest_call_status=$6,
       latest_agent_name=$7,
       latest_attempt_id=$8,
       latest_provider_call_id=$9,
       latest_business_number=$10,
       latest_duration_seconds=$11,
       latest_disconnect_party=$12,
       latest_end_reason=$13,
       call_attempt_count=$14,
       answered_attempt_count=$15,
       unanswered_attempt_count=$16,
       updated_at=NOW(),
       updated_by=$17
     WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3`,
    [
      input.workspaceId,
      input.brandId,
      input.leadId,
      asDate(summary.first_call_at)?.toISOString() || null,
      asDate(latest.activity_at)?.toISOString() || null,
      latest.call_status || null,
      latest.agent_name || null,
      latest.attempt_id || null,
      latest.provider_call_id || null,
      latest.business_number || null,
      latest.duration_seconds == null ? null : Number(latest.duration_seconds),
      latest.disconnect_party || null,
      latest.end_reason || null,
      Number(summary.total || 0),
      Number(summary.answered || 0),
      Number(summary.unanswered || 0),
      input.actor,
    ]
  );

  return summary;
}

export async function queueMetaEvent(input) {
  const eventCallIdentity = input.eventKey === 'CALL_LEAD_CONNECTED' ? '' : (input.callId || '');
  const eventId = deterministic('cc_meta', [
    input.workspaceId,
    input.brandId,
    input.eventKey,
    input.leadId,
    eventCallIdentity,
    input.eventKey === 'CALL_LEAD_CONVERTED' ? String(input.payload?.order_id || '') : '',
  ]);
  const queueId = deterministic('queue', [input.workspaceId, input.brandId, eventId]);

  await pgQuery(
    `INSERT INTO call_commerce.meta_event_queue (
       queue_id,workspace_id,brand_id,lead_id,call_id,event_key,event_name,event_id,
       payload,status,attempts,next_attempt_at,created_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'PENDING',0,NOW(),NOW(),NOW())
     ON CONFLICT (workspace_id,brand_id,event_id) DO NOTHING`,
    [
      queueId,
      input.workspaceId,
      input.brandId,
      input.leadId,
      input.callId || null,
      input.eventKey,
      input.eventName,
      eventId,
      JSON.stringify(input.payload ?? {}),
    ]
  );

  return eventId;
}

async function queueAnalyticsEvent(input, client) {
  const analyticsEventId = deterministic('cca', [
    input.workspaceId,
    input.brandId,
    input.eventType,
    input.entityType,
    input.entityId,
    input.occurredAt || '',
  ]);

  await run(
    client,
    `INSERT INTO call_commerce.analytics_outbox (
       analytics_event_id,workspace_id,brand_id,event_type,entity_type,entity_id,
       occurred_at,payload,status,attempts,created_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::jsonb,'PENDING',0,NOW(),NOW())
     ON CONFLICT (analytics_event_id) DO NOTHING`,
    [
      analyticsEventId,
      input.workspaceId,
      input.brandId,
      input.eventType,
      input.entityType,
      input.entityId,
      input.occurredAt || new Date().toISOString(),
      JSON.stringify(input.payload ?? {}),
    ]
  );
}

export async function ingestCanonicalEvent(event, actor = 'calling-cloud-run') {
  const settings = await getRuntimeSettings(event.workspaceId, event.brandId);

  const result = await pgTransaction(async client => {
    const lockKey = `${event.workspaceId}:${event.brandId}:${normalizePhone(event.customerPhone)}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

    const existingAttempt = await getProviderAttempt(event, client);
    let lead = null;

    if (existingAttempt?.lead_id) {
      const leadResult = await client.query(
        `SELECT lead_id,status
         FROM call_commerce.call_leads
         WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
         LIMIT 1`,
        [event.workspaceId, event.brandId, existingAttempt.lead_id]
      );
      lead = leadResult.rows[0] || null;
    }

    if (!lead) {
      lead = await findAttachableLead(
        {
          workspaceId: event.workspaceId,
          brandId: event.brandId,
          phone: event.customerPhone,
          callAt: event.startedAt || event.updatedAt || null,
        },
        settings,
        client
      );
    }

    const createdLead = !lead;
    const leadId = lead?.lead_id || await createCallLead(
      {
        workspaceId: event.workspaceId,
        brandId: event.brandId,
        phone: event.customerPhone,
        startedAt: event.startedAt || null,
        actor,
      },
      client
    );

    const attemptResult = await upsertCallAttempt(event, leadId, existingAttempt, client);
    const attempt = attemptResult.attempt;

    await refreshLeadCallSummary({
      workspaceId: event.workspaceId,
      brandId: event.brandId,
      leadId,
      actor,
    }, client);

    await queueAnalyticsEvent({
      workspaceId: event.workspaceId,
      brandId: event.brandId,
      eventType: 'call_attempt.upserted',
      entityType: 'call_attempt',
      entityId: attempt.attempt_id,
      occurredAt: event.updatedAt || event.endedAt || event.startedAt || new Date().toISOString(),
      payload: {
        lead_id: leadId,
        provider_call_id: event.providerCallId,
        call_status: attempt.call_status,
        direction: attempt.direction,
        duration_seconds: attempt.duration_seconds,
      },
    }, client);

    return {
      leadId,
      attempt,
      createdLead,
      createdAttempt: attemptResult.created,
    };
  });

  if (
    isAnswered(result.attempt.call_status) &&
    Number(result.attempt.duration_seconds || 0) >= settings.contactMinDurationSeconds
  ) {
    await queueMetaEvent({
      workspaceId: event.workspaceId,
      brandId: event.brandId,
      leadId: result.leadId,
      callId: result.attempt.attempt_id,
      eventKey: 'CALL_LEAD_CONNECTED',
      eventName: 'ConnectedCallLead',
      payload: {
        lead_type: 'call',
        source_module: 'call_commerce',
        lead_id: result.leadId,
        call_id: result.attempt.attempt_id,
        provider_call_id: event.providerCallId,
        phone: event.customerPhone,
        business_number: event.businessNumber || null,
        duration_seconds: Number(result.attempt.duration_seconds || 0),
      },
    });
  }

  return {
    leadId: result.leadId,
    attemptId: result.attempt.attempt_id,
    providerCallId: event.providerCallId,
    createdLead: result.createdLead,
    createdAttempt: result.createdAttempt,
    attachedToExistingLead: !result.createdLead,
  };
}

export function getCallCommerceConfig() {
  return {
    projectId: PROJECT_ID || null,
    store: 'postgres',
    postgres: getPostgresConfig(),
    defaultContactMinDurationSeconds: DEFAULT_CONTACT_MIN_DURATION_SECONDS,
    defaultReopenGraceMinutes: DEFAULT_REOPEN_GRACE_MINUTES,
  };
}
