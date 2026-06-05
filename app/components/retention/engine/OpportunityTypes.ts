export type OpportunityType =
  | 'FIRST_ORDER_NO_REPEAT'
  | 'REPLENISHMENT_DUE'
  | 'CROSS_SELL_GAP'
  | 'HIGH_VALUE_CHURN'
  | 'WINBACK'
  | 'SUBSCRIPTION'
  | 'BUNDLE'
  | 'UPGRADE';

export type ActionType =
  | 'Email'
  | 'WhatsApp'
  | 'SMS/RCS'
  | 'Cross Sell'
  | 'Replenishment'
  | 'Winback'
  | 'Subscription'
  | 'Bundle'
  | 'Journey'
  | 'Support';  

export interface OpportunityResult {
  id: string;
  type: OpportunityType;
  title: string;
  segment: string;

  customers: number;

  potentialRevenue: number;
  potentialProfit: number;

  confidence: number;
  difficulty: 'Low' | 'Medium' | 'High';

  score: number;

  recommendedAction: string;
  expectedImpact: string;
  executionEffort: 'Low' | 'Medium' | 'High';

  actionType: ActionType;

  status: string;
}

