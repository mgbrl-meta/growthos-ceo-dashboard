'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import MetaSettings from './meta/MetaSettings';
import MetaOverview from './meta/MetaOverview';
import MetaCampaignAnalysis from './meta/MetaCampaignAnalysis';
import MetaAdSetAnalysis from './meta/MetaAdSetAnalysis';
import MetaCreativeAnalysis from './meta/MetaCreativeAnalysis';
import MetaFunnelAnalysis from './meta/MetaFunnelAnalysis';
import MetaAlertsRecommendations from './meta/MetaAlertsRecommendations';

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

const DEFAULT_PARAMS: MetaParams = {
  targetRoas: 0.8,
  targetCpa: 1800,
  scalePct: 10,
  killPct: 15,
  minSpend: 10000,
  minPurchases: 3,
  maxCpa: 2200,
  minRoas: 0.7,
  minCtr: 0.8,
  maxFrequency: 2.5,
  cpmIncreasePct: 20,
};

export default function MetaOS({
  activeMetaTab,
  setActiveMetaTab,
  start,
  end,
  compareStart,
  compareEnd,
  setTopTabs,
}: any & { setTopTabs?: (tabs: ReactNode | null) => void }) {
  const [params, setParams] = useState<MetaParams>(DEFAULT_PARAMS);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');

  const metaTabs = [
    'Settings',
    'Overview',
    'Campaign Analysis',
    'Ad Set Analysis',
    'Creative Analysis',
    'Funnel Analysis',
    'Alerts & Recommendations',
  ];

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch(
          `/api/meta-os?tab=campaign-list&start=${start}&end=${end}`
        );
        const json = await res.json();

        const names = Array.isArray(json)
          ? json.map((x: any) => x.campaign_name).filter(Boolean)
          : [];

        setCampaigns(names);
        setSelectedCampaign((prev) =>
          names.length > 0 && !names.includes(prev) ? names[0] : prev
        );
      } catch (error) {
        console.error('Campaign list error', error);
      }
    }

    fetchCampaigns();
  }, [start, end]);

  useEffect(() => {
    if (!setTopTabs) return;

    setTopTabs(
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-2">
        {metaTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveMetaTab(tab)}
            className={
              activeMetaTab === tab
                ? 'whitespace-nowrap rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 shadow'
                : 'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-white hover:text-slate-950'
            }
          >
            {tab}
          </button>
        ))}
      </div>
    );

    return () => setTopTabs(null);
  }, [activeMetaTab, setActiveMetaTab, setTopTabs]);

  return (
    <section className="space-y-6">
      {activeMetaTab === 'Settings' && (
        <MetaSettings params={params} setParams={setParams} />
      )}

      {activeMetaTab === 'Overview' && (
        <MetaOverview
          start={start}
          end={end}
          compareStart={compareStart}
          compareEnd={compareEnd}
          params={params}
        />
      )}

      {activeMetaTab === 'Campaign Analysis' && (
        <MetaCampaignAnalysis start={start} end={end} params={params} />
      )}

      {activeMetaTab === 'Ad Set Analysis' && (
        <MetaAdSetAnalysis
          start={start}
          end={end}
          params={params}
          campaigns={campaigns}
          selectedCampaign={selectedCampaign}
          setSelectedCampaign={setSelectedCampaign}
        />
      )}

      {activeMetaTab === 'Creative Analysis' && (
        <MetaCreativeAnalysis
          start={start}
          end={end}
          params={params}
          campaigns={campaigns}
          selectedCampaign={selectedCampaign}
          setSelectedCampaign={setSelectedCampaign}
        />
      )}

      {activeMetaTab === 'Funnel Analysis' && (
        <MetaFunnelAnalysis
          start={start}
          end={end}
          compareStart={compareStart}
          compareEnd={compareEnd}
          campaigns={campaigns}
          selectedCampaign={selectedCampaign}
          setSelectedCampaign={setSelectedCampaign}
        />
      )}

      {activeMetaTab === 'Alerts & Recommendations' && (
        <MetaAlertsRecommendations
          start={start}
          end={end}
          compareStart={compareStart}
          compareEnd={compareEnd}
          params={params}
        />
      )}
    </section>
  );
}