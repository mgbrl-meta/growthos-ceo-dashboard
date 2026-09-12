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

const DATASET =
  'shopify-colab.brillare_shopify';


// ============================================================
// V2 LIVE SOURCES
// ============================================================

const GROUP_TABLE =
  `${DATASET}.retention_weekly_execution_group_v2_tbl`;

const MEMBER_SOURCE_TABLE =
  `${DATASET}.retention_weekly_execution_member_v2_tbl`;


// ============================================================
// FROZEN ACTION TRACKER TABLES
// ============================================================

const EXECUTION_TABLE =
  `${DATASET}.retention_action_execution_v1_tbl`;

const EXECUTION_MEMBER_TABLE =
  `${DATASET}.retention_action_execution_member_v1_tbl`;


export const dynamic =
  'force-dynamic';


// ============================================================
// POST
// ============================================================

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

    // ========================================================
    // INPUT
    // ========================================================

    const body =
      await req.json();


    const executionGroupId =
      String(
        body?.executionGroupId ||
        ''
      ).trim();


    if (!executionGroupId) {

      return NextResponse.json(
        {
          ok: false,

          error:
            'executionGroupId is required',
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // DETERMINISTIC EXECUTION ID
    //
    // Same planner group = same frozen execution.
    // ========================================================

    const executionIdQuery = `

      SELECT

        TO_HEX(
          SHA256(
            CONCAT(
              'RET_EXEC|',
              @executionGroupId
            )
          )
        ) AS execution_id
    `;


    const [executionIdRows] =
      await bigquery.query({

        query:
          executionIdQuery,

        params: {
          executionGroupId,
        },
      });


    const executionId =
      executionIdRows?.[0]
        ?.execution_id;


    if (!executionId) {

      throw new Error(
        'Failed to generate execution ID'
      );
    }


    // ========================================================
    // VERIFY V2 SOURCE GROUP
    // ========================================================

    const sourceCheckQuery = `

      SELECT

        execution_group_id,

        execution_group_name,

        campaign_family,

        lifecycle_band,

        communication_treatment,

        audience_size,

        execution_group_version

      FROM
        \`${GROUP_TABLE}\`

      WHERE
        execution_group_id =
          @executionGroupId

      LIMIT 1
    `;


    const [sourceRows] =
      await bigquery.query({

        query:
          sourceCheckQuery,

        params: {
          executionGroupId,
        },
      });


    if (
      !sourceRows ||
      sourceRows.length === 0
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            'V2 planner execution group not found',
        },
        {
          status: 404,
        }
      );
    }


    // ========================================================
    // PREPARE/FREEZE
    // ========================================================

    const prepareQuery = `

      BEGIN TRANSACTION;


      -- ======================================================
      -- 1. FREEZE EXECUTION HEADER
      -- ======================================================

      MERGE
        \`${EXECUTION_TABLE}\`
        T

      USING (

        SELECT

          @executionId
            AS execution_id,

          brand_id,

          execution_group_id
            AS source_execution_group_id,

          execution_group_rank
            AS source_execution_group_rank,

          week_start_date,

          week_end_date,

          scheduled_execution_date,

          campaign_slot_for_day,

          campaign_family,

          lifecycle_band,

          communication_treatment,

          execution_template_key,

          execution_group_name,

          audience_size
            AS planned_audience_size,

          unique_dynamic_targets,

          avg_target_probability_90d,

          avg_repeat_probability_90d,

          avg_expected_value_90d,

          total_expected_value_90d,

          avg_reliability_score,

          avg_priority_score,

          suggested_campaign_name
            AS campaign_name

        FROM
          \`${GROUP_TABLE}\`

        WHERE
          execution_group_id =
            @executionGroupId

      ) S


      ON
        T.execution_id =
        S.execution_id


      WHEN NOT MATCHED THEN

        INSERT (

          execution_id,

          brand_id,

          source_execution_group_id,

          source_execution_group_rank,

          week_start_date,

          week_end_date,

          scheduled_execution_date,

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

          actual_send_at,

          sent_audience_size,

          delivered_count,

          clicked_count,

          converted_customers,

          converted_orders,

          conversion_revenue,

          operator_notes,

          prepared_at,

          ready_at,

          sent_at,

          completed_at,

          created_at,

          updated_at,

          action_tracker_version

        )

        VALUES (

          S.execution_id,

          S.brand_id,

          S.source_execution_group_id,

          S.source_execution_group_rank,

          S.week_start_date,

          S.week_end_date,

          S.scheduled_execution_date,

          S.campaign_slot_for_day,

          S.campaign_family,

          S.lifecycle_band,

          S.communication_treatment,

          S.execution_template_key,

          S.execution_group_name,

          S.planned_audience_size,

          S.unique_dynamic_targets,

          S.avg_target_probability_90d,

          S.avg_repeat_probability_90d,

          S.avg_expected_value_90d,

          S.total_expected_value_90d,

          S.avg_reliability_score,

          S.avg_priority_score,

          'WHATSAPP',

          S.campaign_name,

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          'PREPARED',

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          CURRENT_TIMESTAMP(),

          NULL,

          NULL,

          NULL,

          CURRENT_TIMESTAMP(),

          CURRENT_TIMESTAMP(),

          'ACTION_TRACKER_V2'

        );


      -- ======================================================
      -- 2. FREEZE CUSTOMER + GENERIC RECOMMENDATION
      -- ======================================================

      MERGE
        \`${EXECUTION_MEMBER_TABLE}\`
        T

      USING (

        SELECT

          @executionId
            AS execution_id,


          TO_HEX(
            SHA256(
              CONCAT(
                @executionId,
                '|',
                customer_key
              )
            )
          ) AS execution_member_id,


          execution_group_id
            AS source_execution_group_id,


          brand_id,

          scheduled_execution_date,

          CURRENT_DATE(
            'Asia/Kolkata'
          ) AS prepared_date,


          -- ==================================================
          -- CUSTOMER
          -- ==================================================

          customer_key,

          customer_phone,

          customer_email,

          has_phone,

          has_email,


          -- ==================================================
          -- GENERIC RECOMMENDATION IDENTITY
          -- ==================================================

          recommendation_id,

          source_system,

          source_model,

          source_reference_id,

          recommendation_family,

          recommendation_type,

          recommendation_key,

          recommendation_payload_json,

          source_payload_json,


          -- ==================================================
          -- EXECUTION CLASSIFICATION
          -- ==================================================

          campaign_family,

          lifecycle_band,

          communication_treatment,

          execution_template_key,


          -- ==================================================
          -- CURRENT COMPATIBILITY
          -- ==================================================

          action_family,

          communication_objective,

          target_type,

          target_value,


          -- ==================================================
          -- JOURNEY
          -- ==================================================

          current_order_number,

          latest_order_date,

          days_since_latest_order,

          latest_order_basket_signature,


          -- ==================================================
          -- TIMING
          -- ==================================================

          recommended_contact_date,

          timing_source,

          timing_day,

          weekly_timing_status,


          -- ==================================================
          -- PREDICTION / VALUE
          -- ==================================================

          predicted_target_probability_90d,

          predicted_repeat_rate_90d,

          predicted_target_order_value,

          expected_target_value_90d,

          planner_priority_score,

          reliability_score,


          -- ==================================================
          -- CURRENT DYNAMIC COMPATIBILITY
          -- ==================================================

          dynamic_target_type,

          dynamic_target_value,

          dynamic_current_basket,

          dynamic_recommended_date,


          -- ==================================================
          -- CURRENT TEMPLATE VARIABLE PAYLOAD
          --
          -- Generic recommendation_payload_json is stored
          -- separately and remains untouched.
          -- ==================================================

          JSON_OBJECT(

            'target_type',
            dynamic_target_type,

            'target_value',
            dynamic_target_value,

            'current_basket',
            dynamic_current_basket,

            'recommended_date',
            dynamic_recommended_date,

            'recommendation_family',
            recommendation_family,

            'recommendation_type',
            recommendation_type,

            'recommendation_key',
            recommendation_key,

            'source_system',
            source_system

          ) AS dynamic_variables_json,


          -- ==================================================
          -- EXECUTION DEFAULTS
          -- ==================================================

          'WHATSAPP'
            AS channel,

          CAST(
            NULL AS STRING
          ) AS template_name,

          CAST(
            NULL AS STRING
          ) AS template_version,

          CAST(
            NULL AS STRING
          ) AS message_variant,

          CAST(
            NULL AS STRING
          ) AS offer_variant,

          CAST(
            NULL AS STRING
          ) AS offer_code,

          attempt_band,

          'PREPARED'
            AS send_status,

          FALSE
            AS converted


        FROM
          \`${MEMBER_SOURCE_TABLE}\`

        WHERE
          execution_group_id =
            @executionGroupId

      ) S


      ON
        T.execution_member_id =
        S.execution_member_id


      WHEN NOT MATCHED THEN

        INSERT (

          execution_id,

          execution_member_id,

          source_execution_group_id,

          brand_id,

          scheduled_execution_date,

          prepared_date,


          customer_key,

          customer_phone,

          customer_email,

          has_phone,

          has_email,


          recommendation_id,

          source_system,

          source_model,

          source_reference_id,

          recommendation_family,

          recommendation_type,

          recommendation_key,

          recommendation_payload_json,

          source_payload_json,


          campaign_family,

          lifecycle_band,

          communication_treatment,

          execution_template_key,


          action_family,

          communication_objective,

          target_type,

          target_value,


          current_order_number,

          latest_order_date,

          days_since_latest_order,

          latest_order_basket_signature,


          recommended_contact_date,

          timing_source,

          timing_day,

          weekly_timing_status,


          predicted_target_probability_90d,

          predicted_repeat_rate_90d,

          predicted_target_order_value,

          expected_target_value_90d,

          planner_priority_score,

          reliability_score,


          dynamic_target_type,

          dynamic_target_value,

          dynamic_current_basket,

          dynamic_recommended_date,

          dynamic_variables_json,


          channel,

          template_name,

          template_version,

          message_variant,

          offer_variant,

          offer_code,

          attempt_band,

          send_status,


          sent_at,

          delivered_at,

          clicked_at,


          converted,

          conversion_order_id,

          conversion_date,

          conversion_at,

          conversion_revenue,

          conversion_target_match,

          days_to_conversion,


          snapshot_at,

          updated_at,

          execution_member_version

        )

        VALUES (

          S.execution_id,

          S.execution_member_id,

          S.source_execution_group_id,

          S.brand_id,

          S.scheduled_execution_date,

          S.prepared_date,


          S.customer_key,

          S.customer_phone,

          S.customer_email,

          S.has_phone,

          S.has_email,


          S.recommendation_id,

          S.source_system,

          S.source_model,

          S.source_reference_id,

          S.recommendation_family,

          S.recommendation_type,

          S.recommendation_key,

          S.recommendation_payload_json,

          S.source_payload_json,


          S.campaign_family,

          S.lifecycle_band,

          S.communication_treatment,

          S.execution_template_key,


          S.action_family,

          S.communication_objective,

          S.target_type,

          S.target_value,


          S.current_order_number,

          S.latest_order_date,

          S.days_since_latest_order,

          S.latest_order_basket_signature,


          S.recommended_contact_date,

          S.timing_source,

          S.timing_day,

          S.weekly_timing_status,


          S.predicted_target_probability_90d,

          S.predicted_repeat_rate_90d,

          S.predicted_target_order_value,

          S.expected_target_value_90d,

          S.planner_priority_score,

          S.reliability_score,


          S.dynamic_target_type,

          S.dynamic_target_value,

          S.dynamic_current_basket,

          S.dynamic_recommended_date,

          S.dynamic_variables_json,


          S.channel,

          S.template_name,

          S.template_version,

          S.message_variant,

          S.offer_variant,

          S.offer_code,

          S.attempt_band,

          S.send_status,


          NULL,

          NULL,

          NULL,


          S.converted,

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,


          CURRENT_TIMESTAMP(),

          CURRENT_TIMESTAMP(),

          'ACTION_EXECUTION_MEMBER_V2'

        );


      COMMIT TRANSACTION;
    `;


    await bigquery.query({

      query:
        prepareQuery,

      params: {

        executionId,

        executionGroupId,
      },
    });


    // ========================================================
    // QC RESPONSE
    // ========================================================

    const resultQuery = `

      SELECT

        h.execution_id,

        h.source_execution_group_id,

        h.execution_status,

        h.campaign_family,

        h.lifecycle_band,

        h.communication_treatment,

        CAST(
          h.scheduled_execution_date
          AS STRING
        ) AS scheduled_execution_date,

        h.planned_audience_size,


        COUNT(
          m.execution_member_id
        ) AS frozen_members,


        COUNTIF(
          m.recommendation_id
          IS NOT NULL
        ) AS members_with_recommendation_id,


        COUNTIF(
          m.recommendation_payload_json
          IS NOT NULL
        ) AS members_with_payload,


        h.planned_audience_size
        -
        COUNT(
          m.execution_member_id
        ) AS audience_difference


      FROM
        \`${EXECUTION_TABLE}\`
          h


      LEFT JOIN
        \`${EXECUTION_MEMBER_TABLE}\`
          m

        ON
          h.execution_id =
          m.execution_id


      WHERE
        h.execution_id =
          @executionId


      GROUP BY

        h.execution_id,

        h.source_execution_group_id,

        h.execution_status,

        h.campaign_family,

        h.lifecycle_band,

        h.communication_treatment,

        h.scheduled_execution_date,

        h.planned_audience_size
    `;


    const [resultRows] =
      await bigquery.query({

        query:
          resultQuery,

        params: {
          executionId,
        },
      });


    if (
      !resultRows ||
      resultRows.length ===
        0
    ) {

      throw new Error(
        'Execution prepared but QC result was not found'
      );
    }


    const result: any =
      resultRows[0];


    const plannedAudience =
      Number(
        result
          .planned_audience_size ||
        0
      );


    const frozenMembers =
      Number(
        result
          .frozen_members ||
        0
      );


    const membersWithRecommendationId =
      Number(
        result
          .members_with_recommendation_id ||
        0
      );


    const membersWithPayload =
      Number(
        result
          .members_with_payload ||
        0
      );


    const audienceDifference =
      Number(
        result
          .audience_difference ||
        0
      );


    return NextResponse.json({

      ok: true,

      engineVersion:
        'DYNAMIC_EXECUTION_V2',

      execution: {

        executionId:
          result.execution_id,

        sourceExecutionGroupId:
          result
            .source_execution_group_id,

        status:
          result.execution_status,

        campaignFamily:
          result.campaign_family,

        lifecycleBand:
          result.lifecycle_band,

        communicationTreatment:
          result
            .communication_treatment,

        scheduledExecutionDate:
          result
            .scheduled_execution_date,

        plannedAudience,

        frozenMembers,

        membersWithRecommendationId,

        membersWithPayload,

        audienceDifference,

        audienceFrozen:
          audienceDifference === 0,

        genericRecommendationFrozen:
          membersWithRecommendationId ===
            frozenMembers &&
          membersWithPayload ===
            frozenMembers,
      },
    });

  } catch (error) {

    console.error(
      'Prepare V2 retention campaign error:',
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to prepare campaign',
      },
      {
        status: 500,
      }
    );
  }
}