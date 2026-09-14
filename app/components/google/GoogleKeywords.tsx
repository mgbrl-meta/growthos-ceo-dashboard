'use client';

import {
  GosEmptyState,
} from '../ui/GrowthUI';

type Props = {
  startDate: string;
  endDate: string;
};

export default function GoogleKeywords({}: Props) {
  return (
    <GosEmptyState
      title="Keyword intelligence is not available yet"
      text="Keyword-level demand and efficiency will appear here once the source is connected."
    />
  );
}
