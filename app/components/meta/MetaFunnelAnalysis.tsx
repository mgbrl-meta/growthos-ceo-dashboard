'use client';


import { GosCampaignPicker, GosDataTile, GosLoadingCard, GosPanel } from '../ui/GrowthUI';
import { useEffect, useState } from 'react';

export default function MetaFunnelAnalysis({
  start,
  end,
  compareStart,
  compareEnd,
  campaigns,
  selectedCampaign,
  setSelectedCampaign,
}: any) {
  const [viewMode, setViewMode] = useState<'account' | 'campaign'>('account');
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        const campaignParam =
          viewMode === 'campaign' && selectedCampaign
            ? `&campaign=${encodeURIComponent(selectedCampaign)}`
            : '';

        const res = await fetch(
          `/api/meta-os?tab=funnel&start=${start}&end=${end}&compareStart=${compareStart}&compareEnd=${compareEnd}${campaignParam}`
        );

        setPayload(await res.json());
      } catch (error) {
        console.error('Funnel error', error);
        setPayload(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [start, end, compareStart, compareEnd, viewMode, selectedCampaign]);

  if (loading || !payload) {
    return <LoadingCard text="Loading funnel..." />;
  }

  const current = payload.current || {};
  const compare = payload.compare || {};

  const currentRates = getFunnelRates(current);
  const compareRates = getFunnelRates(compare);

  const rows = [
    {
      stage: 'Impressions',
      current: current.impressions,
      compare: compare.impressions,
      rateLabel: '-',
      currentRate: null,
      compareRate: null,
    },
    {
      stage: 'Clicks',
      current: current.clicks,
      compare: compare.clicks,
      rateLabel: 'CTR',
      currentRate: currentRates.ctr,
      compareRate: compareRates.ctr,
    },
    {
      stage: 'LPV',
      current: current.lpv,
      compare: compare.lpv,
      rateLabel: 'LPV Rate',
      currentRate: currentRates.lpvRate,
      compareRate: compareRates.lpvRate,
    },
    {
      stage: 'ATC',
      current: current.atc,
      compare: compare.atc,
      rateLabel: 'ATC Rate',
      currentRate: currentRates.atcRate,
      compareRate: compareRates.atcRate,
    },
    {
      stage: 'Checkout',
      current: current.checkout,
      compare: compare.checkout,
      rateLabel: 'Checkout Rate',
      currentRate: currentRates.checkoutRate,
      compareRate: compareRates.checkoutRate,
    },
    {
      stage: 'Purchase',
      current: current.purchases,
      compare: compare.purchases,
      rateLabel: 'Purchase Rate',
      currentRate: currentRates.purchaseRate,
      compareRate: compareRates.purchaseRate,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 rounded-xl border bg-white p-3.5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Funnel Analysis</h3>
          <p className="text-[11px] text-slate-500">
            Current period vs comparison period with growth by funnel stage.
          </p>
        </div>

        <div className="flex gap-2">
          <Toggle active={viewMode === 'account'} onClick={() => setViewMode('account')} label="Account Level" />
          <Toggle active={viewMode === 'campaign'} onClick={() => setViewMode('campaign')} label="Campaign Level" />
        </div>
      </div>

      {viewMode === 'campaign' && (
        <CampaignPicker campaigns={campaigns} value={selectedCampaign} onChange={setSelectedCampaign} />
      )}

      <Panel title="Vertical Funnel Flow">
        <div className="space-y-3">
          {rows.map((row, index) => {
            const growth = growthPct(row.current, row.compare);
            const rateGrowth =
              row.currentRate !== null && row.compareRate !== null
                ? row.currentRate - row.compareRate
                : null;

            return (
              <div key={row.stage}>
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[180px_1fr_1fr_1fr_1fr] md:items-center">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Stage
                    </p>
                    <p className="text-[14px] font-semibold">{row.stage}</p>
                  </div>

                  <MetricBox label={`Current (${start} → ${end})`} value={formatNumber(row.current, 0)} />

                  <MetricBox label={`Compare (${compareStart} → ${compareEnd})`} value={formatNumber(row.compare, 0)} />

                  <MetricBox
                    label="Growth"
                    value={`${formatMultiplier(row.current, row.compare)} | ${growth >= 0 ? '+' : ''
                      }${formatNumber(growth, 1)}%`}
                    positive={growth >= 0}
                  />

                  <MetricBox
                    label={row.rateLabel}
                    value={
                      row.currentRate === null
                        ? '-'
                        : `${formatNumber(row.currentRate, 2)}% / ${rateGrowth! >= 0 ? '+' : ''}${formatNumber(rateGrowth!, 2)} pts`
                    }
                    positive={rateGrowth === null ? true : rateGrowth >= 0}
                  />
                </div>

                {index < rows.length - 1 && (
                  <div className="ml-8 h-6 border-l-2 border-dashed border-slate-300" />
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function getFunnelRates(data: any) {
  return {
    ctr: safeDivide(data.clicks, data.impressions) * 100,
    lpvRate: safeDivide(data.lpv, data.clicks) * 100,
    atcRate: safeDivide(data.atc, data.lpv) * 100,
    checkoutRate: safeDivide(data.checkout, data.atc) * 100,
    purchaseRate: safeDivide(data.purchases, data.checkout) * 100,
  };
}

function growthPct(current: any, compare: any) {
  const c = Number(current || 0);
  const p = Number(compare || 0);
  if (!p) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
}

function formatMultiplier(current: any, compare: any) {
  const c = Number(current || 0);
  const p = Number(compare || 0);

  if (!p && c > 0) return '∞x';
  if (!p && !c) return '0x';

  return `${(c / p).toFixed(2)}x`;
}

function safeDivide(a: any, b: any) {
  const numerator = Number(a || 0);
  const denominator = Number(b || 0);
  return denominator ? numerator / denominator : 0;
}

function formatNumber(value: number = 0, digits = 2) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function Panel({ title, children }: any) { return <GosPanel title={title}>{children}</GosPanel>; }

function MetricBox({ label, value }: any) { return <GosDataTile label={label} value={value} />; }

function Toggle({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white'
          : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600'
      }
    >
      {label}
    </button>
  );
}

function CampaignPicker({ campaigns, value, onChange }: any) { return <GosCampaignPicker campaigns={campaigns} value={value} onChange={onChange} />; }

function LoadingCard({ text }: any) { return <GosLoadingCard text={text} />; }
