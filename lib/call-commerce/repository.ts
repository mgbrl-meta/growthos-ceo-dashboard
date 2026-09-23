import 'server-only';

import crypto from 'crypto';
import { bigquery } from '@/lib/bigquery';
import { CALL_COMMERCE_DATASET, CALL_COMMERCE_DEFAULTS, CALL_COMMERCE_LOCATION } from './config';
import { ensureCallCommerceSchema } from './schema';
import { getIntegrationConnection } from '@/lib/integrations/store';
import type { CallingFieldMapping, CallingValueMapping, CanonicalCallEvent } from './types';

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || '';
const table = (name: string) => `\`${PROJECT_ID}.${CALL_COMMERCE_DATASET}.${name}\``;
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
const deterministic = (prefix: string, parts: string[]) => `${prefix}_${crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 24)}`;

function requireProject() {
  if (!PROJECT_ID) throw new Error('Call Commerce requires GCP project configuration');
}

export async function listCallingConnections(workspaceId: string, brandId: string) {
  requireProject();
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('calling_connections')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND status != 'deleted' ORDER BY created_at DESC`,
    params: { workspace_id: workspaceId, brand_id: brandId },
  });
  return rows as any[];
}

export async function getCallingConnectionById(connectionId: string) {
  requireProject();
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('calling_connections')} WHERE connection_id=@connection_id LIMIT 1`,
    params: { connection_id: connectionId },
  });
  return (rows as any[])[0] || null;
}

// Low-latency webhook lookup. The calling connection can only exist after the
// Call Commerce schema has already been provisioned during setup/activation,
// so live provider webhooks must not run schema DDL before acknowledgement.
export async function getCallingConnectionByIdFast(connectionId: string) {
  requireProject();
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('calling_connections')} WHERE connection_id=@connection_id LIMIT 1`,
    params: { connection_id: connectionId },
  });
  return (rows as any[])[0] || null;
}

export async function createCallingConnection(input: {
  workspaceId: string; brandId: string; connectionName: string; providerKey: string;
}) {
  requireProject(); await ensureCallCommerceSchema();
  const connectionId = id('ccn');
  const webhookSecret = crypto.randomBytes(24).toString('hex');
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `INSERT INTO ${table('calling_connections')} (connection_id,workspace_id,brand_id,connection_name,provider_key,status,webhook_secret,created_at,updated_at) VALUES (@connection_id,@workspace_id,@brand_id,@connection_name,@provider_key,'testing',@webhook_secret,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())`,
    params: { connection_id: connectionId, workspace_id: input.workspaceId, brand_id: input.brandId, connection_name: input.connectionName, provider_key: input.providerKey, webhook_secret: webhookSecret },
  });
  return { connectionId, webhookSecret };
}


export async function deleteCallingConnection(input: {
  workspaceId: string; brandId: string; connectionId: string;
}) {
  requireProject(); await ensureCallCommerceSchema();
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT connection_id FROM ${table('calling_connections')} WHERE connection_id=@connection_id AND workspace_id=@workspace_id AND brand_id=@brand_id AND status != 'deleted' LIMIT 1`,
    params: { connection_id: input.connectionId, workspace_id: input.workspaceId, brand_id: input.brandId },
  });
  if (!(rows as any[])?.length) throw new Error('CALLING_CONNECTION_NOT_FOUND');

  // Soft-delete the connector so historical call/audit rows remain referentially intact.
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `UPDATE ${table('calling_connections')} SET status='deleted',active_mapping_version_id=NULL,updated_at=CURRENT_TIMESTAMP() WHERE connection_id=@connection_id AND workspace_id=@workspace_id AND brand_id=@brand_id`,
    params: { connection_id: input.connectionId, workspace_id: input.workspaceId, brand_id: input.brandId },
  });

  return { connectionId: input.connectionId, deleted: true };
}

export async function saveMappingVersion(input: {
  workspaceId: string; brandId: string; connectionId: string;
  fieldMappings: CallingFieldMapping[]; valueMappings: CallingValueMapping[]; activate?: boolean;
}) {
  requireProject(); await ensureCallCommerceSchema();
  const [countRows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT COALESCE(MAX(version),0)+1 AS next_version FROM ${table('calling_mapping_versions')} WHERE connection_id=@connection_id`,
    params: { connection_id: input.connectionId },
  });
  const version = Number((countRows as any[])?.[0]?.next_version || 1);
  const mappingVersionId = id('map');
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `INSERT INTO ${table('calling_mapping_versions')} (mapping_version_id,connection_id,workspace_id,brand_id,version,status,field_mappings,value_mappings,created_at,activated_at) VALUES (@mapping_version_id,@connection_id,@workspace_id,@brand_id,@version,@status,PARSE_JSON(@field_mappings),PARSE_JSON(@value_mappings),CURRENT_TIMESTAMP(),IF(@activate,CURRENT_TIMESTAMP(),NULL))`,
    params: { mapping_version_id: mappingVersionId, connection_id: input.connectionId, workspace_id: input.workspaceId, brand_id: input.brandId, version, status: input.activate ? 'active' : 'draft', field_mappings: JSON.stringify(input.fieldMappings), value_mappings: JSON.stringify(input.valueMappings), activate: Boolean(input.activate) },
  });
  if (input.activate) {
    await bigquery.query({
      location: CALL_COMMERCE_LOCATION,
      query: `UPDATE ${table('calling_connections')} SET active_mapping_version_id=@mapping_version_id,status='active',updated_at=CURRENT_TIMESTAMP() WHERE connection_id=@connection_id AND workspace_id=@workspace_id AND brand_id=@brand_id`,
      params: { mapping_version_id: mappingVersionId, connection_id: input.connectionId, workspace_id: input.workspaceId, brand_id: input.brandId },
    });
  }
  return { mappingVersionId, version };
}

export async function getActiveMapping(connectionId: string) {
  const connection = await getCallingConnectionById(connectionId);
  if (!connection?.active_mapping_version_id) return null;
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('calling_mapping_versions')} WHERE mapping_version_id=@mapping_version_id LIMIT 1`,
    params: { mapping_version_id: connection.active_mapping_version_id },
  });
  return (rows as any[])[0] || null;
}

