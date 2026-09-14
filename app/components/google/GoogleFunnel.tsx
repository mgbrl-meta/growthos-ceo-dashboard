'use client';

import {
  GosEmptyState,
} from '../ui/GrowthUI';

type Props = {
  startDate: string;
  endDate: string;
};

export default function GoogleFunnel({}: Props) {
  return (
    <GosEmptyState
      title="Google funnel analysis is not available yet"
      text="The funnel will populate here when Google intent and conversion-stage data are connected."
    />
  );
}
