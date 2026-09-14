'use client';

import {
  GosEmptyState,
} from '../ui/GrowthUI';

type Props = {
  startDate: string;
  endDate: string;
};

export default function GoogleAdGroup({}: Props) {
  return (
    <GosEmptyState
      title="Ad Group analysis is not available yet"
      text="This page will use the shared Growth OS table, filter and decision components when ad-group data is connected."
    />
  );
}
