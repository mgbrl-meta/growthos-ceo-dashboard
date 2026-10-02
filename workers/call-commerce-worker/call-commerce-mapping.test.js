import assert from 'node:assert/strict';
import { normalizeCallingPayload } from './call-commerce-mapping.js';

function normalize(providerKey, payload, fieldMappings, valueMappings) {
  return normalizeCallingPayload({
    workspaceId: 'workspace-a',
    brandId: 'brand-a',
    connectionId: 'connection-a',
    providerKey,
    payload,
    fieldMappings,
    valueMappings,
  });
}

const genericFields = [
  { canonicalField: 'providerCallId', sourcePath: '$.call_id', required: true },
  { canonicalField: 'customerPhone', sourcePath: '$.customer', transform: 'phone', required: true },
  { canonicalField: 'businessNumber', sourcePath: '$.business', transform: 'phone' },
  { canonicalField: 'rawEventType', sourcePath: '$.event' },
  { canonicalField: 'rawStatus', sourcePath: '$.status' },
  { canonicalField: 'direction', sourcePath: '$.direction' },
  { canonicalField: 'disconnectedBy', sourcePath: '$.ended_by' },
  { canonicalField: 'endReason', sourcePath: '$.reason_code' },
  { canonicalField: 'startedAt', sourcePath: '$.started_at', transform: 'timestamp' },
];
const genericValues = [
  { mappingType: 'EVENT_TYPE', sourceValue: 'ring', canonicalValue: 'RINGING' },
  { mappingType: 'EVENT_TYPE', sourceValue: 'done', canonicalValue: 'COMPLETED' },
  { mappingType: 'CALL_STATUS', sourceValue: 'connected', canonicalValue: 'ANSWERED' },
  { mappingType: 'CALL_STATUS', sourceValue: 'not-connected', canonicalValue: 'NO_ANSWER' },
  { mappingType: 'DIRECTION', sourceValue: 'incoming', canonicalValue: 'INBOUND' },
  { mappingType: 'DIRECTION', sourceValue: 'outgoing', canonicalValue: 'OUTBOUND' },
  { mappingType: 'DISCONNECT_PARTY', sourceValue: 'subscriber', canonicalValue: 'CUSTOMER' },
  { mappingType: 'END_REASON', sourceValue: 'no-agent', canonicalValue: 'UNANSWERED' },
];

const generic = normalize('custom-platform', {
  call_id: 'C-1',
  customer: '+91 98765 43210',
  business: '+91 73169 16999',
  event: 'done',
  status: 'not-connected',
  direction: 'incoming',
  ended_by: 'subscriber',
  reason_code: 'no-agent',
  started_at: '2026-10-02T10:00:00+05:30',
}, genericFields, genericValues);
assert.equal(generic.providerCallId, 'C-1');
assert.equal(generic.customerPhone, '919876543210');
assert.equal(generic.businessNumber, '917316916999');
assert.equal(generic.callStatus, 'NO_ANSWER');
assert.equal(generic.direction, 'INBOUND');
assert.equal(generic.disconnectParty, 'CUSTOMER');
assert.equal(generic.endReason, 'UNANSWERED');

const msg91Fields = [
  { canonicalField: 'providerCallId', sourcePath: '$.uuid', required: true },
  { canonicalField: 'providerEventId', sourcePath: '$.requestId' },
  { canonicalField: 'customerPhone', sourcePath: '$.source', transform: 'phone' },
  { canonicalField: 'businessNumber', sourcePath: '$.callerId', transform: 'phone' },
  { canonicalField: 'rawEventType', sourcePath: '$.eventName' },
  { canonicalField: 'rawStatus', sourcePath: '$.status' },
  { canonicalField: 'direction', sourcePath: '$.direction' },
  { canonicalField: 'disconnectedBy', sourcePath: '$.disconnectedBy' },
  { canonicalField: 'reason', sourcePath: '$.reason' },
  { canonicalField: 'ivrInputs', sourcePath: '$.ivrInputs' },
  { canonicalField: 'durationSeconds', sourcePath: '$.duration', transform: 'number' },
];
const msg91Values = [
  { mappingType: 'EVENT_TYPE', sourceValue: 'ringing', canonicalValue: 'RINGING' },
  { mappingType: 'EVENT_TYPE', sourceValue: 'completed', canonicalValue: 'COMPLETED' },
  { mappingType: 'EVENT_TYPE', sourceValue: 'failed', canonicalValue: 'FAILED' },
  { mappingType: 'DIRECTION', sourceValue: 'inbound', canonicalValue: 'INBOUND' },
  { mappingType: 'DIRECTION', sourceValue: 'outbound', canonicalValue: 'OUTBOUND' },
];

const multiLegAnswered = normalize('MSG91', {
  uuid: 'M-1', requestId: 'E-1', source: '919999999999', destination: 'None', callerId: '917316916999',
  eventName: 'completed', direction: 'inbound', disconnectedBy: 'source', duration: '136',
  ivrInputs: 'Call to team on web. Status: No-answer -> Call to team on phone. Status: Answered',
}, msg91Fields, msg91Values);
assert.equal(multiLegAnswered.callStatus, 'ANSWERED');
assert.equal(multiLegAnswered.endReason, 'CUSTOMER_DISCONNECTED');

const allNoAnswer = normalize('MSG91', {
  uuid: 'M-2', requestId: 'E-2', source: '919999999999', destination: 'None', callerId: '917316916999',
  eventName: 'completed', direction: 'inbound', disconnectedBy: 'destination', duration: '52',
  ivrInputs: 'Call to web. Status: No-answer -> Call to phone. Status: No-answer',
}, msg91Fields, msg91Values);
assert.equal(allNoAnswer.callStatus, 'NO_ANSWER');
assert.equal(allNoAnswer.endReason, 'UNANSWERED');

const durationOnly = normalize('MSG91', {
  uuid: 'M-3', requestId: 'E-3', source: '919999999999', destination: 'None', callerId: '917316916999',
  eventName: 'completed', direction: 'inbound', disconnectedBy: 'destination', duration: '42', ivrInputs: '',
}, msg91Fields, msg91Values);
assert.equal(durationOnly.callStatus, 'UNKNOWN');

const outbound = normalize('MSG91', {
  uuid: 'M-4', requestId: 'E-4', source: 'None', destination: '917645095966', callerId: '917316916999',
  eventName: 'completed', direction: 'outbound', disconnectedBy: 'destination', duration: '42',
  ivrInputs: 'Call to customer. Status: Answered',
}, msg91Fields, msg91Values);
assert.equal(outbound.customerPhone, '917645095966');
assert.equal(outbound.businessNumber, '917316916999');
assert.equal(outbound.direction, 'OUTBOUND');
assert.equal(outbound.callStatus, 'ANSWERED');
assert.equal(outbound.disconnectParty, 'CUSTOMER');

console.log('CALL_COMMERCE_MAPPING_TEST_OK');
