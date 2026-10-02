'use client';

const styles: Record<string, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function WorkflowStatusPill({ status }: { status: unknown }) {
  const value = String(status || 'NEW').toUpperCase();
  const className =
    value === 'PURCHASED' ? styles.emerald :
    value === 'QUALIFIED' ? styles.violet :
    value === 'FOLLOW_UP' ? styles.amber :
    value === 'UNQUALIFIED' || value === 'CLOSED_LOST' ? styles.rose :
    styles.blue;

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${className}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

const canonicalLabels: Record<string, string> = {
  ANSWERED: 'Answered',
  NO_ANSWER: 'No Answer',
  RINGING: 'Ringing',
  FAILED: 'Failed',
  BUSY: 'Busy',
  REJECTED: 'Rejected',
  MISSED: 'Missed',
  UNKNOWN: 'Unknown',
};

const canonicalTones: Record<string, string> = {
  ANSWERED: 'emerald',
  NO_ANSWER: 'rose',
  RINGING: 'blue',
  FAILED: 'rose',
  BUSY: 'amber',
  REJECTED: 'rose',
  MISSED: 'rose',
  UNKNOWN: 'slate',
};

export default function StatusPill({ value }: { value: any }) {
  const raw = value?.call_status ?? value?.latest_call_status ?? 'UNKNOWN';
  const status = String(raw || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
  const label = canonicalLabels[status] || status.replaceAll('_', ' ');
  const className = styles[canonicalTones[status] || 'slate'];

  return (
    <span
      title="Canonical status of this call attempt"
      className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
