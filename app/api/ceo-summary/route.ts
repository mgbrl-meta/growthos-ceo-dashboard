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


export const dynamic =
  'force-dynamic';


// ============================================================
// CEO SUMMARY
//
// Runtime enforcement:
//
// GET
// → command-center
// → viewer access required
//
// Tenant safety:
//
// Current physical table still lives inside:
//
// shopify-colab.brillare_shopify
//
// Therefore non-Brillare tenants fail closed until this data
// source is migrated to canonical multi-tenant growthos_data.
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
    // 2. LEGACY DATA TENANT FENCE
    // ========================================================

    requireLegacyBrillareDataScope(
      runtime.brandId
    );


    // ========================================================
    // 3. INPUT
    // ========================================================

    const {
      searchParams,
    } =
      new URL(
        req.url
      );


    const start =
      searchParams.get(
        'start'
      );


    const end =
      searchParams.get(
        'end'
      );


    if (
      !start
      ||
      !end
    ) {

      return NextResponse.json(
        {
          error:
            'Missing start or end date',
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 4. QUERY
    // ========================================================

    const query = `

      SELECT
        *

      FROM
        \`shopify-colab.brillare_shopify.ceo_summary_daily\`

      WHERE
        date BETWEEN @start AND @end

      ORDER BY
        date DESC

    `;


    const [
      rows,
    ] =
      await bigquery.query({

        query,

        params: {
          start,
          end,
        },

      });


    // ========================================================
    // 5. NORMALIZE RESPONSE
    //
    // Keep existing frontend contract unchanged:
    //
    // Array<Row>
    // ========================================================

    const cleanRows =
      rows.map(
        (
          row:
            any
        ) => ({

          ...row,

          date:
            row.date?.value
            ||
            row.date,

        })
      );


    return NextResponse.json(
      cleanRows
    );

  } catch (
    error:
      unknown
  ) {

    // ========================================================
    // EXPECTED AUTHORIZATION FAILURE
    //
    // 401 / 403 instead of converting access denial into 500.
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
      'CEO_SUMMARY_API_ERROR',
      error
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load CEO Summary',
      },
      {
        status:
          500,
      }
    );

  }

}