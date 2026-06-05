import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

const TABLE = 'shopify-colab.brillare_shopify.retention_action_log';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${TABLE}\`
      ORDER BY created_at DESC
      LIMIT 200
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load action log' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const row = await req.json();

    if (row.action_id && row.status) {
      const query = `
        UPDATE \`${TABLE}\`
        SET
          status = @status,
          launched_date = CASE
            WHEN @status = 'Running' THEN CURRENT_DATE()
            ELSE launched_date
          END,
          completed_date = CASE
            WHEN @status = 'Completed' THEN CURRENT_DATE()
            ELSE completed_date
          END,
          updated_at = CURRENT_TIMESTAMP()
        WHERE action_id = @action_id
      `;

      await bigquery.query({
        query,
        params: {
          action_id: row.action_id,
          status: row.status,
        },
      });

      return NextResponse.json({ success: true, updated: true });
    }

    const query = `
      INSERT INTO \`${TABLE}\` (
        action_id,
        opportunity_type,
        opportunity_group,
        action_title,
        channel,
        audience,
        expected_revenue,
        expected_profit,
        expected_customers,
        status,
        planned_date,
        launched_date,
        completed_date,
        notes,
        created_at,
        updated_at,
        created_by
      )
      VALUES (
        GENERATE_UUID(),
        @opportunity_type,
        @opportunity_group,
        @action_title,
        @channel,
        @audience,
        @expected_revenue,
        @expected_profit,
        @expected_customers,
        @status,
        @planned_date,
        NULL,
        NULL,
        @notes,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        'Retention OS'
      )
    `;

    await bigquery.query({
      query,
      params: {
        opportunity_type: row.opportunity_type,
        opportunity_group: row.opportunity_group,
        action_title: row.action_title,
        channel: row.channel,
        audience: row.audience,
        expected_revenue: Number(row.expected_revenue || 0),
        expected_profit: Number(row.expected_profit || 0),
        expected_customers: Number(row.expected_customers || 0),
        status: row.status || 'Planned',
        planned_date: row.planned_date || null,
        notes: row.notes || '',
      },
    });

    return NextResponse.json({ success: true, inserted: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to save action' },
      { status: 500 }
    );
  }
}