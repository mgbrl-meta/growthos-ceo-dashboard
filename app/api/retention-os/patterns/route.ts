import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_pattern_intelligence_v1_tbl';
const LOCATION = 'asia-southeast1';

type PatternRow = {
  pattern_type: string;
  sku: string;
  product_title: string | null;
  category: string | null;
  routine: string | null;
  role: string | null;
  customers: number;
  avg_orders: number;
  avg_ltv: number;
  success_customers: number;
  success_rate: number;
  repeat_rate: number;
  habit_rate: number;
  third_order_rate: number | null;
  second_order_avg_ltv: number | null;
  revenue_per_customer: number | null;
  retention_quality_score: number;
  confidence: string;
  detected_date: string;
};

export async function GET() {
  try {
    const query = `
      SELECT
        'FIRST_ORDER_RETENTION_DRIVER' AS pattern_type,

        sku,
        product_title,
        category,
        routine,
        role,

        CAST(customers AS INT64) AS customers,

        COALESCE(avg_orders, 0) AS avg_orders,
        COALESCE(avg_ltv, 0) AS avg_ltv,

        CAST(
          ROUND(
            CAST(customers AS FLOAT64) *
            COALESCE(repeat_rate, 0)
          )
          AS INT64
        ) AS success_customers,

        COALESCE(repeat_rate, 0) AS success_rate,

        COALESCE(repeat_rate, 0) AS repeat_rate,
        COALESCE(habit_rate, 0) AS habit_rate,
        third_order_rate,
        second_order_avg_ltv,
        revenue_per_customer,
        COALESCE(retention_quality_score, 0) AS retention_quality_score,
        confidence,

        FORMAT_DATE('%Y-%m-%d', detected_date) AS detected_date

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      WHERE sku IS NOT NULL
        AND customers > 0

      ORDER BY
        avg_ltv DESC,
        customers DESC

      LIMIT 500
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
    });

    return NextResponse.json(rows as PatternRow[]);
  } catch (error) {
    console.error('Retention pattern API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load retention patterns snapshot table',
        sourceTable: SOURCE_TABLE,
        details:
          error instanceof Error
            ? error.message
            : 'Unknown BigQuery query error',
      },
      { status: 500 }
    );
  }
}