import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
const TABLE = 'shopify-colab.brillare_shopify.retention_journey_settings';

export async function GET() {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${TABLE}\`
        ORDER BY min_orders
      `,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load journey settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];

    for (const row of rows) {
      await bigquery.query({
        query: `
          MERGE \`${TABLE}\` T
          USING (
            SELECT
              @stage_name AS stage_name,
              @min_orders AS min_orders,
              @max_orders AS max_orders,
              @next_goal AS next_goal,
              @active AS active,
              CURRENT_TIMESTAMP() AS updated_at
          ) S
          ON T.stage_name = S.stage_name
          WHEN MATCHED THEN UPDATE SET
            min_orders = S.min_orders,
            max_orders = S.max_orders,
            next_goal = S.next_goal,
            active = S.active,
            updated_at = S.updated_at
          WHEN NOT MATCHED THEN INSERT (
            stage_name,
            min_orders,
            max_orders,
            next_goal,
            active,
            updated_at
          )
          VALUES (
            S.stage_name,
            S.min_orders,
            S.max_orders,
            S.next_goal,
            S.active,
            S.updated_at
          )
        `,
        params: {
          stage_name: row.stage_name,
          min_orders: Number(row.min_orders || 0),
          max_orders: Number(row.max_orders || 0),
          next_goal: row.next_goal || '',
          active: row.active ?? true,
        },
      });
    }

    return NextResponse.json({ success: true, saved: rows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to save journey settings' },
      { status: 500 }
    );
  }
}