import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { bigquery } from '@/lib/bigquery';

const MEMBER_TABLE =
  'shopify-colab.brillare_shopify.retention_action_execution_member_v1_tbl';

const TEMPLATE_TABLE =
  'shopify-colab.brillare_shopify.retention_template_registry_v1';

const VARIABLE_TABLE =
  'shopify-colab.brillare_shopify.retention_template_variable_registry_v1';

export const dynamic =
  'force-dynamic';


// ============================================================
// SAFE MEMBER COLUMNS
//
// Template registry can reference these without allowing
// arbitrary SQL injection.
// ============================================================

const ALLOWED_MEMBER_COLUMNS =
  new Set([

    'customer_key',
    'customer_phone',
    'customer_email',

    'campaign_family',
    'lifecycle_band',
    'communication_treatment',

    'action_family',

    'target_type',
    'target_value',

    'recommendation_id',

    'source_system',
    'source_model',
    'source_reference_id',

    'recommendation_family',
    'recommendation_type',
    'recommendation_key',

    'current_order_number',

    'latest_order_basket_signature',

    'recommended_contact_date',

    'timing_source',
    'timing_day',

    'weekly_timing_status',

    'predicted_target_probability_90d',
    'predicted_repeat_rate_90d',
    'predicted_target_order_value',
    'expected_target_value_90d',

    'planner_priority_score',
    'reliability_score',

    'dynamic_target_type',
    'dynamic_target_value',

    'dynamic_current_basket',
    'dynamic_recommended_date',

    'channel',

    'attempt_band',
    'send_status',
  ]);


// ============================================================
// TYPES
// ============================================================

type VariableRow = {

  template_id: string;

  variable_position: number;

  variable_key: string;

  export_column_name: string;

  source_type: string;

  source_key:
    | string
    | null;

  fallback_source_type:
    | string
    | null;

  fallback_source_key:
    | string
    | null;

  default_value:
    | string
    | null;

  required: boolean;
};


// ============================================================
// VALIDATION
// ============================================================

function safeAlias(
  value: string
) {

  const cleaned =
    String(value || '')
      .replace(
        /[^a-zA-Z0-9_]/g,
        '_'
      )
      .replace(
        /_+/g,
        '_'
      );

  if (!cleaned) {
    throw new Error(
      'Invalid export column name'
    );
  }

  return cleaned;
}


function safeJsonPath(
  value:
    | string
    | null
) {

  if (!value) {
    return null;
  }

  const path =
    String(value).trim();

  // Supports normal JSON paths such as:
  // $.routine
  // $.products[0].title
  // $.reason_text

  if (
    !/^\$[A-Za-z0-9_\-.\[\]]*$/.test(
      path
    )
  ) {

    throw new Error(
      `Unsafe JSON path: ${path}`
    );
  }

  return path;
}


// ============================================================
// BUILD SOURCE EXPRESSION
// ============================================================

function buildSourceExpression(
  sourceType:
    | string
    | null,

  sourceKey:
    | string
    | null,

  parameterName:
    string,

  params:
    Record<string, any>
) {

  if (
    !sourceType ||
    !sourceKey
  ) {
    return 'NULL';
  }


  const type =
    sourceType.toUpperCase();


  // =========================================================
  // MEMBER COLUMN
  // =========================================================

  if (
    type ===
    'MEMBER_COLUMN'
  ) {

    if (
      !ALLOWED_MEMBER_COLUMNS.has(
        sourceKey
      )
    ) {

      throw new Error(
        `Unsupported member column: ${sourceKey}`
      );
    }


    return `CAST(m.\`${sourceKey}\` AS STRING)`;
  }


  // =========================================================
  // RECOMMENDATION JSON
  // =========================================================

  if (
    type ===
    'RECOMMENDATION_JSON'
  ) {

    const path =
      safeJsonPath(
        sourceKey
      );


    params[
      parameterName
    ] = path;


    return `
      JSON_VALUE(
        m.recommendation_payload_json,
        @${parameterName}
      )
    `;
  }


  // =========================================================
  // SOURCE JSON
  // =========================================================

  if (
    type ===
    'SOURCE_JSON'
  ) {

    const path =
      safeJsonPath(
        sourceKey
      );


    params[
      parameterName
    ] = path;


    return `
      JSON_VALUE(
        m.source_payload_json,
        @${parameterName}
      )
    `;
  }


  // =========================================================
  // LITERAL
  // =========================================================

  if (
    type ===
    'LITERAL'
  ) {

    params[
      parameterName
    ] =
      sourceKey;


    return `@${parameterName}`;
  }


  throw new Error(
    `Unsupported source type: ${sourceType}`
  );
}


