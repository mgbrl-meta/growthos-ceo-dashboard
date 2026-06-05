import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

export async function GET() {
  try {
    const query = `
      SELECT
        journey_stage,
        journey_health,
        COUNT(*) AS customers,
        SUM(qualified_revenue) AS revenue,
        AVG(qualified_orders) AS avg_orders,
        AVG(days_since_last_order) AS avg_days_since_last_order
      FROM \`shopify-colab.brillare_shopify.retention_customer_journey\`
      GROUP BY 1,2
      ORDER BY journey_stage, journey_health
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load journey summary' },
      { status: 500 }
    );
  }
}