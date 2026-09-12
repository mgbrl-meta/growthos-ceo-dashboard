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
// GOOGLE OS — CAMPAIGN
//
// Runtime policy:
//
// GET
// → google
// → campaign
// → viewer access required
//
// Current physical source:
//
// shopify-colab.brillare_shopify
//
// therefore legacy tenant fencing remains mandatory until
// Google OS is moved to canonical multi-tenant growthos_data.
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
    // 2. TENANT SAFETY
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
            'Missing dates',
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

          campaign_name,

          channel_type,

          SUM(
            impressions
          ) AS impressions,

          SUM(
            clicks
          ) AS clicks,

          SUM(
            cost
          ) AS spend,

          SUM(
            conversions
          ) AS conversions,

          SUM(
            conversion_value
          ) AS revenue

        FROM
          \`shopify-colab.brillare_shopify.google_campaign_daily_raw\`

        WHERE
          date BETWEEN @start AND @end

        GROUP BY

          campaign_name,
          channel_type

      ),


      account AS (

        SELECT

          SUM(
            spend
          ) AS spend,

          SUM(
            revenue
          ) AS revenue,

          SUM(
            conversions
          ) AS conversions,

          SAFE_DIVIDE(
            SUM(revenue),
            SUM(spend)
          ) AS account_roas,

          SAFE_DIVIDE(
            SUM(spend),
            SUM(conversions)
          ) AS account_cpa

        FROM
          base

      ),


      channel AS (

        SELECT

          channel_type,

          SUM(
            spend
          ) AS spend,

          SUM(
            revenue
          ) AS revenue,

          SAFE_DIVIDE(
            SUM(revenue),
            SUM(spend)
          ) AS channel_roas,

          SAFE_DIVIDE(
            SUM(spend),
            SUM(conversions)
          ) AS channel_cpa

        FROM
          base

        GROUP BY
          channel_type

      ),


      final AS (

        SELECT

          b.*,


          SAFE_DIVIDE(
            b.revenue,
            b.spend
          ) AS roas,


          SAFE_DIVIDE(
            b.spend,
            b.conversions
          ) AS cpa,


          SAFE_DIVIDE(
            b.clicks,
            b.impressions
          ) AS ctr,


          SAFE_DIVIDE(
            b.conversions,
            b.clicks
          ) AS cvr,


          SAFE_DIVIDE(
            b.revenue,
            b.clicks
          ) AS rpc,


          SAFE_DIVIDE(
            b.spend,
            (
              SELECT
                spend
              FROM
                account
            )
          ) AS spend_share,


          SAFE_DIVIDE(
            b.revenue,
            (
              SELECT
                revenue
              FROM
                account
            )
          ) AS revenue_share,


          SAFE_DIVIDE(
            b.revenue,
            (
              SELECT
                revenue
              FROM
                account
            )
          )
          -
          SAFE_DIVIDE(
            b.spend,
            (
              SELECT
                spend
              FROM
                account
            )
          ) AS efficiency_gap,


          (
            SELECT
              account_roas
            FROM
              account
          ) AS account_roas,


          (
            SELECT
              account_cpa
            FROM
              account
          ) AS account_cpa,


          c.channel_roas,

          c.channel_cpa

        FROM
          base b

        LEFT JOIN
          channel c

          ON
            b.channel_type =
            c.channel_type

      )


      SELECT

        ARRAY(

          SELECT AS STRUCT

            campaign_name,

            channel_type,

            impressions,

            clicks,

            spend,

            revenue,

            conversions,

            roas,

            cpa,

            ctr,

            cvr,

            rpc,

            spend_share,

            revenue_share,

            efficiency_gap,

            account_roas,

            channel_roas,


            SAFE_DIVIDE(
              roas,
              account_roas
            ) AS roas_index_account,


            SAFE_DIVIDE(
              roas,
              channel_roas
            ) AS roas_index_channel,


            CASE

              WHEN
                roas >
                  account_roas

                AND
                roas >
                  channel_roas

                AND
                efficiency_gap >
                  0

              THEN
                'SCALE'


              WHEN
                roas <
                  account_roas

                AND
                roas <
                  channel_roas

                AND
                efficiency_gap <
                  0

              THEN
                'REDUCE'


              WHEN
                roas <
                  account_roas

                AND
                roas >
                  channel_roas

              THEN
                'HOLD'


              ELSE
                'WATCH'

            END AS action

          FROM
            final

          ORDER BY
            spend DESC

        ) AS campaigns,


        (
          SELECT AS STRUCT
            *
          FROM
            account
        ) AS totals

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


    // ========================================================
    // 6. RESPONSE
    //
    // Existing frontend contract remains unchanged.
    // ========================================================

    return NextResponse.json({

      totals:
        data.totals
        ||
        {},

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
    // EXPECTED AUTH / ACCESS FAILURE
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

        : 'Unknown Google Campaign API error';


    console.error(
      'GOOGLE_CAMPAIGN_API_ERROR',
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