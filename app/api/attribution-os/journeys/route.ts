import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';

import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";


export async function GET(req: Request) {

  // ==========================================================
  // RUNTIME ACCESS ENFORCEMENT
  // ==========================================================

  try {

    const runtimeAccess =
      await requireGrowthOSApiAccess(
        req
      );


    requireLegacyBrillareDataScope(
      runtimeAccess.brandId
    );

  } catch (
    accessError:
      unknown
  ) {

    const accessResponse =
      runtimeAccessErrorResponse(
        accessError
      );


    if (accessResponse) {

      return accessResponse;

    }


    throw accessError;

  }


  try {

    const { searchParams } =
      new URL(req.url);


    const start =
      searchParams.get("start");


    const end =
      searchParams.get("end");


    const model =
      searchParams.get("model")
      || "LAST_NON_DIRECT";


    const search =
      (
        searchParams.get("search")
        || ""
      ).trim();


    const requestedLimit =
      Number(
        searchParams.get("limit")
        || 50
      );


    const limit =
      Math.min(
        Math.max(
          requestedLimit,
          1
        ),
        100
      );


    if (!start || !end) {

      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing start or end date",
        },
        {
          status: 400,
        }
      );

    }


    const query = `

      -- ======================================================
      -- JOURNEY EXPLORER
      -- ======================================================

      WITH


      -- ======================================================
      -- 1. FILTER JOURNEYS
      -- ======================================================

      filtered_journeys AS (

        SELECT

          order_id,
          order_name,
          order_date,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            order_created_at
          ) AS order_created_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            previous_order_timestamp
          ) AS previous_order_timestamp,

          journey_window_type,

          customer_id,
          visitor_id,

          CAST(
            order_value
            AS FLOAT64
          ) AS order_value,

          currency,

          order_cart_id,
          gokwik_cid,

          match_status,
          resolution_status,

          converting_session_id,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            converting_session_start
          ) AS converting_session_start,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            converting_session_end
          ) AS converting_session_end,

          converting_channel,
          converting_channel_group,
          converting_source,
          converting_medium,

          converting_campaign_id,
          converting_adset_id,
          converting_adgroup_id,
          converting_ad_id,
          converting_creative_id,

          sessions_before_purchase,
          engaged_sessions_before_purchase,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            journey_started_at
          ) AS journey_started_at,

          seconds_to_purchase,
          days_to_purchase,

          session_channel_path,
          canonical_session_path,

          first_session_channel,
          first_session_campaign_id,
          first_session_adset_id,
          first_session_ad_id,
          first_entry_page,

          last_session_channel,
          last_session_deepest_stage,

          attribution_touchpoints_before_purchase,
          marketing_touches_before_purchase,
          unique_channels_before_purchase,

          touch_channel_path,

          first_touch_channel,
          first_touch_source,
          first_touch_campaign_id,
          first_touch_adset_id,
          first_touch_ad_id,
          first_touch_creative_id,

          last_touch_channel,
          last_touch_source,
          last_touch_campaign_id,
          last_touch_adset_id,
          last_touch_ad_id,
          last_touch_creative_id,

          total_events_before_purchase,
          page_views_before_purchase,
          product_views_before_purchase,
          collection_views_before_purchase,
          searches_before_purchase,
          add_to_cart_events_before_purchase,
          checkout_starts_before_purchase,

          unique_products_viewed_before_purchase,
          products_viewed_before_purchase,

          unique_products_added_before_purchase,
          products_added_before_purchase,

          pixel_version,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            generated_at
          ) AS generated_at

        FROM
          \`shopify-colab.brillare_shopify.attribution_order_journeys_v3\`

        WHERE
          order_date BETWEEN @start AND @end

          AND (
            @search = ''

            OR LOWER(
              COALESCE(
                order_name,
                ''
              )
            )
            LIKE CONCAT(
              '%',
              LOWER(@search),
              '%'
            )

            OR LOWER(
              COALESCE(
                customer_id,
                ''
              )
            )
            LIKE CONCAT(
              '%',
              LOWER(@search),
              '%'
            )

            OR LOWER(
              COALESCE(
                visitor_id,
                ''
              )
            )
            LIKE CONCAT(
              '%',
              LOWER(@search),
              '%'
            )

            OR LOWER(
              COALESCE(
                order_id,
                ''
              )
            )
            LIKE CONCAT(
              '%',
              LOWER(@search),
              '%'
            )
          )

        ORDER BY
          order_created_at DESC

        LIMIT @limit

      ),


      -- ======================================================
      -- 2. TOUCHPOINTS
      --
      -- Only query touches for the journeys selected above.
      -- ======================================================

      touches AS (

        SELECT

          tc.order_id,

          ARRAY_AGG(

            STRUCT(

              tc.touch_number
                AS touch_number,

              tc.touch_count
                AS touch_count,

              FORMAT_TIMESTAMP(
                '%Y-%m-%dT%H:%M:%SZ',
                tc.touchpoint_timestamp
              )
                AS touchpoint_timestamp,

              tc.channel
                AS channel,

              tc.channel_group
                AS channel_group,

              tc.source
                AS source,

              tc.medium
                AS medium,

              tc.campaign_id
                AS campaign_id,

              tc.adset_id
                AS adset_id,

              tc.adgroup_id
                AS adgroup_id,

              tc.assetgroup_id
                AS assetgroup_id,

              tc.ad_id
                AS ad_id,

              tc.creative_id
                AS creative_id,

              tc.keyword
                AS keyword,

              tc.placement
                AS placement,

              tc.landing_page
                AS landing_page,

              tc.touch_source_type
                AS touch_source_type,

              tc.seconds_before_order
                AS seconds_before_order,

              tc.days_before_order
                AS days_before_order,

              tc.credit_weight
                AS credit_weight,

              CAST(
                tc.attributed_revenue
                AS FLOAT64
              )
                AS attributed_revenue

            )

            ORDER BY
              tc.touchpoint_timestamp

          ) AS touchpoints

        FROM
          \`shopify-colab.brillare_shopify.attribution_touch_credits_v1\`
          AS tc

        INNER JOIN
          filtered_journeys
          AS j

          ON tc.order_id =
             j.order_id

        WHERE
          tc.attribution_model =
          @model

        GROUP BY
          tc.order_id

      )


      -- ======================================================
      -- 3. FINAL
      -- ======================================================

      SELECT

        j.*,

        IFNULL(
          t.touchpoints,
          []
        ) AS touchpoints

      FROM
        filtered_journeys
        AS j

      LEFT JOIN
        touches
        AS t

        ON j.order_id =
           t.order_id

      ORDER BY
        j.order_created_at DESC
    `;


    const [rows] =
      await bigquery.query({

        query,

        params: {
          start,
          end,
          model,
          search,
          limit,
        },

        types: {
          limit:
            "INT64",
        },

      });


    return NextResponse.json({

      ok: true,

      data: {
        journeys:
          rows || [],
      },

      meta: {
        start,
        end,
        attributionModel:
          model,

        search,

        limit,

        rowCount:
          rows?.length || 0,

        source:
          "bigquery",
      },

    });


  } catch (error: any) {

    console.error(
      "ATTRIBUTION_JOURNEYS_API_ERROR",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message
          ||
          "Failed to load journeys",
      },
      {
        status: 500,
      }
    );

  }

}