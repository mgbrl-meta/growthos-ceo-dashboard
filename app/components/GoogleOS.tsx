'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import GoogleSettings, {
  defaultSettings,
  GoogleSettingsState,
} from './google/GoogleSettings';

import GoogleOverview from './google/GoogleOverview';
import GoogleChannelMix from './google/GoogleChannelMix';
import GoogleCampaign from './google/GoogleCampaign';
import GoogleAdGroup from './google/GoogleAdGroup';
import GoogleSearchTerms from './google/GoogleSearchTerms';
import GoogleKeywords from './google/GoogleKeywords';
import GoogleFunnel from './google/GoogleFunnel';
import GoogleAlerts from './google/GoogleAlerts';

type Props = {
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
  setTopTabs?: (tabs: ReactNode) => void;
};

export default function GoogleOS({
  startDate,
  endDate,
  compareStartDate,
  compareEndDate,
  setTopTabs,
}: Props) {
  const [activeGoogleTab, setActiveGoogleTab] = useState('Settings');

  const [googleSettings, setGoogleSettings] =
    useState<GoogleSettingsState>(defaultSettings);

  const googleTabs = [
    'Settings',
    'Overview',
    'Channel Mix',
    'Campaign',
    'Ad Group',
    'Search Terms',
    'Keywords',
    'Funnel',
    'Alerts',
  ];

  useEffect(() => {
    if (!setTopTabs) return;

    setTopTabs(
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-2">
        {googleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveGoogleTab(tab)}
            className={
              activeGoogleTab === tab
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
  }, [activeGoogleTab, setTopTabs]);

  return (
    <section className="space-y-6">
      {activeGoogleTab === 'Settings' && (
        <GoogleSettings
          settings={googleSettings}
          setSettings={setGoogleSettings}
        />
      )}

      {activeGoogleTab === 'Overview' && (
        <GoogleOverview startDate={startDate} endDate={endDate} />
      )}

      {activeGoogleTab === 'Channel Mix' && (
        <GoogleChannelMix startDate={startDate} endDate={endDate} />
      )}

      {activeGoogleTab === 'Campaign' && (
        <GoogleCampaign startDate={startDate} endDate={endDate} />
      )}

      {activeGoogleTab === 'Ad Group' && (
        <GoogleAdGroup startDate={startDate} endDate={endDate} />
      )}

      {activeGoogleTab === 'Search Terms' && (
        <GoogleSearchTerms
          startDate={startDate}
          endDate={endDate}
          settings={googleSettings}
        />
      )}

      {activeGoogleTab === 'Keywords' && (
        <GoogleKeywords startDate={startDate} endDate={endDate} />
      )}

      {activeGoogleTab === 'Funnel' && (
        <GoogleFunnel startDate={startDate} endDate={endDate} />
      )}

      {activeGoogleTab === 'Alerts' && (
        <GoogleAlerts startDate={startDate} endDate={endDate} />
      )}
    </section>
  );
}