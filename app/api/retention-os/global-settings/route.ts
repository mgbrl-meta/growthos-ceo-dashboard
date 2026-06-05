import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
const TABLE = 'shopify-colab.brillare_shopify.retention_global_settings';

export async function GET() {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${TABLE}\`
        ORDER BY setting_name
      `,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load global settings' },
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
              @setting_name AS setting_name,
              @setting_value AS setting_value,
              CURRENT_TIMESTAMP() AS updated_at
          ) S
          ON T.setting_name = S.setting_name
          WHEN MATCHED THEN UPDATE SET
            setting_value = S.setting_value,
            updated_at = S.updated_at
          WHEN NOT MATCHED THEN INSERT (
            setting_name,
            setting_value,
            updated_at
          )
          VALUES (
            S.setting_name,
            S.setting_value,
            S.updated_at
          )
        `,
        params: {
          setting_name: row.setting_name,
          setting_value: row.setting_value,
        },
      });
    }

    return NextResponse.json({ success: true, saved: rows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to save global settings' },
      { status: 500 }
    );
  }
}