import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
const TABLE = 'shopify-colab.brillare_shopify.retention_journey_health_settings';

export async function GET() {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${TABLE}\`
        ORDER BY min_days
      `,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load journey health settings' },
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
              @health_name AS health_name,
              @min_days AS min_days,
              @max_days AS max_days,
              @active AS active,
              CURRENT_TIMESTAMP() AS updated_at
          ) S
          ON T.health_name = S.health_name
          WHEN MATCHED THEN UPDATE SET
            min_days = S.min_days,
            max_days = S.max_days,
            active = S.active,
            updated_at = S.updated_at
          WHEN NOT MATCHED THEN INSERT (
            health_name,
            min_days,
            max_days,
            active,
            updated_at
          )
          VALUES (
            S.health_name,
            S.min_days,
            S.max_days,
            S.active,
            S.updated_at
          )
        `,
        params: {
          health_name: row.health_name,
          min_days: Number(row.min_days || 0),
          max_days: Number(row.max_days || 0),
          active: row.active ?? true,
        },
      });
    }

    return NextResponse.json({ success: true, saved: rows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to save journey health settings' },
      { status: 500 }
    );
  }
}