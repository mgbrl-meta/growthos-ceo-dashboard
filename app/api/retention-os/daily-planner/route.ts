import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

export async function GET() {
    try {
        const query = `
            SELECT
                FORMAT_DATE('%Y-%m-%d', send_date) AS send_date,
                priority_rank,
                opportunity_type,
                best_action,
                message_theme,
                journey_stage,
                journey_health,
                revenue_tier,
                customers,
                avg_customer_priority,
                avg_customer_confidence,
                strategic_confidence,
                learning_accuracy,
                expected_revenue,
                expected_profit,
                confidence_weighted_profit,
                reason,
                recommended_execution,
                action_group_key
            FROM \`shopify-colab.brillare_shopify.retention_daily_execution_plan_v2\`
            ORDER BY priority_rank
            LIMIT 50
        `;

        const [rows] = await bigquery.query({ query });

        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: 'Failed to load daily planner' },
            { status: 500 }
        );
    }
}
