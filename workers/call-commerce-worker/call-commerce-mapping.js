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
  return String(value ?? '').replace(/[^0-9+]/g, '').trim();
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

function partyFromMsg91Disconnect(disconnectedBy, connected) {
  const side = normalizeDisconnectValue(disconnectedBy);

  if (['source', 'caller', 'customer'].includes(side)) {
    return 'CUSTOMER';
  }

  if (['destination', 'callee'].includes(side)) {
    return connected ? 'AGENT' : 'BUSINESS_ROUTING';
  }

  if (['agent'].includes(side)) {
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

  const disconnectedByDestination =
    ['destination', 'callee', 'agent'].includes(disconnectedBy);

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

  // A positive leg-level connection signal is authoritative. A later
  // provider failure can still describe how the connected call ended.
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
      partyFromMsg91Disconnect(disconnectedBy, true);

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

  // Customer/source cancellation before an answered leg is a caller
  // drop, not an agent disconnect and not an answered call.
  if (
    ['canceled', 'cancelled'].includes(rawEventType)
    || cancelledEvidence
  ) {
    const disconnectParty =
      partyFromMsg91Disconnect(disconnectedBy, false);

    return {
      eventType,
      callStatus: 'NO_ANSWER',
      disconnectParty,
      endReason:
        disconnectedBySource
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
        partyFromMsg91Disconnect(disconnectedBy, false),
      endReason: 'USER_UNREACHABLE',
      outcomeSource: 'MSG91_REASON',
    };
  }

  if (noAnswerEvidence) {
    return {
      eventType,
      callStatus: 'NO_ANSWER',
      disconnectParty:
        partyFromMsg91Disconnect(disconnectedBy, false),
      endReason:
        disconnectedBySource
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
        partyFromMsg91Disconnect(disconnectedBy, false),
      endReason: 'PROVIDER_FAILURE',
      outcomeSource: 'MSG91_EVENT',
    };
  }

  // MSG91 sometimes emits completed without an explicit IVR leg result.
  // If the caller/source ended it before any answered evidence, classify it
  // as a caller drop. Destination-side completed events without evidence
  // remain UNKNOWN rather than being falsely counted as answered.
  if (rawEventType === 'completed') {
    if (disconnectedBySource) {
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
        disconnectedByDestination
          ? 'BUSINESS_ROUTING'
          : 'UNKNOWN',
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

  let eventType =
    mapValue('EVENT_TYPE', rawEventType, valueMappings)
    || mapValue('EVENT_TYPE', rawStatus, valueMappings)
    || 'UPDATED';

  let callStatus =
    mapValue('CALL_STATUS', rawStatus, valueMappings)
    || mapValue('CALL_STATUS', rawEventType, valueMappings)
    || 'UNKNOWN';

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

  let disconnectParty = 'UNKNOWN';
  let endReason = null;
  let outcomeSource = 'VALUE_MAPPING';

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
    durationSeconds:
      mapped.durationSeconds === null || mapped.durationSeconds === undefined
        ? null
        : Number(mapped.durationSeconds),
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
