import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

export async function GET() {
  try {
    const query = `
      SELECT
        h.unmapped_products,
        h.mapped_products,
        h.routine_products,
        h.opportunity_settings,
        h.live_opportunities,

        (SELECT COUNT(*) FROM \`shopify-colab.brillare_shopify.retention_action_log\`) AS actions,

        (SELECT COUNT(*) FROM \`shopify-colab.brillare_shopify.retention_learning_log\`) AS learnings,

        (SELECT COUNT(*) FROM \`shopify-colab.brillare_shopify.retention_learning_candidates\`) AS learning_candidates,

        CURRENT_TIMESTAMP() AS generated_at

      FROM \`shopify-colab.brillare_shopify.retention_settings_health\` h
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows[0] || {});
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load Retention OS summary' },
      { status: 500 }
    );
  }
}