'use client';
type Props = {
  startDate: string;
  endDate: string;
};

export default function GoogleAdGroup({ startDate, endDate }: Props) {
  return (
    <div className="rounded-3xl border bg-white/90 p-6 shadow-sm">
      <h3 className="text-xl font-black">Ad Group</h3>
      <p className="mt-2 text-sm text-slate-500">
        Google OS Overview will be built here.
      </p>
    </div>
  );
}