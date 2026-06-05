'use client';

export default function StatusPill({
  status,
}: {
  status: string;
}) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
      {status}
    </span>
  );
}