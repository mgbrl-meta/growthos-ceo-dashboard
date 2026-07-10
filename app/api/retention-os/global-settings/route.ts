import { NextRequest, NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const TABLE =
  'shopify-colab.brillare_shopify.retention_global_settings';

const LOCATION = 'asia-southeast1';

type GlobalSettingInput = {
  setting_name?: string;
  setting_value?: string | number | boolean | null;
};

export async function GET() {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${TABLE}\`
        ORDER BY setting_name
      `,
      location: LOCATION,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Global settings GET error:', error);

    return NextResponse.json(
      { error: 'Failed to load global settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: GlobalSettingInput | GlobalSettingInput[] =
      await req.json();

    const rows = Array.isArray(body) ? body : [body];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No settings were provided' },
        { status: 400 }
      );
    }

    for (const row of rows) {
      if (!row.setting_name?.trim()) {
        return NextResponse.json(
          { error: 'setting_name is required' },
          { status: 400 }
        );
      }

      await bigquery.query({
        query: `
          MERGE \`${TABLE}\` AS T
          USING (
            SELECT
              @setting_name AS setting_name,
              @setting_value AS setting_value,
              CURRENT_TIMESTAMP() AS updated_at
          ) AS S
          ON T.setting_name = S.setting_name

          WHEN MATCHED THEN
            UPDATE SET
              setting_value = S.setting_value,
              updated_at = S.updated_at

          WHEN NOT MATCHED THEN
            INSERT (
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
        location: LOCATION,
        params: {
          setting_name: row.setting_name.trim(),
          setting_value:
            row.setting_value === undefined
              ? null
              : String(row.setting_value),
        },
      });
    }

    return NextResponse.json({
      success: true,
      saved: rows.length,
    });
  } catch (error) {
    console.error('Global settings POST error:', error);

    return NextResponse.json(
      { error: 'Failed to save global settings' },
      { status: 500 }
    );
  }
}