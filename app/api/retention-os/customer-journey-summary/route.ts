import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_customer_journey_state_v1_tbl';

export async function GET() {
  try {
    const query = `
      SELECT
        journey_stage,
        journey_state,

        COUNT(*) AS customers,

        SUM(qualified_revenue) AS revenue,

        AVG(state_score) AS avg_state_score,

        AVG(days_since_last_order) AS avg_days_since_last_order

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      GROUP BY
        journey_stage,
        journey_state

      ORDER BY
        journey_stage,
        journey_state
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Journey summary API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load journey summary snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}