import { NextResponse } from 'next/server';

import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const LOCATION = 'asia-southeast1';

const PATTERN_TABLE = 'retention_pd_pattern_master_serving_v1_tbl';
const ACTION_TABLE = 'retention_action_log';

const WORKFLOW_TYPES = ['ACTIVATE', 'TEST', 'FIX'] as const;
type PatternWorkflowType = (typeof WORKFLOW_TYPES)[number];

type CreatePatternWorkflowBody = {
  patternId?: unknown;
  workflowType?: unknown;
  plannedDate?: unknown;
  channel?: unknown;
  audience?: unknown;
  notes?: unknown;
};

function isWorkflowType(value: string): value is PatternWorkflowType {
  return WORKFLOW_TYPES.includes(value as PatternWorkflowType);
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

const SELECT_FIELDS = `
  action_id,
  opportunity_type,
  opportunity_group,
  action_title,
  channel,
  audience,
  CAST(expected_revenue AS FLOAT64) AS expected_revenue,
  CAST(expected_profit AS FLOAT64) AS expected_profit,
  CAST(expected_customers AS INT64) AS expected_customers,
  status,
  FORMAT_DATE('%Y-%m-%d', planned_date) AS planned_date,
  FORMAT_DATE('%Y-%m-%d', launched_date) AS launched_date,
  FORMAT_DATE('%Y-%m-%d', completed_date) AS completed_date,
  notes,
  CAST(created_at AS STRING) AS created_at,
  CAST(updated_at AS STRING) AS updated_at,
  created_by,
  source_system,
  source_pattern_id,
  workflow_type,
  pattern_family,
  pattern_subtype,
  source_sku,
  target_sku,
  source_product_title,
  target_product_title,
  priority_band,
  CAST(operator_priority_score AS FLOAT64) AS operator_priority_score,
  CAST(confidence_score AS FLOAT64) AS confidence_score,
  CAST(evidence_support AS INT64) AS evidence_support,
  CAST(expected_primary_lift AS FLOAT64) AS expected_primary_lift,
  CAST(expected_downstream_repeat_lift AS FLOAT64) AS expected_downstream_repeat_lift,
  CAST(expected_revenue_lift_per_customer AS FLOAT64) AS expected_revenue_lift_per_customer,
  CAST(recommended_window_start_day AS INT64) AS recommended_window_start_day,
  CAST(recommended_window_end_day AS INT64) AS recommended_window_end_day,
  requires_holdout,
  recommended_test_split,
  evidence_status,
  source_table,
  source_version,
  idempotency_key,
  metadata_json
`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workflowType =
      url.searchParams.get('workflowType')?.trim().toUpperCase() || '';

    if (workflowType && !isWorkflowType(workflowType)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid workflowType' },
        { status: 400 }
      );
    }

    const workflowFilter = workflowType
      ? 'AND workflow_type = @workflowType'
      : '';

    const query = `
      SELECT
        ${SELECT_FIELDS}
      FROM \`${PROJECT}.${DATASET}.${ACTION_TABLE}\`
      WHERE source_system = 'PATTERN_DISCOVERY'
        ${workflowFilter}
      ORDER BY
        CASE status
          WHEN 'Running' THEN 1
          WHEN 'Planned' THEN 2
          WHEN 'Completed' THEN 3
          WHEN 'Cancelled' THEN 4
          ELSE 5
        END,
        operator_priority_score DESC,
        created_at DESC
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
      params: workflowType ? { workflowType } : undefined,
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Pattern workflow GET error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load Pattern Discovery workflows',
        details:
          error instanceof Error ? error.message : 'Unknown BigQuery error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePatternWorkflowBody;

    const patternId = optionalString(body.patternId);
    const workflowType = optionalString(body.workflowType).toUpperCase();
    const plannedDate = optionalString(body.plannedDate);
    const requestedChannel = optionalString(body.channel);
    const requestedAudience = optionalString(body.audience);
    const additionalNotes = optionalString(body.notes);

    if (!patternId) {
      return NextResponse.json(
        { ok: false, error: 'patternId is required' },
        { status: 400 }
      );
    }

    if (!isWorkflowType(workflowType)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'workflowType must be ACTIVATE, TEST or FIX',
        },
        { status: 400 }
      );
    }

    const query = `
      MERGE \`${PROJECT}.${DATASET}.${ACTION_TABLE}\` AS target
      USING (
        SELECT
          pattern_id,
          pattern_family,
          pattern_subtype,
          operator_domain,
          operator_status,
          source_sku,
          source_product_title,
          target_sku,
          target_product_title,
          priority_band,
          CAST(operator_priority_score AS FLOAT64) AS operator_priority_score,
          CAST(confidence_score AS FLOAT64) AS confidence_score,
          CAST(observed_support AS INT64) AS evidence_support,
          CAST(absolute_lift AS FLOAT64) AS expected_primary_lift,
          CAST(downstream_repeat_lift AS FLOAT64) AS expected_downstream_repeat_lift,
          CAST(downstream_revenue_lift AS FLOAT64) AS expected_revenue_lift_per_customer,
          CAST(recommended_window_start_day AS INT64) AS recommended_window_start_day,
          CAST(recommended_window_end_day AS INT64) AS recommended_window_end_day,
          requires_holdout,
          recommended_test_split,
          evidence_status,
          operator_headline,
          operator_insight,
          operator_action,
          decision_reason,
          source_table,
          source_version
        FROM \`${PROJECT}.${DATASET}.${PATTERN_TABLE}\`
        WHERE pattern_id = @patternId
        LIMIT 1
      ) AS source
      ON target.idempotency_key = CONCAT(
        'PATTERN_DISCOVERY:', source.pattern_id, ':', @workflowType
      )
      AND target.status NOT IN ('Completed', 'Cancelled')

      WHEN NOT MATCHED THEN
        INSERT (
          action_id,
          opportunity_type,
          opportunity_group,
          action_title,
          channel,
          audience,
          expected_revenue,
          expected_profit,
          expected_customers,
          status,
          planned_date,
          launched_date,
          completed_date,
          notes,
          created_at,
          updated_at,
          created_by,
          source_system,
          source_pattern_id,
          workflow_type,
          pattern_family,
          pattern_subtype,
          source_sku,
          target_sku,
          source_product_title,
          target_product_title,
          priority_band,
          operator_priority_score,
          confidence_score,
          evidence_support,
          expected_primary_lift,
          expected_downstream_repeat_lift,
          expected_revenue_lift_per_customer,
          recommended_window_start_day,
          recommended_window_end_day,
          requires_holdout,
          recommended_test_split,
          evidence_status,
          source_table,
          source_version,
          idempotency_key,
          metadata_json
        )
        VALUES (
          GENERATE_UUID(),
          source.pattern_family,
          @workflowType,
          CASE @workflowType
            WHEN 'ACTIVATE' THEN CONCAT('Activate: ', source.operator_headline)
            WHEN 'TEST' THEN CONCAT('Test: ', source.operator_headline)
            ELSE CONCAT('Investigate: ', source.operator_headline)
          END,
          COALESCE(
            NULLIF(@channel, ''),
            CASE source.operator_domain
              WHEN 'CART_MERCHANDISING' THEN 'Website'
              WHEN 'ACQUISITION_MERCHANDISING' THEN 'Website'
              WHEN 'LIFECYCLE_CRM' THEN 'WhatsApp'
              WHEN 'LIFECYCLE_ROUTINE' THEN 'WhatsApp'
              WHEN 'LIFECYCLE_REPLENISHMENT' THEN 'WhatsApp'
              ELSE 'Internal'
            END
          ),
          COALESCE(
            NULLIF(@audience, ''),
            CONCAT(
              'Define audience from ',
              source.source_sku,
              IF(
                source.target_sku IS NULL,
                '',
                CONCAT(' → ', source.target_sku)
              )
            )
          ),
          0,
          0,
          0,
          'Planned',
          COALESCE(
            SAFE.PARSE_DATE('%Y-%m-%d', NULLIF(@plannedDate, '')),
            CURRENT_DATE()
          ),
          NULL,
          NULL,
          CONCAT(
            'Pattern Discovery handoff. Operator action: ',
            source.operator_action,
            ' Evidence: ',
            source.operator_insight,
            ' Decision: ',
            source.decision_reason,
            IF(
              NULLIF(@notes, '') IS NULL,
              '',
              CONCAT(' Additional note: ', @notes)
            )
          ),
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP(),
          'Pattern Discovery',
          'PATTERN_DISCOVERY',
          source.pattern_id,
          @workflowType,
          source.pattern_family,
          source.pattern_subtype,
          source.source_sku,
          source.target_sku,
          source.source_product_title,
          source.target_product_title,
          source.priority_band,
          source.operator_priority_score,
          source.confidence_score,
          source.evidence_support,
          source.expected_primary_lift,
          source.expected_downstream_repeat_lift,
          source.expected_revenue_lift_per_customer,
          source.recommended_window_start_day,
          source.recommended_window_end_day,
          source.requires_holdout,
          source.recommended_test_split,
          source.evidence_status,
          source.source_table,
          source.source_version,
          CONCAT('PATTERN_DISCOVERY:', source.pattern_id, ':', @workflowType),
          TO_JSON_STRING(
            STRUCT(
              source.operator_status AS operator_status,
              source.operator_domain AS operator_domain,
              source.operator_headline AS operator_headline,
              source.operator_action AS operator_action,
              source.operator_insight AS operator_insight,
              source.decision_reason AS decision_reason
            )
          )
        );

      SELECT
        ${SELECT_FIELDS}
      FROM \`${PROJECT}.${DATASET}.${ACTION_TABLE}\`
      WHERE idempotency_key = CONCAT(
        'PATTERN_DISCOVERY:', @patternId, ':', @workflowType
      )
      AND status NOT IN ('Completed', 'Cancelled')
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
      params: {
        patternId,
        workflowType,
        plannedDate,
        channel: requestedChannel,
        audience: requestedAudience,
        notes: additionalNotes,
      },
    });

    if (!rows.length) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Pattern was not found in the serving table',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: rows[0],
      message: 'Workflow saved. Active duplicates are prevented.',
    });
  } catch (error) {
    console.error('Pattern workflow POST error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to create Pattern Discovery workflow',
        details:
          error instanceof Error ? error.message : 'Unknown BigQuery error',
      },
      { status: 500 }
    );
  }
}
