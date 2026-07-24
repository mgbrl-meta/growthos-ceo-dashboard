export type PatternActionGroup =
  | 'ACTIVATE'
  | 'TEST'
  | 'FIX'
  | 'MONITOR';

export type PatternPriorityBand = 'P1' | 'P2' | 'P3' | 'P4';

export interface PatternDiscoveryPattern {
  pattern_id: string;

  global_rank: number;
  family_rank: number;
  family_status_rank: number;
  source_pattern_rank: number;

  default_visible: boolean;

  priority_band: PatternPriorityBand;

  pattern_family: string;
  pattern_subtype: string;

  operator_domain: string;
  operator_status: string;
  execution_mode: string;

  test_tier: string | null;
  requires_holdout: boolean;
  recommended_test_split: string | null;

  frontend_action_group: PatternActionGroup;

  source_sku: string;
  source_product_title: string | null;
  source_category: string | null;
  source_routine: string | null;
  source_role: string | null;
  source_routine_step: number | null;

  target_sku: string | null;
  target_product_title: string | null;
  target_category: string | null;
  target_routine: string | null;
  target_role: string | null;
  target_routine_step: number | null;

  observed_support: number;
  control_support: number | null;

  primary_metric_name: string;
  primary_metric_value: number | null;

  benchmark_metric_name: string | null;
  benchmark_metric_value: number | null;

  absolute_lift: number | null;
  relative_lift: number | null;

  downstream_repeat_lift: number | null;
  downstream_revenue_lift: number | null;

  recommended_window_start_day: number | null;
  recommended_window_end_day: number | null;

  confidence_score: number;
  confidence_band: string;

  evidence_status: string;
  mapping_status: string;

  engine_priority_score: number;
  operator_priority_score: number;

  operator_headline: string;
  operator_insight: string;
  operator_action: string;
  decision_reason: string;

  source_table: string;
  source_version: string;

  detected_date: string;
  refreshed_at: string;

  pattern_age_days: number;
}

export interface PatternDiscoveryFamily {
  pattern_family: string;

  pattern_count: number;

  activation_patterns: number;
  controlled_rollout_patterns: number;
  controlled_test_patterns: number;
  investigation_patterns: number;

  p1_patterns: number;
  p2_patterns: number;

  avg_confidence_score: number;
  highest_operator_priority: number;
}

export interface PatternDiscoveryQuality {
  refreshed_at: string;

  total_master_patterns: number;
  pattern_families: number;

  activation_patterns: number;
  controlled_rollout_patterns: number;
  controlled_test_patterns: number;
  investigation_patterns: number;

  p1_patterns: number;
  p2_patterns: number;
  p3_patterns: number;
  p4_patterns: number;

  source_products: number;
  target_products: number;
  routines_covered: number;

  patterns_requiring_holdout: number;
  mapping_issue_patterns: number;
  high_confidence_patterns: number;
  large_sample_override_patterns: number;

  avg_confidence_score: number;
  avg_operator_priority: number;

  latest_source_refresh: string;
}

export interface PatternDiscoveryData {
  quality: PatternDiscoveryQuality | null;
  families: PatternDiscoveryFamily[];
  patterns: PatternDiscoveryPattern[];
}

export interface PatternDiscoveryApiResponse {
  ok: boolean;

  data?: PatternDiscoveryData;

  meta?: {
    contract: string;
    version: string;
    generatedAt: string;
    cached: boolean;
    sourceTables: string[];
  };

  error?: {
    message: string;
    details?: string;
    sourceTables?: string[];
  };
}