// ============================================================
// GET
// ============================================================

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


    const templateId =
      String(
        searchParams.get(
          'templateId'
        ) || ''
      ).trim();


    const requestedLimit =
      Number(
        searchParams.get(
          'limit'
        ) || 20
      );


    const limit =
      Math.min(
        Math.max(
          requestedLimit,
          1
        ),
        100
      );


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
    // TEMPLATE
    // ========================================================

    const templateQuery = `

      SELECT *

      FROM
        \`${TEMPLATE_TABLE}\`

      WHERE
        template_id =
          @templateId

        AND active = TRUE

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
      templateRows.length ===
        0
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            'Template not found',
        },
        {
          status: 404,
        }
      );
    }


    // ========================================================
    // VARIABLE DEFINITIONS
    // ========================================================

    const variableQuery = `

      SELECT

        template_id,

        variable_position,

        variable_key,

        export_column_name,

        source_type,

        source_key,

        fallback_source_type,

        fallback_source_key,

        default_value,

        required

      FROM
        \`${VARIABLE_TABLE}\`

      WHERE
        template_id =
          @templateId

        AND active = TRUE

      ORDER BY
        variable_position
    `;


    const [variableRows] =
      await bigquery.query({

        query:
          variableQuery,

        params: {
          templateId,
        },
      });


    if (
      !variableRows ||
      variableRows.length ===
        0
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            'Template has no variable definitions',
        },
        {
          status: 400,
        }
      );
    }


    const variables =
      variableRows as VariableRow[];


    // ========================================================
    // BUILD DYNAMIC SQL
    // ========================================================

    const params:
      Record<string, any> = {

        executionId,

        limit,
      };


    const variableSelects:
      string[] = [];


    const metadata =
      variables.map(
        (
          variable,
          index
        ) => {

          const position =
            Number(
              variable.variable_position
            );


          const alias =
            safeAlias(
              variable.export_column_name ||
              `var_${position}`
            );


          const primary =
            buildSourceExpression(

              variable.source_type,

              variable.source_key,

              `primary_${index}`,

              params
            );


          const fallback =
            buildSourceExpression(

              variable.fallback_source_type,

              variable.fallback_source_key,

              `fallback_${index}`,

              params
            );


          const defaultParameter =
            `default_${index}`;


          params[
            defaultParameter
          ] =
            variable.default_value ??
            '';


          variableSelects.push(`

            COALESCE(

              NULLIF(
                ${primary},
                ''
              ),

              NULLIF(
                ${fallback},
                ''
              ),

              NULLIF(
                @${defaultParameter},
                ''
              )

            )
            AS \`${alias}\`

          `);


          return {

            position,

            variableKey:
              variable.variable_key,

            exportColumnName:
              alias,

            required:
              Boolean(
                variable.required
              ),

            sourceType:
              variable.source_type,

            sourceKey:
              variable.source_key,

            fallbackSourceType:
              variable.fallback_source_type,

            fallbackSourceKey:
              variable.fallback_source_key,
          };
        }
      );


    const audienceQuery = `

      SELECT

        m.execution_member_id,

        m.customer_key,

        m.customer_phone,

        m.customer_email,

        m.recommendation_family,

        m.recommendation_type,

        m.recommendation_key,

        m.campaign_family,

        m.lifecycle_band,

        m.communication_treatment,

        ${
          variableSelects.join(
            ','
          )
        }

      FROM
        \`${MEMBER_TABLE}\`
          m

      WHERE
        m.execution_id =
          @executionId

      ORDER BY

        m.planner_priority_score
          DESC,

        m.customer_key

      LIMIT @limit
    `;


    const [resolvedRows] =
      await bigquery.query({

        query:
          audienceQuery,

        params,

        types: {
          limit:
            'INT64',
        },
      });


    // ========================================================
    // REQUIRED VARIABLE QC
    // ========================================================

    const qc =
      metadata.map(
        variable => {

          const missing =
            resolvedRows.filter(
              (row: any) => {

                const value =
                  row[
                    variable.exportColumnName
                  ];


                return (
                  value === null ||
                  value === undefined ||
                  String(value)
                    .trim() ===
                    ''
                );
              }
            ).length;


          return {

            variablePosition:
              variable.position,

            variableKey:
              variable.variableKey,

            exportColumnName:
              variable.exportColumnName,

            required:
              variable.required,

            previewMissing:
              missing,

            previewResolved:
              resolvedRows.length -
              missing,
          };
        }
      );


    const requiredFailures =
      qc.filter(
        item =>
          item.required &&
          item.previewMissing >
            0
      );


    return NextResponse.json({

      ok: true,

      template:
        templateRows[0],

      variables:
        metadata,

      qc: {

        previewRows:
          resolvedRows.length,

        requiredVariablesPassed:
          requiredFailures.length ===
          0,

        requiredFailures,
      },

      members:
        resolvedRows,
    });

  } catch (error) {

    console.error(
      'Template resolver preview error:',
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to resolve template variables',
      },
      {
        status: 500,
      }
    );
  }
}