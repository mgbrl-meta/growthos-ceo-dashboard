import crypto from 'crypto';

import {
  BigQuery,
} from '@google-cloud/bigquery';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || ''
  ).trim();


const DATASET_ID =
  String(
    process.env.GROWTHOS_CALL_COMMERCE_DATASET
    || 'growthos_call_commerce'
  ).trim();


const CONTROL_DATASET =
  String(
    process.env.GROWTHOS_CONTROL_DATASET
    || 'growthos_control'
  ).trim();


const LOCATION =
  String(
    process.env.GROWTHOS_CALL_COMMERCE_LOCATION
    || process.env.GCP_BQ_LOCATION
    || 'asia-south1'
  ).trim();


const REOPEN_GRACE_MINUTES =
  Number(
    process.env.CALL_COMMERCE_REOPEN_GRACE_MINUTES
    || 30
  );


const CONTACT_MIN_DURATION_SECONDS =
  Number(
    process.env.CALL_COMMERCE_CONTACT_MIN_DURATION_SECONDS
    || 20
  );


if (!PROJECT_ID) {
  throw new Error('CALL_COMMERCE_WORKER_PROJECT_MISSING');
}


const bigquery =
  new BigQuery({
    projectId: PROJECT_ID,
  });


const table =
  name =>
    `\`${PROJECT_ID}.${DATASET_ID}.${name}\``;


const controlTable =
  name =>
    `\`${PROJECT_ID}.${CONTROL_DATASET}.${name}\``;


const id =
  prefix =>
    `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;


const deterministic =
  (prefix, parts) =>
    `${prefix}_${crypto
      .createHash('sha256')
      .update(parts.join(':'))
      .digest('hex')
      .slice(0, 24)}`;


const OPEN_LEAD_STATUSES =
  new Set([
    'NEW',
    'QUALIFIED',
    'FOLLOW_UP',
  ]);


const TERMINAL_LEAD_STATUSES =
  new Set([
    'PURCHASED',
    'UNQUALIFIED',
    'CLOSED_LOST',
  ]);


// ============================================================
// HELPERS
// ============================================================

function normalizePhone(value) {
  return String(value ?? '').replace(/[^0-9+]/g, '').trim();
}


function asDate(value) {
  const raw = value?.value ?? value;

  if (!raw) return null;

  const date = raw instanceof Date ? raw : new Date(raw);

  return Number.isNaN(date.getTime())
    ? null
    : date;
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
  const date = asDate(value);
  return date?.toISOString() || new Date().toISOString();
}

function nullableString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}


function nullableIntegerString(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.trunc(number)) : '';
}


// ============================================================
// CALLING CONTEXT INTEGRITY
//
// The queue message does not get to define tenant identity by
// itself. The persisted calling connection is authoritative.
// ============================================================

export async function resolveCallingContext(job) {
  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        SELECT
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
        FROM ${table('calling_connections')} c
        LEFT JOIN ${table('calling_mapping_versions')} m
          ON m.mapping_version_id=c.active_mapping_version_id
        WHERE c.connection_id=@connection_id
        LIMIT 1
      `,
      params: {
        connection_id: job.connectionId,
      },
    });

  const row = rows?.[0] || null;

  if (!row) {
    throw new Error('CALLING_CONNECTION_NOT_FOUND');
  }

  if (String(row.status || '').toLowerCase() !== 'active') {
    throw new Error('CALLING_CONNECTION_NOT_ACTIVE');
  }

  if (
    String(row.workspace_id || '') !== String(job.workspaceId || '')
    || String(row.brand_id || '') !== String(job.brandId || '')
    || String(row.provider_key || '') !== String(job.providerKey || '')
  ) {
    throw new Error('CALLING_JOB_TENANT_MISMATCH');
  }

  if (
    !row.active_mapping_version_id
    || String(row.active_mapping_version_id) !== String(job.mappingVersionId || '')
    || String(row.mapping_version_id || '') !== String(job.mappingVersionId || '')
  ) {
    throw new Error('CALLING_MAPPING_VERSION_MISMATCH');
  }

  if (String(row.mapping_status || '').toLowerCase() !== 'active') {
    throw new Error('CALLING_MAPPING_NOT_ACTIVE');
  }

  return row;
}


// ============================================================
// RAW DELIVERY
// ============================================================

