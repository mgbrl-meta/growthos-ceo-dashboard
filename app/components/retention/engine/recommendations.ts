export function getRecommendedAction(type: string) {
  switch (type) {
    case 'FIRST_ORDER_NO_REPEAT':
      return 'Launch education sequence';
    case 'REPLENISHMENT_DUE':
      return 'Launch replenishment reminder';
    case 'CROSS_SELL_GAP':
      return 'Launch cross-sell campaign';
    case 'HIGH_VALUE_CHURN':
      return 'Create VIP winback journey';
    case 'WINBACK':
      return 'Launch inactivity campaign';
    default:
      return 'Investigate';
  }
}