export async function getCallingMappingById(mappingVersionId: string) {
  requireProject();
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('calling_mapping_versions')} WHERE mapping_version_id=@mapping_version_id LIMIT 1`,
    params: { mapping_version_id: mappingVersionId },
  });
  return (rows as any[])[0] || null;
}

export async function storeTestEvent(input: { connection: any; payload: unknown; discoveredFields: unknown }) {
  const testEventId = id('tst');
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `INSERT INTO ${table('calling_test_events')} (test_event_id,connection_id,workspace_id,brand_id,provider_key,payload,discovered_fields,received_at) VALUES (@test_event_id,@connection_id,@workspace_id,@brand_id,@provider_key,PARSE_JSON(@payload),PARSE_JSON(@discovered_fields),CURRENT_TIMESTAMP())`,
    params: { test_event_id: testEventId, connection_id: input.connection.connection_id, workspace_id: input.connection.workspace_id, brand_id: input.connection.brand_id, provider_key: input.connection.provider_key, payload: JSON.stringify(input.payload ?? {}), discovered_fields: JSON.stringify(input.discoveredFields ?? []) },
  });
  await bigquery.query({ location: CALL_COMMERCE_LOCATION, query: `UPDATE ${table('calling_connections')} SET last_event_at=CURRENT_TIMESTAMP(),updated_at=CURRENT_TIMESTAMP() WHERE connection_id=@connection_id`, params: { connection_id: input.connection.connection_id } });
  return testEventId;
}

export async function getLatestTestEvent(connectionId: string) {
  const [rows] = await bigquery.query({ location: CALL_COMMERCE_LOCATION, query: `SELECT * FROM ${table('calling_test_events')} WHERE connection_id=@connection_id ORDER BY received_at DESC LIMIT 1`, params: { connection_id: connectionId } });
  return (rows as any[])[0] || null;
}

export async function insertRawEvent(input: { event: CanonicalCallEvent | null; connection: any; payload: unknown; mappingVersionId?: string | null; status: string; error?: string | null }) {
  const rawEventId = id('raw');
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `INSERT INTO ${table('raw_call_events')} (raw_event_id,workspace_id,brand_id,connection_id,provider_key,provider_call_id,provider_event_id,raw_event_type,raw_status,payload,mapping_version_id,processing_status,processing_error,received_at,processed_at) VALUES (@raw_event_id,@workspace_id,@brand_id,@connection_id,@provider_key,@provider_call_id,@provider_event_id,@raw_event_type,@raw_status,PARSE_JSON(@payload),@mapping_version_id,@processing_status,@processing_error,CURRENT_TIMESTAMP(),IF(@processing_status='processed',CURRENT_TIMESTAMP(),NULL))`,
    params: { raw_event_id: rawEventId, workspace_id: input.connection.workspace_id, brand_id: input.connection.brand_id, connection_id: input.connection.connection_id, provider_key: input.connection.provider_key, provider_call_id: input.event?.providerCallId || null, provider_event_id: input.event?.providerEventId || null, raw_event_type: input.event?.rawEventType || null, raw_status: input.event?.rawStatus || null, payload: JSON.stringify(input.payload ?? {}), mapping_version_id: input.mappingVersionId || null, processing_status: input.status, processing_error: input.error || null },
  });
  return rawEventId;
}

export async function beginRawEventDelivery(input: {
  deliveryId: string;
  pubsubMessageId?: string | null;
  acceptedAt: string;
  workspaceId: string;
  brandId: string;
  connectionId: string;
  providerKey: string;
  mappingVersionId: string;
  payload: unknown;
}) {
  requireProject();
  const rawEventId = deterministic('raw', [input.workspaceId, input.brandId, input.connectionId, input.deliveryId]);
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `MERGE ${table('raw_call_events')} t
      USING (SELECT @delivery_id delivery_id) s
      ON t.workspace_id=@workspace_id AND t.brand_id=@brand_id AND t.connection_id=@connection_id AND t.delivery_id=s.delivery_id
      WHEN MATCHED THEN UPDATE SET
        pubsub_message_id=COALESCE(@pubsub_message_id,t.pubsub_message_id),
        processing_status=IF(t.processing_status='processed',t.processing_status,'processing'),
        processing_error=IF(t.processing_status='processed',t.processing_error,NULL)
      WHEN NOT MATCHED THEN INSERT (
        raw_event_id,delivery_id,pubsub_message_id,workspace_id,brand_id,connection_id,provider_key,
        payload,mapping_version_id,processing_status,processing_error,received_at,processed_at
      ) VALUES (
        @raw_event_id,@delivery_id,@pubsub_message_id,@workspace_id,@brand_id,@connection_id,@provider_key,
        PARSE_JSON(@payload),@mapping_version_id,'processing',NULL,@accepted_at,NULL
      )`,
    params: {
      raw_event_id: rawEventId,
      delivery_id: input.deliveryId,
      pubsub_message_id: input.pubsubMessageId || null,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      connection_id: input.connectionId,
      provider_key: input.providerKey,
      payload: JSON.stringify(input.payload ?? {}),
      mapping_version_id: input.mappingVersionId,
      accepted_at: input.acceptedAt,
    },
    types: { accepted_at: 'TIMESTAMP' },
  });
  return rawEventId;
}

export async function finalizeRawEventDelivery(input: {
  rawEventId: string;
  event?: CanonicalCallEvent | null;
  status: 'processing' | 'raw_only' | 'processed' | 'failed' | 'retry';
  error?: string | null;
}) {
  requireProject();
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `UPDATE ${table('raw_call_events')} SET
      provider_call_id=COALESCE(@provider_call_id,provider_call_id),
      provider_event_id=COALESCE(@provider_event_id,provider_event_id),
      raw_event_type=COALESCE(@raw_event_type,raw_event_type),
      raw_status=COALESCE(@raw_status,raw_status),
      processing_status=@processing_status,
      processing_error=@processing_error,
      processed_at=IF(@processing_status IN ('processed','raw_only','failed'),CURRENT_TIMESTAMP(),processed_at)
    WHERE raw_event_id=@raw_event_id`,
    params: {
      raw_event_id: input.rawEventId,
      provider_call_id: input.event?.providerCallId || null,
      provider_event_id: input.event?.providerEventId || null,
      raw_event_type: input.event?.rawEventType || null,
      raw_status: input.event?.rawStatus || null,
      processing_status: input.status,
      processing_error: input.error || null,
    },
  });
}

export async function markCallingConnectionProcessingResult(input: {
  connectionId: string;
  acceptedAt: string;
  success: boolean;
  error?: string | null;
}) {
  requireProject();
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `UPDATE ${table('calling_connections')} SET
      last_event_at=IF(last_event_at IS NULL OR last_event_at<@accepted_at,@accepted_at,last_event_at),
      last_success_at=IF(@success,CURRENT_TIMESTAMP(),last_success_at),
      last_error=IF(@success,NULL,@last_error),
      updated_at=CURRENT_TIMESTAMP()
    WHERE connection_id=@connection_id`,
    params: {
      connection_id: input.connectionId,
      accepted_at: input.acceptedAt,
      success: input.success,
      last_error: input.error || null,
    },
    types: { accepted_at: 'TIMESTAMP' },
  });
}

const OPEN_LEAD_STATUSES = new Set(['NEW', 'QUALIFIED', 'FOLLOW_UP']);
const TERMINAL_LEAD_STATUSES = new Set(['PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST']);

function isAnswered(status: string) { return status === 'ANSWERED'; }
function isUnanswered(status: string) { return ['MISSED','NO_ANSWER','BUSY','REJECTED','FAILED'].includes(status); }

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/[^0-9+]/g, '').trim();
}

function asDate(value: any): Date | null {
  const raw = value?.value ?? value;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function earlierIso(a: any, b: any) {
  const da = asDate(a);
  const db = asDate(b);
  if (!da) return db?.toISOString() || null;
  if (!db) return da.toISOString();
  return (da.getTime() <= db.getTime() ? da : db).toISOString();
}

function laterIso(a: any, b: any) {
  const da = asDate(a);
  const db = asDate(b);
  if (!da) return db?.toISOString() || null;
  if (!db) return da.toISOString();
  return (da.getTime() >= db.getTime() ? da : db).toISOString();
}

function callStatusRank(status: string) {
  const ranks: Record<string, number> = {
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

async function getProviderAttempt(event: CanonicalCallEvent) {
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('call_attempts')}
      WHERE workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND connection_id=@connection_id
        AND provider_call_id=@provider_call_id
      ORDER BY created_at ASC
      LIMIT 1`,
    params: {
      workspace_id: event.workspaceId,
      brand_id: event.brandId,
      connection_id: event.connectionId,
      provider_call_id: event.providerCallId,
    },
  });
  return (rows as any[])[0] || null;
}

