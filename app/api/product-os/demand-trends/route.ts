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
    const compareStart = searchParams.get('compareStart') || start;
    const compareEnd = searchParams.get('compareEnd') || end;

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing start or end date' },
        { status: 400 }
      );
    }

    const query = `
      WITH current_daily AS (
        SELECT
          date,
          SUM(total_revenue) AS revenue,
          SUM(units_sold) AS units
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE date BETWEEN @start AND @end
        GROUP BY date
      ),

      compare_daily AS (
        SELECT
          date,
          ROW_NUMBER() OVER (ORDER BY date) AS compare_day_index,
          SUM(total_revenue) AS compare_revenue,
          SUM(units_sold) AS compare_units
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE date BETWEEN @compareStart AND @compareEnd
        GROUP BY date
      ),

      current_indexed AS (
        SELECT
          date,
          ROW_NUMBER() OVER (ORDER BY date) AS day_index,
          revenue,
          units
        FROM current_daily
      ),

      daily_joined AS (
        SELECT
          c.date,
          c.revenue,
          c.units,
          COALESCE(cd.compare_revenue, 0) AS compare_revenue,
          COALESCE(cd.compare_units, 0) AS compare_units
        FROM current_indexed c
        LEFT JOIN compare_daily cd
          ON c.day_index = cd.compare_day_index
      ),

      trend_rows AS (
        SELECT
          date,
          revenue,
          units,
          compare_revenue,
          compare_units,
          AVG(revenue) OVER (
            ORDER BY date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
          ) AS revenue_ma7,
          AVG(units) OVER (
            ORDER BY date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
          ) AS units_ma7
        FROM daily_joined
      ),

      top_skus AS (
        SELECT
          sku,
          ANY_VALUE(product_title) AS product_title,
          SUM(total_revenue) AS revenue
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE date BETWEEN @start AND @end
        GROUP BY sku
        ORDER BY revenue DESC
        LIMIT 5
      ),

      top_sku_daily AS (
        SELECT
          d.date,
          d.sku,
          ANY_VALUE(d.product_title) AS product_title,
          SUM(d.total_revenue) AS revenue,
          SUM(d.units_sold) AS units
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\` d
        INNER JOIN top_skus t USING (sku)
        WHERE d.date BETWEEN @start AND @end
        GROUP BY d.date, d.sku
      ),

      distribution AS (
        SELECT
          d.date,
          SUM(d.total_revenue) AS total_revenue,
          SUM(CASE WHEN t.sku IS NOT NULL THEN d.total_revenue ELSE 0 END) AS top_sku_revenue,
          SUM(CASE WHEN t.sku IS NULL THEN d.total_revenue ELSE 0 END) AS rest_revenue,
          SAFE_DIVIDE(
            SUM(CASE WHEN t.sku IS NOT NULL THEN d.total_revenue ELSE 0 END),
            NULLIF(SUM(d.total_revenue), 0)
          ) AS top_sku_share
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\` d
        LEFT JOIN top_skus t USING (sku)
        WHERE d.date BETWEEN @start AND @end
        GROUP BY d.date
      ),

      totals AS (
        SELECT
          SUM(revenue) AS revenue,
          SUM(units) AS units,
          SUM(compare_revenue) AS compare_revenue,
          SUM(compare_units) AS compare_units
        FROM daily_joined
      ),

      top_driver AS (
        SELECT
          sku,
          product_title,
          revenue,
          SAFE_DIVIDE(revenue, (SELECT revenue FROM totals)) AS contribution_pct
        FROM top_skus
        ORDER BY revenue DESC
        LIMIT 1
      ),

      share_change AS (
        SELECT
          ARRAY_AGG(top_sku_share ORDER BY date ASC LIMIT 1)[OFFSET(0)] AS start_share,
          ARRAY_AGG(top_sku_share ORDER BY date DESC LIMIT 1)[OFFSET(0)] AS end_share
        FROM distribution
      )

      SELECT
        ARRAY(
          SELECT AS STRUCT *
          FROM trend_rows
          ORDER BY date
        ) AS trend_rows,

        ARRAY(
          SELECT AS STRUCT *
          FROM top_sku_daily
          ORDER BY date, revenue DESC
        ) AS top_sku_rows,

        ARRAY(
          SELECT AS STRUCT *
          FROM distribution
          ORDER BY date
        ) AS distribution_rows,

        STRUCT(
          SAFE_DIVIDE(t.revenue - t.compare_revenue, NULLIF(t.compare_revenue, 0)) AS revenue_growth_pct,
          SAFE_DIVIDE(t.units - t.compare_units, NULLIF(t.compare_units, 0)) AS units_growth_pct,
          td.sku AS top_driver_sku,
          td.product_title AS top_driver_product,
          td.contribution_pct AS top_driver_contribution_pct,
          sc.start_share AS top_share_start,
          sc.end_share AS top_share_end,
          sc.end_share - sc.start_share AS top_share_change
        ) AS insights

      FROM totals t
      CROSS JOIN top_driver td
      CROSS JOIN share_change sc
    `;

    const [rows] = await bigquery.query({
      query,
      params: { start, end, compareStart, compareEnd },
    });

    return NextResponse.json(rows[0] || {});
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch demand trends' },
      { status: 500 }
    );
  }
}