export async function beginRawEventDelivery(input) {
  const receivedAt = normalizeAcceptedAt(input.acceptedAt);

  const rawEventId =
    deterministic(
      'raw',
      [
        input.workspaceId,
        input.brandId,
        input.connectionId,
        input.deliveryId,
      ]
    );

  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE ${table('raw_call_events')} t
      USING (SELECT @delivery_id AS delivery_id) s
      ON t.workspace_id=@workspace_id
       AND t.brand_id=@brand_id
       AND t.connection_id=@connection_id
       AND t.delivery_id=s.delivery_id

      WHEN MATCHED THEN
        UPDATE SET
          pubsub_message_id=COALESCE(NULLIF(@pubsub_message_id,''),t.pubsub_message_id),
          processing_status=IF(t.processing_status='processed',t.processing_status,'processing'),
          processing_error=IF(t.processing_status='processed',t.processing_error,NULL)

      WHEN NOT MATCHED THEN
        INSERT (
          raw_event_id,
          delivery_id,
          pubsub_message_id,
          workspace_id,
          brand_id,
          connection_id,
          provider_key,
          payload,
          mapping_version_id,
          processing_status,
          processing_error,
          received_at,
          processed_at
        )
        VALUES (
          @raw_event_id,
          @delivery_id,
          NULLIF(@pubsub_message_id,''),
          @workspace_id,
          @brand_id,
          @connection_id,
          @provider_key,
          PARSE_JSON(@payload),
          @mapping_version_id,
          'processing',
          NULL,
          COALESCE(SAFE_CAST(@accepted_at AS TIMESTAMP),CURRENT_TIMESTAMP()),
          NULL
        )
    `,
    params: {
      raw_event_id: rawEventId,
      delivery_id: input.deliveryId,
      pubsub_message_id: nullableString(input.pubsubMessageId),
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      connection_id: input.connectionId,
      provider_key: input.providerKey,
      payload: JSON.stringify(input.payload ?? {}),
      mapping_version_id: input.mappingVersionId,
      accepted_at: receivedAt,
    },
  });

  return rawEventId;
}


export async function finalizeRawEventDelivery(input) {
  await bigquery.query({
    location: LOCATION,
    query: `
      UPDATE ${table('raw_call_events')}
      SET
        provider_call_id=COALESCE(NULLIF(@provider_call_id,''),provider_call_id),
        provider_event_id=COALESCE(NULLIF(@provider_event_id,''),provider_event_id),
        raw_event_type=COALESCE(NULLIF(@raw_event_type,''),raw_event_type),
        raw_status=COALESCE(NULLIF(@raw_status,''),raw_status),
        processing_status=@processing_status,
        processing_error=NULLIF(@processing_error,''),
        processed_at=IF(
          @processing_status IN ('processed','raw_only','failed'),
          CURRENT_TIMESTAMP(),
          processed_at
        )
      WHERE raw_event_id=@raw_event_id
    `,
    params: {
      raw_event_id: input.rawEventId,
      provider_call_id: nullableString(input.event?.providerCallId),
      provider_event_id: nullableString(input.event?.providerEventId),
      raw_event_type: nullableString(input.event?.rawEventType),
      raw_status: nullableString(input.event?.rawStatus),
      processing_status: input.status,
      processing_error: nullableString(input.error),
    },
  });
}


export async function markCallingConnectionProcessingResult(input) {
  const acceptedAt = normalizeAcceptedAt(input.acceptedAt);

  await bigquery.query({
    location: LOCATION,
    query: `
      UPDATE ${table('calling_connections')}
      SET
        last_event_at=IF(
          last_event_at IS NULL
          OR last_event_at<SAFE_CAST(@accepted_at AS TIMESTAMP),
          SAFE_CAST(@accepted_at AS TIMESTAMP),
          last_event_at
        ),
        last_success_at=IF(@success,CURRENT_TIMESTAMP(),last_success_at),
        last_error=IF(@success,NULL,NULLIF(@last_error,'')),
        updated_at=CURRENT_TIMESTAMP()
      WHERE connection_id=@connection_id
    `,
    params: {
      connection_id: input.connectionId,
      accepted_at: acceptedAt,
      success: Boolean(input.success),
      last_error: nullableString(input.error),
    },
  });
}


// ============================================================
// CALL ATTEMPT / LEAD THREADING
// ============================================================

async function getProviderAttempt(event) {
  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        SELECT *
        FROM ${table('call_attempts')}
        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND connection_id=@connection_id
          AND provider_call_id=@provider_call_id
        ORDER BY created_at ASC
        LIMIT 1
      `,
      params: {
        workspace_id: event.workspaceId,
        brand_id: event.brandId,
        connection_id: event.connectionId,
        provider_call_id: event.providerCallId,
      },
    });

  return rows?.[0] || null;
}


