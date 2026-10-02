import { canonicalCallStatus, normalizePhoneIdentity } from './call-commerce-lifecycle.js';

// ============================================================
// CALL COMMERCE PROVIDER -> CANONICAL MAPPING
//
// Generic providers are normalized from the user-defined field
// and value mappings. Known providers may add a semantic outcome
// resolver AFTER generic mapping so provider lifecycle events are
// not confused with call outcomes.
//
// The complete provider JSON is always retained separately in
// raw_call_events.payload.
// ============================================================

function readPath(input, path) {
  const clean = String(path || '').trim().replace(/^\$\.?/, '');
  if (!clean) return input;

  const parts = clean.split('.').filter(Boolean);
  let current = input;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

function normalizePhone(value) {
  return normalizePhoneIdentity(value);
}

function transformValue(value, transform) {
  switch (transform) {
    case 'phone':
      return normalizePhone(value);

    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    case 'milliseconds_to_seconds': {
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n / 1000) : null;
    }

    case 'timestamp': {
      if (value === null || value === undefined || value === '') return null;

      if (typeof value === 'number') {
        const ms = value > 1e12 ? value : value * 1000;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      }

      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    case 'lowercase':
      return String(value ?? '').toLowerCase();

    case 'uppercase':
      return String(value ?? '').toUpperCase();

    case 'trim':
      return String(value ?? '').trim();

    default:
      return value;
  }
}

function mapValue(mappingType, sourceValue, mappings) {
  const source = String(sourceValue ?? '').trim().toLowerCase();

  return (
    mappings.find(
      item =>
        item?.mappingType === mappingType
        && String(item?.sourceValue ?? '').trim().toLowerCase() === source
    )?.canonicalValue
    || null
  );
}

function normalizeProviderName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeOutcomeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeDisconnectValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseIvrStatuses(value) {
  const text = String(value ?? '');
  if (!text) return [];

  const statuses = [];
  const matcher = /status\s*:\s*([a-z]+(?:[-_ ][a-z]+)*)/gi;

  for (const match of text.matchAll(matcher)) {
    const normalized = normalizeOutcomeToken(match[1]);
    if (normalized) statuses.push(normalized);
  }

  return statuses;
}

function isMsg91Provider(providerKey) {
  return normalizeProviderName(providerKey) === 'msg91';
}

function partyFromMsg91Disconnect(disconnectedBy, connected, direction) {
  const side = normalizeDisconnectValue(disconnectedBy);

  // Outbound MSG91 reverses source/destination relative to the customer:
  // destination is the customer; source/caller is the business/agent side.
  if (direction === 'OUTBOUND') {
    if (['destination', 'callee', 'customer'].includes(side)) {
      return 'CUSTOMER';
    }

    if (['source', 'caller', 'agent'].includes(side)) {
      return connected ? 'AGENT' : 'BUSINESS_ROUTING';
    }

    return 'UNKNOWN';
  }

  if (['source', 'caller', 'customer'].includes(side)) {
    return 'CUSTOMER';
  }

  if (['destination', 'callee', 'agent'].includes(side)) {
    return connected ? 'AGENT' : 'BUSINESS_ROUTING';
  }

  return 'UNKNOWN';
}

function deriveMsg91Outcome(input) {
  const rawEventType = normalizeOutcomeToken(input.rawEventType);
  const rawStatus = normalizeOutcomeToken(input.rawStatus);
  const reasonText = String(input.reason ?? '').trim().toLowerCase();
  const disconnectedBy = normalizeDisconnectValue(input.disconnectedBy);
  const ivrStatuses = parseIvrStatuses(input.ivrInputs);

  // Restore the pre-PostgreSQL outcome semantics:
  // any positive leg-level connection evidence wins over earlier no-answer
  // routing legs. Provider lifecycle completion and duration are NOT answer
  // evidence by themselves.
  const answeredEvidence =
    ivrStatuses.some(status => ['answered', 'connected', 'success'].includes(status))
    || ['answered', 'connected'].includes(rawStatus);

  const noAnswerEvidence =
    ivrStatuses.some(status => ['no-answer', 'noanswer', 'unanswered', 'missed'].includes(status))
    || ['no-answer', 'noanswer', 'unanswered', 'missed'].includes(rawStatus)
    || ['no-answer', 'noanswer', 'unanswered', 'missed'].includes(rawEventType);

  const cancelledEvidence =
    ivrStatuses.some(status => ['cancelled', 'canceled'].includes(status));

  const userUnreachable =
    reasonText.includes('user unreachable')
    || reasonText.includes('unreachable');

  const networkFailure =
    reasonText.includes('network failure')
    || reasonText.includes('network error');

  const disconnectedBySource =
    ['source', 'caller', 'customer'].includes(disconnectedBy);

  // The old caller-dropped rule applies to inbound customer/source hangs only.
  // For MSG91 outbound calls the customer is destination, so a destination-side
  // pre-answer end remains NO_ANSWER rather than being mislabeled Caller Dropped.
  const callerDroppedBeforeAnswer =
    input.direction !== 'OUTBOUND' && disconnectedBySource;

  let eventType = input.eventType;

  if (rawEventType === 'ringing') eventType = 'RINGING';
  else if (rawEventType === 'completed') eventType = 'COMPLETED';
  else if (rawEventType === 'failed') eventType = 'FAILED';
  else if (['canceled', 'cancelled'].includes(rawEventType)) eventType = 'CANCELED';
  else if (['answered', 'connected'].includes(rawEventType)) eventType = 'ANSWERED';

  if (rawEventType === 'ringing') {
    return {
      eventType,
      callStatus: 'RINGING',
      disconnectParty: 'UNKNOWN',
      endReason: null,
      outcomeSource: 'MSG91_EVENT',
    };
  }

  // This is the key pre-PostgreSQL rule. A call flow may contain several
  // No-answer routing legs and then an Answered fallback leg. Any explicit
  // Answered/Connected/Success leg makes the whole provider call ANSWERED.
  if (answeredEvidence) {
    if (networkFailure) {
      return {
        eventType,
        callStatus: 'ANSWERED',
        disconnectParty: 'SYSTEM',
        endReason: 'NETWORK_FAILURE',
        outcomeSource: 'MSG91_IVR_STATUS',
      };
    }

    const disconnectParty =
      partyFromMsg91Disconnect(disconnectedBy, true, input.direction);

    return {
      eventType,
      callStatus: 'ANSWERED',
      disconnectParty,
      endReason:
        disconnectParty === 'CUSTOMER'
          ? 'CUSTOMER_DISCONNECTED'
          : disconnectParty === 'AGENT'
            ? 'AGENT_DISCONNECTED'
            : 'UNKNOWN',
      outcomeSource: 'MSG91_IVR_STATUS',
    };
  }

  if (
    ['canceled', 'cancelled'].includes(rawEventType)
    || cancelledEvidence
  ) {
    const disconnectParty =
      partyFromMsg91Disconnect(disconnectedBy, false, input.direction);

    return {
      eventType,
      callStatus: 'NO_ANSWER',
      disconnectParty,
      endReason:
        callerDroppedBeforeAnswer
          ? 'CALLER_DROPPED_BEFORE_ANSWER'
          : 'UNANSWERED',
      outcomeSource:
        cancelledEvidence
          ? 'MSG91_IVR_STATUS'
          : 'MSG91_EVENT',
    };
  }

  if (userUnreachable) {
    return {
      eventType,
      callStatus: 'NO_ANSWER',
      disconnectParty:
        partyFromMsg91Disconnect(disconnectedBy, false, input.direction),
      endReason: 'USER_UNREACHABLE',
      outcomeSource: 'MSG91_REASON',
    };
  }

  if (noAnswerEvidence) {
    return {
      eventType,
      callStatus: 'NO_ANSWER',
      disconnectParty:
        partyFromMsg91Disconnect(disconnectedBy, false, input.direction),
      endReason:
        callerDroppedBeforeAnswer
          ? 'CALLER_DROPPED_BEFORE_ANSWER'
          : 'UNANSWERED',
      outcomeSource: 'MSG91_IVR_STATUS',
    };
  }

  if (rawEventType === 'failed') {
    if (networkFailure) {
      return {
        eventType,
        callStatus: 'FAILED',
        disconnectParty: 'SYSTEM',
        endReason: 'NETWORK_FAILURE',
        outcomeSource: 'MSG91_REASON',
      };
    }

    return {
      eventType,
      callStatus: 'FAILED',
      disconnectParty:
        partyFromMsg91Disconnect(disconnectedBy, false, input.direction),
      endReason: 'PROVIDER_FAILURE',
      outcomeSource: 'MSG91_EVENT',
    };
  }

  // Provider "completed" means the lifecycle ended; it does not mean a human
  // answered. Preserve the old inbound caller-drop inference, otherwise remain
  // UNKNOWN until explicit outcome evidence exists.
  if (rawEventType === 'completed') {
    if (callerDroppedBeforeAnswer) {
      return {
        eventType,
        callStatus: 'NO_ANSWER',
        disconnectParty: 'CUSTOMER',
        endReason: 'CALLER_DROPPED_BEFORE_ANSWER',
        outcomeSource: 'MSG91_EVENT_DISCONNECT',
      };
    }

    return {
      eventType,
      callStatus: 'UNKNOWN',
      disconnectParty:
        partyFromMsg91Disconnect(disconnectedBy, false, input.direction),
      endReason: 'UNKNOWN',
      outcomeSource: 'MSG91_EVENT',
    };
  }

  return {
    eventType,
    callStatus: input.callStatus || 'UNKNOWN',
    disconnectParty: 'UNKNOWN',
    endReason: null,
    outcomeSource: 'VALUE_MAPPING',
  };
}

export function readJson(value, fallback) {
  if (value === null || value === undefined) return fallback;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
}

export function normalizeCallingPayload(input) {
  const fieldMappings = Array.isArray(input.fieldMappings) ? input.fieldMappings : [];
  const valueMappings = Array.isArray(input.valueMappings) ? input.valueMappings : [];
  const mapped = {};

  for (const mapping of fieldMappings) {
    const raw = readPath(input.payload, mapping?.sourcePath);
    const value = transformValue(raw, mapping?.transform);

    if (
      mapping?.required
      && (value === null || value === undefined || value === '')
      && !(isMsg91Provider(input.providerKey) && mapping?.canonicalField === 'customerPhone')
    ) {
      throw new Error(
        `CALLING_MAPPING_REQUIRED_FIELD_MISSING:${mapping?.canonicalField || 'unknown'}`
      );
    }

    mapped[String(mapping?.canonicalField || '')] = value;
  }

  const payload =
    input.payload && typeof input.payload === 'object'
      ? input.payload
      : {};

  const rawEventType = String(mapped.rawEventType ?? '').trim();
  const rawStatus = String(mapped.rawStatus ?? '').trim();
  const rawDirection = String(mapped.direction ?? '').trim();

  // MSG91 publishes different customer-number fields by direction:
  // inbound  -> source
  // outbound -> destination
  // Keep provider-specific semantics here rather than in the CRM/UI layer.
  if (isMsg91Provider(input.providerKey)) {
    const directionToken = String(rawDirection || payload.direction || '').trim().toLowerCase();
    const inboundPhone = normalizePhone(payload.source);
    const outboundPhone = normalizePhone(payload.destination);
    const currentlyMappedPhone = normalizePhone(mapped.customerPhone);

    if (!currentlyMappedPhone) {
      mapped.customerPhone =
        directionToken === 'outbound'
          ? (outboundPhone || inboundPhone)
          : (inboundPhone || outboundPhone);
    }

    if (!normalizePhone(mapped.businessNumber) && payload.callerId) {
      mapped.businessNumber = normalizePhone(payload.callerId);
    }

    if (!mapped.providerEventId && payload.requestId) {
      mapped.providerEventId = String(payload.requestId);
    }
  }

  if (!String(mapped.providerCallId ?? '').trim()) {
    throw new Error('CALLING_MAPPING_REQUIRED_FIELD_MISSING:providerCallId');
  }

  if (!normalizePhone(mapped.customerPhone)) {
    throw new Error('CALLING_MAPPING_REQUIRED_FIELD_MISSING:customerPhone');
  }

  let eventType =
    mapValue('EVENT_TYPE', rawEventType, valueMappings)
    || mapValue('EVENT_TYPE', rawStatus, valueMappings)
    || 'UPDATED';

  let callStatus = canonicalCallStatus(
    mapValue('CALL_STATUS', rawStatus, valueMappings)
    || mapValue('CALL_STATUS', rawEventType, valueMappings)
    || 'UNKNOWN'
  );

  const directionCandidate =
    mapValue('DIRECTION', rawDirection, valueMappings)
    || String(rawDirection || 'UNKNOWN').toUpperCase();

  const direction = ['INBOUND', 'OUTBOUND'].includes(directionCandidate)
    ? directionCandidate
    : 'UNKNOWN';

  const providerCallId = String(mapped.providerCallId ?? '').trim();
  const customerPhone = normalizePhone(mapped.customerPhone);

  if (!providerCallId) {
    throw new Error('CALLING_PROVIDER_CALL_ID_MISSING');
  }

  if (!customerPhone) {
    throw new Error('CALLING_CUSTOMER_PHONE_MISSING');
  }

  const disconnectedBy =
    mapped.disconnectedBy
      ? String(mapped.disconnectedBy)
      : (payload.disconnectedBy ? String(payload.disconnectedBy) : null);

  const reason =
    mapped.reason
      ? String(mapped.reason)
      : (payload.reason ? String(payload.reason) : null);

  const ivrInputs =
    mapped.ivrInputs !== undefined && mapped.ivrInputs !== null
      ? mapped.ivrInputs
      : (payload.ivrInputs ?? null);

  const durationSeconds = mapped.durationSeconds === null || mapped.durationSeconds === undefined
    ? null
    : Number(mapped.durationSeconds);

  const mappedDisconnectParty = String(
    mapValue(
      'DISCONNECT_PARTY',
      mapped.disconnectParty ?? disconnectedBy ?? '',
      valueMappings
    ) || mapped.disconnectParty || 'UNKNOWN'
  ).toUpperCase();

  const mappedEndReason = String(
    mapValue(
      'END_REASON',
      mapped.endReason ?? reason ?? '',
      valueMappings
    ) || mapped.endReason || ''
  ).toUpperCase();

  const validDisconnectParties = new Set([
    'CUSTOMER',
    'AGENT',
    'BUSINESS_ROUTING',
    'SYSTEM',
    'UNKNOWN',
  ]);
  const validEndReasons = new Set([
    'CALLER_DROPPED_BEFORE_ANSWER',
    'CUSTOMER_DISCONNECTED',
    'AGENT_DISCONNECTED',
    'UNANSWERED',
    'USER_UNREACHABLE',
    'NETWORK_FAILURE',
    'PROVIDER_FAILURE',
    'UNKNOWN',
  ]);

  let disconnectParty =
    validDisconnectParties.has(mappedDisconnectParty)
      ? mappedDisconnectParty
      : 'UNKNOWN';
  let endReason =
    mappedEndReason && validEndReasons.has(mappedEndReason)
      ? mappedEndReason
      : null;
  let outcomeSource =
    disconnectParty !== 'UNKNOWN' || endReason
      ? 'VALUE_MAPPING'
      : 'UNMAPPED';

  if (isMsg91Provider(input.providerKey)) {
    const outcome =
      deriveMsg91Outcome({
        eventType,
        callStatus,
        rawEventType,
        rawStatus,
        disconnectedBy,
        reason,
        ivrInputs,
        direction: ['INBOUND', 'OUTBOUND'].includes(direction) ? direction : 'UNKNOWN',
        durationSeconds,
      });

    eventType = outcome.eventType;
    callStatus = outcome.callStatus;
    disconnectParty = outcome.disconnectParty;
    endReason = outcome.endReason;
    outcomeSource = outcome.outcomeSource;
  }

  return {
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    connectionId: input.connectionId,
    callingProvider: input.providerKey,
    providerCallId,
    providerEventId: mapped.providerEventId ? String(mapped.providerEventId) : null,
    eventType,
    callStatus,
    direction,
    customerPhone,
    businessNumber: mapped.businessNumber ? normalizePhone(mapped.businessNumber) : null,
    agentId: mapped.agentId ? String(mapped.agentId) : null,
    agentName: mapped.agentName ? String(mapped.agentName) : null,
    agentPhone: mapped.agentPhone ? normalizePhone(mapped.agentPhone) : null,
    startedAt: mapped.startedAt ? String(mapped.startedAt) : null,
    answeredAt: mapped.answeredAt ? String(mapped.answeredAt) : null,
    endedAt: mapped.endedAt ? String(mapped.endedAt) : null,
    updatedAt: mapped.updatedAt ? String(mapped.updatedAt) : null,
    durationSeconds,
    disconnectedBy,
    disconnectParty,
    endReason,
    outcomeSource,
    recordingUrl: mapped.recordingUrl ? String(mapped.recordingUrl) : null,
    reason,
    ivrInputs,
    rawEventType,
    rawStatus,
    rawPayload: input.payload,
  };
}
