import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_customer_journey_state_v1_tbl';

export async function GET() {
  try {
    const query = `
      SELECT
        customer_key,

        journey_stage,
        journey_state,

        qualified_orders,
        qualified_revenue,

        days_since_last_order,

        base_probability,
        priority_multiplier,
        state_score,

        calculated_date

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY qualified_revenue DESC

      LIMIT 500
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Customer Journey API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load customer journey snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}