import { NextRequest, NextResponse } from 'next/server';
import { bigquery } from '@/lib/bigquery';

const TABLE = 'shopify-colab.brillare_shopify.retention_product_master';

export async function GET() {
  try {
    const query = `
      SELECT *
      FROM \`${TABLE}\`
      ORDER BY product_title
    `;

    const [rows] = await bigquery.query({ query });

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Failed to load product mappings' },
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
            @sku AS sku,
            @product_title AS product_title,
            @category AS category,
            @routine AS routine,
            @role AS role,
            @active AS active,
            @product_family AS product_family,
            @product_sub_category AS product_sub_category,
            @product_type AS product_type,
            @routine_step AS routine_step,
            @replenishment_days AS replenishment_days,
            @bundle_components AS bundle_components,
            CURRENT_TIMESTAMP() AS updated_at
        ) S
        ON T.sku = S.sku

        WHEN MATCHED THEN UPDATE SET
          product_title = S.product_title,
          category = S.category,
          routine = S.routine,
          role = S.role,
          active = S.active,
          product_family = S.product_family,
          product_sub_category = S.product_sub_category,
          product_type = S.product_type,
          routine_step = S.routine_step,
          replenishment_days = S.replenishment_days,
          bundle_components = S.bundle_components,
          updated_at = S.updated_at

        WHEN NOT MATCHED THEN INSERT (
          sku,
          product_title,
          category,
          routine,
          role,
          active,
          created_at,
          updated_at,
          created_by,
          product_family,
          product_sub_category,
          product_type,
          routine_step,
          replenishment_days,
          bundle_components
        )
        VALUES (
          S.sku,
          S.product_title,
          S.category,
          S.routine,
          S.role,
          S.active,
          CURRENT_TIMESTAMP(),
          S.updated_at,
          'Retention OS',
          S.product_family,
          S.product_sub_category,
          S.product_type,
          S.routine_step,
          S.replenishment_days,
          S.bundle_components
        )
      `;

      await bigquery.query({
        query,
        params: {
          sku: row.sku || '',
          product_title: row.product_title || '',
          category: row.category || '',
          routine: row.routine || '',
          role: row.product_type === 'Bundle' ? 'Bundle' : row.role || '',
          active: row.active ?? true,

          product_family: row.product_family || '',
          product_sub_category:
            row.product_sub_category || '',
          product_type: row.product_type || 'Single',

          routine_step:
            row.product_type === 'Bundle' || row.routine_step === ''
              ? 0
              : Number(row.routine_step || 0),

          replenishment_days:
            row.replenishment_days === '' || row.replenishment_days == null
              ? 0
              : Number(row.replenishment_days),

          bundle_components:
            row.product_type === 'Bundle'
              ? row.bundle_components || ''
              : '',
        }
      });
    }

    return NextResponse.json({
      success: true,
      saved: rows.length,
    });
  } catch (error: any) {
    console.error('Product mapping save error:', error?.message || error);

    return NextResponse.json(
      {
        error: 'Failed to save product mappings',
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
