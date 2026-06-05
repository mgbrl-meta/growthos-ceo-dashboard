import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`shopify-colab.brillare_shopify.retention_daily_execution_plan\`
      ORDER BY priority_rank
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load daily execution plan' },
      { status: 500 }
    );
  }
}
