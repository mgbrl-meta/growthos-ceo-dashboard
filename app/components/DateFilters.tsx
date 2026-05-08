type Props = {
  start: string;
  end: string;
  compareStart: string;
  compareEnd: string;
  setStart: (v: string) => void;
  setEnd: (v: string) => void;
  setCompareStart: (v: string) => void;
  setCompareEnd: (v: string) => void;
};

export default function DateFilters({
  start,
  end,
  compareStart,
  compareEnd,
  setStart,
  setEnd,
  setCompareStart,
  setCompareEnd,
}: Props) {
  return (
    <div className="flex gap-2">
      <input
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <input
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="rounded border px-3 py-2"
      />
    </div>
  );
}