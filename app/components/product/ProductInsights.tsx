'use client';

import {
  GosEmptyState,
} from '../ui/GrowthUI';

type Props = {
  startDate: string;
  endDate: string;
};

export default function ProductInsights({}: Props) {
  return (
    <GosEmptyState
      title="No product insights available yet"
      text="Product growth signals, concentration risks and portfolio opportunities will appear here as the intelligence layer is expanded."
    />
  );
}
