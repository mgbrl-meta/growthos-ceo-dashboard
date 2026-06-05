import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

const TABLE = 'shopify-colab.brillare_shopify.retention_opportunity_settings';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${TABLE}\`
      ORDER BY opportunity_type
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load opportunity settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];

    for (const row of rows) {
      const oldQuery = `
        SELECT confidence
        FROM \`${TABLE}\`
        WHERE opportunity_type = @opportunity_type
        LIMIT 1
      `;

      const [oldRows] = await bigquery.query({
        query: oldQuery,
        params: {
          opportunity_type: row.opportunity_type,
        },
      });

      const oldConfidence = Number((oldRows as any[])?.[0]?.confidence || 0);
      const newConfidence = Number(row.confidence || 0);

      const query = `
        MERGE \`${TABLE}\` T
        USING (
          SELECT
            @opportunity_type AS opportunity_type,
            @estimated_aov AS estimated_aov,
            @estimated_profit_per_customer AS estimated_profit_per_customer,
            @confidence AS confidence,
            @difficulty AS difficulty,
            @active AS active,
            CURRENT_TIMESTAMP() AS updated_at
        ) S
        ON T.opportunity_type = S.opportunity_type

        WHEN MATCHED THEN UPDATE SET
          estimated_aov = S.estimated_aov,
          estimated_profit_per_customer = S.estimated_profit_per_customer,
          confidence = S.confidence,
          difficulty = S.difficulty,
          active = S.active,
          updated_at = S.updated_at

        WHEN NOT MATCHED THEN INSERT (
          opportunity_type,
          estimated_aov,
          estimated_profit_per_customer,
          confidence,
          difficulty,
          active,
          updated_at
        )
        VALUES (
          S.opportunity_type,
          S.estimated_aov,
          S.estimated_profit_per_customer,
          S.confidence,
          S.difficulty,
          S.active,
          S.updated_at
        )
      `;

      await bigquery.query({
        query,
        params: {
          opportunity_type: row.opportunity_type,
          estimated_aov: Number(row.estimated_aov || 0),
          estimated_profit_per_customer: Number(
            row.estimated_profit_per_customer || 0
          ),
          confidence: newConfidence,
          difficulty: row.difficulty,
          active: row.active ?? true,
        },
      });

      if (oldConfidence !== newConfidence) {
        const logQuery = `
          INSERT INTO \`shopify-colab.brillare_shopify.retention_confidence_change_log\` (
            change_id,
            opportunity_type,
            old_confidence,
            new_confidence,
            reason,
            created_at,
            created_by
          )
          VALUES (
            GENERATE_UUID(),
            @opportunity_type,
            @old_confidence,
            @new_confidence,
            @reason,
            CURRENT_TIMESTAMP(),
            'Retention OS'
          )
        `;

        await bigquery.query({
          query: logQuery,
          params: {
            opportunity_type: row.opportunity_type,
            old_confidence: oldConfidence,
            new_confidence: newConfidence,
            reason: row.reason || 'Manual or learning-based confidence update',
          },
        });
      }
    }

    return NextResponse.json({ success: true, saved: rows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to save opportunity settings' },
      { status: 500 }
    );
  }
}