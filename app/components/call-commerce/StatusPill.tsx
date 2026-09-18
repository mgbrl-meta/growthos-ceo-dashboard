'use client';

export default function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'PURCHASED'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'UNQUALIFIED' || status === 'CLOSED_LOST'
        ? 'bg-red-50 text-red-700'
        : status === 'QUALIFIED'
          ? 'bg-blue-50 text-blue-700'
          : status === 'FOLLOW_UP'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-slate-100 text-slate-700';

  return (
    <span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}
