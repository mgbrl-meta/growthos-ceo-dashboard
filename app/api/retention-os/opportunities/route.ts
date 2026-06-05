import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

export async function GET() {
  try {
    const query = `
      SELECT
        opportunity_type,
        opportunity_group,
        customers,
        historical_routine_revenue,
        estimated_revenue,
        estimated_profit,
        reason,
        recommended_action,
        action_type,
        difficulty,
        confidence,
        detected_date
      FROM \`shopify-colab.brillare_shopify.retention_opportunity_all\`
      ORDER BY estimated_profit DESC
      LIMIT 200
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load retention opportunities' },
      { status: 500 }
    );
  }
}