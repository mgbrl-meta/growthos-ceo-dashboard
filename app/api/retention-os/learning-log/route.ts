import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

const TABLE = 'shopify-colab.brillare_shopify.retention_learning_log';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${TABLE}\`
      ORDER BY created_at DESC
      LIMIT 200
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load learning log' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const row = await req.json();

    const actualRevenue = Number(row.actual_revenue || 0);
    const actualProfit = Number(row.actual_profit || 0);
    const expectedRevenue = Number(row.expected_revenue || 0);
    const expectedProfit = Number(row.expected_profit || 0);

    const revenueAccuracy =
      expectedRevenue > 0 ? actualRevenue / expectedRevenue : 0;

    const profitAccuracy =
      expectedProfit > 0 ? actualProfit / expectedProfit : 0;

    const query = `
      INSERT INTO \`${TABLE}\` (
        learning_id,
        action_id,
        opportunity_type,
        opportunity_group,
        expected_revenue,
        expected_profit,
        actual_revenue,
        actual_profit,
        revenue_accuracy,
        profit_accuracy,
        result,
        learning_note,
        next_recommendation,
        created_at,
        updated_at,
        created_by
      )
      VALUES (
        GENERATE_UUID(),
        @action_id,
        @opportunity_type,
        @opportunity_group,
        @expected_revenue,
        @expected_profit,
        @actual_revenue,
        @actual_profit,
        @revenue_accuracy,
        @profit_accuracy,
        @result,
        @learning_note,
        @next_recommendation,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        'Retention OS'
      )
    `;

    await bigquery.query({
      query,
      params: {
        action_id: row.action_id,
        opportunity_type: row.opportunity_type,
        opportunity_group: row.opportunity_group,
        expected_revenue: expectedRevenue,
        expected_profit: expectedProfit,
        actual_revenue: actualRevenue,
        actual_profit: actualProfit,
        revenue_accuracy: revenueAccuracy,
        profit_accuracy: profitAccuracy,
        result: row.result || 'Recorded',
        learning_note: row.learning_note || '',
        next_recommendation: row.next_recommendation || '',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to save learning' },
      { status: 500 }
    );
  }
}