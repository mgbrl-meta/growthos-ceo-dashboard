'use client';

import { useState } from 'react';
import CommandCenter from './retention/CommandCenter';
import Settings from './retention/Settings';
import OpportunityBank from './retention/OpportunityBank';
import PatternDiscovery from './retention/PatternDiscovery';
import HypothesisLab from './retention/HypothesisLab';
import ActionTracker from './retention/ActionTracker';
import LearningLoop from './retention/LearningLoop';
import CustomerJourney from './retention/CustomerJourney';
import DailyPlanner from './retention/DailyPlanner';

const tabs = [
  'Mission Control',
  'Command Center',
  'Daily Planner',
  'Opportunity Bank',
  'Pattern Discovery',
  'Hypothesis Lab',
  'Action Tracker',
  'Learning Loop',
  'Settings',
  'Customer Journey',
];

function Placeholder({ title }: { title: string }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Retention OS
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        This module will be built next.
      </p>
    </section>
  );
}

export default function RetentionOS() {
  const [activeTab, setActiveTab] = useState('Mission Control');

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-4 py-2 text-xs font-black transition ${
                activeTab === tab
                  ? 'bg-slate-950 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {(activeTab === 'Mission Control' || activeTab === 'Command Center') && (
        <CommandCenter />
      )}

      {activeTab === 'Customer Journey' && <CustomerJourney />}
      {activeTab === 'Daily Planner' && <DailyPlanner />}
      {activeTab === 'Opportunity Bank' && <OpportunityBank />}
      {activeTab === 'Pattern Discovery' && <PatternDiscovery />}
      {activeTab === 'Hypothesis Lab' && <HypothesisLab />}
      {activeTab === 'Settings' && <Settings />}
      {activeTab === 'Learning Loop' && <LearningLoop />}
      {activeTab === 'Action Tracker' && <ActionTracker />}
    

      {activeTab !== 'Mission Control' &&
        activeTab !== 'Command Center' &&
        activeTab !== 'Daily Planner' &&
        activeTab !== 'Customer Journey' &&
        activeTab !== 'Opportunity Bank' &&
        activeTab !== 'Pattern Discovery' &&
        activeTab !== 'Hypothesis Lab' &&
        activeTab !== 'Settings' &&
        activeTab !== 'Learning Loop' && 
        activeTab !== 'Action Tracker' && <Placeholder title={activeTab} />}
    </div>
  );
}