async function findAttachableLead(input: {
  workspaceId: string;
  brandId: string;
  phone: string;
  callAt?: string | Date | null;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT lead_id,status,status_changed_at,latest_call_at,updated_at,created_at
      FROM ${table('call_leads')}
      WHERE workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND phone=@phone
        AND is_archived=FALSE
        AND status IN ('NEW','QUALIFIED','FOLLOW_UP','PURCHASED','UNQUALIFIED','CLOSED_LOST')
      ORDER BY COALESCE(latest_call_at,updated_at,created_at) DESC
      LIMIT 50`,
    params: {
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      phone,
    },
  });

  const candidates = rows as any[];
  const open = candidates.find(row => OPEN_LEAD_STATUSES.has(String(row.status || '').toUpperCase()));
  if (open) return open;

  const callAt = asDate(input.callAt) || new Date();
  const graceMs = CALL_COMMERCE_DEFAULTS.reopenGraceMinutes * 60_000;
  let bestTerminal: any = null;
  let bestTerminalAt = -1;

  for (const row of candidates) {
    const status = String(row.status || '').toUpperCase();
    if (!TERMINAL_LEAD_STATUSES.has(status)) continue;
    // status_changed_at is intentionally separate from call/webhook updated_at.
    // A later provider callback must never extend the terminal reopen grace window.
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

async function createCallLead(input: {
  workspaceId: string;
  brandId: string;
  phone: string;
  actor: string;
  startedAt?: string | null;
  customerName?: string | null;
  email?: string | null;
  product?: string | null;
  notes?: string | null;
}) {
  const leadId = id('CL');
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `INSERT INTO ${table('call_leads')} (
      lead_id,workspace_id,brand_id,phone,customer_name,email,product,status,notes,currency,
      status_changed_at,first_call_at,latest_call_at,call_attempt_count,answered_attempt_count,
      unanswered_attempt_count,is_archived,created_at,updated_at,created_by,updated_by
    ) VALUES (
      @lead_id,@workspace_id,@brand_id,@phone,@customer_name,@email,@product,'NEW',@notes,'INR',
      CURRENT_TIMESTAMP(),COALESCE(@started_at,CURRENT_TIMESTAMP()),COALESCE(@started_at,CURRENT_TIMESTAMP()),
      0,0,0,FALSE,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP(),@actor,@actor
    )`,
    params: {
      lead_id: leadId,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      phone: normalizePhone(input.phone),
      customer_name: input.customerName || null,
      email: input.email || null,
      product: input.product || null,
      notes: input.notes || null,
      started_at: input.startedAt || null,
      actor: input.actor,
    },
    types: { started_at: 'TIMESTAMP' },
  });
  return leadId;
}

async function upsertCallAttempt(event: CanonicalCallEvent, leadId: string, existingAttempt: any) {
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
  const incomingUpdatedAt = asDate(event.updatedAt) || asDate(event.endedAt) || asDate(event.startedAt) || new Date();
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
    duration_seconds: Math.max(Number(existingAttempt?.duration_seconds || 0), Number(event.durationSeconds || 0)),
    disconnected_by: incomingWins ? (event.disconnectedBy || existingAttempt?.disconnected_by || null) : (existingAttempt?.disconnected_by || null),
    disconnect_party: incomingWins ? (event.disconnectParty || existingAttempt?.disconnect_party || null) : (existingAttempt?.disconnect_party || null),
    end_reason: incomingWins ? (event.endReason || existingAttempt?.end_reason || null) : (existingAttempt?.end_reason || null),
    outcome_source: incomingWins ? (event.outcomeSource || existingAttempt?.outcome_source || null) : (existingAttempt?.outcome_source || null),
    recording_url: event.recordingUrl || existingAttempt?.recording_url || null,
    reason: incomingWins ? (event.reason || existingAttempt?.reason || null) : (existingAttempt?.reason || null),
    ivr_inputs: event.ivrInputs ?? existingAttempt?.ivr_inputs ?? null,
    raw_event_type: incomingWins ? (event.rawEventType || existingAttempt?.raw_event_type || null) : (existingAttempt?.raw_event_type || null),
    raw_status: incomingWins ? (event.rawStatus || existingAttempt?.raw_status || null) : (existingAttempt?.raw_status || null),
  };

  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `MERGE ${table('call_attempts')} t
      USING (SELECT @workspace_id workspace_id,@brand_id brand_id,@connection_id connection_id,@provider_call_id provider_call_id) s
      ON t.workspace_id=s.workspace_id
       AND t.brand_id=s.brand_id
       AND t.connection_id=s.connection_id
       AND t.provider_call_id=s.provider_call_id
      WHEN MATCHED THEN UPDATE SET
        lead_id=@lead_id,
        business_number=COALESCE(@business_number,t.business_number),
        event_type=@event_type,
        call_status=@call_status,
        direction=@direction,
        agent_id=@agent_id,
        agent_name=@agent_name,
        agent_phone=@agent_phone,
        call_started_at=COALESCE(@started_at,t.call_started_at),
        call_answered_at=COALESCE(@answered_at,t.call_answered_at),
        call_ended_at=COALESCE(@ended_at,t.call_ended_at),
        provider_updated_at=COALESCE(@provider_updated_at,t.provider_updated_at),
        duration_seconds=GREATEST(COALESCE(t.duration_seconds,0),COALESCE(@duration_seconds,0)),
        disconnected_by=NULLIF(@disconnected_by,''),
        disconnect_party=NULLIF(@disconnect_party,''),
        end_reason=NULLIF(@end_reason,''),
        outcome_source=NULLIF(@outcome_source,''),
        recording_url=COALESCE(@recording_url,t.recording_url),
        reason=@reason,
        ivr_inputs=PARSE_JSON(@ivr_inputs),
        raw_event_type=@raw_event_type,
        raw_status=@raw_status,
        updated_at=CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        attempt_id,workspace_id,brand_id,connection_id,provider_key,provider_call_id,lead_id,phone,
        business_number,event_type,call_status,direction,agent_id,agent_name,agent_phone,call_started_at,
        call_answered_at,call_ended_at,provider_updated_at,duration_seconds,disconnected_by,disconnect_party,end_reason,outcome_source,recording_url,
        reason,ivr_inputs,raw_event_type,raw_status,created_at,updated_at
      ) VALUES (
        @attempt_id,@workspace_id,@brand_id,@connection_id,@provider_key,@provider_call_id,@lead_id,@phone,
        @business_number,@event_type,@call_status,@direction,@agent_id,@agent_name,@agent_phone,@started_at,
        @answered_at,@ended_at,@provider_updated_at,@duration_seconds,NULLIF(@disconnected_by,''),NULLIF(@disconnect_party,''),NULLIF(@end_reason,''),NULLIF(@outcome_source,''),@recording_url,
        @reason,PARSE_JSON(@ivr_inputs),@raw_event_type,@raw_status,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()
      )`,
    params: {
      ...values,
      disconnected_by: values.disconnected_by || '',
      disconnect_party: values.disconnect_party || '',
      end_reason: values.end_reason || '',
      outcome_source: values.outcome_source || '',
      ivr_inputs: JSON.stringify(values.ivr_inputs ?? null),
    },
    types: {
      started_at: 'TIMESTAMP',
      answered_at: 'TIMESTAMP',
      ended_at: 'TIMESTAMP',
      provider_updated_at: 'TIMESTAMP',
    },
  });

  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('call_attempts')}
      WHERE workspace_id=@workspace_id AND brand_id=@brand_id
        AND connection_id=@connection_id AND provider_call_id=@provider_call_id
      ORDER BY created_at ASC LIMIT 1`,
    params: {
      workspace_id: event.workspaceId,
      brand_id: event.brandId,
      connection_id: event.connectionId,
      provider_call_id: event.providerCallId,
    },
  });

  return { created, attempt: (rows as any[])[0] || { ...values } };
}

