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

export type PatternWorkflowType = 'ACTIVATE' | 'TEST' | 'FIX';

export interface PatternWorkflowAction {
  action_id: string;
  opportunity_type: string | null;
  opportunity_group: string | null;
  action_title: string;
  channel: string | null;
  audience: string | null;
  expected_revenue: number;
  expected_profit: number;
  expected_customers: number;
  status: string;
  planned_date: string | null;
  launched_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  source_system: string | null;
  source_pattern_id: string | null;
  workflow_type: PatternWorkflowType | null;
  pattern_family: string | null;
  pattern_subtype: string | null;
  source_sku: string | null;
  target_sku: string | null;
  source_product_title: string | null;
  target_product_title: string | null;
  priority_band: string | null;
  operator_priority_score: number | null;
  confidence_score: number | null;
  evidence_support: number | null;
  expected_primary_lift: number | null;
  expected_downstream_repeat_lift: number | null;
  expected_revenue_lift_per_customer: number | null;
  recommended_window_start_day: number | null;
  recommended_window_end_day: number | null;
  requires_holdout: boolean | null;
  recommended_test_split: string | null;
  evidence_status: string | null;
  source_table: string | null;
  source_version: string | null;
  idempotency_key: string | null;
  metadata_json: string | null;
}

export interface PatternWorkflowApiResponse {
  ok: boolean;
  data?: PatternWorkflowAction[];
  error?: string;
  details?: string;
}
