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
// GOOGLE OS — SEARCH TERMS
//
// Runtime policy:
//
// GET
// → google
// → search-terms
// → viewer access required
//
// Current physical source still lives inside Brillare's
// legacy dataset, therefore tenant fencing is mandatory.
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


    const campaign =
      searchParams.get(
        'campaign'
      )
      ||
      '';


    const adGroup =
      searchParams.get(
        'adGroup'
      )
      ||
      '';


    const targetRoas =
      Number(
        searchParams.get(
          'targetRoas'
        )
        ||
        2
      );


    const minSpend =
      Number(
        searchParams.get(
          'minSpend'
        )
        ||
        1000
      );


    const minClicks =
      Number(
        searchParams.get(
          'minClicks'
        )
        ||
        20
      );


    const negativeSpend =
      Number(
        searchParams.get(
          'negativeSpend'
        )
        ||
        500
      );


    const negativeClicks =
      Number(
        searchParams.get(
          'negativeClicks'
        )
        ||
        15
      );


    const positiveConversions =
      Number(
        searchParams.get(
          'positiveConversions'
        )
        ||
        2
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

      WITH all_data AS (

        SELECT

          date,

          campaign_name,

          ad_group_name,

          search_term,

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
          \`shopify-colab.brillare_shopify.google_search_term_daily_raw\`

        WHERE

          (
            @campaign = ''
            OR campaign_name = @campaign
          )

          AND
          (
            @adGroup = ''
            OR ad_group_name = @adGroup
          )

      ),


      lifetime AS (

        SELECT

          campaign_name,

          ad_group_name,

          search_term,

          MIN(
            date
          ) AS first_seen_date,

          MAX(
            date
          ) AS last_seen_date

        FROM
          all_data

        GROUP BY

          campaign_name,

          ad_group_name,

          search_term

      ),


      period AS (

        SELECT

          campaign_name,

          ad_group_name,

          search_term,

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
          all_data

        WHERE
          date BETWEEN @start AND @end

        GROUP BY

          campaign_name,

          ad_group_name,

          search_term

      ),


      latest_review AS (

        SELECT

          campaign_name,

          ad_group_name,

          search_term,

          ARRAY_AGG(

            STRUCT(

              review_status,

              review_action,

              reviewed_at,

              reviewed_by,

              notes

            )

            ORDER BY
              reviewed_at DESC

            LIMIT
              1

          )[OFFSET(0)] AS latest

        FROM
          \`shopify-colab.brillare_shopify.google_search_term_reviews\`

        GROUP BY

          campaign_name,

          ad_group_name,

          search_term

      ),


      final AS (

        SELECT

          p.campaign_name,

          p.ad_group_name,

          p.search_term,

          l.first_seen_date,

          l.last_seen_date,

          p.impressions,

          p.clicks,

          p.spend,

          p.conversions,

          p.revenue,


          SAFE_DIVIDE(
            p.revenue,
            p.spend
          ) AS roas,


          SAFE_DIVIDE(
            p.spend,
            p.conversions
          ) AS cpa,


          SAFE_DIVIDE(
            p.revenue,
            p.clicks
          ) AS rpc,


          SAFE_DIVIDE(
            p.conversions,
            p.clicks
          ) AS cvr,


          SAFE_DIVIDE(
            p.clicks,
            p.impressions
          ) AS ctr,


          COALESCE(
            r.latest.review_status,
            'unchecked'
          ) AS review_status,


          r.latest.review_action,

          r.latest.reviewed_at,

          r.latest.reviewed_by,

          r.latest.notes,


          CASE

            WHEN
              r.latest.reviewed_at IS NULL

            THEN
              'UNREVIEWED'


            WHEN
              l.first_seen_date >
                DATE(
                  r.latest.reviewed_at
                )

            THEN
              'NEW_SINCE_LAST_REVIEW'


            WHEN
              l.last_seen_date >
                DATE(
                  r.latest.reviewed_at
                )

            THEN
              'EXISTING_WITH_NEW_ACTIVITY'


            ELSE
              'ALREADY_REVIEWED'

          END AS review_bucket


        FROM
          period p


        LEFT JOIN
          lifetime l

          ON
            p.campaign_name =
              l.campaign_name

            AND
            p.ad_group_name =
              l.ad_group_name

            AND
            p.search_term =
              l.search_term


        LEFT JOIN
          latest_review r

          ON
            p.campaign_name =
              r.campaign_name

            AND
            p.ad_group_name =
              r.ad_group_name

            AND
            p.search_term =
              r.search_term

      ),


      classified AS (

        SELECT

          *,


          CASE

            WHEN
              conversions = 0
              AND spend >= @negativeSpend

            THEN
              'ADD_NEGATIVE'


            WHEN
              conversions = 0
              AND clicks >= @negativeClicks

            THEN
              'ADD_NEGATIVE'


            WHEN
              conversions >= @positiveConversions
              AND roas >= @targetRoas

            THEN
              'SCALE_EXACT'


            WHEN
              clicks >= @minClicks
              AND conversions <= 1
              AND spend >= @minSpend

            THEN
              'FIX_FUNNEL'


            WHEN
              clicks >= 10
              AND conversions > 0
              AND roas < @targetRoas

            THEN
              'TEST_MORE'


            ELSE
              'MONITOR'

          END AS suggested_action,


          CASE

            WHEN
              conversions = 0

            THEN
              spend


            WHEN
              roas >= @targetRoas

            THEN
              revenue


            ELSE
              spend * 0.25

          END AS priority_score


        FROM
          final

      )


      SELECT

        ARRAY(

          SELECT AS STRUCT
            *

          FROM
            classified

          ORDER BY
            priority_score DESC

          LIMIT
            500

        ) AS search_terms,


        (

          SELECT AS STRUCT

            SUM(
              spend
            ) AS spend,

            SUM(
              revenue
            ) AS revenue,

            SUM(
              conversions
            ) AS conversions,

            COUNT(
              *
            ) AS total_terms,


            COUNTIF(
              suggested_action =
                'ADD_NEGATIVE'
            ) AS negative_candidates,


            COUNTIF(
              suggested_action =
                'SCALE_EXACT'
            ) AS positive_candidates,


            COUNTIF(
              review_bucket =
                'UNREVIEWED'
            ) AS unreviewed_terms,


            COUNTIF(
              review_bucket =
                'EXISTING_WITH_NEW_ACTIVITY'
            ) AS existing_with_new_activity,


            SUM(

              CASE

                WHEN
                  suggested_action =
                    'ADD_NEGATIVE'

                THEN
                  spend

                ELSE
                  0

              END

            ) AS wasted_spend

          FROM
            classified

        ) AS summary

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

          campaign,

          adGroup,

          targetRoas,

          minSpend,

          minClicks,

          negativeSpend,

          negativeClicks,

          positiveConversions,

        },

      });


    const data =
      rows?.[0]
      ||
      {};


    // ========================================================
    // 6. RESPONSE
    //
    // Existing frontend contract preserved.
    // ========================================================

    return NextResponse.json({

      summary:
        data.summary
        ||
        {},

      rows:
        data.search_terms
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

        : 'Unknown Google Search Terms API error';


    console.error(
      'GOOGLE_SEARCH_TERMS_API_ERROR',
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