async function refreshLeadCallSummary(input: {
  workspaceId: string;
  brandId: string;
  leadId: string;
  actor: string;
}) {
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `WITH attempts AS (
      SELECT *,COALESCE(call_started_at,created_at) AS activity_at
      FROM ${table('call_attempts')}
      WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND lead_id=@lead_id
    )
    SELECT
      COUNT(*) total,
      COUNTIF(call_status='ANSWERED') answered,
      COUNTIF(call_status IN ('MISSED','NO_ANSWER','BUSY','REJECTED','FAILED')) unanswered,
      MIN(activity_at) first_call_at,
      ARRAY_AGG(STRUCT(
        attempt_id,provider_call_id,business_number,call_status,agent_name,duration_seconds,
        disconnect_party,end_reason,activity_at,call_ended_at,provider_updated_at
      ) ORDER BY activity_at DESC,COALESCE(provider_updated_at,updated_at) DESC LIMIT 1)[SAFE_OFFSET(0)] latest
    FROM attempts`,
    params: {
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      lead_id: input.leadId,
    },
  });

  const summary: any = (rows as any[])[0] || {};
  const latest: any = summary.latest || {};
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `UPDATE ${table('call_leads')} SET
      first_call_at=COALESCE(@first_call_at,first_call_at),
      latest_call_at=@latest_call_at,
      latest_call_status=@latest_call_status,
      latest_agent_name=@latest_agent_name,
      latest_attempt_id=@latest_attempt_id,
      latest_provider_call_id=@latest_provider_call_id,
      latest_business_number=@latest_business_number,
      latest_duration_seconds=@latest_duration_seconds,
      latest_disconnect_party=NULLIF(@latest_disconnect_party,''),
      latest_end_reason=NULLIF(@latest_end_reason,''),
      call_attempt_count=@total,
      answered_attempt_count=@answered,
      unanswered_attempt_count=@unanswered,
      updated_at=CURRENT_TIMESTAMP(),
      updated_by=@actor
    WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND lead_id=@lead_id`,
    params: {
      first_call_at: asDate(summary.first_call_at)?.toISOString() || null,
      latest_call_at: asDate(latest.activity_at)?.toISOString() || null,
      latest_call_status: latest.call_status || null,
      latest_agent_name: latest.agent_name || null,
      latest_attempt_id: latest.attempt_id || null,
      latest_provider_call_id: latest.provider_call_id || null,
      latest_business_number: latest.business_number || null,
      latest_duration_seconds: latest.duration_seconds == null ? null : Number(latest.duration_seconds),
      latest_disconnect_party: String(latest.disconnect_party || ''),
      latest_end_reason: String(latest.end_reason || ''),
      total: Number(summary.total || 0),
      answered: Number(summary.answered || 0),
      unanswered: Number(summary.unanswered || 0),
      actor: input.actor,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      lead_id: input.leadId,
    },
    types: { first_call_at: 'TIMESTAMP', latest_call_at: 'TIMESTAMP' },
  });

  return summary;
}

