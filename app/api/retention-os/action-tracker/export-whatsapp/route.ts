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


// ============================================================
// SAFE MEMBER COLUMNS
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
// HELPERS
// ============================================================

function safeAlias(
  value: string
) {
  const cleaned =
    String(value || '')
      .trim()
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
    sourceType
      .trim()
      .toUpperCase();


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

    return `
      CAST(
        m.\`${sourceKey}\`
        AS STRING
      )
    `;
  }


  // =========================================================
  // RECOMMENDATION PAYLOAD
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
  // SOURCE PAYLOAD
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


function csvValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  let text =
    String(value);

  // Excel / spreadsheet formula protection
  if (
    /^[=+\-@]/.test(
      text
    )
  ) {
    text =
      `'${text}`;
  }

  text =
    text.replace(
      /"/g,
      '""'
    );

  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text}"`;
  }

  return text;
}


function safeFilename(
  value: string
) {
  return String(value)
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '_'
    )
    .replace(
      /_+/g,
      '_'
    )
    .replace(
      /^_+|_+$/g,
      ''
    )
    .slice(
      0,
      120
    );
}


// ============================================================
// GET
// ============================================================

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


    // ========================================================
    // 1. LOAD EXECUTION + SELECTED TEMPLATE
    // ========================================================

    const executionQuery = `
      SELECT

        execution_id,

        campaign_name,

        campaign_family,

        lifecycle_band,

        communication_treatment,

        template_id,

        template_name,

        template_version,

        template_registry_version,

        planned_audience_size,

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


    const [executionRows] =
      await bigquery.query({
        query:
          executionQuery,

        params: {
          executionId,
        },
      });


    if (
      !executionRows ||
      executionRows.length === 0
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


    const execution: any =
      executionRows[0];


    const templateId =
      String(
        execution.template_id ||
        ''
      ).trim();


    if (!templateId) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'No template is selected for this execution',
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // 2. VERIFY TEMPLATE
    // ========================================================

    const templateQuery = `
      SELECT

        template_id,

        template_name,

        template_version,

        template_language,

        channel,

        template_status

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
      templateRows.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'Selected template is missing or inactive',
        },
        {
          status: 400,
        }
      );
    }


    const template: any =
      templateRows[0];


    // ========================================================
    // 3. LOAD TEMPLATE VARIABLE DEFINITIONS
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
      variableRows.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'Selected template has no active variable definitions',
        },
        {
          status: 400,
        }
      );
    }


    const variables =
      variableRows as VariableRow[];


    // ========================================================
    // 4. BUILD DYNAMIC VARIABLE SQL
    // ========================================================

    const params:
      Record<string, any> = {
        executionId,
      };


    const variableSelects:
      string[] = [];


    const exportColumns =
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


          const defaultParam =
            `default_${index}`;


          params[
            defaultParam
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
                @${defaultParam},
                ''
              )

            ) AS \`${alias}\`
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
          };
        }
      );


    // ========================================================
    // 5. RESOLVE ALL FROZEN CUSTOMERS
    // ========================================================

    const exportQuery = `
      SELECT

        -- ====================================================
        -- Stable operational identifier
        -- ====================================================

        CAST(
          m.customer_phone
          AS STRING
        ) AS customer_phone,

        ${variableSelects.join(',')}

      FROM
        \`${MEMBER_TABLE}\`
          m

      WHERE
        m.execution_id =
          @executionId

      ORDER BY
        m.planner_priority_score DESC,
        m.customer_key
    `;


    const [rows] =
      await bigquery.query({
        query:
          exportQuery,

        params,
      });


    // ========================================================
    // 6. QC BEFORE EXPORT
    // ========================================================

    const requiredFailures:
      {
        variablePosition:
          number;

        variableKey:
          string;

        exportColumnName:
          string;

        missingCount:
          number;
      }[] = [];


    for (
      const variable
      of exportColumns
    ) {
      if (
        !variable.required
      ) {
        continue;
      }


      const missingCount =
        rows.filter(
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


      if (
        missingCount > 0
      ) {
        requiredFailures.push({
          variablePosition:
            variable.position,

          variableKey:
            variable.variableKey,

          exportColumnName:
            variable.exportColumnName,

          missingCount,
        });
      }
    }


    if (
      requiredFailures.length >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'Required template variables are missing for some customers',

          executionId,

          templateId,

          audienceSize:
            rows.length,

          requiredFailures,
        },
        {
          status: 422,
        }
      );
    }


    // ========================================================
    // 7. BUILD CSV
    // ========================================================

    const headers = [
      'customer_phone',

      ...exportColumns.map(
        variable =>
          variable.exportColumnName
      ),
    ];


    const csvLines:
      string[] = [];


    csvLines.push(
      headers
        .map(
          csvValue
        )
        .join(',')
    );


    for (
      const row of rows
    ) {
      csvLines.push(
        headers
          .map(
            column =>
              csvValue(
                row[column]
              )
          )
          .join(',')
      );
    }


    // UTF-8 BOM for Excel
    const csv =
      '\uFEFF' +
      csvLines.join(
        '\r\n'
      );


    // ========================================================
    // 8. FILE NAME
    // ========================================================

    const filename =
      safeFilename(
        [
          execution
            .campaign_name ||
          execution
            .campaign_family ||
          'retention',

          template
            .template_name ||
          templateId,

          execution
            .scheduled_execution_date ||
          '',
        ]
          .filter(Boolean)
          .join('_')
      );


    // ========================================================
    // 9. RESPONSE
    // ========================================================

    return new NextResponse(
      csv,
      {
        status: 200,

        headers: {
          'Content-Type':
            'text/csv; charset=utf-8',

          'Content-Disposition':
            `attachment; filename="${filename}.csv"`,

          'Cache-Control':
            'no-store',

          'X-Retention-Execution-Id':
            executionId,

          'X-Retention-Template-Id':
            templateId,

          'X-Retention-Audience-Size':
            String(
              rows.length
            ),

          'X-Retention-Variable-Count':
            String(
              exportColumns.length
            ),
        },
      }
    );

  } catch (error) {
    console.error(
      'Dynamic WhatsApp export error:',
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate WhatsApp export',
      },
      {
        status: 500,
      }
    );
  }
}