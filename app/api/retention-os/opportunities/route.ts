import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_opportunity_scoring_v5_tbl';

export async function GET() {
  try {
    const query = `
      SELECT
        opportunity_type,

        best_action,
        message_theme,

        recommended_product,
        recommended_sku,
        routine,

        journey_stage,
        journey_state,

        strategic_segment,

        estimated_revenue,
        estimated_profit,

        success_probability,
        expected_business_value,

        confidence,
        reason

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY expected_business_value DESC

      LIMIT 500
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Opportunity API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load retention opportunities snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}