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
      WITH current_sku AS (
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

      compare_sku AS (
        SELECT
          sku,
          SUM(units_sold) AS compare_units,
          SUM(total_revenue) AS compare_revenue
        FROM \`shopify-colab.brillare_shopify.product_sku_daily\`
        WHERE date BETWEEN @compareStart AND @compareEnd
        GROUP BY sku
      ),

      merged AS (
        SELECT
          c.sku,
          c.product_title,
          c.variant_title,
          c.units,
          c.revenue,
          COALESCE(cp.compare_units, 0) AS compare_units,
          COALESCE(cp.compare_revenue, 0) AS compare_revenue,
          SAFE_DIVIDE(
            c.revenue - COALESCE(cp.compare_revenue, 0),
            NULLIF(cp.compare_revenue, 0)
          ) AS revenue_growth_pct,
          SAFE_DIVIDE(
            c.units - COALESCE(cp.compare_units, 0),
            NULLIF(cp.compare_units, 0)
          ) AS units_growth_pct
        FROM current_sku c
        LEFT JOIN compare_sku cp USING (sku)
      ),

      totals AS (
        SELECT
          SUM(revenue) AS total_revenue,
          SUM(units) AS total_units,
          COUNT(DISTINCT sku) AS active_skus,
          SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT sku)) AS avg_revenue_per_sku,
          SUM(compare_revenue) AS compare_revenue,
          SUM(compare_units) AS compare_units
        FROM merged
      ),

      ranked AS (
        SELECT
          *,
          SAFE_DIVIDE(revenue, (SELECT total_revenue FROM totals)) AS share_pct,
          ROW_NUMBER() OVER (ORDER BY revenue DESC) AS revenue_rank
        FROM merged
      ),

      concentration AS (
        SELECT
          SUM(CASE WHEN revenue_rank <= 3 THEN share_pct ELSE 0 END) AS top_3_share,
          SUM(CASE WHEN revenue_rank <= 5 THEN share_pct ELSE 0 END) AS top_5_share,
          MAX(CASE WHEN revenue_rank = 1 THEN share_pct ELSE 0 END) AS top_1_share
        FROM ranked
      ),

      status_mix AS (
        SELECT
          COUNTIF(revenue_growth_pct >= 0.25 AND revenue >= 10000) AS winners,
          COUNTIF(revenue_growth_pct <= -0.25 AND compare_revenue >= 10000) AS declining,
          COUNTIF(
            NOT (revenue_growth_pct >= 0.25 AND revenue >= 10000)
            AND NOT (revenue_growth_pct <= -0.25 AND compare_revenue >= 10000)
          ) AS stable,
          0 AS dead
        FROM ranked
      ),

      growth AS (
        SELECT
          SAFE_DIVIDE(
            total_revenue - compare_revenue,
            NULLIF(compare_revenue, 0)
          ) AS revenue_growth_pct,
          SAFE_DIVIDE(
            total_units - compare_units,
            NULLIF(compare_units, 0)
          ) AS units_growth_pct
        FROM totals
      ),

      growth_counts AS (
        SELECT
          COUNTIF(revenue_growth_pct > 0) AS growing_skus,
          COUNTIF(revenue_growth_pct < 0) AS declining_skus
        FROM ranked
      ),

      top_5 AS (
        SELECT
          sku,
          product_title,
          variant_title,
          units,
          revenue,
          share_pct,
          revenue_growth_pct
        FROM ranked
        WHERE revenue_rank <= 5
        ORDER BY revenue DESC
      ),

      alerts AS (
        SELECT ARRAY_CONCAT(
          ARRAY(
            SELECT AS STRUCT
              'High revenue but declining' AS alert_type,
              sku,
              product_title,
              revenue,
              revenue_growth_pct
            FROM ranked
            WHERE revenue_rank <= 10
              AND revenue_growth_pct <= -0.25
            ORDER BY revenue DESC
            LIMIT 3
          ),
          ARRAY(
            SELECT AS STRUCT
              'Fast growing small SKU' AS alert_type,
              sku,
              product_title,
              revenue,
              revenue_growth_pct
            FROM ranked
            WHERE revenue < 50000
              AND revenue_growth_pct >= 0.5
            ORDER BY revenue_growth_pct DESC
            LIMIT 3
          ),
          ARRAY(
            SELECT AS STRUCT
              'Top SKU dependency risk' AS alert_type,
              sku,
              product_title,
              revenue,
              revenue_growth_pct
            FROM ranked
            WHERE revenue_rank = 1
              AND share_pct >= 0.35
            LIMIT 1
          )
        ) AS product_alerts
      )

      SELECT
        t.total_revenue,
        t.total_units,
        t.active_skus,
        t.avg_revenue_per_sku,

        c.top_3_share,
        c.top_5_share,
        c.top_1_share,
        CASE
          WHEN c.top_3_share > 0.55 THEN 'High'
          WHEN c.top_3_share >= 0.35 THEN 'Medium'
          ELSE 'Low'
        END AS concentration_risk,

        sm.winners,
        sm.stable,
        sm.declining,
        sm.dead,

        g.revenue_growth_pct,
        g.units_growth_pct,
        gc.growing_skus,
        gc.declining_skus,

        ARRAY_AGG(STRUCT(
          top_5.sku AS sku,
          top_5.product_title AS product_title,
          top_5.variant_title AS variant_title,
          top_5.units AS units,
          top_5.revenue AS revenue,
          top_5.share_pct AS share_pct,
          top_5.revenue_growth_pct AS revenue_growth_pct
        ) ORDER BY top_5.revenue DESC) AS top_skus,

        a.product_alerts

      FROM totals t
      CROSS JOIN concentration c
      CROSS JOIN status_mix sm
      CROSS JOIN growth g
      CROSS JOIN growth_counts gc
      CROSS JOIN top_5
      CROSS JOIN alerts a
      GROUP BY
        t.total_revenue,
        t.total_units,
        t.active_skus,
        t.avg_revenue_per_sku,
        c.top_3_share,
        c.top_5_share,
        c.top_1_share,
        concentration_risk,
        sm.winners,
        sm.stable,
        sm.declining,
        sm.dead,
        g.revenue_growth_pct,
        g.units_growth_pct,
        gc.growing_skus,
        gc.declining_skus,
        a.product_alerts
    `;

    const [rows] = await bigquery.query({
      query,
      params: {
        start,
        end,
        compareStart,
        compareEnd,
      },
    });

    return NextResponse.json(rows[0] || {});
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product overview' },
      { status: 500 }
    );
  }
}