export async function ingestCanonicalEvent(
  event: CanonicalCallEvent,
  actor = 'calling-webhook',
  options?: { skipSchemaEnsure?: boolean }
) {
  if (!options?.skipSchemaEnsure) await ensureCallCommerceSchema();

  // Provider IDs identify one provider call attempt only. Growth OS owns the
  // business identities (CL_* thread and CA_* attempt).
  const existingAttempt = await getProviderAttempt(event);
  let lead: any = null;

  // Updates for an already-seen provider call must stay on the exact same
  // Growth OS attempt/thread even if the lead later becomes terminal.
  if (existingAttempt?.lead_id) {
    const [leadRows] = await bigquery.query({
      location: CALL_COMMERCE_LOCATION,
      query: `SELECT lead_id,status FROM ${table('call_leads')}
        WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND lead_id=@lead_id LIMIT 1`,
      params: {
        workspace_id: event.workspaceId,
        brand_id: event.brandId,
        lead_id: existingAttempt.lead_id,
      },
    });
    lead = (leadRows as any[])[0] || null;
  }

  if (!lead) {
    lead = await findAttachableLead({
      workspaceId: event.workspaceId,
      brandId: event.brandId,
      phone: event.customerPhone,
      callAt: event.startedAt || event.updatedAt || null,
    });
  }

  const createdLead = !lead;
  const leadId = lead?.lead_id || await createCallLead({
    workspaceId: event.workspaceId,
    brandId: event.brandId,
    phone: event.customerPhone,
    startedAt: event.startedAt || null,
    actor,
  });

  const attemptResult = await upsertCallAttempt(event, leadId, existingAttempt);
  const attempt = attemptResult.attempt;
  await refreshLeadCallSummary({
    workspaceId: event.workspaceId,
    brandId: event.brandId,
    leadId,
    actor,
  });

  if (isAnswered(String(attempt.call_status || '')) && Number(attempt.duration_seconds || 0) >= CALL_COMMERCE_DEFAULTS.contactMinDurationSeconds) {
    await queueMetaEvent({
      workspaceId: event.workspaceId,
      brandId: event.brandId,
      leadId,
      callId: attempt.attempt_id,
      eventKey: 'CALL_LEAD_CONNECTED',
      eventName: 'ConnectedCallLead',
      payload: {
        lead_type: 'call',
        source_module: 'call_commerce',
        lead_id: leadId,
        call_id: attempt.attempt_id,
        provider_call_id: event.providerCallId,
        phone: event.customerPhone,
        business_number: event.businessNumber || null,
        duration_seconds: Number(attempt.duration_seconds || 0),
      },
    });
  }

  return {
    leadId,
    attemptId: attempt.attempt_id,
    providerCallId: event.providerCallId,
    createdLead,
    createdAttempt: attemptResult.created,
    attachedToExistingLead: !createdLead,
  };
}

