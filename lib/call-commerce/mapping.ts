import type {
  CallingFieldMapping,
  CallingValueMapping,
  CanonicalCallEndReason,
  CanonicalCallEvent,
  CanonicalCallEventType,
  CanonicalCallStatus,
  CanonicalDirection,
  CanonicalDisconnectParty,
} from './types';

function readPath(input: unknown, path: string): unknown {
  const clean = String(path || '').trim().replace(/^\$\.?/, '');
  if (!clean) return input;
  const parts = clean.split('.').filter(Boolean);
  let current: any = input;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/[^0-9+]/g, '').trim();
}

function transformValue(value: unknown, transform?: string | null) {
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

function mapValue(
  mappingType: CallingValueMapping['mappingType'],
  sourceValue: unknown,
  mappings: CallingValueMapping[]
) {
  const source = String(sourceValue ?? '').trim().toLowerCase();
  return mappings.find(
    item => item.mappingType === mappingType && item.sourceValue.trim().toLowerCase() === source
  )?.canonicalValue || null;
}

function normalizeProviderName(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeOutcomeToken(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeDisconnectValue(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function parseIvrStatuses(value: unknown) {
  const text = String(value ?? '');
  if (!text) return [];

  const statuses: string[] = [];
  const matcher = /status\s*:\s*([a-z]+(?:[-_ ][a-z]+)*)/gi;

  for (const match of text.matchAll(matcher)) {
    const normalized = normalizeOutcomeToken(match[1]);
    if (normalized) statuses.push(normalized);
  }

  return statuses;
}

function isMsg91Provider(providerKey: unknown) {
  return normalizeProviderName(providerKey) === 'msg91';
}

function partyFromMsg91Disconnect(
  disconnectedBy: unknown,
  connected: boolean
): CanonicalDisconnectParty {
  const side = normalizeDisconnectValue(disconnectedBy);

  if (['source', 'caller', 'customer'].includes(side)) {
    return 'CUSTOMER';
  }

  if (['destination', 'callee', 'agent'].includes(side)) {
    return connected ? 'AGENT' : 'BUSINESS_ROUTING';
  }

  return 'UNKNOWN';
}

function deriveMsg91Outcome(input: {
  eventType: CanonicalCallEventType;
  callStatus: CanonicalCallStatus;
  rawEventType: string;
  rawStatus: string;
  disconnectedBy: string | null;
  reason: string | null;
  ivrInputs: unknown;
}): {
  eventType: CanonicalCallEventType;
  callStatus: CanonicalCallStatus;
  disconnectParty: CanonicalDisconnectParty;
  endReason: CanonicalCallEndReason | null;
  outcomeSource: string;
} {
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

  if (
    ['canceled', 'cancelled'].includes(rawEventType)
    || cancelledEvidence
  ) {
    return {
      eventType,
      callStatus: 'NO_ANSWER',
      disconnectParty:
        partyFromMsg91Disconnect(disconnectedBy, false),
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

export function discoverPayloadFields(payload: unknown) {
  const rows: Array<{ path: string; example: unknown }> = [];

  function walk(value: unknown, path: string, depth: number) {
    if (depth > 5) return;
    if (Array.isArray(value)) {
      if (value.length) walk(value[0], `${path}[0]`, depth + 1);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const childPath = path ? `${path}.${key}` : `$.${key}`;
        if (child && typeof child === 'object') walk(child, childPath, depth + 1);
        else rows.push({ path: childPath, example: child });
      }
    }
  }

  walk(payload, '', 0);
  return rows;
}

export function normalizeCallingPayload(input: {
  workspaceId: string;
  brandId: string;
  connectionId: string;
  providerKey: string;
  payload: unknown;
  fieldMappings: CallingFieldMapping[];
  valueMappings: CallingValueMapping[];
}): CanonicalCallEvent {
  const mapped: Record<string, unknown> = {};

  for (const mapping of input.fieldMappings) {
    const raw = readPath(input.payload, mapping.sourcePath);
    const value = transformValue(raw, mapping.transform);
    if (mapping.required && (value === null || value === undefined || value === '')) {
      throw new Error(`CALLING_MAPPING_REQUIRED_FIELD_MISSING:${mapping.canonicalField}`);
    }
    mapped[mapping.canonicalField] = value;
  }

  const payload = (
    input.payload && typeof input.payload === 'object'
      ? input.payload
      : {}
  ) as Record<string, unknown>;

  const rawEventType = String(mapped.rawEventType ?? '').trim();
  const rawStatus = String(mapped.rawStatus ?? '').trim();
  const rawDirection = String(mapped.direction ?? '').trim();

  let eventType = (
    mapValue('EVENT_TYPE', rawEventType, input.valueMappings) ||
    mapValue('EVENT_TYPE', rawStatus, input.valueMappings) ||
    'UPDATED'
  ) as CanonicalCallEventType;

  let callStatus = (
    mapValue('CALL_STATUS', rawStatus, input.valueMappings) ||
    mapValue('CALL_STATUS', rawEventType, input.valueMappings) ||
    'UNKNOWN'
  ) as CanonicalCallStatus;

  const direction = (
    mapValue('DIRECTION', rawDirection, input.valueMappings) ||
    String(rawDirection || 'UNKNOWN').toUpperCase()
  ) as CanonicalDirection;

  const disconnectedBy = mapped.disconnectedBy
    ? String(mapped.disconnectedBy)
    : (payload.disconnectedBy ? String(payload.disconnectedBy) : null);

  const reason = mapped.reason
    ? String(mapped.reason)
    : (payload.reason ? String(payload.reason) : null);

  const ivrInputs = mapped.ivrInputs !== undefined && mapped.ivrInputs !== null
    ? mapped.ivrInputs
    : (payload.ivrInputs ?? null);

  let disconnectParty: CanonicalDisconnectParty = 'UNKNOWN';
  let endReason: CanonicalCallEndReason | null = null;
  let outcomeSource = 'VALUE_MAPPING';

  if (isMsg91Provider(input.providerKey)) {
    const outcome = deriveMsg91Outcome({
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
    providerCallId: String(mapped.providerCallId ?? '').trim(),
    providerEventId: mapped.providerEventId ? String(mapped.providerEventId) : null,
    eventType,
    callStatus,
    direction: ['INBOUND', 'OUTBOUND'].includes(direction) ? direction : 'UNKNOWN',
    customerPhone: normalizePhone(mapped.customerPhone),
    businessNumber: mapped.businessNumber ? normalizePhone(mapped.businessNumber) : null,
    agentId: mapped.agentId ? String(mapped.agentId) : null,
    agentName: mapped.agentName ? String(mapped.agentName) : null,
    agentPhone: mapped.agentPhone ? normalizePhone(mapped.agentPhone) : null,
    startedAt: mapped.startedAt ? String(mapped.startedAt) : null,
    answeredAt: mapped.answeredAt ? String(mapped.answeredAt) : null,
    endedAt: mapped.endedAt ? String(mapped.endedAt) : null,
    updatedAt: mapped.updatedAt ? String(mapped.updatedAt) : null,
    durationSeconds: mapped.durationSeconds === null || mapped.durationSeconds === undefined
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
