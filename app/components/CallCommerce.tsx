'use client';

import CallCommerceSummary from './call-commerce/CallCommerceSummary';
import CallCommerceCalls from './call-commerce/CallCommerceCalls';
import CallCommerceMetaEvents from './call-commerce/CallCommerceMetaEvents';
import CallCommerceArchive from './call-commerce/CallCommerceArchive';
import CallCommerceReports from './call-commerce/CallCommerceReports';
import CallCommerceSystemStatus from './call-commerce/CallCommerceSystemStatus';

type Props = {
  activeTab: string;
  start: string;
  end: string;
};

export default function CallCommerce({ activeTab, start, end }: Props) {
  return (
    <section className="space-y-3">
      {activeTab === 'Summary' && (
        <CallCommerceSummary start={start} end={end} />
      )}

      {activeTab === 'Calls' && <CallCommerceCalls />}

      {activeTab === 'Meta Events' && <CallCommerceMetaEvents />}

      {activeTab === 'Archive' && <CallCommerceArchive />}

      {activeTab === 'Reports' && <CallCommerceReports />}

      {activeTab === 'System Status' && <CallCommerceSystemStatus />}
    </section>
  );
}
