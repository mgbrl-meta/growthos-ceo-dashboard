import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`shopify-colab.brillare_shopify.retention_product_master\`
      ORDER BY product_title
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Mapped products API error:', error?.message || error);

    return NextResponse.json(
      {
        error: 'Failed to load mapped products',
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
