import type { CanonicalCallStatus } from './types';

export const OPEN_LEAD_STATUSES = new Set([
  'NEW',
  'QUALIFIED',
  'FOLLOW_UP',
] as const);

export const TERMINAL_LEAD_STATUSES = new Set([
  'PURCHASED',
  'UNQUALIFIED',
  'CLOSED_LOST',
] as const);

export const CANONICAL_CALL_STATUSES = new Set([
  'RINGING',
  'ANSWERED',
  'MISSED',
  'NO_ANSWER',
  'BUSY',
  'REJECTED',
  'FAILED',
  'UNKNOWN',
] as const);

export type LeadLifecycleCandidate = {
  lead_id: string;
  status: string;
  first_call_at?: unknown;
  status_changed_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  latest_call_at?: unknown;
  is_archived?: boolean | null;
};

export function normalizePhoneIdentity(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').trim();
}

export function canonicalCallStatus(value: unknown): CanonicalCallStatus {
  const status = String(value || '').trim().toUpperCase();
  return CANONICAL_CALL_STATUSES.has(status as any)
    ? status as CanonicalCallStatus
    : 'UNKNOWN';
}

export function isOpenLeadStatus(value: unknown) {
  return OPEN_LEAD_STATUSES.has(String(value || '').trim().toUpperCase() as any);
}

export function isTerminalLeadStatus(value: unknown) {
  return TERMINAL_LEAD_STATUSES.has(String(value || '').trim().toUpperCase() as any);
}

export function toLifecycleDate(value: unknown): Date | null {
  const raw = (value as any)?.value ?? value;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function leadLifecycleStartedAt(lead: LeadLifecycleCandidate) {
  const firstCall = toLifecycleDate(lead.first_call_at);
  const created = toLifecycleDate(lead.created_at);
  if (!firstCall) return created;
  if (!created) return firstCall;
  return firstCall.getTime() <= created.getTime() ? firstCall : created;
}

export function selectLeadForNewAttempt(
  candidates: LeadLifecycleCandidate[],
  callStartedAt?: unknown
) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const callAt = toLifecycleDate(callStartedAt);

  const openCandidates = rows
    .filter(row => isOpenLeadStatus(row.status) && !Boolean(row.is_archived))
    .sort((a, b) => {
      const aStart = leadLifecycleStartedAt(a)?.getTime() ?? 0;
      const bStart = leadLifecycleStartedAt(b)?.getTime() ?? 0;
      return bStart - aStart;
    });

  // When the provider gives us the call's real start time, use the lead
  // lifecycle interval first. This keeps a delayed first webhook for a call
  // that actually happened before terminalization on the historical lead,
  // while a genuinely new call after terminalization starts a new lead.
  if (callAt) {
    const matches = rows
      .filter(row => {
        const started = leadLifecycleStartedAt(row);
        if (!started || callAt.getTime() < started.getTime()) return false;

        if (isOpenLeadStatus(row.status) && !Boolean(row.is_archived)) {
          return true;
        }

        if (!isTerminalLeadStatus(row.status)) return false;
        const ended = toLifecycleDate(row.status_changed_at);
        return Boolean(ended && callAt.getTime() <= ended.getTime());
      })
      .sort((a, b) => {
        const aStart = leadLifecycleStartedAt(a)?.getTime() ?? 0;
        const bStart = leadLifecycleStartedAt(b)?.getTime() ?? 0;
        return bStart - aStart;
      });

    if (matches.length) return matches[0];
  }

  // If time cannot resolve a historical lifecycle safely, an existing OPEN
  // lead owns new calls for this customer. Terminal leads are never reopened
  // automatically.
  return openCandidates[0] || null;
}

const CALL_STATUS_RANK: Record<string, number> = {
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

export function callStatusRank(value: unknown) {
  return CALL_STATUS_RANK[String(value || '').trim().toUpperCase()] ?? 30;
}

export function isTerminalLifecycleEvent(value: unknown) {
  return new Set(['COMPLETED', 'FAILED', 'CANCELED']).has(
    String(value || '').trim().toUpperCase()
  );
}

export function shouldIncomingStatusWin(input: {
  existingStatus: unknown;
  incomingStatus: unknown;
  existingUpdatedAt?: unknown;
  incomingUpdatedAt?: unknown;
  incomingEventType?: unknown;
}) {
  const existing = String(input.existingStatus || '').trim().toUpperCase();
  const incoming = String(input.incomingStatus || '').trim().toUpperCase();

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

  const oldTime = toLifecycleDate(input.existingUpdatedAt)?.getTime();
  const newTime = toLifecycleDate(input.incomingUpdatedAt)?.getTime();
  if (newTime === undefined) return false;
  if (oldTime === undefined) return true;
  return newTime >= oldTime;
}

export function shouldIncomingLifecycleEventWin(input: {
  existingUpdatedAt?: unknown;
  incomingUpdatedAt?: unknown;
}) {
  const oldTime = toLifecycleDate(input.existingUpdatedAt)?.getTime();
  const newTime = toLifecycleDate(input.incomingUpdatedAt)?.getTime();
  if (newTime === undefined) return false;
  if (oldTime === undefined) return true;
  return newTime >= oldTime;
}

export function attemptIdentityParts(input: {
  workspaceId: string;
  brandId: string;
  connectionId: string;
  providerCallId: string;
}) {
  return [
    input.workspaceId,
    input.brandId,
    input.connectionId,
    input.providerCallId,
  ];
}
