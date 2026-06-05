export function getActionType(type: string) {
  switch (type) {
    case 'FIRST_ORDER_NO_REPEAT':
      return 'WhatsApp';
    case 'REPLENISHMENT_DUE':
      return 'Replenishment';
    case 'CROSS_SELL_GAP':
      return 'Cross Sell';
    case 'HIGH_VALUE_CHURN':
      return 'Winback';
    case 'WINBACK':
      return 'SMS/RCS';
    default:
      return 'Journey';
  }
}