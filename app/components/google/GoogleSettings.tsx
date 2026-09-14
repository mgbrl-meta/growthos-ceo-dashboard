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

const labels: Record<keyof GoogleSettingsState, string> = {
  targetRoas: 'Target ROAS',
  targetCpa: 'Target CPA',
  minSpend: 'Minimum Spend',
  minConversions: 'Minimum Conversions',
  minClicks: 'Minimum Clicks',
  negativeKeywordSpend: 'Negative Keyword Spend',
  negativeKeywordClicks: 'Negative Keyword Clicks',
  positiveKeywordConversions: 'Positive Keyword Conversions',
};

export default function GoogleSettings({ settings, setSettings }: any) {
  const update = (key: keyof GoogleSettingsState, value: string) => {
    setSettings((prev: GoogleSettingsState) => ({
      ...prev,
      [key]: Number(value || 0),
    }));
  };

  const values = settings || defaultSettings;

  return (
    <section className="gos-panel">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(Object.keys(values) as Array<keyof GoogleSettingsState>).map((key) => (
          <label key={key}>
            <span className="mb-1 block text-[10px] font-semibold text-slate-600">
              {labels[key]}
            </span>

            <input
              type="number"
              value={values[key] as number}
              onChange={(event) => update(key, event.target.value)}
              className="gos-input w-full"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
