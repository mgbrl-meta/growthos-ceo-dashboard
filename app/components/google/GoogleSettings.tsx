'use client';

export type GoogleSettingsState = {
  targetRoas: number;
  targetCpa: number;
  minSpend: number;
  minConversions: number;
  minClicks: number;
  negativeKeywordSpend: number;
  negativeKeywordClicks: number;
  positiveKeywordConversions: number;
};

export const defaultSettings: GoogleSettingsState = {
  targetRoas: 2,
  targetCpa: 1000,
  minSpend: 1000,
  minConversions: 1,
  minClicks: 20,
  negativeKeywordSpend: 500,
  negativeKeywordClicks: 15,
  positiveKeywordConversions: 2,
};

export default function GoogleSettings({ settings, setSettings }: any) {
  const update = (key: keyof GoogleSettingsState, value: string) => {
    setSettings((prev: GoogleSettingsState) => ({
      ...prev,
      [key]: Number(value || 0),
    }));
  };

  return (
    <div className="rounded-xl border bg-white/90 p-3.5 shadow-sm">
      <h3 className="mb-2.5 text-[14px] font-semibold">Google OS Settings</h3>

      <div className="grid grid-cols-2 gap-2.5">
        {Object.entries(settings || defaultSettings).map(([key, value]) => (
          <label key={key}>
            <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
              {key}
            </span>
            <input
              type="number"
              value={value as number}
              onChange={(e) => update(key as keyof GoogleSettingsState, e.target.value)}
              className="w-full rounded-lg border bg-slate-50 px-3 py-2 font-semibold outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
