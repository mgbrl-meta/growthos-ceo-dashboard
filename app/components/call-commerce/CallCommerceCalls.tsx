'use client';

import LeadListWorkspace from './LeadListWorkspace';

export default function CallCommerceCalls() {
  return <LeadListWorkspace endpoint="/api/call-commerce/calls" allowManualCall />;
}
