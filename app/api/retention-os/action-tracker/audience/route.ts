import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { bigquery } from '@/lib/bigquery';

const MEMBER_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_member_v1_tbl';

const EXECUTION_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_v1_tbl';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest
) {

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
    const { searchParams } =
      new URL(req.url);

    const executionId =
      String(
        searchParams.get(
          'executionId'
        ) || ''
      ).trim();

    if (!executionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'executionId is required',
        },
        {
          status: 400,
        }
      );
    }

    const requestedLimit =
      Number(
        searchParams.get(
          'limit'
        ) || 50
      );

    const requestedOffset =
      Number(
        searchParams.get(
          'offset'
        ) || 0
      );

    const limit =
      Math.min(
        Math.max(
          requestedLimit,
          1
        ),
        200
      );

    const offset =
      Math.max(
        requestedOffset,
        0
      );

    // ========================================================
    // EXECUTION HEADER
    // ========================================================

    const headerQuery = `
      SELECT

        execution_id,

        campaign_family,
        lifecycle_band,
        communication_treatment,

        campaign_name,

        template_name,
        template_version,

        message_variant,

        offer_variant,
        offer_code,

        execution_status,

        planned_audience_size,

        unique_dynamic_targets,

        CAST(
          scheduled_execution_date
          AS STRING
        ) AS scheduled_execution_date

      FROM
        \`${EXECUTION_TABLE}\`

      WHERE
        execution_id =
          @executionId

      LIMIT 1
    `;

    const [headerRows] =
      await bigquery.query({
        query: headerQuery,

        params: {
          executionId,
        },
      });

    if (
      !headerRows ||
      headerRows.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Execution not found',
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // MEMBERS
    // ========================================================

    const memberQuery = `
      SELECT

        execution_member_id,

        customer_key,

        customer_phone,
        customer_email,

        has_phone,
        has_email,

        campaign_family,
        lifecycle_band,
        communication_treatment,

        action_family,

        target_type,
        target_value,

        dynamic_target_type,
        dynamic_target_value,

        dynamic_current_basket,

        dynamic_recommended_date,

        current_order_number,

        CAST(
          latest_order_date
          AS STRING
        ) AS latest_order_date,

        days_since_latest_order,

        latest_order_basket_signature,

        CAST(
          recommended_contact_date
          AS STRING
        ) AS recommended_contact_date,

        timing_source,
        timing_day,

        weekly_timing_status,

        predicted_target_probability_90d,

        predicted_repeat_rate_90d,

        predicted_target_order_value,

        expected_target_value_90d,

        planner_priority_score,

        reliability_score,

        channel,

        template_name,
        template_version,

        message_variant,

        offer_variant,
        offer_code,

        attempt_band,

        send_status,

        COUNT(*) OVER ()
          AS total_rows

      FROM
        \`${MEMBER_TABLE}\`

      WHERE
        execution_id =
          @executionId

      ORDER BY

        planner_priority_score DESC,

        predicted_target_probability_90d DESC,

        expected_target_value_90d DESC,

        customer_key

      LIMIT @limit

      OFFSET @offset
    `;

    const [memberRows] =
      await bigquery.query({
        query: memberQuery,

        params: {
          executionId,
          limit,
          offset,
        },

        types: {
          limit: 'INT64',
          offset: 'INT64',
        },
      });

    const totalRows =
      memberRows.length > 0
        ? Number(
            memberRows[0]
              .total_rows || 0
          )
        : 0;

    const members =
      memberRows.map(
        (row: any) => {
          const {
            total_rows,
            ...member
          } = row;

          return member;
        }
      );

    return NextResponse.json({
      ok: true,

      execution:
        headerRows[0],

      pagination: {
        limit,
        offset,
        totalRows,

        hasPrevious:
          offset > 0,

        hasNext:
          offset +
            members.length <
          totalRows,
      },

      members,
    });
  } catch (error) {
    console.error(
      'Action Tracker audience error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to load audience',
      },
      {
        status: 500,
      }
    );
  }
}