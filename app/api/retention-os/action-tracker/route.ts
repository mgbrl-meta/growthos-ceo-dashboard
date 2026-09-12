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

const EXECUTION_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_v1_tbl';

const MEMBER_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_member_v1_tbl';


export const dynamic =
  'force-dynamic';

export async function GET(req: Request) {

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
    const query = `
      SELECT

        execution_id,
        brand_id,

        source_execution_group_id,
        source_execution_group_rank,

        CAST(week_start_date AS STRING)
          AS week_start_date,

        CAST(week_end_date AS STRING)
          AS week_end_date,

        CAST(scheduled_execution_date AS STRING)
          AS scheduled_execution_date,

        campaign_slot_for_day,

        campaign_family,
        lifecycle_band,
        communication_treatment,

        execution_template_key,
        execution_group_name,

        planned_audience_size,
        unique_dynamic_targets,

        avg_target_probability_90d,
        avg_repeat_probability_90d,

        avg_expected_value_90d,
        total_expected_value_90d,

        avg_reliability_score,
        avg_priority_score,

        channel,
        campaign_name,

        template_name,
        template_version,

        message_variant,

        offer_variant,
        offer_code,

        content_variant,

        execution_status,

        CAST(actual_send_at AS STRING)
          AS actual_send_at,

        sent_audience_size,

        delivered_count,
        clicked_count,

        converted_customers,
        converted_orders,
        conversion_revenue,

        operator_notes,

        CAST(prepared_at AS STRING)
          AS prepared_at,

        CAST(ready_at AS STRING)
          AS ready_at,

        CAST(sent_at AS STRING)
          AS sent_at,

        CAST(completed_at AS STRING)
          AS completed_at,

        CAST(created_at AS STRING)
          AS created_at,

        CAST(updated_at AS STRING)
          AS updated_at

      FROM
        \`${EXECUTION_TABLE}\`

      WHERE
        brand_id = @brandId

      ORDER BY
        scheduled_execution_date,
        source_execution_group_rank
    `;

    const [rows] =
      await bigquery.query({
        query,

        params: {
          brandId:
            runtimeBrandId,
        },
      });

    return NextResponse.json({
      ok: true,
      executions: rows,
    });
  } catch (error) {
    console.error(
      'Action Tracker GET error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to load Action Tracker',
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
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
    const body =
      await req.json();

    const executionId =
      String(
        body?.executionId ||
          ''
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

    const channel =
      String(
        body?.channel ||
          'WHATSAPP'
      );

    const campaignName =
      String(
        body?.campaignName ||
          ''
      );

    const templateName =
      String(
        body?.templateName ||
          ''
      );

    const templateVersion =
      String(
        body?.templateVersion ||
          ''
      );

    const messageVariant =
      String(
        body?.messageVariant ||
          ''
      );

    const offerVariant =
      String(
        body?.offerVariant ||
          ''
      );

    const offerCode =
      String(
        body?.offerCode ||
          ''
      );

    const contentVariant =
      String(
        body?.contentVariant ||
          ''
      );

    const operatorNotes =
      String(
        body?.operatorNotes ||
          ''
      );

    const executionStatus =
      String(
        body?.executionStatus ||
          'PREPARED'
      );

    const allowedStatuses =
      new Set([
        'PREPARED',
        'READY_TO_SEND',
        'SENT',
        'MEASURING',
        'COMPLETED',
        'CANCELLED',
      ]);

    if (
      !allowedStatuses.has(
        executionStatus
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid execution status',
        },
        {
          status: 400,
        }
      );
    }

    const query = `
      BEGIN TRANSACTION;

      UPDATE
        \`${EXECUTION_TABLE}\`

      SET

        channel =
          @channel,

        campaign_name =
          @campaignName,

        template_name =
          NULLIF(
            @templateName,
            ''
          ),

        template_version =
          NULLIF(
            @templateVersion,
            ''
          ),

        message_variant =
          NULLIF(
            @messageVariant,
            ''
          ),

        offer_variant =
          NULLIF(
            @offerVariant,
            ''
          ),

        offer_code =
          NULLIF(
            @offerCode,
            ''
          ),

        content_variant =
          NULLIF(
            @contentVariant,
            ''
          ),

        operator_notes =
          NULLIF(
            @operatorNotes,
            ''
          ),

        execution_status =
          @executionStatus,

        ready_at =
          CASE
            WHEN
              @executionStatus =
                'READY_TO_SEND'
              AND ready_at IS NULL
            THEN CURRENT_TIMESTAMP()
            ELSE ready_at
          END,

        actual_send_at =
          CASE
            WHEN
              @executionStatus =
                'SENT'
              AND actual_send_at IS NULL
            THEN CURRENT_TIMESTAMP()
            ELSE actual_send_at
          END,

        sent_at =
          CASE
            WHEN
              @executionStatus =
                'SENT'
              AND sent_at IS NULL
            THEN CURRENT_TIMESTAMP()
            ELSE sent_at
          END,

        sent_audience_size =
          CASE
            WHEN
              @executionStatus =
                'SENT'
              AND sent_audience_size
                IS NULL
            THEN planned_audience_size
            ELSE sent_audience_size
          END,

        completed_at =
          CASE
            WHEN
              @executionStatus =
                'COMPLETED'
              AND completed_at IS NULL
            THEN CURRENT_TIMESTAMP()
            ELSE completed_at
          END,

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE
        execution_id =
          @executionId;


      UPDATE
        \`${MEMBER_TABLE}\`

      SET

        channel =
          @channel,

        template_name =
          NULLIF(
            @templateName,
            ''
          ),

        template_version =
          NULLIF(
            @templateVersion,
            ''
          ),

        message_variant =
          NULLIF(
            @messageVariant,
            ''
          ),

        offer_variant =
          NULLIF(
            @offerVariant,
            ''
          ),

        offer_code =
          NULLIF(
            @offerCode,
            ''
          ),

        send_status =
          @executionStatus,

        sent_at =
          CASE
            WHEN
              @executionStatus =
                'SENT'
              AND sent_at IS NULL
            THEN CURRENT_TIMESTAMP()
            ELSE sent_at
          END,

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE
        execution_id =
          @executionId;


      COMMIT TRANSACTION;


      SELECT

        execution_id,
        execution_status,

        planned_audience_size,

        channel,
        campaign_name,

        template_name,
        template_version,

        message_variant,

        offer_variant,
        offer_code,

        operator_notes

      FROM
        \`${EXECUTION_TABLE}\`

      WHERE
        execution_id =
          @executionId

      LIMIT 1
    `;

    const [rows] =
      await bigquery.query({
        query,

        params: {
          executionId,

          channel,
          campaignName,

          templateName,
          templateVersion,

          messageVariant,

          offerVariant,
          offerCode,

          contentVariant,

          operatorNotes,

          executionStatus,
        },
      });

    if (
      !rows ||
      rows.length ===
        0
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

    return NextResponse.json({
      ok: true,
      execution:
        rows[0],
    });
  } catch (error) {
    console.error(
      'Action Tracker POST error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to update execution',
      },
      {
        status: 500,
      }
    );
  }
}