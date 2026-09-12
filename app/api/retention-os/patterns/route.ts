import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';

import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';

import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const LOCATION = 'asia-southeast1';

const SERVING_TABLE =
  'retention_pd_pattern_master_serving_v1_tbl';

const FAMILY_SUMMARY_TABLE =
  'retention_pd_pattern_master_family_summary_v1_tbl';

const QUALITY_TABLE =
  'retention_pd_pattern_master_quality_v1_tbl';

const SOURCE_TABLES = [
  SERVING_TABLE,
  FAMILY_SUMMARY_TABLE,
  QUALITY_TABLE,
];

type JsonPayloadRow = {
  payload: string | null;
};

function parseJsonRows<T>(rows: JsonPayloadRow[]): T[] {
  return rows.flatMap((row) => {
    if (!row.payload) {
      return [];
    }

    try {
      return [JSON.parse(row.payload) as T];
    } catch (error) {
      console.error(
        'Failed to parse Pattern Discovery BigQuery row',
        error
      );

      return [];
    }
  });
}

const PATTERNS_QUERY = `
  SELECT
    TO_JSON_STRING(
      STRUCT(
        pattern_id,

        CAST(global_rank AS INT64)
          AS global_rank,

        CAST(family_rank AS INT64)
          AS family_rank,

        CAST(family_status_rank AS INT64)
          AS family_status_rank,

        CAST(source_pattern_rank AS INT64)
          AS source_pattern_rank,

        default_visible,

        priority_band,

        pattern_family,
        pattern_subtype,

        operator_domain,
        operator_status,
        execution_mode,

        test_tier,
        requires_holdout,
        recommended_test_split,

        frontend_action_group,

        source_sku,
        source_product_title,
        source_category,
        source_routine,
        source_role,

        CAST(source_routine_step AS INT64)
          AS source_routine_step,

        target_sku,
        target_product_title,
        target_category,
        target_routine,
        target_role,

        CAST(target_routine_step AS INT64)
          AS target_routine_step,

        CAST(observed_support AS INT64)
          AS observed_support,

        CAST(control_support AS INT64)
          AS control_support,

        primary_metric_name,

        CAST(primary_metric_value AS FLOAT64)
          AS primary_metric_value,

        benchmark_metric_name,

        CAST(benchmark_metric_value AS FLOAT64)
          AS benchmark_metric_value,

        CAST(absolute_lift AS FLOAT64)
          AS absolute_lift,

        CAST(relative_lift AS FLOAT64)
          AS relative_lift,

        CAST(downstream_repeat_lift AS FLOAT64)
          AS downstream_repeat_lift,

        CAST(downstream_revenue_lift AS FLOAT64)
          AS downstream_revenue_lift,

        CAST(recommended_window_start_day AS INT64)
          AS recommended_window_start_day,

        CAST(recommended_window_end_day AS INT64)
          AS recommended_window_end_day,

        CAST(confidence_score AS FLOAT64)
          AS confidence_score,

        confidence_band,

        evidence_status,
        mapping_status,

        CAST(engine_priority_score AS FLOAT64)
          AS engine_priority_score,

        CAST(operator_priority_score AS FLOAT64)
          AS operator_priority_score,

        operator_headline,
        operator_insight,
        operator_action,
        decision_reason,

        source_table,
        source_version,

        FORMAT_DATE(
          '%Y-%m-%d',
          detected_date
        ) AS detected_date,

        CAST(refreshed_at AS STRING)
          AS refreshed_at,

        CAST(pattern_age_days AS INT64)
          AS pattern_age_days
      )
    ) AS payload

  FROM
    \`${PROJECT}.${DATASET}.${SERVING_TABLE}\`

  ORDER BY
    global_rank
`;

const FAMILY_QUERY = `
  WITH family_aggregated AS (
    SELECT
      pattern_family,

      CAST(
        SUM(pattern_count)
        AS INT64
      ) AS pattern_count,

      CAST(
        SUM(
          IF(
            operator_status = 'ACTIVATE',
            pattern_count,
            0
          )
        )
        AS INT64
      ) AS activation_patterns,

      CAST(
        SUM(
          IF(
            operator_status = 'CONTROLLED_ROLLOUT',
            pattern_count,
            0
          )
        )
        AS INT64
      ) AS controlled_rollout_patterns,

      CAST(
        SUM(
          IF(
            operator_status = 'CONTROLLED_TEST',
            pattern_count,
            0
          )
        )
        AS INT64
      ) AS controlled_test_patterns,

      CAST(
        SUM(
          IF(
            operator_status = 'INVESTIGATE',
            pattern_count,
            0
          )
        )
        AS INT64
      ) AS investigation_patterns,

      CAST(
        SUM(
          IF(
            priority_band = 'P1',
            pattern_count,
            0
          )
        )
        AS INT64
      ) AS p1_patterns,

      CAST(
        SUM(
          IF(
            priority_band = 'P2',
            pattern_count,
            0
          )
        )
        AS INT64
      ) AS p2_patterns,

      ROUND(
        SAFE_DIVIDE(
          SUM(
            avg_confidence_score * pattern_count
          ),
          SUM(pattern_count)
        ),
        4
      ) AS avg_confidence_score,

      MAX(highest_operator_priority)
        AS highest_operator_priority

    FROM
      \`${PROJECT}.${DATASET}.${FAMILY_SUMMARY_TABLE}\`

    GROUP BY
      pattern_family
  )

  SELECT
    TO_JSON_STRING(
      STRUCT(
        pattern_family,
        pattern_count,

        activation_patterns,
        controlled_rollout_patterns,
        controlled_test_patterns,
        investigation_patterns,

        p1_patterns,
        p2_patterns,

        avg_confidence_score,
        highest_operator_priority
      )
    ) AS payload

  FROM family_aggregated

  ORDER BY
    highest_operator_priority DESC,
    pattern_family
`;

