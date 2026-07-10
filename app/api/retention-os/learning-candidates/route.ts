import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_learning_candidates_tbl';
const LOCATION = 'asia-southeast1';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY completed_date DESC

      LIMIT 200
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Learning candidates API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load learning candidates snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}