import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`shopify-colab.brillare_shopify.retention_settings_health\`
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows[0] || {});
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load settings health' },
      { status: 500 }
    );
  }
}
