'use client';
import LeadListWorkspace from './LeadListWorkspace';

export default function CallCommerceCalls({
  start = '',
  end = '',
}: {
  start?: string;
  end?: string;
}) {
  return <LeadListWorkspace start={start} end={end} />;
}
