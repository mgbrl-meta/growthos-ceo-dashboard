import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_daily_planner_v3_tbl';

export async function GET() {
  try {
    const query = `
      SELECT
        plan_date,
        priority_rank,
        action_coverage,

        journey_opportunity_type,
        journey_action,
        journey_message_theme,

        product_opportunity_type,
        product_action,
        product_message_theme,

        recommended_sku,
        recommended_product,
        routine,

        journey_stage,
        journey_state,
        strategic_segment,

        customers,

        journey_revenue,
        journey_profit,
        journey_ebv,

        product_revenue,
        product_profit,
        product_ebv,

        combined_ebv,
        avg_confidence,
        planner_action

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY priority_rank

      LIMIT 100
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Daily planner API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load daily planner snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}