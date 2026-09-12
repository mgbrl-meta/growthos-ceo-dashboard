import {
  NextResponse,
} from 'next/server';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';


const PROJECT =
  'shopify-colab';

const DATASET =
  'brillare_shopify';

const SOURCE_TABLE =
  'retention_unmapped_products_tbl';

const LOCATION =
  'asia-southeast1';


export const dynamic =
  'force-dynamic';


// ============================================================
// RETENTION OS — UNMAPPED PRODUCTS
//
// Runtime policy:
//
// GET
// → retention
// → settings
// → viewer access required
//
// This table still lives inside the legacy Brillare dataset,
// therefore non-Brillare tenants must fail closed.
// ============================================================

export async function GET(
  req:
    Request
) {

  try {

    // ========================================================
    // 1. AUTHENTICATE + AUTHORIZE
    // ========================================================

    const runtime =
      await requireGrowthOSApiAccess(
        req
      );


    // ========================================================
    // 2. LEGACY TENANT FENCE
    // ========================================================

    requireLegacyBrillareDataScope(
      runtime.brandId
    );


    // ========================================================
    // 3. QUERY
    // ========================================================

    const query = `

      SELECT

        sku,

        product_title,

        orders,

        customers,

        revenue,

        last_sold_at

      FROM
        \`${PROJECT}.${DATASET}.${SOURCE_TABLE}\`

      ORDER BY
        revenue DESC

      LIMIT
        100

    `;


    // ========================================================
    // 4. BIGQUERY
    // ========================================================

    const [
      rows,
    ] =
      await bigquery.query({

        query,

        location:
          LOCATION,

      });


    // ========================================================
    // 5. RESPONSE
    //
    // Preserve existing frontend contract:
    //
    // Array<Row>
    // ========================================================

    return NextResponse.json(
      rows
    );

  } catch (
    error:
      unknown
  ) {

    // ========================================================
    // EXPECTED AUTHORIZATION FAILURE
    // ========================================================

    const accessResponse =
      runtimeAccessErrorResponse(
        error
      );


    if (
      accessResponse
    ) {

      return accessResponse;

    }


    // ========================================================
    // UNEXPECTED FAILURE
    // ========================================================

    console.error(
      'RETENTION_UNMAPPED_PRODUCTS_API_ERROR',
      error
    );


    return NextResponse.json(
      {

        error:
          'Failed to load unmapped products snapshot table',

        sourceTable:
          SOURCE_TABLE,

      },
      {
        status:
          500,
      }
    );

  }

}