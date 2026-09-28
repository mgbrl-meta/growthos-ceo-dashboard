'use client';

import {
  MetaEventsDestinations,
  MetaEventsDiagnostics,
  MetaEventsEventLog,
  MetaEventsOverview,
  MetaEventsRules,
  MetaEventsSettings,
  MetaEventsSources,
} from './meta-events/MetaEventsPages';

type Props = {
  activeTab: string;
};

export default function MetaEvents({
  activeTab,
}: Props) {
  return (
    <section className="space-y-3">
      {activeTab === 'Overview' && (
        <MetaEventsOverview />
      )}

      {activeTab === 'Event Rules' && (
        <MetaEventsRules />
      )}

      {activeTab === 'Event Log' && (
        <MetaEventsEventLog />
      )}

      {activeTab === 'Destinations' && (
        <MetaEventsDestinations />
      )}

      {activeTab === 'Sources' && (
        <MetaEventsSources />
      )}

      {activeTab === 'Diagnostics' && (
        <MetaEventsDiagnostics />
      )}

      {activeTab === 'Settings' && (
        <MetaEventsSettings />
      )}
    </section>
  );
}
