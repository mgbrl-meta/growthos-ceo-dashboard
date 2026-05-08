type DateControlProps = {
  start: string;
  end: string;
  compareStart: string;
  compareEnd: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  setCompareStart: (value: string) => void;
  setCompareEnd: (value: string) => void;
  onApply: () => void;
  loading: boolean;
  setPreset: (
    preset: "yesterday" | "l7" | "l14" | "l30" | "mtd" | "lastMonth"
  ) => void;
};

export default function DateControl({
  start,
  end,
  compareStart,
  compareEnd,
  setStart,
  setEnd,
  setCompareStart,
  setCompareEnd,
  onApply,
  loading,
  setPreset,
}: DateControlProps) {
  return (
    <section className="flex flex-wrap items-center justify-end gap-2">
      <select
        onChange={(e) => setPreset(e.target.value as any)}
        defaultValue=""
        className="h-9 rounded-full border border-slate-200 bg-slate-100 px-3 text-xs font-black text-slate-800 outline-none"
      >
        <option value="" disabled>
          Preset
        </option>
        <option value="yesterday">Yesterday</option>
        <option value="l7">Last 7 Days</option>
        <option value="l14">Last 14 Days</option>
        <option value="l30">Last 30 Days</option>
        <option value="mtd">This Month</option>
        <option value="lastMonth">Last Month</option>
      </select>

      <DatePill
        label="Period"
        start={start}
        end={end}
        setStart={setStart}
        setEnd={setEnd}
      />

      <DatePill
        label="Compare"
        start={compareStart}
        end={compareEnd}
        setStart={setCompareStart}
        setEnd={setCompareEnd}
      />

      <button
        onClick={onApply}
        className="h-9 rounded-full bg-slate-950 px-5 text-xs font-black text-white"
      >
        {loading ? "Loading..." : "Apply"}
      </button>
    </section>
  );
}

function DatePill({
  label,
  start,
  end,
  setStart,
  setEnd,
}: {
  label: string;
  start: string;
  end: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
}) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>

      <input
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="w-[125px] bg-transparent text-xs font-black text-slate-900 outline-none"
      />

      <span className="text-slate-300">→</span>

      <input
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="w-[125px] bg-transparent text-xs font-black text-slate-900 outline-none"
      />
    </div>
  );
}