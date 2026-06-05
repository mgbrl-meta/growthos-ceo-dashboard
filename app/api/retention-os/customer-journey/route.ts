import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

export async function GET() {
  try {
    const query = `
      SELECT
        customer_key,
        qualified_orders,
        qualified_revenue,
        first_order_date,
        last_order_date,
        customer_age_days,
        days_since_last_order,
        orders_per_month,
        first_order_month,
        journey_stage,
        journey_health,
        blocker,
        next_goal,
        revenue_tier,
        calculated_date
      FROM \`shopify-colab.brillare_shopify.retention_customer_journey\`
      ORDER BY qualified_revenue DESC
      LIMIT 500
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load customer journey' },
      { status: 500 }
    );
  }
}
