'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// Import tab components
import ProductOverview from './product/ProductOverview';
import SkuPerformance from './product/SkuPerformance';
import DemandTrends from './product/DemandTrends';
import InventoryHealth from './product/InventoryHealth';
import Forecasting from './product/Forecasting';
import SeasonalityEngine from './product/SeasonalityEngine';
import ProductInsights from './product/ProductInsights';
import ProductSettings from './product/ProductSettings';

type Props = {
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
  setTopTabs?: (tabs: ReactNode | null) => void;
};

export default function ProductOS({
  startDate,
  endDate,
  compareStartDate,
  compareEndDate,
  setTopTabs,
}: Props) {
  const [activeTab, setActiveTab] = useState('Overview');

  const tabs = [
    'Overview',
    'SKU Performance',
    'Demand Trends',
    'Inventory Health',
    'Forecasting',
    'Seasonality',
    'Insights',
    'Settings',
  ];

  useEffect(() => {
    if (!setTopTabs) return;

    setTopTabs(
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
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
  }, [activeTab, setTopTabs]);

  return (
    <div className="mt-6">
      <div>
        {activeTab === 'Overview' && (
          <ProductOverview startDate={startDate} endDate={endDate} />
        )}

        {activeTab === 'SKU Performance' && (
          <SkuPerformance startDate={startDate} endDate={endDate} />
        )}

        {activeTab === 'Demand Trends' && (
          <DemandTrends startDate={startDate} endDate={endDate} />
        )}

        {activeTab === 'Inventory Health' && (
          <InventoryHealth startDate={startDate} endDate={endDate} />
        )}

        {activeTab === 'Forecasting' && (
          <Forecasting startDate={startDate} endDate={endDate} />
        )}

        {activeTab === 'Seasonality' && (
          <SeasonalityEngine startDate={startDate} endDate={endDate} />
        )}

        {activeTab === 'Insights' && (
          <ProductInsights startDate={startDate} endDate={endDate} />
        )}

        {activeTab === 'Settings' && <ProductSettings />}
      </div>
    </div>
  );
}