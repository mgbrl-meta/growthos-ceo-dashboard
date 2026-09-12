import {
  NextResponse,
} from 'next/server';

import {
  BigQuery,
} from '@google-cloud/bigquery';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';


export const dynamic =
  'force-dynamic';


const bigquery =
  new BigQuery({

    projectId:
      process.env.GCP_PROJECT_ID,

    credentials: {

      client_email:
        process.env.GCP_CLIENT_EMAIL,

      private_key:
        process.env.GCP_PRIVATE_KEY
          ?.replace(
            /\\n/g,
            '\n'
          ),

    },

  });


// ============================================================
// GOOGLE OS — OVERVIEW
//
// Runtime policy:
//
// GET
// → google
// → overview
// → viewer access required
//
// Current physical source still lives in Brillare's legacy
// dataset, so tenant fencing remains mandatory.
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

      WITH base AS (

        SELECT

          date,

          campaign_name,

          channel_type,

          COALESCE(
            impressions,
            0
          ) AS impressions,

          COALESCE(
            clicks,
            0
          ) AS clicks,

          COALESCE(
            cost,
            0
          ) AS spend,

          COALESCE(
            conversions,
            0
          ) AS conversions,

          COALESCE(
            conversion_value,
            0
          ) AS revenue

        FROM
          \`shopify-colab.brillare_shopify.google_campaign_daily_raw\`

        WHERE
          date BETWEEN @start AND @end

      ),


      totals AS (

        SELECT

          SUM(
            impressions
          ) AS impressions,

          SUM(
            clicks
          ) AS clicks,

          SUM(
            spend
          ) AS spend,

          SUM(
            conversions
          ) AS conversions,

          SUM(
            revenue
          ) AS revenue

        FROM
          base

      ),


      channel_mix AS (

        SELECT

          channel_type,

          SUM(
            impressions
          ) AS impressions,

          SUM(
            clicks
          ) AS clicks,

          SUM(
            spend
          ) AS spend,

          SUM(
            conversions
          ) AS conversions,

          SUM(
            revenue
          ) AS revenue

        FROM
          base

        GROUP BY
          channel_type

      ),


      campaign_snapshot AS (

        SELECT

          campaign_name,

          channel_type,

          SUM(
            impressions
          ) AS impressions,

          SUM(
            clicks
          ) AS clicks,

          SUM(
            spend
          ) AS spend,

          SUM(
            conversions
          ) AS conversions,

          SUM(
            revenue
          ) AS revenue

        FROM
          base

        GROUP BY

          campaign_name,

          channel_type

        ORDER BY
          spend DESC

        LIMIT
          5

      )


      SELECT

        (
          SELECT AS STRUCT
            *
          FROM
            totals
        ) AS totals,


        ARRAY(

          SELECT AS STRUCT

            channel_type,

            impressions,

            clicks,

            spend,

            revenue,

            conversions,


            SAFE_DIVIDE(
              revenue,
              spend
            ) AS roas,


            SAFE_DIVIDE(
              spend,
              conversions
            ) AS cpa,


            SAFE_DIVIDE(
              clicks,
              impressions
            ) AS ctr,


            SAFE_DIVIDE(
              conversions,
              clicks
            ) AS cvr,


            SAFE_DIVIDE(
              revenue,
              clicks
            ) AS rpc,


            SAFE_DIVIDE(
              spend,
              (
                SELECT
                  spend
                FROM
                  totals
              )
            ) AS spend_share,


            SAFE_DIVIDE(
              revenue,
              (
                SELECT
                  revenue
                FROM
                  totals
              )
            ) AS revenue_share,


            (
              SAFE_DIVIDE(
                revenue,
                (
                  SELECT
                    revenue
                  FROM
                    totals
                )
              )
              -
              SAFE_DIVIDE(
                spend,
                (
                  SELECT
                    spend
                  FROM
                    totals
                )
              )
            ) AS efficiency_gap

          FROM
            channel_mix

          ORDER BY
            spend DESC

        ) AS channel_mix,


        ARRAY(

          SELECT AS STRUCT

            campaign_name,

            channel_type,

            impressions,

            clicks,

            spend,

            revenue,

            conversions,


            SAFE_DIVIDE(
              revenue,
              spend
            ) AS roas,


            SAFE_DIVIDE(
              spend,
              conversions
            ) AS cpa,


            SAFE_DIVIDE(
              clicks,
              impressions
            ) AS ctr,


            SAFE_DIVIDE(
              conversions,
              clicks
            ) AS cvr,


            SAFE_DIVIDE(
              revenue,
              clicks
            ) AS rpc

          FROM
            campaign_snapshot

          ORDER BY
            spend DESC

        ) AS campaigns

    `;


    // ========================================================
    // 5. BIGQUERY
    // ========================================================

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


    const data =
      rows?.[0]
      ||
      {};


    const totals =
      data.totals
      ||
      {};


    // ========================================================
    // 6. RESPONSE
    //
    // Existing frontend response contract preserved exactly.
    // ========================================================

    return NextResponse.json({

      totals: {

        spend:
          totals.spend
          ||
          0,

        revenue:
          totals.revenue
          ||
          0,

        conversions:
          totals.conversions
          ||
          0,

        impressions:
          totals.impressions
          ||
          0,

        clicks:
          totals.clicks
          ||
          0,

        roas:
          totals.spend

            ? totals.revenue /
              totals.spend

            : 0,

        cpa:
          totals.conversions

            ? totals.spend /
              totals.conversions

            : 0,

        rpc:
          totals.clicks

            ? totals.revenue /
              totals.clicks

            : 0,

        cvr:
          totals.clicks

            ? totals.conversions /
              totals.clicks

            : 0,

        ctr:
          totals.impressions

            ? totals.clicks /
              totals.impressions

            : 0,

      },


      channel_mix:
        data.channel_mix
        ||
        [],


      campaigns:
        data.campaigns
        ||
        [],

    });

  } catch (
    error:
      unknown
  ) {

    // ========================================================
    // EXPECTED AUTH / PERMISSION FAILURE
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

    const message =
      error instanceof Error

        ? error.message

        : 'Unknown Google Overview API error';


    console.error(
      'GOOGLE_OVERVIEW_API_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          500,
      }
    );

  }

}