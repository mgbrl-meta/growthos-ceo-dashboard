'use client';

export type GoogleOSSettingsState = {
  targetRoas: number;
  targetCpa: number;
  minSpend: number;
  minConversions: number;
  minClicks: number;
  negativeKeywordSpend: number;
  negativeKeywordClicks: number;
  positiveKeywordConversions: number;
};

export const defaultSettings: GoogleOSSettingsState = {
  targetRoas: 2,
  targetCpa: 1000,
  minSpend: 1000,
  minConversions: 1,
  minClicks: 20,
  negativeKeywordSpend: 500,
  negativeKeywordClicks: 15,
  positiveKeywordConversions: 2,
};

export default function GoogleOSSettings({ settings, setSettings }: any) {
  const update = (key: keyof GoogleOSSettingsState, value: string) => {
    setSettings((prev: GoogleOSSettingsState) => ({
      ...prev,
      [key]: Number(value || 0),
    }));
  };

  return (
    <div className="rounded-3xl border bg-white/90 p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-black">Google OS Settings</h3>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(settings || defaultSettings).map(([key, value]) => (
          <label key={key}>
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
              {key}
            </span>
            <input
              type="number"
              value={value as number}
              onChange={(e) => update(key as keyof GoogleOSSettingsState, e.target.value)}
              className="w-full rounded-2xl border bg-slate-50 px-4 py-3 font-black outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}