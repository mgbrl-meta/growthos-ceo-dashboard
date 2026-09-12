import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';

import { NextRequest, NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PLANNER_TABLE =
  'shopify-colab.brillare_shopify.retention_weekly_execution_group_v2_tbl';

const ACTION_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_v1_tbl';


export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  let runtimeBrandId =
    '';


  // ==========================================================
  // RUNTIME ACCESS ENFORCEMENT
  // ==========================================================

  try {

    const runtimeAccess =
      await requireGrowthOSApiAccess(
        req
      );


    requireLegacyBrillareDataScope(
      runtimeAccess.brandId
    );


    runtimeBrandId =
      runtimeAccess.brandId;

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
    const { searchParams } = new URL(req.url);

    const selectedDate =
      searchParams.get('date');

    const query = `
      WITH latest_tracker AS (

        SELECT
          *

        FROM
          \`${ACTION_TABLE}\`

        WHERE
          brand_id = @brandId

        QUALIFY
          ROW_NUMBER() OVER (
            PARTITION BY
              source_execution_group_id

            ORDER BY
              created_at DESC
          ) = 1
      )

      SELECT

        g.execution_group_id,
        g.execution_group_rank,

        CAST(
          g.run_date AS STRING
        ) AS run_date,

        CAST(
          g.week_start_date AS STRING
        ) AS week_start_date,

        CAST(
          g.week_end_date AS STRING
        ) AS week_end_date,

        CAST(
          g.scheduled_execution_date
          AS STRING
        ) AS scheduled_execution_date,

        g.campaign_slot_for_day,

        g.campaign_family,
        g.lifecycle_band,
        g.communication_treatment,

        g.execution_template_key,
        g.execution_group_name,

        g.audience_size,

        g.customers_with_phone,
        g.customers_with_email,

        g.replenishment_customers,
        g.next_product_customers,
        g.next_basket_customers,
        g.reactivation_customers,
        g.repeat_basket_customers,

        g.sku_target_customers,
        g.basket_target_customers,

        g.unique_dynamic_targets,

        g.avg_target_probability_90d,
        g.avg_repeat_probability_90d,

        g.avg_predicted_order_value,
        g.avg_expected_value_90d,
        g.total_expected_value_90d,

        g.avg_reliability_score,
        g.avg_priority_score,
        g.total_priority_score,

        g.capacity_status,

        g.suggested_campaign_name,
        g.suggested_template_key,

        g.campaign_status,
        g.template_status,

        g.execution_group_version,

        a.execution_id
          AS tracker_execution_id,

        a.execution_status
          AS tracker_status,

        CAST(
          a.prepared_at AS STRING
        ) AS tracker_prepared_at

      FROM
        \`${PLANNER_TABLE}\` g

      LEFT JOIN
        latest_tracker a

        ON
          g.execution_group_id =
          a.source_execution_group_id

      WHERE
        g.brand_id =
          @brandId

        ${
          selectedDate
            ? `
              AND
                g.scheduled_execution_date =
                DATE(@selectedDate)
            `
            : ''
        }

      ORDER BY

        g.scheduled_execution_date,

        g.campaign_slot_for_day,

        g.execution_group_rank
    `;

    const params:
      Record<string, string> = {
        brandId: runtimeBrandId,
      };

    if (selectedDate) {
      params.selectedDate =
        selectedDate;
    }

    const [rows] =
      await bigquery.query({
        query,
        params,
      });

    return NextResponse.json({
      ok: true,

      engineVersion:
        'DYNAMIC_EXECUTION_GROUP_V2',

      mode:
        selectedDate
          ? 'SELECTED_DATE'
          : 'ALL_WEEK',

      selectedDate:
        selectedDate || null,

      campaigns: rows,
    });

  } catch (error) {

    console.error(
      'Weekly Retention Planner API error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to load weekly retention planner',
      },
      {
        status: 500,
      }
    );
  }
}