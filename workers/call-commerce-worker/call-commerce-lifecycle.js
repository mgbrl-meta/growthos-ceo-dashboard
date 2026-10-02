export const OPEN_LEAD_STATUSES = new Set(['NEW', 'QUALIFIED', 'FOLLOW_UP']);
export const TERMINAL_LEAD_STATUSES = new Set(['PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST']);
export const CANONICAL_CALL_STATUSES = new Set([
  'RINGING',
  'ANSWERED',
  'MISSED',
  'NO_ANSWER',
  'BUSY',
  'REJECTED',
  'FAILED',
  'UNKNOWN',
]);

export function normalizePhoneIdentity(value) {
  return String(value ?? '').replace(/\D/g, '').trim();
}

export function canonicalCallStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  return CANONICAL_CALL_STATUSES.has(status) ? status : 'UNKNOWN';
}

export function isOpenLeadStatus(value) {
  return OPEN_LEAD_STATUSES.has(String(value || '').trim().toUpperCase());
}

export function isTerminalLeadStatus(value) {
  return TERMINAL_LEAD_STATUSES.has(String(value || '').trim().toUpperCase());
}

export function toLifecycleDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function leadLifecycleStartedAt(lead) {
  const firstCall = toLifecycleDate(lead?.first_call_at);
  const created = toLifecycleDate(lead?.created_at);
  if (!firstCall) return created;
  if (!created) return firstCall;
  return firstCall.getTime() <= created.getTime() ? firstCall : created;
}

export function selectLeadForNewAttempt(candidates, callStartedAt) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const callAt = toLifecycleDate(callStartedAt);

  const openCandidates = rows
    .filter(row => isOpenLeadStatus(row?.status) && !Boolean(row?.is_archived))
    .sort((a, b) => {
      const aStart = leadLifecycleStartedAt(a)?.getTime() ?? 0;
      const bStart = leadLifecycleStartedAt(b)?.getTime() ?? 0;
      return bStart - aStart;
    });

  if (callAt) {
    const matches = rows
      .filter(row => {
        const started = leadLifecycleStartedAt(row);
        if (!started || callAt.getTime() < started.getTime()) return false;

        if (isOpenLeadStatus(row?.status) && !Boolean(row?.is_archived)) {
          return true;
        }

        if (!isTerminalLeadStatus(row?.status)) return false;
        const ended = toLifecycleDate(row?.status_changed_at);
        return Boolean(ended && callAt.getTime() <= ended.getTime());
      })
      .sort((a, b) => {
        const aStart = leadLifecycleStartedAt(a)?.getTime() ?? 0;
        const bStart = leadLifecycleStartedAt(b)?.getTime() ?? 0;
        return bStart - aStart;
      });

    if (matches.length) return matches[0];
  }

  return openCandidates[0] || null;
}

const CALL_STATUS_RANK = {
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

export function callStatusRank(value) {
  return CALL_STATUS_RANK[String(value || '').trim().toUpperCase()] ?? 30;
}

export function isTerminalLifecycleEvent(value) {
  return new Set(['COMPLETED', 'FAILED', 'CANCELED']).has(
    String(value || '').trim().toUpperCase()
  );
}

export function shouldIncomingStatusWin(input) {
  const existing = String(input?.existingStatus || '').trim().toUpperCase();
  const incoming = String(input?.incomingStatus || '').trim().toUpperCase();
  if (!existing) return true;

  // A newer terminal provider lifecycle event with no mapped business status
  // must clear a stale transient RINGING state to UNKNOWN. This is not an
  // outcome guess; it explicitly says the call ended but the connector did
  // not provide enough evidence for a terminal canonical status.
  if (
    existing === 'RINGING'
    && incoming === 'UNKNOWN'
    && isTerminalLifecycleEvent(input.incomingEventType)
  ) {
    const oldTime = toLifecycleDate(input.existingUpdatedAt)?.getTime();
    const newTime = toLifecycleDate(input.incomingUpdatedAt)?.getTime();
    return newTime !== undefined && (oldTime === undefined || newTime >= oldTime);
  }

  const incomingRank = callStatusRank(incoming);
  const existingRank = callStatusRank(existing);
  if (incomingRank !== existingRank) return incomingRank > existingRank;

  const oldTime = toLifecycleDate(input?.existingUpdatedAt)?.getTime();
  const newTime = toLifecycleDate(input?.incomingUpdatedAt)?.getTime();
  if (newTime === undefined) return false;
  if (oldTime === undefined) return true;
  return newTime >= oldTime;
}

export function shouldIncomingLifecycleEventWin(input) {
  const oldTime = toLifecycleDate(input?.existingUpdatedAt)?.getTime();
  const newTime = toLifecycleDate(input?.incomingUpdatedAt)?.getTime();
  if (newTime === undefined) return false;
  if (oldTime === undefined) return true;
  return newTime >= oldTime;
}

export function attemptIdentityParts(input) {
  return [
    input.workspaceId,
    input.brandId,
    input.connectionId,
    input.providerCallId,
  ];
}