async function findAttachableLead(input) {
  const phone = normalizePhone(input.phone);

  if (!phone) return null;

  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        SELECT
          lead_id,
          status,
          status_changed_at,
          latest_call_at,
          updated_at,
          created_at
        FROM ${table('call_leads')}
        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND phone=@phone
          AND is_archived=FALSE
          AND status IN ('NEW','QUALIFIED','FOLLOW_UP','PURCHASED','UNQUALIFIED','CLOSED_LOST')
        ORDER BY COALESCE(latest_call_at,updated_at,created_at) DESC
        LIMIT 50
      `,
      params: {
        workspace_id: input.workspaceId,
        brand_id: input.brandId,
        phone,
      },
    });

  const candidates = rows || [];

  const open =
    candidates.find(
      row =>
        OPEN_LEAD_STATUSES.has(
          String(row.status || '').toUpperCase()
        )
    );

  if (open) return open;

  const callAt = asDate(input.callAt) || new Date();
  const graceMs = REOPEN_GRACE_MINUTES * 60_000;

  let bestTerminal = null;
  let bestTerminalAt = -1;

  for (const row of candidates) {
    const status = String(row.status || '').toUpperCase();

    if (!TERMINAL_LEAD_STATUSES.has(status)) continue;

    const terminalAt =
      asDate(row.status_changed_at)
      || asDate(row.updated_at);

    if (!terminalAt) continue;

    const delta = callAt.getTime() - terminalAt.getTime();

    if (
      delta >= 0
      && delta <= graceMs
      && terminalAt.getTime() > bestTerminalAt
    ) {
      bestTerminal = row;
      bestTerminalAt = terminalAt.getTime();
    }
  }

  return bestTerminal;
}


async function createCallLead(input) {
  const leadId = id('CL');

  await bigquery.query({
    location: LOCATION,
    query: `
      INSERT INTO ${table('call_leads')} (
        lead_id,
        workspace_id,
        brand_id,
        phone,
        customer_name,
        email,
        product,
        status,
        notes,
        currency,
        status_changed_at,
        first_call_at,
        latest_call_at,
        call_attempt_count,
        answered_attempt_count,
        unanswered_attempt_count,
        is_archived,
        created_at,
        updated_at,
        created_by,
        updated_by
      ) VALUES (
        @lead_id,
        @workspace_id,
        @brand_id,
        @phone,
        NULLIF(@customer_name,''),
        NULLIF(@email,''),
        NULLIF(@product,''),
        'NEW',
        NULLIF(@notes,''),
        'INR',
        CURRENT_TIMESTAMP(),
        COALESCE(SAFE_CAST(@started_at AS TIMESTAMP),CURRENT_TIMESTAMP()),
        COALESCE(SAFE_CAST(@started_at AS TIMESTAMP),CURRENT_TIMESTAMP()),
        0,
        0,
        0,
        FALSE,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        @actor,
        @actor
      )
    `,
    params: {
      lead_id: leadId,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      phone: normalizePhone(input.phone),
      customer_name: nullableString(input.customerName),
      email: nullableString(input.email),
      product: nullableString(input.product),
      notes: nullableString(input.notes),
      started_at: input.startedAt || '',
      actor: input.actor,
    },
  });

  return leadId;
}


async function upsertCallAttempt(event, leadId, existingAttempt) {
  const created = !existingAttempt;
  const attemptId =
    existingAttempt?.attempt_id
    || deterministic('CA', [
      event.workspaceId,
      event.brandId,
      event.connectionId,
      event.providerCallId,
    ]);
  const oldStatus = String(existingAttempt?.call_status || '');
  const incomingStatus = String(event.callStatus || '');
  const oldUpdatedAt = asDate(existingAttempt?.provider_updated_at);

  const incomingUpdatedAt =
    asDate(event.updatedAt)
    || asDate(event.endedAt)
    || asDate(event.startedAt)
    || new Date();

  const incomingWins =
    !oldStatus
    || callStatusRank(incomingStatus) > callStatusRank(oldStatus)
    || (
      callStatusRank(incomingStatus) === callStatusRank(oldStatus)
      && (!oldUpdatedAt || incomingUpdatedAt.getTime() >= oldUpdatedAt.getTime())
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

  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE ${table('call_attempts')} t
      USING (
        SELECT
          @workspace_id AS workspace_id,
          @brand_id AS brand_id,
          @connection_id AS connection_id,
          @provider_call_id AS provider_call_id
      ) s
      ON t.workspace_id=s.workspace_id
       AND t.brand_id=s.brand_id
       AND t.connection_id=s.connection_id
       AND t.provider_call_id=s.provider_call_id

      WHEN MATCHED THEN
        UPDATE SET
          lead_id=@lead_id,
          business_number=COALESCE(NULLIF(@business_number,''),t.business_number),
          event_type=@event_type,
          call_status=@call_status,
          direction=@direction,
          agent_id=NULLIF(@agent_id,''),
          agent_name=NULLIF(@agent_name,''),
          agent_phone=NULLIF(@agent_phone,''),
          call_started_at=COALESCE(SAFE_CAST(@started_at AS TIMESTAMP),t.call_started_at),
          call_answered_at=COALESCE(SAFE_CAST(@answered_at AS TIMESTAMP),t.call_answered_at),
          call_ended_at=COALESCE(SAFE_CAST(@ended_at AS TIMESTAMP),t.call_ended_at),
          provider_updated_at=COALESCE(SAFE_CAST(@provider_updated_at AS TIMESTAMP),t.provider_updated_at),
          duration_seconds=GREATEST(COALESCE(t.duration_seconds,0),COALESCE(@duration_seconds,0)),
          disconnected_by=NULLIF(@disconnected_by,''),
          disconnect_party=NULLIF(@disconnect_party,''),
          end_reason=NULLIF(@end_reason,''),
          outcome_source=NULLIF(@outcome_source,''),
          recording_url=COALESCE(NULLIF(@recording_url,''),t.recording_url),
          reason=NULLIF(@reason,''),
          ivr_inputs=PARSE_JSON(@ivr_inputs),
          raw_event_type=NULLIF(@raw_event_type,''),
          raw_status=NULLIF(@raw_status,''),
          updated_at=CURRENT_TIMESTAMP()

      WHEN NOT MATCHED THEN
        INSERT (
          attempt_id,
          workspace_id,
          brand_id,
          connection_id,
          provider_key,
          provider_call_id,
          lead_id,
          phone,
          business_number,
          event_type,
          call_status,
          direction,
          agent_id,
          agent_name,
          agent_phone,
          call_started_at,
          call_answered_at,
          call_ended_at,
          provider_updated_at,
          duration_seconds,
          disconnected_by,
          disconnect_party,
          end_reason,
          outcome_source,
          recording_url,
          reason,
          ivr_inputs,
          raw_event_type,
          raw_status,
          created_at,
          updated_at
        )
        VALUES (
          @attempt_id,
          @workspace_id,
          @brand_id,
          @connection_id,
          @provider_key,
          @provider_call_id,
          @lead_id,
          @phone,
          NULLIF(@business_number,''),
          @event_type,
          @call_status,
          @direction,
          NULLIF(@agent_id,''),
          NULLIF(@agent_name,''),
          NULLIF(@agent_phone,''),
          SAFE_CAST(@started_at AS TIMESTAMP),
          SAFE_CAST(@answered_at AS TIMESTAMP),
          SAFE_CAST(@ended_at AS TIMESTAMP),
          SAFE_CAST(@provider_updated_at AS TIMESTAMP),
          @duration_seconds,
          NULLIF(@disconnected_by,''),
          NULLIF(@disconnect_party,''),
          NULLIF(@end_reason,''),
          NULLIF(@outcome_source,''),
          NULLIF(@recording_url,''),
          NULLIF(@reason,''),
          PARSE_JSON(@ivr_inputs),
          NULLIF(@raw_event_type,''),
          NULLIF(@raw_status,''),
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
    params: {
      ...values,
      business_number: nullableString(values.business_number),
      agent_id: nullableString(values.agent_id),
      agent_name: nullableString(values.agent_name),
      agent_phone: nullableString(values.agent_phone),
      disconnected_by: nullableString(values.disconnected_by),
      disconnect_party: nullableString(values.disconnect_party),
      end_reason: nullableString(values.end_reason),
      outcome_source: nullableString(values.outcome_source),
      recording_url: nullableString(values.recording_url),
      reason: nullableString(values.reason),
      raw_event_type: nullableString(values.raw_event_type),
      raw_status: nullableString(values.raw_status),
      started_at: values.started_at || '',
      answered_at: values.answered_at || '',
      ended_at: values.ended_at || '',
      provider_updated_at: values.provider_updated_at || '',
      ivr_inputs: JSON.stringify(values.ivr_inputs ?? null),
    },
  });

  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        SELECT *
        FROM ${table('call_attempts')}
        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND connection_id=@connection_id
          AND provider_call_id=@provider_call_id
        ORDER BY created_at ASC
        LIMIT 1
      `,
      params: {
        workspace_id: event.workspaceId,
        brand_id: event.brandId,
        connection_id: event.connectionId,
        provider_call_id: event.providerCallId,
      },
    });

  return {
    created,
    attempt: rows?.[0] || values,
  };
}


