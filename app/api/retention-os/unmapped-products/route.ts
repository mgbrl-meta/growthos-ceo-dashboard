import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

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
      FROM \`shopify-colab.brillare_shopify.retention_unmapped_products\`
      ORDER BY revenue DESC
      LIMIT 100
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load unmapped products' },
      { status: 500 }
    );
  }
}