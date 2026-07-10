import { NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const PROJECT = 'shopify-colab';
const DATASET = 'brillare_shopify';
const LOCATION = 'asia-southeast1';

const SETTINGS_HEALTH_TABLE = 'retention_settings_health_tbl';
const LEARNING_CANDIDATES_TABLE = 'retention_learning_candidates_tbl';

const ACTION_LOG_TABLE = 'retention_action_log';
const LEARNING_LOG_TABLE = 'retention_learning_log';

export async function GET() {
  try {
    const query = `
      SELECT
        h.unmapped_products,
        h.mapped_products,
        h.routine_products,
        h.opportunity_settings,
        h.live_opportunities,

        (
          SELECT COUNT(*)
          FROM \`${PROJECT}.${DATASET}.${ACTION_LOG_TABLE}\`
        ) AS actions,

        (
          SELECT COUNT(*)
          FROM \`${PROJECT}.${DATASET}.${LEARNING_LOG_TABLE}\`
        ) AS learnings,

        (
          SELECT COUNT(*)
          FROM \`${PROJECT}.${DATASET}.${LEARNING_CANDIDATES_TABLE}\`
        ) AS learning_candidates,

        CURRENT_TIMESTAMP() AS generated_at

      FROM \`${PROJECT}.${DATASET}.${SETTINGS_HEALTH_TABLE}\` AS h

      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      location: LOCATION,
    });

    return NextResponse.json(rows[0] || {});
  } catch (error) {
    console.error('Retention OS summary API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to load Retention OS summary',
        sources: {
          settingsHealth: SETTINGS_HEALTH_TABLE,
          learningCandidates: LEARNING_CANDIDATES_TABLE,
          actionLog: ACTION_LOG_TABLE,
          learningLog: LEARNING_LOG_TABLE,
        },
      },
      { status: 500 }
    );
  }
}