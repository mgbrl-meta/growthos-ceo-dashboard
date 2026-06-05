export type Status =
  | 'New'
  | 'Investigating'
  | 'Testing'
  | 'Running'
  | 'Validated'
  | 'Failed'
  | 'Archived';

export interface Opportunity {
  id: string;
  score: number;
  title: string;
  segment: string;
  customers: number;
  potentialRevenue: number;
  potentialProfit: number;
  confidence: number;
  difficulty: string;
  status: Status;
}

export interface Pattern {
  id: string;
  category: string;
  pattern: string;
  sampleSize: number;
  effect: string;
  confidence: number;
  status: Status;
}

export interface Hypothesis {
  id: string;
  title: string;
  segment: string;
  channel: string;
  expectedProfit: number;
  confidence: number;
  score: number;
  status: Status;
}

export interface Action {
  id: string;
  title: string;
  channel: string;
  audience: string;
  expectedProfit: number;
  status: Status;
}

export interface Learning {
  id: string;
  title: string;
  expectedValue: number;
  actualValue: number;
  accuracy: number;
  result: string;
  recommendation: string;
}