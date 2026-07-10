import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_settings_health_tbl';
const LOCATION = 'asia-southeast1';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
    });

    return NextResponse.json(rows[0] || {});
  } catch (error) {
    console.error('Settings health API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load settings health snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}