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

const TEMPLATE_TABLE =
  'shopify-colab.brillare_shopify.retention_template_registry_v1';

const VARIABLE_TABLE =
  'shopify-colab.brillare_shopify.retention_template_variable_registry_v1';

export const dynamic = 'force-dynamic';

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
        body?.executionId || ''
      ).trim();

    const templateId =
      String(
        body?.templateId || ''
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

    if (!templateId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'templateId is required',
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 1. RESOLVE EXECUTION CONTEXT
    // ========================================================

    const contextQuery = `
      SELECT

        h.execution_id,

        UPPER(
          TRIM(
            COALESCE(
              h.channel,
              ''
            )
          )
        ) AS channel,

        UPPER(
          TRIM(
            COALESCE(
              h.campaign_family,
              ''
            )
          )
        ) AS campaign_family,

        UPPER(
          TRIM(
            COALESCE(
              h.lifecycle_band,
              ''
            )
          )
        ) AS lifecycle_band,

        UPPER(
          TRIM(
            COALESCE(
              h.communication_treatment,
              ''
            )
          )
        ) AS communication_treatment,

        ARRAY_AGG(
          DISTINCT
          UPPER(
            TRIM(
              m.recommendation_family
            )
          )
          IGNORE NULLS
        ) AS recommendation_families,

        h.planned_audience_size

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
        h.planned_audience_size

      LIMIT 1
    `;

    const [contextRows] =
      await bigquery.query({
        query:
          contextQuery,

        params: {
          executionId,
        },
      });

    if (
      !contextRows ||
      contextRows.length === 0
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

    const context: any =
      contextRows[0];

    // ========================================================
    // 2. LOAD TEMPLATE + TEST COMPATIBILITY
    //
    // NULL registry dimensions remain wildcards.
    // All comparisons are normalized.
    // ========================================================

    const templateQuery = `
      SELECT

        t.template_id,

        t.template_name,

        t.template_version,

        t.template_language,

        t.template_status,

        t.channel,

        t.recommendation_family,

        t.campaign_family,

        t.lifecycle_band,

        t.communication_treatment,

        t.match_priority,

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
        t.template_id =
        @templateId

        AND t.active = TRUE

      GROUP BY

        t.template_id,
        t.template_name,
        t.template_version,
        t.template_language,
        t.template_status,
        t.channel,
        t.recommendation_family,
        t.campaign_family,
        t.lifecycle_band,
        t.communication_treatment,
        t.match_priority

      LIMIT 1
    `;

    const [templateRows] =
      await bigquery.query({
        query:
          templateQuery,

        params: {
          templateId,
        },
      });

    if (
      !templateRows ||
      templateRows.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Template not found or inactive',
        },
        {
          status: 404,
        }
      );
    }

    const template: any =
      templateRows[0];

    // ========================================================
    // 3. NORMALIZE LOCALLY
    // ========================================================

    const normalize = (
      value: unknown
    ) =>
      value === null ||
      value === undefined
        ? null
        : String(value)
            .trim()
            .toUpperCase();

    const executionChannel =
      normalize(
        context.channel
      );

    const executionCampaign =
      normalize(
        context.campaign_family
      );

    const executionLifecycle =
      normalize(
        context.lifecycle_band
      );

    const executionTreatment =
      normalize(
        context.communication_treatment
      );

    const executionRecommendations =
      (
        Array.isArray(
          context.recommendation_families
        )
          ? context.recommendation_families
          : []
      )
        .map(normalize)
        .filter(Boolean);

    const ruleChannel =
      normalize(
        template.channel
      );

    const ruleRecommendation =
      normalize(
        template.recommendation_family
      );

    const ruleCampaign =
      normalize(
        template.campaign_family
      );

    const ruleLifecycle =
      normalize(
        template.lifecycle_band
      );

    const ruleTreatment =
      normalize(
        template.communication_treatment
      );

    // ========================================================
    // 4. GENERIC MATCHING
    //
    // NULL = wildcard.
    // ========================================================

    const channelMatch =
      !ruleChannel ||
      ruleChannel ===
        executionChannel;

    const recommendationMatch =
      !ruleRecommendation ||
      executionRecommendations.includes(
        ruleRecommendation
      );

    const campaignMatch =
      !ruleCampaign ||
      ruleCampaign ===
        executionCampaign;

    const lifecycleMatch =
      !ruleLifecycle ||
      ruleLifecycle ===
        executionLifecycle;

    const treatmentMatch =
      !ruleTreatment ||
      ruleTreatment ===
        executionTreatment;

    const compatible =
      channelMatch &&
      recommendationMatch &&
      campaignMatch &&
      lifecycleMatch &&
      treatmentMatch;

    if (!compatible) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'Template is not compatible with this execution',

          compatibility: {
            channelMatch,
            recommendationMatch,
            campaignMatch,
            lifecycleMatch,
            treatmentMatch,
          },

          executionContext: {
            channel:
              executionChannel,

            recommendationFamilies:
              executionRecommendations,

            campaignFamily:
              executionCampaign,

            lifecycleBand:
              executionLifecycle,

            communicationTreatment:
              executionTreatment,
          },

          templateRules: {
            channel:
              ruleChannel,

            recommendationFamily:
              ruleRecommendation,

            campaignFamily:
              ruleCampaign,

            lifecycleBand:
              ruleLifecycle,

            communicationTreatment:
              ruleTreatment,
          },
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 5. APPLY TEMPLATE TO EXECUTION + FROZEN MEMBERS
    // ========================================================

    const saveQuery = `
      BEGIN TRANSACTION;


      UPDATE
        \`${EXECUTION_TABLE}\`

      SET

        template_id =
          @templateId,

        template_name =
          @templateName,

        template_version =
          NULLIF(
            @templateVersion,
            ''
          ),

        template_registry_version =
          'TEMPLATE_REGISTRY_V1',

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE
        execution_id =
          @executionId;


      UPDATE
        \`${MEMBER_TABLE}\`

      SET

        template_id =
          @templateId,

        template_name =
          @templateName,

        template_version =
          NULLIF(
            @templateVersion,
            ''
          ),

        template_registry_version =
          'TEMPLATE_REGISTRY_V1',

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE
        execution_id =
          @executionId;


      COMMIT TRANSACTION;
    `;

    await bigquery.query({
      query:
        saveQuery,

      params: {
        executionId,

        templateId,

        templateName:
          String(
            template.template_name ||
              ''
          ),

        templateVersion:
          String(
            template.template_version ||
              ''
          ),
      },
    });

    // ========================================================
    // 6. VERIFY FREEZE
    // ========================================================

    const qcQuery = `
      SELECT

        h.execution_id,

        h.template_id,

        h.template_name,

        h.template_version,

        h.template_registry_version,

        h.planned_audience_size,

        COUNT(
          m.execution_member_id
        ) AS frozen_members,

        COUNTIF(
          m.template_id =
          h.template_id
        ) AS members_with_template

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

        h.template_id,

        h.template_name,

        h.template_version,

        h.template_registry_version,

        h.planned_audience_size
    `;

    const [qcRows] =
      await bigquery.query({
        query:
          qcQuery,

        params: {
          executionId,
        },
      });

    const qc: any =
      qcRows?.[0];

    const plannedAudience =
      Number(
        qc?.planned_audience_size ||
          0
      );

    const frozenMembers =
      Number(
        qc?.frozen_members ||
          0
      );

    const membersWithTemplate =
      Number(
        qc?.members_with_template ||
          0
      );

    return NextResponse.json({
      ok: true,

      template: {
        templateId:
          template.template_id,

        templateName:
          template.template_name,

        templateVersion:
          template.template_version,

        templateLanguage:
          template.template_language,

        templateStatus:
          template.template_status,

        variableCount:
          Number(
            template.variable_count ||
              0
          ),

        requiredVariableCount:
          Number(
            template.required_variable_count ||
              0
          ),
      },

      compatibility: {
        channelMatch,
        recommendationMatch,
        campaignMatch,
        lifecycleMatch,
        treatmentMatch,

        compatible: true,
      },

      qc: {
        plannedAudience,

        frozenMembers,

        membersWithTemplate,

        templateAppliedToAll:
          plannedAudience ===
            frozenMembers &&
          frozenMembers ===
            membersWithTemplate,
      },
    });

  } catch (error) {
    console.error(
      'Template selection error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to select template',
      },
      {
        status: 500,
      }
    );
  }
}