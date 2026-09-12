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

  // Prevent spreadsheet formula injection.
  if (
    /^[=+\-@]/.test(
      text
    )
  ) {
    text =
      `'${text}`;
  }

  if (
    text.includes('"')
  ) {
    text =
      text.replace(
        /"/g,
        '""'
      );
  }

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
  return value
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '_'
    )
    .replace(
      /_+/g,
      '_'
    )
    .slice(
      0,
      100
    );
}

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
    // HEADER
    // ========================================================

    const executionQuery = `
      SELECT

        execution_id,

        campaign_name,

        campaign_family,

        lifecycle_band,

        communication_treatment,

        execution_status,

        CAST(
          scheduled_execution_date
          AS STRING
        ) AS scheduled_execution_date,

        template_name,
        template_version,

        message_variant,

        offer_variant,
        offer_code

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
      executionRows.length ===
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

    const execution: any =
      executionRows[0];

    // ========================================================
    // FROZEN MEMBERS
    // ========================================================

    const memberQuery = `
      SELECT

        customer_key,

        customer_phone,

        customer_email,

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

        reliability_score,

        planner_priority_score,

        channel,

        template_name,

        template_version,

        message_variant,

        offer_variant,

        offer_code,

        attempt_band,

        send_status

      FROM
        \`${MEMBER_TABLE}\`

      WHERE
        execution_id =
          @executionId

      ORDER BY
        customer_key
    `;

    const [rows] =
      await bigquery.query({
        query:
          memberQuery,

        params: {
          executionId,
        },
      });

    // ========================================================
    // EXPORT COLUMNS
    // ========================================================

    const columns = [
      'customer_key',
      'customer_phone',
      'customer_email',

      'campaign_family',
      'lifecycle_band',
      'communication_treatment',

      'action_family',

      'target_type',
      'target_value',

      'dynamic_target_type',
      'dynamic_target_value',

      'dynamic_current_basket',
      'dynamic_recommended_date',

      'current_order_number',

      'latest_order_date',
      'days_since_latest_order',

      'latest_order_basket_signature',

      'recommended_contact_date',

      'timing_source',
      'timing_day',

      'weekly_timing_status',

      'predicted_target_probability_90d',

      'predicted_repeat_rate_90d',

      'predicted_target_order_value',

      'expected_target_value_90d',

      'reliability_score',

      'planner_priority_score',

      'channel',

      'template_name',
      'template_version',

      'message_variant',

      'offer_variant',
      'offer_code',

      'attempt_band',

      'send_status',
    ];

    const csvLines: string[] =
      [];

    csvLines.push(
      columns.join(',')
    );

    for (
      const row of rows
    ) {
      csvLines.push(
        columns
          .map(
            column =>
              csvValue(
                row[column]
              )
          )
          .join(',')
      );
    }

    // UTF-8 BOM helps Excel open Indian/customer text correctly.
    const csv =
      '\uFEFF' +
      csvLines.join(
        '\r\n'
      );

    const filename =
      safeFilename(
        `${
          execution.campaign_name ||
          execution.campaign_family ||
          'retention_campaign'
        }_${execution.scheduled_execution_date || ''}`
      );

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
        },
      }
    );
  } catch (error) {
    console.error(
      'Action Tracker export error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to export campaign',
      },
      {
        status: 500,
      }
    );
  }
}