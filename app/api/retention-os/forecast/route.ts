import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`shopify-colab.brillare_shopify.retention_forecast_v1\`
      ORDER BY confidence_weighted_profit DESC
      LIMIT 200
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load retention forecast' },
      { status: 500 }
    );
  }
}