export async function listLeads(input: { workspaceId: string; brandId: string; archived?: boolean; status?: string; search?: string; limit?: number; offset?: number }) {
  requireProject();
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 500);
  const offset = Math.max(Number(input.offset || 0), 0);
  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `SELECT * FROM ${table('call_leads')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND is_archived=@archived AND (@status='' OR status=@status) AND (@search='' OR LOWER(CONCAT(COALESCE(phone,''),' ',COALESCE(customer_name,''),' ',COALESCE(email,''),' ',COALESCE(product,''),' ',COALESCE(order_id,''))) LIKE CONCAT('%',LOWER(@search),'%')) ORDER BY latest_call_at DESC,updated_at DESC LIMIT @limit OFFSET @offset`,
    params: { workspace_id: input.workspaceId, brand_id: input.brandId, archived: Boolean(input.archived), status: input.status || '', search: input.search || '', limit, offset },
    types: { limit: 'INT64', offset: 'INT64' },
  });
  const [counts] = await bigquery.query({ location: CALL_COMMERCE_LOCATION, query: `SELECT COUNT(*) total FROM ${table('call_leads')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND is_archived=@archived`, params: { workspace_id: input.workspaceId, brand_id: input.brandId, archived: Boolean(input.archived) } });
  return { rows, total: Number((counts as any[])?.[0]?.total || 0) };
}

export async function getLeadHistory(
  workspaceId: string,
  brandId: string,
  leadId: string
) {

  requireProject();


  const attemptsPromise =
    bigquery.query({
      location:
        CALL_COMMERCE_LOCATION,

      query: `
        SELECT *
        FROM ${table('call_attempts')}

        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND lead_id=@lead_id

        ORDER BY
          COALESCE(
            call_started_at,
            created_at
          ) DESC

        LIMIT 50
      `,

      params: {
        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        lead_id:
          leadId,
      },
    });


  const activityPromise =
    bigquery.query({
      location:
        CALL_COMMERCE_LOCATION,

      query: `
        SELECT *
        FROM ${table('activity_log')}

        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND lead_id=@lead_id

        ORDER BY created_at DESC

        LIMIT 100
      `,

      params: {
        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        lead_id:
          leadId,
      },
    });


  const [
    attemptsResult,
    activityResult,
  ] =
    await Promise.all([
      attemptsPromise,
      activityPromise,
    ]);


  return {
    attempts:
      attemptsResult[0],

    activity:
      activityResult[0],
  };
}

const transitions: Record<string, string[]> = {
  NEW: ['QUALIFIED','UNQUALIFIED'],
  QUALIFIED: ['FOLLOW_UP','PURCHASED'],
  FOLLOW_UP: ['FOLLOW_UP','PURCHASED','CLOSED_LOST'],
};

