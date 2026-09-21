import type {
  CallingFieldMapping,
  CallingValueMapping,
} from './types';

export type CallingProviderPreset = {
  key: string;
  name: string;
  aliases?: string[];
  fieldMappings: CallingFieldMapping[];
  valueMappings: CallingValueMapping[];
};

export const MSG91_PRESET: CallingProviderPreset = {
  key: 'msg91',
  name: 'MSG91',
  aliases: ['msg 91'],
  fieldMappings: [
    { canonicalField: 'providerCallId', sourcePath: '$.uuid', required: true },
    { canonicalField: 'customerPhone', sourcePath: '$.source', transform: 'phone', required: true },
    { canonicalField: 'businessNumber', sourcePath: '$.callerId', transform: 'phone' },
    { canonicalField: 'agentName', sourcePath: '$.agentName' },
    { canonicalField: 'startedAt', sourcePath: '$.startTime', transform: 'timestamp' },
    { canonicalField: 'updatedAt', sourcePath: '$.statusUpdatedAt', transform: 'timestamp' },
    { canonicalField: 'endedAt', sourcePath: '$.endTime', transform: 'timestamp' },
    { canonicalField: 'durationSeconds', sourcePath: '$.duration', transform: 'number' },
    { canonicalField: 'rawEventType', sourcePath: '$.eventName' },
    { canonicalField: 'rawStatus', sourcePath: '$.status' },
    { canonicalField: 'direction', sourcePath: '$.direction' },
    { canonicalField: 'disconnectedBy', sourcePath: '$.disconnectedBy' },
    { canonicalField: 'reason', sourcePath: '$.reason' },
    { canonicalField: 'recordingUrl', sourcePath: '$.recordingUrl' },
    { canonicalField: 'ivrInputs', sourcePath: '$.ivrInputs' },
  ],
  valueMappings: [
    { mappingType: 'EVENT_TYPE', sourceValue: 'ringing', canonicalValue: 'RINGING' },
    { mappingType: 'EVENT_TYPE', sourceValue: 'answered', canonicalValue: 'ANSWERED' },
    { mappingType: 'EVENT_TYPE', sourceValue: 'completed', canonicalValue: 'COMPLETED' },
    { mappingType: 'EVENT_TYPE', sourceValue: 'missed', canonicalValue: 'COMPLETED' },
    { mappingType: 'CALL_STATUS', sourceValue: 'ringing', canonicalValue: 'RINGING' },
    { mappingType: 'CALL_STATUS', sourceValue: 'answered', canonicalValue: 'ANSWERED' },
    { mappingType: 'CALL_STATUS', sourceValue: 'connected', canonicalValue: 'ANSWERED' },
    { mappingType: 'CALL_STATUS', sourceValue: 'completed', canonicalValue: 'ANSWERED' },
    { mappingType: 'CALL_STATUS', sourceValue: 'missed', canonicalValue: 'MISSED' },
    { mappingType: 'CALL_STATUS', sourceValue: 'no_answer', canonicalValue: 'NO_ANSWER' },
    { mappingType: 'CALL_STATUS', sourceValue: 'busy', canonicalValue: 'BUSY' },
    { mappingType: 'CALL_STATUS', sourceValue: 'rejected', canonicalValue: 'REJECTED' },
    { mappingType: 'CALL_STATUS', sourceValue: 'failed', canonicalValue: 'FAILED' },
    { mappingType: 'DIRECTION', sourceValue: 'inbound', canonicalValue: 'INBOUND' },
    { mappingType: 'DIRECTION', sourceValue: 'outbound', canonicalValue: 'OUTBOUND' },
  ],
};

export const CALLING_PROVIDER_PRESETS: CallingProviderPreset[] = [MSG91_PRESET];

function normalizeProviderName(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getCallingProviderPreset(value: string) {
  const normalized = normalizeProviderName(value);
  if (!normalized) return null;
  return CALLING_PROVIDER_PRESETS.find(item => {
    const candidates = [item.key, item.name, ...(item.aliases || [])].map(normalizeProviderName);
    return candidates.includes(normalized);
  }) || null;
}
