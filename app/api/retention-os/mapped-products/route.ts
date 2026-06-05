import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

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