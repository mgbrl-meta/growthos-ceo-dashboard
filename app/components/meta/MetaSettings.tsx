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

export default function MetaSettings({
  params,
  setParams,
}: any) {
  const update = (
    key: keyof MetaParams,
    value: string
  ) => {
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
          onChange={(v: string) =>
            update('targetRoas', v)
          }
        />

        <SettingInput
          label="Target CPA"
          value={params.targetCpa}
          onChange={(v: string) =>
            update('targetCpa', v)
          }
        />
      </SettingCard>

      <SettingCard title="Decision Rules">
        <SettingInput
          label="Scale If Better Than Target %"
          value={params.scalePct}
          onChange={(v: string) =>
            update('scalePct', v)
          }
        />

        <SettingInput
          label="Kill If Worse Than Target %"
          value={params.killPct}
          onChange={(v: string) =>
            update('killPct', v)
          }
        />
      </SettingCard>

      <SettingCard title="Minimum Data Threshold">
        <SettingInput
          label="Minimum Spend To Evaluate"
          value={params.minSpend}
          onChange={(v: string) =>
            update('minSpend', v)
          }
        />

        <SettingInput
          label="Minimum Purchases"
          value={params.minPurchases}
          onChange={(v: string) =>
            update('minPurchases', v)
          }
        />
      </SettingCard>

      <SettingCard title="Efficiency Limits">
        <SettingInput
          label="Max CPA"
          value={params.maxCpa}
          onChange={(v: string) =>
            update('maxCpa', v)
          }
        />

        <SettingInput
          label="Min ROAS"
          value={params.minRoas}
          onChange={(v: string) =>
            update('minRoas', v)
          }
        />
      </SettingCard>

      <SettingCard title="Creative & Fatigue Signals">
        <SettingInput
          label="Min CTR %"
          value={params.minCtr}
          onChange={(v: string) =>
            update('minCtr', v)
          }
        />

        <SettingInput
          label="Max Frequency"
          value={params.maxFrequency}
          onChange={(v: string) =>
            update('maxFrequency', v)
          }
        />

        <SettingInput
          label="CPM Increase %"
          value={params.cpmIncreasePct}
          onChange={(v: string) =>
            update('cpmIncreasePct', v)
          }
        />
      </SettingCard>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-[14px] font-semibold text-slate-950">
          How this powers Meta OS
        </h3>

        <p className="mt-2 text-[11px] leading-[17px] text-slate-500">
          Every tab uses these rules to classify Scale, Test,
          Kill and Ignore.
        </p>

        <div className="mt-4 space-y-2.5">
          <RuleRow
            label="Scale ROAS"
            value={`Above ${(
              params.targetRoas *
              (1 + params.scalePct / 100)
            ).toFixed(2)}`}
          />

          <RuleRow
            label="Kill ROAS"
            value={`Below ${(
              params.targetRoas *
              (1 - params.killPct / 100)
            ).toFixed(2)}`}
          />

          <RuleRow
            label="Minimum evaluation spend"
            value={formatCurrency(params.minSpend)}
          />
        </div>
      </div>
    </div>
  );
}

function SettingCard({
  title,
  children,
}: any) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-[14px] font-semibold text-slate-950">
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function SettingInput({
  label,
  value,
  onChange,
}: any) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold text-slate-500">
        {label}
      </span>

      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
      />
    </label>
  );
}

function RuleRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <span className="text-[11px] text-slate-500">
        {label}
      </span>

      <strong className="text-[11px] font-semibold text-slate-900">
        {value}
      </strong>
    </div>
  );
}

function formatCurrency(
  value: number = 0
) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}