async function refreshLeadCallSummary(input) {
  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        WITH attempts AS (
          SELECT
            *,
            COALESCE(call_started_at,created_at) AS activity_at
          FROM ${table('call_attempts')}
          WHERE workspace_id=@workspace_id
            AND brand_id=@brand_id
            AND lead_id=@lead_id
        )
        SELECT
          COUNT(*) AS total,
          COUNTIF(call_status='ANSWERED') AS answered,
          COUNTIF(call_status IN ('MISSED','NO_ANSWER','BUSY','REJECTED','FAILED')) AS unanswered,
          MIN(activity_at) AS first_call_at,
          ARRAY_AGG(
            STRUCT(
              attempt_id,
              provider_call_id,
              business_number,
              call_status,
              agent_name,
              duration_seconds,
              disconnect_party,
              end_reason,
              activity_at,
              call_ended_at,
              provider_updated_at
            )
            ORDER BY activity_at DESC,COALESCE(provider_updated_at,updated_at) DESC
            LIMIT 1
          )[SAFE_OFFSET(0)] AS latest
        FROM attempts
      `,
      params: {
        workspace_id: input.workspaceId,
        brand_id: input.brandId,
        lead_id: input.leadId,
      },
    });

  const summary = rows?.[0] || {};
  const latest = summary.latest || {};

  const firstCallAt = asDate(summary.first_call_at)?.toISOString() || '';
  const latestCallAt = asDate(latest.activity_at)?.toISOString() || '';

  await bigquery.query({
    location: LOCATION,
    query: `
      UPDATE ${table('call_leads')}
      SET
        first_call_at=COALESCE(SAFE_CAST(@first_call_at AS TIMESTAMP),first_call_at),
        latest_call_at=SAFE_CAST(@latest_call_at AS TIMESTAMP),
        latest_call_status=NULLIF(@latest_call_status,''),
        latest_agent_name=NULLIF(@latest_agent_name,''),
        latest_attempt_id=NULLIF(@latest_attempt_id,''),
        latest_provider_call_id=NULLIF(@latest_provider_call_id,''),
        latest_business_number=NULLIF(@latest_business_number,''),
        latest_duration_seconds=SAFE_CAST(NULLIF(@latest_duration_seconds,'') AS INT64),
        latest_disconnect_party=NULLIF(@latest_disconnect_party,''),
        latest_end_reason=NULLIF(@latest_end_reason,''),
        call_attempt_count=@total,
        answered_attempt_count=@answered,
        unanswered_attempt_count=@unanswered,
        updated_at=CURRENT_TIMESTAMP(),
        updated_by=@actor
      WHERE workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND lead_id=@lead_id
    `,
    params: {
      first_call_at: firstCallAt,
      latest_call_at: latestCallAt,
      latest_call_status: nullableString(latest.call_status),
      latest_agent_name: nullableString(latest.agent_name),
      latest_attempt_id: nullableString(latest.attempt_id),
      latest_provider_call_id: nullableString(latest.provider_call_id),
      latest_business_number: nullableString(latest.business_number),
      latest_duration_seconds:
        nullableIntegerString(latest.duration_seconds),
      latest_disconnect_party: nullableString(latest.disconnect_party),
      latest_end_reason: nullableString(latest.end_reason),
      total: Number(summary.total || 0),
      answered: Number(summary.answered || 0),
      unanswered: Number(summary.unanswered || 0),
      actor: input.actor,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      lead_id: input.leadId,
    },
  });

  return summary;
}


// ============================================================
// META CONNECTION / QUEUE
// ============================================================

async function getMetaEventsConnection(workspaceId, brandId) {
  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        SELECT
          connection_id,
          workspace_id,
          brand_id,
          provider,
          status,
          provider_account_id,
          secret_name
        FROM ${controlTable('integration_connections')}
        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND provider='meta_events'
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      params: {
        workspace_id: workspaceId,
        brand_id: brandId,
      },
    });

  return rows?.[0] || null;
}


export async function queueMetaEvent(input) {
  const metaConnection =
    await getMetaEventsConnection(
      input.workspaceId,
      input.brandId
    );

  if (
    !metaConnection
    || String(metaConnection.status || '').toLowerCase() !== 'connected'
  ) {
    return null;
  }

  const eventCallIdentity =
    input.eventKey === 'CALL_LEAD_CONNECTED'
      ? ''
      : (input.callId || '');

  const eventId =
    deterministic(
      'cc_meta',
      [
        input.workspaceId,
        input.brandId,
        input.eventKey,
        input.leadId,
        eventCallIdentity,
        input.eventKey === 'CALL_LEAD_CONVERTED'
          ? String(input.payload?.order_id || '')
          : '',
      ]
    );

  const queueId =
    deterministic(
      'queue',
      [
        input.workspaceId,
        input.brandId,
        eventId,
      ]
    );

  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE ${table('meta_event_queue')} t
      USING (SELECT @event_id AS event_id) s
      ON t.workspace_id=@workspace_id
       AND t.brand_id=@brand_id
       AND t.event_id=s.event_id

      WHEN NOT MATCHED THEN
        INSERT (
          queue_id,
          workspace_id,
          brand_id,
          lead_id,
          call_id,
          event_key,
          event_name,
          event_id,
          payload,
          status,
          attempts,
          next_attempt_at,
          created_at,
          updated_at
        )
        VALUES (
          @queue_id,
          @workspace_id,
          @brand_id,
          @lead_id,
          NULLIF(@call_id,''),
          @event_key,
          @event_name,
          @event_id,
          PARSE_JSON(@payload),
          'PENDING',
          0,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
    params: {
      queue_id: queueId,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      lead_id: input.leadId,
      call_id: nullableString(input.callId),
      event_key: input.eventKey,
      event_name: input.eventName,
      event_id: eventId,
      payload: JSON.stringify(input.payload ?? {}),
    },
  });

  return eventId;
}


// ============================================================
// CANONICAL EVENT INGESTION
// ============================================================

export async function ingestCanonicalEvent(event, actor = 'calling-cloud-run') {
  const existingAttempt = await getProviderAttempt(event);
  let lead = null;

  if (existingAttempt?.lead_id) {
    const [leadRows] =
      await bigquery.query({
        location: LOCATION,
        query: `
          SELECT lead_id,status
          FROM ${table('call_leads')}
          WHERE workspace_id=@workspace_id
            AND brand_id=@brand_id
            AND lead_id=@lead_id
          LIMIT 1
        `,
        params: {
          workspace_id: event.workspaceId,
          brand_id: event.brandId,
          lead_id: existingAttempt.lead_id,
        },
      });

    lead = leadRows?.[0] || null;
  }

  if (!lead) {
    lead =
      await findAttachableLead({
        workspaceId: event.workspaceId,
        brandId: event.brandId,
        phone: event.customerPhone,
        callAt: event.startedAt || event.updatedAt || null,
      });
  }

  const createdLead = !lead;

  const leadId =
    lead?.lead_id
    || await createCallLead({
      workspaceId: event.workspaceId,
      brandId: event.brandId,
      phone: event.customerPhone,
      startedAt: event.startedAt || null,
      actor,
    });

  const attemptResult =
    await upsertCallAttempt(
      event,
      leadId,
      existingAttempt
    );

  const attempt = attemptResult.attempt;

  await refreshLeadCallSummary({
    workspaceId: event.workspaceId,
    brandId: event.brandId,
    leadId,
    actor,
  });

  if (
    isAnswered(attempt.call_status)
    && Number(attempt.duration_seconds || 0) >= CONTACT_MIN_DURATION_SECONDS
  ) {
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


export function getCallCommerceConfig() {
  return {
    projectId: PROJECT_ID,
    datasetId: DATASET_ID,
    controlDataset: CONTROL_DATASET,
    location: LOCATION,
    contactMinDurationSeconds: CONTACT_MIN_DURATION_SECONDS,
    reopenGraceMinutes: REOPEN_GRACE_MINUTES,
  };
}
