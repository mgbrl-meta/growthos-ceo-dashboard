'use client';

import {
  GosEmptyState,
} from '../ui/GrowthUI';

type Props = {
  startDate: string;
  endDate: string;
};

export default function GoogleAlerts({}: Props) {
  return (
    <GosEmptyState
      title="No Google alerts available yet"
      text="Performance risks and opportunities will appear here as the alert engine is expanded."
    />
  );
}
