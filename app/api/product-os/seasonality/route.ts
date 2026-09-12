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

export async function GET(req: Request) {

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
        const query = `
      WITH monthly AS (
        SELECT
          sku,
          ANY_VALUE(product_title) AS item_name,
          DATE_TRUNC(date, MONTH) AS month,
          EXTRACT(MONTH FROM date) AS month_num,
          SUM(units_sold) AS units,
          SUM(total_revenue) AS revenue
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE sku IS NOT NULL
          AND TRIM(sku) != ''
        GROUP BY sku, month, month_num
      ),

      sku_avg AS (
        SELECT
          sku,
          AVG(CASE WHEN units > 0 THEN units END) AS avg_monthly_units,
          COUNT(DISTINCT month) AS months_history,
          COUNT(DISTINCT CASE WHEN units > 0 THEN month_num END) AS active_months
        FROM monthly
        GROUP BY sku
      ),

      indexed AS (
        SELECT
          m.sku,
          ANY_VALUE(m.item_name) AS item_name,
          m.month_num,
          ANY_VALUE(sa.months_history) AS months_history,
          ANY_VALUE(sa.active_months) AS active_months,

          SAFE_DIVIDE(
            SUM(m.units),
            NULLIF(SUM(SUM(m.units)) OVER (PARTITION BY m.sku), 0)
          ) AS monthly_share,

          SAFE_DIVIDE(
            1,
            NULLIF(ANY_VALUE(sa.active_months), 0)
          ) AS expected_share

          FROM monthly m
          JOIN sku_avg sa USING (sku)
          GROUP BY m.sku, m.month_num
      ),

      pivoted AS (
        SELECT
          sku,
          ANY_VALUE(item_name) AS item_name,
          ANY_VALUE(months_history) AS months_history,
          ANY_VALUE(active_months) AS active_months,

          ROUND(MAX(CASE WHEN month_num = 1 THEN SAFE_DIVIDE(monthly_share, expected_share) END), 2) AS jan,
          ROUND(MAX(CASE WHEN month_num = 2 THEN seasonality_index END), 2) AS feb,
          ROUND(MAX(CASE WHEN month_num = 3 THEN seasonality_index END), 2) AS mar,
          ROUND(MAX(CASE WHEN month_num = 4 THEN seasonality_index END), 2) AS apr,
          ROUND(MAX(CASE WHEN month_num = 5 THEN seasonality_index END), 2) AS may,
          ROUND(MAX(CASE WHEN month_num = 6 THEN seasonality_index END), 2) AS jun,
          ROUND(MAX(CASE WHEN month_num = 7 THEN seasonality_index END), 2) AS jul,
          ROUND(MAX(CASE WHEN month_num = 8 THEN seasonality_index END), 2) AS aug,
          ROUND(MAX(CASE WHEN month_num = 9 THEN seasonality_index END), 2) AS sep,
          ROUND(MAX(CASE WHEN month_num = 10 THEN seasonality_index END), 2) AS oct,
          ROUND(MAX(CASE WHEN month_num = 11 THEN seasonality_index END), 2) AS nov,
          ROUND(MAX(CASE WHEN month_num = 12 THEN seasonality_index END), 2) AS dec,

          ROUND(
            MAX(seasonality_index) - MIN(CASE WHEN seasonality_index > 0 THEN seasonality_index END),
            2
          ) AS seasonality_strength,

          ROUND(MAX(seasonality_index), 2) AS peak_index,

          ROUND(
            MIN(CASE WHEN seasonality_index > 0 THEN seasonality_index END),
            2
          ) AS low_index

        FROM indexed
        GROUP BY sku
      )

      SELECT
        *,
        CASE
          WHEN active_months >= 10 THEN 'High'
          WHEN active_months >= 6 THEN 'Medium'
          ELSE 'Low'
        END AS confidence,

        CASE
          WHEN seasonality_strength >= 0.7 THEN 'Highly Seasonal'
          WHEN seasonality_strength >= 0.35 THEN 'Moderately Seasonal'
          ELSE 'Stable Demand'
        END AS seasonality_type

      FROM pivoted
      WHERE active_months >= 6
      ORDER BY seasonality_strength DESC
      LIMIT 300
    `;

        const [rows] = await bigquery.query({ query });

        return NextResponse.json({ rows });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to fetch seasonality' },
            { status: 500 }
        );
    }
}