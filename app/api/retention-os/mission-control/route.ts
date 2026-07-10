import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_next_best_action_v6_tbl';

export async function GET() {
  try {
    const query = `
      SELECT
        action_coverage,
        journey_opportunity_type,
        product_opportunity_type,
        recommended_sku,
        recommended_product,
        routine,
        journey_stage,
        journey_state,
        strategic_segment,
        combined_ebv,
        journey_estimated_revenue,
        journey_estimated_profit,
        product_estimated_revenue,
        product_estimated_profit

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY combined_ebv DESC

      LIMIT 5000
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    const totalPotentialRevenue = rows.reduce(
      (sum: number, row: any) =>
        sum +
        Number(row.journey_estimated_revenue || 0) +
        Number(row.product_estimated_revenue || 0),
      0
    );

    const totalPotentialProfit = rows.reduce(
      (sum: number, row: any) =>
        sum +
        Number(row.journey_estimated_profit || 0) +
        Number(row.product_estimated_profit || 0),
      0
    );

    const totalEBV = rows.reduce(
      (sum: number, row: any) =>
        sum + Number(row.combined_ebv || 0),
      0
    );

    const topOpportunity = rows[0] || null;

    return NextResponse.json({
      totalOpportunities: rows.length,
      totalPotentialRevenue,
      totalPotentialProfit,
      forecastedRevenue: totalEBV,
      forecastedProfit: totalEBV,
      topOpportunity,
      opportunities: rows,
    });
  } catch (error) {
    console.error('Mission control API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load mission control snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}