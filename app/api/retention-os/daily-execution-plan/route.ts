import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const TABLE =
  'shopify-colab.brillare_shopify.retention_daily_execution_plan_tbl';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${TABLE}\`
      ORDER BY priority_rank
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Daily execution plan API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load daily execution plan snapshot table',
        sourceTable: TABLE,
      },
      { status: 500 }
    );
  }
}