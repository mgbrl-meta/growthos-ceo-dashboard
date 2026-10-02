import assert from 'node:assert/strict';
import {
  attemptIdentityParts,
  canonicalCallStatus,
  normalizePhoneIdentity,
  selectLeadForNewAttempt,
  shouldIncomingStatusWin,
} from './call-commerce-lifecycle.js';

const lead = (id, status, start, end = null, archived = false) => ({
  lead_id: id,
  status,
  first_call_at: start,
  created_at: start,
  status_changed_at: end,
  is_archived: archived,
});

assert.equal(normalizePhoneIdentity('+91 99999-99999'), '919999999999');
assert.equal(canonicalCallStatus(''), 'UNKNOWN');
assert.equal(canonicalCallStatus('answered'), 'ANSWERED');

// New inbound/outbound physical calls share the same lead resolver. Direction,
// connector and business number are attempt attributes, not lead identity.
assert.equal(
  selectLeadForNewAttempt([
    lead('L1', 'FOLLOW_UP', '2026-10-01T10:00:00Z'),
  ], '2026-10-02T10:00:00Z')?.lead_id,
  'L1'
);

// Terminal means terminal: a genuinely new call after finalization starts a
// new lead (null means the caller must create one).
assert.equal(
  selectLeadForNewAttempt([
    lead('L1', 'UNQUALIFIED', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
  ], '2026-10-01T12:00:00Z'),
  null
);

// A delayed first webhook for a previously unseen call ID is resolved using
// physical call start time. If the call happened before terminalization it
// stays inside that historical lead lifecycle, even if the lead is archived.
assert.equal(
  selectLeadForNewAttempt([
    lead('L1', 'UNQUALIFIED', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', true),
    lead('L2', 'NEW', '2026-10-01T11:30:00Z'),
  ], '2026-10-01T10:30:00Z')?.lead_id,
  'L1'
);

// A current open lead owns a new call when a provider does not expose a
// reliable startedAt. Terminal leads are never reused as a grace-window rule.
assert.equal(
  selectLeadForNewAttempt([
    lead('L1', 'PURCHASED', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z'),
    lead('L2', 'NEW', '2026-10-01T10:00:00Z'),
  ], null)?.lead_id,
  'L2'
);

// Same-attempt state progression: transient statuses may resolve, fallback
// routing may upgrade NO_ANSWER to ANSWERED, but stale/lower evidence cannot
// downgrade an already answered call.
assert.equal(shouldIncomingStatusWin({ existingStatus: 'RINGING', incomingStatus: 'NO_ANSWER' }), true);
assert.equal(shouldIncomingStatusWin({ existingStatus: 'NO_ANSWER', incomingStatus: 'ANSWERED' }), true);
assert.equal(shouldIncomingStatusWin({ existingStatus: 'ANSWERED', incomingStatus: 'NO_ANSWER' }), false);
assert.equal(shouldIncomingStatusWin({ existingStatus: 'NO_ANSWER', incomingStatus: 'RINGING' }), false);

// A final provider lifecycle event with no canonical outcome must not leave an
// attempt permanently RINGING. It becomes UNKNOWN rather than guessed.
assert.equal(shouldIncomingStatusWin({
  existingStatus: 'RINGING',
  incomingStatus: 'UNKNOWN',
  existingUpdatedAt: '2026-10-01T10:00:00Z',
  incomingUpdatedAt: '2026-10-01T10:01:00Z',
  incomingEventType: 'COMPLETED',
}), true);
assert.equal(shouldIncomingStatusWin({
  existingStatus: 'ANSWERED',
  incomingStatus: 'UNKNOWN',
  existingUpdatedAt: '2026-10-01T10:00:00Z',
  incomingUpdatedAt: '2026-10-01T10:01:00Z',
  incomingEventType: 'COMPLETED',
}), false);

// Attempt identity is tenant + brand + connector + provider call ID. The same
// provider call ID on another connector or brand is a different physical leg.
assert.notDeepEqual(
  attemptIdentityParts({workspaceId:'W',brandId:'B',connectionId:'C1',providerCallId:'X'}),
  attemptIdentityParts({workspaceId:'W',brandId:'B',connectionId:'C2',providerCallId:'X'})
);
assert.notDeepEqual(
  attemptIdentityParts({workspaceId:'W',brandId:'B1',connectionId:'C1',providerCallId:'X'}),
  attemptIdentityParts({workspaceId:'W',brandId:'B2',connectionId:'C1',providerCallId:'X'})
);

console.log('CALL_COMMERCE_LIFECYCLE_TEST_OK');
