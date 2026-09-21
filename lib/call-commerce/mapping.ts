import type {
  CallingFieldMapping,
  CallingValueMapping,
  CanonicalCallEvent,
  CanonicalCallEventType,
  CanonicalCallStatus,
  CanonicalDirection,
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

  const rawEventType = String(mapped.rawEventType ?? '').trim();
  const rawStatus = String(mapped.rawStatus ?? '').trim();
  const rawDirection = String(mapped.direction ?? '').trim();

  const eventType = (
    mapValue('EVENT_TYPE', rawEventType, input.valueMappings) ||
    mapValue('EVENT_TYPE', rawStatus, input.valueMappings) ||
    'UPDATED'
  ) as CanonicalCallEventType;

  const callStatus = (
    mapValue('CALL_STATUS', rawStatus, input.valueMappings) ||
    mapValue('CALL_STATUS', rawEventType, input.valueMappings) ||
    'UNKNOWN'
  ) as CanonicalCallStatus;

  const direction = (
    mapValue('DIRECTION', rawDirection, input.valueMappings) ||
    String(rawDirection || 'UNKNOWN').toUpperCase()
  ) as CanonicalDirection;

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
    disconnectedBy: mapped.disconnectedBy ? String(mapped.disconnectedBy) : null,
    recordingUrl: mapped.recordingUrl ? String(mapped.recordingUrl) : null,
    reason: mapped.reason ? String(mapped.reason) : null,
    ivrInputs: mapped.ivrInputs ?? null,
    rawEventType,
    rawStatus,
    rawPayload: input.payload,
  };
}
