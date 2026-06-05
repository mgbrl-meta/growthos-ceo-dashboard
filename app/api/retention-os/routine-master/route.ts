import { NextRequest, NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const TABLE = 'shopify-colab.brillare_shopify.retention_routine_master';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${TABLE}\`
      ORDER BY routine, sku
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load routine master' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];

    for (const row of rows) {
      const query = `
        MERGE \`${TABLE}\` T
        USING (
          SELECT
            @routine AS routine,
            @sku AS sku,
            @required AS required,
            @weight AS weight,
            @active AS active,
            CURRENT_TIMESTAMP() AS updated_at
        ) S
        ON T.routine = S.routine AND T.sku = S.sku

        WHEN MATCHED THEN UPDATE SET
          required = S.required,
          weight = S.weight,
          active = S.active,
          updated_at = S.updated_at

        WHEN NOT MATCHED THEN INSERT (
          routine,
          sku,
          required,
          weight,
          active,
          created_at,
          updated_at
        )
        VALUES (
          S.routine,
          S.sku,
          S.required,
          S.weight,
          S.active,
          CURRENT_TIMESTAMP(),
          S.updated_at
        )
      `;

      await bigquery.query({
        query,
        params: {
          routine: row.routine,
          sku: row.sku,
          required: row.required ?? true,
          weight: Number(row.weight || 0),
          active: row.active ?? true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      saved: rows.length,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to save routine master' },
      { status: 500 }
    );
  }
}
