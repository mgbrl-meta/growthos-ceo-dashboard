'use client';

type MetaParams = {
  targetRoas: number;
  targetCpa: number;
  scalePct: number;
  killPct: number;
  minSpend: number;
  minPurchases: number;
  maxCpa: number;
  minRoas: number;
  minCtr: number;
  maxFrequency: number;
  cpmIncreasePct: number;
};

export default function MetaSettings({ params, setParams }: any) {
  const update = (key: keyof MetaParams, value: string) => {
    setParams((prev: MetaParams) => ({
      ...prev,
      [key]: Number(value || 0),
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <SettingCard title="Core Targets">
        <SettingInput
          label="Target ROAS"
          value={params.targetRoas}
          onChange={(v: string) => update('targetRoas', v)}
        />
        <SettingInput
          label="Target CPA"
          value={params.targetCpa}
          onChange={(v: string) => update('targetCpa', v)}
        />
      </SettingCard>

      <SettingCard title="Decision Rules">
        <SettingInput
          label="Scale If Better Than Target %"
          value={params.scalePct}
          onChange={(v: string) => update('scalePct', v)}
        />
        <SettingInput
          label="Kill If Worse Than Target %"
          value={params.killPct}
          onChange={(v: string) => update('killPct', v)}
        />
      </SettingCard>

      <SettingCard title="Minimum Data Threshold">
        <SettingInput
          label="Minimum Spend To Evaluate"
          value={params.minSpend}
          onChange={(v: string) => update('minSpend', v)}
        />
        <SettingInput
          label="Minimum Purchases"
          value={params.minPurchases}
          onChange={(v: string) => update('minPurchases', v)}
        />
      </SettingCard>

      <SettingCard title="Efficiency Limits">
        <SettingInput
          label="Max CPA"
          value={params.maxCpa}
          onChange={(v: string) => update('maxCpa', v)}
        />
        <SettingInput
          label="Min ROAS"
          value={params.minRoas}
          onChange={(v: string) => update('minRoas', v)}
        />
      </SettingCard>

      <SettingCard title="Creative & Fatigue Signals">
        <SettingInput
          label="Min CTR %"
          value={params.minCtr}
          onChange={(v: string) => update('minCtr', v)}
        />
        <SettingInput
          label="Max Frequency"
          value={params.maxFrequency}
          onChange={(v: string) => update('maxFrequency', v)}
        />
        <SettingInput
          label="CPM Increase %"
          value={params.cpmIncreasePct}
          onChange={(v: string) => update('cpmIncreasePct', v)}
        />
      </SettingCard>

      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-3.5 text-white shadow-sm shadow-slate-900/25">
        <h3 className="text-[14px] font-semibold">How this powers Meta OS</h3>
        <p className="mt-2 text-[11px] text-slate-400">
          Every tab uses these rules to classify Scale, Test, Kill and Ignore.
        </p>

        <div className="mt-3 space-y-2 text-[11px] text-slate-300">
          <p>
            Scale ROAS: above{' '}
            {(params.targetRoas * (1 + params.scalePct / 100)).toFixed(2)}
          </p>
          <p>
            Kill ROAS: below{' '}
            {(params.targetRoas * (1 - params.killPct / 100)).toFixed(2)}
          </p>
          <p>
            Evaluate only after {formatCurrency(params.minSpend)} spend
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingCard({ title, children }: any) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm shadow-slate-200/25">
      <h3 className="mb-2.5 font-semibold">{title}</h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function SettingInput({ label, value, onChange }: any) {
  return (
    <label>
      <span className="mb-1 block text-[10px] font-bold text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold outline-none focus:border-slate-950"
      />
    </label>
  );
}

function formatCurrency(value: number = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
