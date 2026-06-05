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
        avg_ltv,
        success_rate,

        CASE
          WHEN pattern_type = 'FIRST_PRODUCT_LTV'
          THEN CONCAT('Acquire more customers through ', product_title)

          WHEN pattern_type = 'SECOND_PRODUCT_LTV'
          THEN CONCAT('Push ', product_title, ' as second-order product')

          ELSE CONCAT('Test lifecycle campaign around ', product_title)
        END AS hypothesis,

        CASE
          WHEN pattern_type = 'FIRST_PRODUCT_LTV'
          THEN 'Acquisition Mix'

          WHEN pattern_type = 'SECOND_PRODUCT_LTV'
          THEN 'Second Purchase'

          ELSE 'Retention Test'
        END AS action_type,

        ROUND(avg_ltv * customers * 0.05) AS expected_revenue,

        ROUND(avg_ltv * customers * 0.02) AS expected_profit,

        LEAST(95, CAST(ROUND(success_rate * 100) AS INT64)) AS confidence,

        CURRENT_DATE() AS detected_date

      FROM \`shopify-colab.brillare_shopify.retention_pattern_all\`

      WHERE customers >= 10

      ORDER BY expected_profit DESC

      LIMIT 100
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load hypotheses' },
      { status: 500 }
    );
  }
}
