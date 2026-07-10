import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_unmapped_products_tbl';
const LOCATION = 'asia-southeast1';

export async function GET() {
  try {
    const query = `
      SELECT
        sku,
        product_title,
        orders,
        customers,
        revenue,
        last_sold_at

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY revenue DESC

      LIMIT 100
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Unmapped products API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load unmapped products snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}