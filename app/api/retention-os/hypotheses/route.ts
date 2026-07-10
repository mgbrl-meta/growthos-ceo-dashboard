import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const SOURCE_TABLE = 'retention_pattern_intelligence_v1_tbl';
const LOCATION = 'asia-southeast1';

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
        avg_ltv,
        success_rate,

        CASE
          WHEN pattern_type = 'FIRST_PRODUCT_LTV'
            THEN CONCAT(
              'Acquire more customers through ',
              product_title
            )

          WHEN pattern_type = 'SECOND_PRODUCT_LTV'
            THEN CONCAT(
              'Push ',
              product_title,
              ' as second-order product'
            )

          ELSE CONCAT(
            'Test lifecycle campaign around ',
            product_title
          )
        END AS hypothesis,

        CASE
          WHEN pattern_type = 'FIRST_PRODUCT_LTV'
            THEN 'Acquisition Mix'

          WHEN pattern_type = 'SECOND_PRODUCT_LTV'
            THEN 'Second Purchase'

          ELSE 'Retention Test'
        END AS action_type,

        ROUND(
          avg_ltv * customers * 0.05
        ) AS expected_revenue,

        ROUND(
          avg_ltv * customers * 0.02
        ) AS expected_profit,

        LEAST(
          95,
          CAST(
            ROUND(success_rate * 100)
            AS INT64
          )
        ) AS confidence,

        CURRENT_DATE() AS detected_date

      FROM \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      WHERE customers >= 10

      ORDER BY expected_profit DESC

      LIMIT 100
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Hypothesis API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load hypotheses from snapshot table',
        sourceTable: SOURCE_TABLE,
      },
      { status: 500 }
    );
  }
}