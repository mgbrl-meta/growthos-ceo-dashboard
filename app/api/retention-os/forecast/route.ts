import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_forecast_v1_tbl';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY confidence_weighted_profit DESC

      LIMIT 200
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Retention forecast API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load retention forecast snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}