import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_pattern_intelligence_v1_tbl';

export async function GET() {
  try {
    const query = `
      SELECT
        pattern_type,
        sku,
        product_title,
        routine,
        role,
        customers,
        avg_orders,
        avg_ltv,
        success_customers,
        success_rate,
        detected_date

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY avg_ltv DESC

      LIMIT 200
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'asia-southeast1',
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Patterns API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load retention patterns snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}