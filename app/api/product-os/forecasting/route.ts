import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';

import { BigQuery } from '@google-cloud/bigquery';
import { NextResponse } from 'next/server';

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

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
    const { searchParams } = new URL(request.url);
    const end = searchParams.get('end');

    if (!end) {
      return NextResponse.json({ error: 'Missing end date' }, { status: 400 });
    }

    const query = `
      WITH latest_month AS (
        SELECT
          MAX(DATE_TRUNC(date, MONTH)) AS selected_month
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE date <= DATE(@end)
      ),

      monthly AS (
        SELECT
          sku,
          ANY_VALUE(product_title) AS item_name,
          DATE_TRUNC(date, MONTH) AS month,
          SUM(units_sold) AS units,
          SUM(total_revenue) AS revenue
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE sku IS NOT NULL
          AND TRIM(sku) != ''
        GROUP BY sku, month
      ),

      base AS (
        SELECT
          m.sku,
          ANY_VALUE(m.item_name) AS item_name,

          SUM(CASE WHEN m.month = lm.selected_month THEN m.units ELSE 0 END) AS last_calendar_month,
          SUM(CASE WHEN m.month = lm.selected_month THEN m.revenue ELSE 0 END) AS last_calendar_month_revenue,

          SUM(CASE WHEN m.month BETWEEN DATE_SUB(lm.selected_month, INTERVAL 2 MONTH) AND lm.selected_month THEN m.units ELSE 0 END) AS latest_3m_units,
          SUM(CASE WHEN m.month BETWEEN DATE_SUB(lm.selected_month, INTERVAL 5 MONTH) AND DATE_SUB(lm.selected_month, INTERVAL 3 MONTH) THEN m.units ELSE 0 END) AS previous_3m_units,
          SUM(CASE WHEN m.month = DATE_SUB(lm.selected_month, INTERVAL 1 MONTH) THEN m.units ELSE 0 END) AS previous_month_units,

          COUNT(DISTINCT m.month) AS months_history
        FROM monthly m
        CROSS JOIN latest_month lm
        GROUP BY m.sku
      ),

      calculated AS (
        SELECT
          sku,
          item_name,
          last_calendar_month,
          last_calendar_month_revenue,
          months_history,

          LEAST(
            GREATEST(
              (
                0.6 * COALESCE(
                  SAFE_DIVIDE(latest_3m_units - previous_3m_units, NULLIF(previous_3m_units, 0)),
                  0
                )
                +
                0.4 * COALESCE(
                  SAFE_DIVIDE(last_calendar_month - previous_month_units, NULLIF(previous_month_units, 0)),
                  0
                )
              ),
              -0.5
            ),
            1.0
          ) AS growth_rate,

          1 AS seasonality_index

        FROM base
      )

      SELECT
        sku,
        item_name,
        ROUND(last_calendar_month) AS last_calendar_month,
        ROUND(last_calendar_month_revenue) AS last_calendar_month_revenue,
        growth_rate,
        seasonality_index,
        months_history
      FROM calculated
      WHERE last_calendar_month > 0
      ORDER BY last_calendar_month DESC
      LIMIT 300
    `;

    const [rows] = await bigquery.query({
      query,
      params: { end },
    });

    return NextResponse.json({ rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch forecast' },
      { status: 500 }
    );
  }
}