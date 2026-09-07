'use client';

type Props = {
  startDate: string;
  endDate: string;
};

export default function GoogleFunnel({ startDate, endDate }: Props) {
  return (
    <div className="rounded-xl border bg-white/90 p-3.5 shadow-sm">
      <h3 className="text-[15px] font-semibold">Funnel</h3>
      <p className="mt-2 text-[11px] text-slate-500">
        Google OS Overview will be built here.
      </p>
    </div>
  );
}
