'use client';

export default function StatusPill({
  status,
}: {
  status: string;
}) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-700">
      {status}
    </span>
  );
}
