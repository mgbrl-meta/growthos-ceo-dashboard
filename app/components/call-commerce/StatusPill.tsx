'use client';

import { callOutcome } from './utils';

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

export default function StatusPill({ value }: { value: any }) {
  const outcome = callOutcome(value);
  const className = styles[outcome.tone] || styles.slate;
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${className}`}>
      {outcome.label}
    </span>
  );
}
