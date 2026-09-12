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

    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const compareStart = searchParams.get('compareStart');
    const compareEnd = searchParams.get('compareEnd');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing start or end date' },
        { status: 400 }
      );
    }

    const query = `
      WITH current_period AS (
        SELECT
          sku,
          ANY_VALUE(product_title) AS product_title,
          ANY_VALUE(variant_title) AS variant_title,
          SUM(units_sold) AS units,
          SUM(total_revenue) AS revenue
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE date BETWEEN @start AND @end
        GROUP BY sku
      ),

      compare_period AS (
        SELECT
          sku,
          SUM(units_sold) AS compare_units,
          SUM(total_revenue) AS compare_revenue
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE date BETWEEN @compareStart AND @compareEnd
        GROUP BY sku
      ),

      totals AS (
        SELECT SUM(revenue) AS total_revenue
        FROM current_period
      )

      SELECT
        c.sku,
        c.product_title,
        c.variant_title,

        c.units AS units_l30,
        c.revenue AS revenue_l30,

        COALESCE(cp.compare_units, 0) AS units_prev_30,
        COALESCE(cp.compare_revenue, 0) AS revenue_prev_30,

        SAFE_DIVIDE(c.revenue, NULLIF(c.units, 0)) AS avg_selling_price,

        SAFE_DIVIDE(
          c.units - COALESCE(cp.compare_units, 0),
          NULLIF(cp.compare_units, 0)
        ) AS unit_growth_pct,

        SAFE_DIVIDE(
          c.revenue - COALESCE(cp.compare_revenue, 0),
          NULLIF(cp.compare_revenue, 0)
        ) AS revenue_growth_pct,

        SAFE_DIVIDE(c.revenue, NULLIF(t.total_revenue, 0)) AS contribution_pct,

        CASE
          WHEN c.units = 0 THEN 'Dead'
          WHEN SAFE_DIVIDE(c.revenue - COALESCE(cp.compare_revenue, 0), NULLIF(cp.compare_revenue, 0)) >= 0.25 THEN 'Winner'
          WHEN SAFE_DIVIDE(c.revenue - COALESCE(cp.compare_revenue, 0), NULLIF(cp.compare_revenue, 0)) <= -0.25 THEN 'Declining'
          ELSE 'Stable'
        END AS sku_status

      FROM current_period c
      LEFT JOIN compare_period cp USING (sku)
      CROSS JOIN totals t
      ORDER BY revenue_l30 DESC
      LIMIT 200
    `;

    const [rows] = await bigquery.query({
      query,
      params: {
        start,
        end,
        compareStart: compareStart || start,
        compareEnd: compareEnd || end,
      },
    });

    return NextResponse.json({ rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SKU performance' },
      { status: 500 }
    );
  }
}