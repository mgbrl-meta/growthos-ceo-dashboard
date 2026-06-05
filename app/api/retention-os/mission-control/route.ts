import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`shopify-colab.brillare_shopify.retention_opportunity_all\`
    `;

    const [rows] = await bigquery.query({ query });

    const forecastQuery = `
      SELECT
        SUM(confidence_weighted_revenue) AS forecasted_revenue,
        SUM(confidence_weighted_profit) AS forecasted_profit
      FROM \`shopify-colab.brillare_shopify.retention_forecast_v1\`
    `;

    const [forecastRows] = await bigquery.query({ query: forecastQuery });
    const forecast = (forecastRows as any[])?.[0] || {};

    const totalPotentialRevenue = rows.reduce(
      (sum: number, row: any) => sum + Number(row.estimated_revenue || 0),
      0
    );

    const totalPotentialProfit = rows.reduce(
      (sum: number, row: any) => sum + Number(row.estimated_profit || 0),
      0
    );

    const topOpportunity =
      [...rows].sort(
        (a: any, b: any) =>
          Number(b.estimated_profit || 0) - Number(a.estimated_profit || 0)
      )[0] || null;

    return NextResponse.json({
      totalOpportunities: rows.length,
      totalPotentialRevenue,
      totalPotentialProfit,
      forecastedRevenue: Number(forecast.forecasted_revenue || 0),
      forecastedProfit: Number(forecast.forecasted_profit || 0),
      topOpportunity,
      opportunities: rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load mission control data' },
      { status: 500 }
    );
  }
}
