import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { bigquery } from '@/lib/bigquery';

const EXECUTION_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_v1_tbl';

const MEMBER_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_member_v1_tbl';

const TEMPLATE_TABLE =
  'shopify-colab.brillare_shopify.retention_template_registry_v1';

const VARIABLE_TABLE =
  'shopify-colab.brillare_shopify.retention_template_variable_registry_v1';

export const dynamic =
  'force-dynamic';

export async function GET(
  req: NextRequest
) {
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

    const query = `

      WITH execution_context AS (

        SELECT

          h.execution_id,

          h.channel,

          h.campaign_family,

          h.lifecycle_band,

          h.communication_treatment,

          h.execution_template_key,

          h.planned_audience_size,

          -- ==================================================
          -- Recommendation families actually present inside
          -- the frozen audience.
          --
          -- Currently one execution should normally have one.
          -- Future architecture allows more.
          -- ==================================================

          ARRAY_AGG(
            DISTINCT m.recommendation_family
            IGNORE NULLS
          ) AS recommendation_families

        FROM
          \`${EXECUTION_TABLE}\` h

        LEFT JOIN
          \`${MEMBER_TABLE}\` m

          ON
            h.execution_id =
            m.execution_id

        WHERE
          h.execution_id =
            @executionId

        GROUP BY

          h.execution_id,

          h.channel,

          h.campaign_family,

          h.lifecycle_band,

          h.communication_treatment,

          h.execution_template_key,

          h.planned_audience_size
      ),


      templates AS (

        SELECT

          t.*,

          COUNTIF(
            v.active = TRUE
          ) AS variable_count,

          COUNTIF(
            v.active = TRUE
            AND v.required = TRUE
          ) AS required_variable_count

        FROM
          \`${TEMPLATE_TABLE}\` t

        LEFT JOIN
          \`${VARIABLE_TABLE}\` v

          ON
            t.template_id =
            v.template_id

        WHERE
          t.active = TRUE

        GROUP BY

          t.template_id,

          t.channel,

          t.template_name,

          t.template_version,

          t.template_language,

          t.recommendation_family,

          t.campaign_family,

          t.lifecycle_band,

          t.communication_treatment,

          t.match_priority,

          t.template_status,

          t.active,

          t.notes,

          t.created_at,

          t.updated_at
      )


      SELECT

        t.template_id,

        t.template_name,

        t.template_version,

        t.template_language,

        t.channel,

        t.template_status,

        t.notes,

        t.variable_count,

        t.required_variable_count,


        -- ====================================================
        -- Registry matching rules
        -- ====================================================

        t.recommendation_family
          AS rule_recommendation_family,

        t.campaign_family
          AS rule_campaign_family,

        t.lifecycle_band
          AS rule_lifecycle_band,

        t.communication_treatment
          AS rule_communication_treatment,


        -- ====================================================
        -- Specificity
        --
        -- Higher means the template was designed more
        -- specifically for this execution.
        -- ====================================================

        (
          IF(
            t.recommendation_family
              IS NOT NULL,
            8,
            0
          )
          +
          IF(
            t.campaign_family
              IS NOT NULL,
            4,
            0
          )
          +
          IF(
            t.lifecycle_band
              IS NOT NULL,
            2,
            0
          )
          +
          IF(
            t.communication_treatment
              IS NOT NULL,
            1,
            0
          )
        ) AS specificity_score,


        COALESCE(
          t.match_priority,
          9999
        ) AS match_priority,


        -- ====================================================
        -- Human-readable match explanation
        -- ====================================================

        ARRAY_TO_STRING(
          ARRAY(
            SELECT label
            FROM UNNEST([

              IF(
                t.recommendation_family
                  IS NOT NULL,
                CONCAT(
                  'Recommendation: ',
                  t.recommendation_family
                ),
                NULL
              ),

              IF(
                t.campaign_family
                  IS NOT NULL,
                CONCAT(
                  'Campaign: ',
                  t.campaign_family
                ),
                NULL
              ),

              IF(
                t.lifecycle_band
                  IS NOT NULL,
                CONCAT(
                  'Lifecycle: ',
                  t.lifecycle_band
                ),
                NULL
              ),

              IF(
                t.communication_treatment
                  IS NOT NULL,
                CONCAT(
                  'Treatment: ',
                  t.communication_treatment
                ),
                NULL
              )

            ]) label

            WHERE
              label IS NOT NULL
          ),
          ' · '
        ) AS match_reason


      FROM
        execution_context e

      CROSS JOIN
        templates t


      WHERE

        -- Channel

        (
          t.channel IS NULL

          OR

          t.channel =
            e.channel
        )


        -- Recommendation family

        AND (

          t.recommendation_family
            IS NULL

          OR

          t.recommendation_family
            IN UNNEST(
              e.recommendation_families
            )

        )


        -- Campaign family

        AND (

          t.campaign_family
            IS NULL

          OR

          t.campaign_family =
            e.campaign_family

        )


        -- Lifecycle

        AND (

          t.lifecycle_band
            IS NULL

          OR

          t.lifecycle_band =
            e.lifecycle_band

        )


        -- Treatment

        AND (

          t.communication_treatment
            IS NULL

          OR

          t.communication_treatment =
            e.communication_treatment

        )


      ORDER BY

        -- APPROVED first when it exists

        CASE
          WHEN
            t.template_status =
            'APPROVED'
            THEN 1

          WHEN
            t.template_status =
            'READY'
            THEN 2

          WHEN
            t.template_status =
            'DRAFT'
            THEN 3

          ELSE 4
        END,

        -- Most-specific rule wins

        specificity_score DESC,

        -- Manual priority breaks ties

        match_priority ASC,

        t.template_name
    `;

    const [rows] =
      await bigquery.query({
        query,

        params: {
          executionId,
        },
      });

    return NextResponse.json({
      ok: true,

      executionId,

      compatibleTemplates:
        rows,

      count:
        rows.length,
    });

  } catch (error) {
    console.error(
      'Compatible template API error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to find compatible templates',
      },
      {
        status: 500,
      }
    );
  }
}