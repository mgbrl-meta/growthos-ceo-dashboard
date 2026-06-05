import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

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
      FROM \`shopify-colab.brillare_shopify.retention_pattern_all\`
      ORDER BY avg_ltv DESC
      LIMIT 200
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load retention patterns' },
      { status: 500 }
    );
  }
}
