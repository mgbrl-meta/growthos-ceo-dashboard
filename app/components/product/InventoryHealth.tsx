'use client';

import {
  GosEmptyState,
} from '../ui/GrowthUI';

type Props = {
  startDate: string;
  endDate: string;
};

export default function InventoryHealth({}: Props) {
  return (
    <GosEmptyState
      title="Inventory health is not available yet"
      text="Availability, stock-cover and inventory-risk metrics will appear here as this view is expanded."
    />
  );
}
