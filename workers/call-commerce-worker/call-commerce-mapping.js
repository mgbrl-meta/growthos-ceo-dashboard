// ============================================================
// CALL COMMERCE PROVIDER -> CANONICAL MAPPING
//
// This mirrors the mapping contract used by the Growth OS app.
// The worker receives the full provider JSON and only extracts
// mapped fields into the canonical call event. The complete raw
// payload is retained separately in raw_call_events.payload.
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

  const rawEventType = String(mapped.rawEventType ?? '').trim();
  const rawStatus = String(mapped.rawStatus ?? '').trim();
  const rawDirection = String(mapped.direction ?? '').trim();

  const eventType =
    mapValue('EVENT_TYPE', rawEventType, valueMappings)
    || mapValue('EVENT_TYPE', rawStatus, valueMappings)
    || 'UPDATED';

  const callStatus =
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
    disconnectedBy: mapped.disconnectedBy ? String(mapped.disconnectedBy) : null,
    recordingUrl: mapped.recordingUrl ? String(mapped.recordingUrl) : null,
    reason: mapped.reason ? String(mapped.reason) : null,
    ivrInputs: mapped.ivrInputs ?? null,
    rawEventType,
    rawStatus,
    rawPayload: input.payload,
  };
}