const QUALITY_QUERY = `
  SELECT
    TO_JSON_STRING(
      STRUCT(
        CAST(refreshed_at AS STRING)
          AS refreshed_at,

        CAST(total_master_patterns AS INT64)
          AS total_master_patterns,

        CAST(pattern_families AS INT64)
          AS pattern_families,

        CAST(activation_patterns AS INT64)
          AS activation_patterns,

        CAST(controlled_rollout_patterns AS INT64)
          AS controlled_rollout_patterns,

        CAST(controlled_test_patterns AS INT64)
          AS controlled_test_patterns,

        CAST(investigation_patterns AS INT64)
          AS investigation_patterns,

        CAST(p1_patterns AS INT64)
          AS p1_patterns,

        CAST(p2_patterns AS INT64)
          AS p2_patterns,

        CAST(p3_patterns AS INT64)
          AS p3_patterns,

        CAST(p4_patterns AS INT64)
          AS p4_patterns,

        CAST(source_products AS INT64)
          AS source_products,

        CAST(target_products AS INT64)
          AS target_products,

        CAST(routines_covered AS INT64)
          AS routines_covered,

        CAST(patterns_requiring_holdout AS INT64)
          AS patterns_requiring_holdout,

        CAST(mapping_issue_patterns AS INT64)
          AS mapping_issue_patterns,

        CAST(high_confidence_patterns AS INT64)
          AS high_confidence_patterns,

        CAST(large_sample_override_patterns AS INT64)
          AS large_sample_override_patterns,

        CAST(avg_confidence_score AS FLOAT64)
          AS avg_confidence_score,

        CAST(avg_operator_priority AS FLOAT64)
          AS avg_operator_priority,

        CAST(latest_source_refresh AS STRING)
          AS latest_source_refresh
      )
    ) AS payload

  FROM
    \`${PROJECT}.${DATASET}.${QUALITY_TABLE}\`

  LIMIT 1
`;

async function loadPatternDiscoveryData() {
  const [
    patternResult,
    familyResult,
    qualityResult,
  ] = await Promise.all([
    bigquery.query({
      query: PATTERNS_QUERY,
      location: LOCATION,
    }),

    bigquery.query({
      query: FAMILY_QUERY,
      location: LOCATION,
    }),

    bigquery.query({
      query: QUALITY_QUERY,
      location: LOCATION,
    }),
  ]);

  const [patternRows] = patternResult;
  const [familyRows] = familyResult;
  const [qualityRows] = qualityResult;

  const patterns = parseJsonRows<Record<string, unknown>>(
    patternRows as JsonPayloadRow[]
  );

  const families = parseJsonRows<Record<string, unknown>>(
    familyRows as JsonPayloadRow[]
  );

  const parsedQuality =
    parseJsonRows<Record<string, unknown>>(
      qualityRows as JsonPayloadRow[]
    );

  return {
    quality: parsedQuality[0] ?? null,
    families,
    patterns,
  };
}

const loadCachedPatternDiscoveryData = unstable_cache(
  loadPatternDiscoveryData,
  ['retention-pattern-discovery-contract-v1'],
  {
    revalidate: 300,
    tags: ['retention-pattern-discovery'],
  }
);

export async function GET(request: Request) {

  // ==========================================================
  // RUNTIME ACCESS ENFORCEMENT
  // ==========================================================

  try {

    const runtimeAccess =
      await requireGrowthOSApiAccess(
        request
      );


    requireLegacyBrillareDataScope(
      runtimeAccess.brandId
    );

  } catch (
    accessError:
      unknown
  ) {

    const accessResponse =
      runtimeAccessErrorResponse(
        accessError
      );


    if (accessResponse) {

      return accessResponse;

    }


    throw accessError;

  }

  try {
    const url = new URL(request.url);

    const forceRefresh =
      url.searchParams.get('refresh') === '1';

    const data = forceRefresh
      ? await loadPatternDiscoveryData()
      : await loadCachedPatternDiscoveryData();

    return NextResponse.json(
      {
        ok: true,

        data,

        meta: {
          contract: 'retention-pattern-discovery',
          version: 'v1',
          generatedAt: new Date().toISOString(),
          cached: !forceRefresh,
          sourceTables: SOURCE_TABLES,
        },
      },
      {
        headers: {
          'Cache-Control': forceRefresh
            ? 'no-store'
            : 'private, max-age=0, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error(
      'Pattern Discovery API error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error: {
          message:
            'Failed to load Pattern Discovery master contract',

          details:
            error instanceof Error
              ? error.message
              : 'Unknown BigQuery query error',

          sourceTables: SOURCE_TABLES,
        },
      },
      {
        status: 500,
      }
    );
  }
}