export async function updateLeadWorkflow(input: { workspaceId:string; brandId:string; leadId:string; actorUserId:string; action:string; data?:Record<string,unknown> }) {
  const [rows] = await bigquery.query({ location: CALL_COMMERCE_LOCATION, query: `SELECT * FROM ${table('call_leads')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND lead_id=@lead_id LIMIT 1`, params: { workspace_id: input.workspaceId, brand_id: input.brandId, lead_id: input.leadId } });
  const lead = (rows as any[])[0];
  if (!lead) throw new Error('CALL_LEAD_NOT_FOUND');
  if (['PURCHASED','UNQUALIFIED','CLOSED_LOST'].includes(String(lead.status)) && input.action !== 'update_details') throw new Error('CALL_LEAD_FINALIZED');

  if (input.action === 'update_details') {
    await bigquery.query({ location: CALL_COMMERCE_LOCATION, query: `UPDATE ${table('call_leads')} SET customer_name=@customer_name,email=@email,product=@product,notes=@notes,next_follow_up_at=@next_follow_up_at,updated_at=CURRENT_TIMESTAMP(),updated_by=@actor WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND lead_id=@lead_id`, params: { customer_name: input.data?.customerName || null, email: input.data?.email || null, product: input.data?.product || null, notes: input.data?.notes || null, next_follow_up_at: input.data?.nextFollowUpAt || null, actor: input.actorUserId, workspace_id: input.workspaceId, brand_id: input.brandId, lead_id: input.leadId }, types: { next_follow_up_at: 'TIMESTAMP' } });
    return { status: lead.status };
  }

  const targetByAction: Record<string,string> = { qualify:'QUALIFIED', unqualify:'UNQUALIFIED', follow_up:'FOLLOW_UP', purchase:'PURCHASED', close_lost:'CLOSED_LOST' };
  const target = targetByAction[input.action];
  if (!target || !(transitions[String(lead.status)] || []).includes(target)) throw new Error('INVALID_CALL_LEAD_TRANSITION');

  await bigquery.query({ location: CALL_COMMERCE_LOCATION, query: `UPDATE ${table('call_leads')} SET status=@target,status_changed_at=CURRENT_TIMESTAMP(),unqualified_reason=IF(@target='UNQUALIFIED',@reason,unqualified_reason),closed_lost_reason=IF(@target='CLOSED_LOST',@reason,closed_lost_reason),next_follow_up_at=IF(@target='FOLLOW_UP',@next_follow_up_at,next_follow_up_at),order_id=IF(@target='PURCHASED',@order_id,order_id),order_amount=IF(@target='PURCHASED',@order_amount,order_amount),purchased_at=IF(@target='PURCHASED',CURRENT_TIMESTAMP(),purchased_at),updated_at=CURRENT_TIMESTAMP(),updated_by=@actor WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND lead_id=@lead_id`, params: { target, reason: input.data?.reason || null, next_follow_up_at: input.data?.nextFollowUpAt || null, order_id: input.data?.orderId || null, order_amount: input.data?.orderAmount === undefined ? null : Number(input.data?.orderAmount), actor: input.actorUserId, workspace_id: input.workspaceId, brand_id: input.brandId, lead_id: input.leadId }, types: { next_follow_up_at:'TIMESTAMP', order_amount:'NUMERIC' } });

  await bigquery.query({ location: CALL_COMMERCE_LOCATION, query: `INSERT INTO ${table('activity_log')} (activity_id,workspace_id,brand_id,lead_id,activity_type,from_status,to_status,details,actor_user_id,created_at) VALUES (@activity_id,@workspace_id,@brand_id,@lead_id,@activity_type,@from_status,@to_status,PARSE_JSON(@details),@actor,CURRENT_TIMESTAMP())`, params: { activity_id:id('act'), workspace_id:input.workspaceId, brand_id:input.brandId, lead_id:input.leadId, activity_type:input.action, from_status:String(lead.status), to_status:target, details:JSON.stringify(input.data || {}), actor:input.actorUserId } });

  const eventMap: Record<string,[string,string]> = {
    QUALIFIED:['CALL_LEAD_QUALIFIED','QualifiedCallLead'],
    UNQUALIFIED:['CALL_LEAD_UNQUALIFIED','UnqualifiedCallLead'],
    PURCHASED:['CALL_LEAD_CONVERTED','ConvertedCallLead'],
  };
  if (eventMap[target]) {
    const [eventKey,eventName] = eventMap[target];
    await queueMetaEvent({ workspaceId:input.workspaceId, brandId:input.brandId, leadId:input.leadId, callId:null, eventKey, eventName, payload:{ lead_type:'call', source_module:'call_commerce', lead_id:input.leadId, phone:lead.phone, lead_status:target, order_id:target==='PURCHASED' ? input.data?.orderId || null : null, value:target==='PURCHASED' ? Number(input.data?.orderAmount || 0) : null, currency:lead.currency || 'INR' } });
  }
  return { status: target };
}

export async function createManualLead(input:{ workspaceId:string;brandId:string;actorUserId:string;phone:string;customerName?:string;email?:string;product?:string;notes?:string }) {
  await ensureCallCommerceSchema();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error('CALL_PHONE_REQUIRED');
  const now = new Date();
  let lead = await findAttachableLead({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    phone,
    callAt: now,
  });
  const createdLead = !lead;
  const leadId = lead?.lead_id || await createCallLead({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    phone,
    actor: input.actorUserId,
    startedAt: now.toISOString(),
    customerName: input.customerName || null,
    email: input.email || null,
    product: input.product || null,
    notes: input.notes || null,
  });

  const attemptId = id('CA');
  const providerCallId = `MANUAL_${crypto.randomUUID().replace(/-/g, '')}`;
  await bigquery.query({
    location: CALL_COMMERCE_LOCATION,
    query: `INSERT INTO ${table('call_attempts')} (
      attempt_id,workspace_id,brand_id,connection_id,provider_key,provider_call_id,lead_id,phone,
      event_type,call_status,direction,call_started_at,provider_updated_at,duration_seconds,created_at,updated_at
    ) VALUES (
      @attempt_id,@workspace_id,@brand_id,'manual','MANUAL',@provider_call_id,@lead_id,@phone,
      'manual.incoming_call','MANUAL_CREATED','INBOUND',@started_at,@provider_updated_at,0,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()
    )`,
    params: {
      attempt_id: attemptId,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      provider_call_id: providerCallId,
      lead_id: leadId,
      phone,
      started_at: now.toISOString(),
      provider_updated_at: now.toISOString(),
    },
    types: { started_at: 'TIMESTAMP', provider_updated_at: 'TIMESTAMP' },
  });

  await refreshLeadCallSummary({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    leadId,
    actor: input.actorUserId,
  });

  return { leadId, attemptId, providerCallId, createdLead, attachedToExistingLead: !createdLead };
}

export async function queueMetaEvent(input:{ workspaceId:string;brandId:string;leadId:string;callId:string|null;eventKey:string;eventName:string;payload:unknown }) {
  const metaConnection = await getIntegrationConnection(input.workspaceId, input.brandId, 'meta_events');
  if (!metaConnection || metaConnection.status !== 'connected') {
    return null;
  }
  const eventCallIdentity = input.eventKey === 'CALL_LEAD_CONNECTED' ? '' : (input.callId || '');
  const eventId = deterministic('cc_meta', [input.workspaceId,input.brandId,input.eventKey,input.leadId,eventCallIdentity, input.eventKey==='CALL_LEAD_CONVERTED' ? String((input.payload as any)?.order_id || '') : '']);
  const queueId = deterministic('queue',[input.workspaceId,input.brandId,eventId]);
  await bigquery.query({ location:CALL_COMMERCE_LOCATION, query:`MERGE ${table('meta_event_queue')} t USING (SELECT @event_id event_id) s ON t.workspace_id=@workspace_id AND t.brand_id=@brand_id AND t.event_id=s.event_id WHEN NOT MATCHED THEN INSERT (queue_id,workspace_id,brand_id,lead_id,call_id,event_key,event_name,event_id,payload,status,attempts,next_attempt_at,created_at,updated_at) VALUES (@queue_id,@workspace_id,@brand_id,@lead_id,@call_id,@event_key,@event_name,@event_id,PARSE_JSON(@payload),'PENDING',0,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())`, params:{ queue_id:queueId,workspace_id:input.workspaceId,brand_id:input.brandId,lead_id:input.leadId,call_id:input.callId,event_key:input.eventKey,event_name:input.eventName,event_id:eventId,payload:JSON.stringify(input.payload ?? {}) } });
  return eventId;
}

export async function getSummary(workspaceId:string,brandId:string,start?:string,end?:string) {
  const [rows] = await bigquery.query({ location:CALL_COMMERCE_LOCATION, query:`SELECT COUNT(*) calls,COUNTIF(answered_attempt_count>0) connected,COUNTIF(status IN ('QUALIFIED','FOLLOW_UP','PURCHASED','CLOSED_LOST')) qualified,COUNTIF(status='PURCHASED') purchased,COALESCE(SUM(IF(status='PURCHASED',order_amount,0)),0) revenue,SAFE_DIVIDE(COUNTIF(status IN ('QUALIFIED','FOLLOW_UP','PURCHASED','CLOSED_LOST')),COUNT(*))*100 qualification_rate,SAFE_DIVIDE(COUNTIF(status='PURCHASED'),COUNTIF(status IN ('QUALIFIED','FOLLOW_UP','PURCHASED','CLOSED_LOST')))*100 qualified_purchase_rate FROM ${table('call_leads')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND is_archived=FALSE AND (@start='' OR DATE(created_at)>=DATE(@start)) AND (@end='' OR DATE(created_at)<=DATE(@end))`, params:{workspace_id:workspaceId,brand_id:brandId,start:start||'',end:end||''} });
  return (rows as any[])[0] || {};
}

export async function listMetaEvents(workspaceId:string,brandId:string,limit=100) {
  const [rows]=await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`SELECT * FROM ${table('meta_event_queue')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id ORDER BY created_at DESC LIMIT @limit`,params:{workspace_id:workspaceId,brand_id:brandId,limit:Math.min(limit,500)},types:{limit:'INT64'}}); return rows;
}

export async function getSystemStatus(workspaceId:string,brandId:string) {
  const [connectionRows]=await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`SELECT COUNT(*) total,COUNTIF(status='active') active,MAX(last_event_at) last_event_at,MAX(last_success_at) last_success_at FROM ${table('calling_connections')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id`,params:{workspace_id:workspaceId,brand_id:brandId}});
  const [metaRows]=await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`SELECT COUNTIF(status='PENDING') pending,COUNTIF(status='RETRY') retry,COUNTIF(status='NEEDS_ATTENTION') needs_attention FROM ${table('meta_event_queue')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id`,params:{workspace_id:workspaceId,brand_id:brandId}});
  const [leadRows]=await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`SELECT MAX(latest_call_at) last_call_at,COUNT(*) active_leads FROM ${table('call_leads')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND is_archived=FALSE`,params:{workspace_id:workspaceId,brand_id:brandId}});
  return { calling:(connectionRows as any[])[0]||{}, meta:(metaRows as any[])[0]||{}, leads:(leadRows as any[])[0]||{} };
}

export async function archiveEligibleLeads(workspaceId:string,brandId:string) {
  await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`UPDATE ${table('call_leads')} AS l SET is_archived=TRUE,archived_at=CURRENT_TIMESTAMP(),updated_at=CURRENT_TIMESTAMP() WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND is_archived=FALSE AND NOT EXISTS (SELECT 1 FROM ${table('meta_event_queue')} q WHERE q.workspace_id=l.workspace_id AND q.brand_id=l.brand_id AND q.lead_id=l.lead_id AND q.status NOT IN ('SUCCESS')) AND ((status IN ('UNQUALIFIED','CLOSED_LOST') AND COALESCE(status_changed_at,updated_at)<TIMESTAMP_SUB(CURRENT_TIMESTAMP(),INTERVAL ${CALL_COMMERCE_DEFAULTS.terminalArchiveDays} DAY)) OR (status='PURCHASED' AND COALESCE(status_changed_at,updated_at)<TIMESTAMP_SUB(CURRENT_TIMESTAMP(),INTERVAL ${CALL_COMMERCE_DEFAULTS.terminalArchiveDays} DAY)) OR (status NOT IN ('PURCHASED','UNQUALIFIED','CLOSED_LOST') AND updated_at<TIMESTAMP_SUB(CURRENT_TIMESTAMP(),INTERVAL ${CALL_COMMERCE_DEFAULTS.generalArchiveDays} DAY)))`,params:{workspace_id:workspaceId,brand_id:brandId}});
}
