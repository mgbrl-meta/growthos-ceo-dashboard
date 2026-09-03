import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const model =
      searchParams.get("model") ||
      "LAST_NON_DIRECT";

    if (!start || !end) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing start or end date",
        },
        {
          status: 400,
        }
      );
    }

    const query = `

      -- ======================================================
      -- ATTRIBUTION OVERVIEW
      --
      -- Growth OS direct BigQuery data contract
      -- ======================================================

      WITH


      -- ======================================================
      -- 1. OVERVIEW
      -- ======================================================

      overview_base AS (

        SELECT
          order_date,
          attribution_model,

          total_orders,
          CAST(total_order_revenue AS FLOAT64)
            AS total_order_revenue,

          deterministic_orders,
          CAST(deterministic_revenue AS FLOAT64)
            AS deterministic_revenue,

          unmatched_orders,
          CAST(unmatched_revenue AS FLOAT64)
            AS unmatched_revenue,

          no_cart_token_orders,

          attributed_orders,
          attributed_revenue,

          avg_sessions_to_purchase,
          avg_marketing_touches_to_purchase,
          avg_days_to_purchase,

          multi_session_orders,
          multi_touch_orders

        FROM
          \`shopify-colab.brillare_shopify.attribution_overview_v1\`

        WHERE
          order_date BETWEEN @start AND @end

          AND attribution_model = @model

      ),


      overview_summary AS (

        SELECT

          COALESCE(
            SUM(total_orders),
            0
          ) AS total_orders,


          COALESCE(
            SUM(total_order_revenue),
            0
          ) AS total_order_revenue,


          COALESCE(
            SUM(deterministic_orders),
            0
          ) AS deterministic_orders,


          COALESCE(
            SUM(deterministic_revenue),
            0
          ) AS deterministic_revenue,


          SAFE_MULTIPLY(
            SAFE_DIVIDE(
              SUM(deterministic_orders),
              SUM(total_orders)
            ),
            100
          ) AS match_rate_pct,


          SAFE_MULTIPLY(
            SAFE_DIVIDE(
              SUM(deterministic_revenue),
              SUM(total_order_revenue)
            ),
            100
          ) AS revenue_coverage_pct,


          COALESCE(
            SUM(unmatched_orders),
            0
          ) AS unmatched_orders,


          COALESCE(
            SUM(no_cart_token_orders),
            0
          ) AS no_cart_token_orders,


          COALESCE(
            SUM(attributed_orders),
            0
          ) AS attributed_orders,


          COALESCE(
            SUM(attributed_revenue),
            0
          ) AS attributed_revenue,


          SAFE_DIVIDE(

            SUM(
              avg_sessions_to_purchase
              *
              deterministic_orders
            ),

            SUM(
              deterministic_orders
            )

          ) AS avg_sessions_to_purchase,


          SAFE_DIVIDE(

            SUM(
              avg_marketing_touches_to_purchase
              *
              deterministic_orders
            ),

            SUM(
              deterministic_orders
            )

          ) AS avg_marketing_touches_to_purchase,


          SAFE_DIVIDE(

            SUM(
              avg_days_to_purchase
              *
              deterministic_orders
            ),

            SUM(
              deterministic_orders
            )

          ) AS avg_days_to_purchase,


          COALESCE(
            SUM(multi_session_orders),
            0
          ) AS multi_session_orders,


          COALESCE(
            SUM(multi_touch_orders),
            0
          ) AS multi_touch_orders

        FROM
          overview_base

      ),


      -- ======================================================
      -- 2. NEW VS REPEAT
      -- ======================================================

      new_repeat AS (

        SELECT

          tracked_customer_type,

          SUM(orders)
            AS orders,

          SUM(customers)
            AS customers,

          CAST(
            SUM(revenue)
            AS FLOAT64
          ) AS revenue,

          SAFE_DIVIDE(
            SUM(revenue),
            SUM(orders)
          ) AS avg_order_value

        FROM
          \`shopify-colab.brillare_shopify.attribution_new_repeat_v1\`

        WHERE
          order_date BETWEEN @start AND @end

        GROUP BY
          tracked_customer_type

      ),


      -- ======================================================
      -- 3. JOURNEY PATHS
      --
      -- Use order journeys rather than the all-history
      -- journey-pattern view so date filtering is correct.
      -- ======================================================

      journey_paths AS (

        SELECT

          COALESCE(
            NULLIF(
              touch_channel_path,
              ''
            ),
            'Unknown'
          ) AS journey_path,

          COUNT(*)
            AS orders,

          COUNT(
            DISTINCT visitor_id
          ) AS visitors,

          CAST(
            SUM(order_value)
            AS FLOAT64
          ) AS revenue,

          AVG(
            sessions_before_purchase
          ) AS avg_sessions,

          AVG(
            marketing_touches_before_purchase
          ) AS avg_marketing_touches,

          AVG(
            days_to_purchase
          ) AS avg_days_to_purchase

        FROM
          \`shopify-colab.brillare_shopify.attribution_order_journeys_v3\`

        WHERE
          order_date BETWEEN @start AND @end

        GROUP BY
          journey_path

        ORDER BY
          orders DESC

        LIMIT 10

      ),


      -- ======================================================
      -- 4. CHANNEL PERFORMANCE
      -- ======================================================

      channel_performance AS (

        SELECT

          COALESCE(
            NULLIF(
              channel,
              ''
            ),
            'unknown'
          ) AS channel,

          COALESCE(
            NULLIF(
              channel_group,
              ''
            ),
            'unknown'
          ) AS channel_group,

          SUM(
            assisted_orders
          ) AS assisted_orders,

          SUM(
            credited_orders
          ) AS credited_orders,

          SUM(
            equivalent_order_credits
          ) AS equivalent_order_credits,

          SUM(
            attributed_revenue
          ) AS attributed_revenue

        FROM
          \`shopify-colab.brillare_shopify.attribution_channel_daily_v1\`

        WHERE
          order_date BETWEEN @start AND @end

          AND attribution_model = @model

        GROUP BY
          channel,
          channel_group

        ORDER BY
          attributed_revenue DESC

      ),


      -- ======================================================
      -- 5. CHANNEL JOURNEY ROLES
      --
      -- Starter = first touch
      -- Assist  = middle touch
      -- Closer  = final touch
      -- ======================================================

      channel_roles AS (

        SELECT

          COALESCE(
            NULLIF(
              channel,
              ''
            ),
            'unknown'
          ) AS channel,


          COUNT(
            DISTINCT IF(
              touch_number = 1,
              order_id,
              NULL
            )
          ) AS starter_orders,


          COUNT(
            DISTINCT IF(
              touch_number > 1
              AND
              touch_number < touch_count,
              order_id,
              NULL
            )
          ) AS assist_orders,


          COUNT(
            DISTINCT IF(
              touch_number = touch_count,
              order_id,
              NULL
            )
          ) AS closer_orders

        FROM
          \`shopify-colab.brillare_shopify.attribution_touch_credits_v1\`

        WHERE
          order_date BETWEEN @start AND @end

          AND attribution_model = @model

        GROUP BY
          channel

      ),


      -- ======================================================
      -- 6. CREATIVE INTELLIGENCE
      -- ======================================================

      creative_performance AS (

        SELECT

          COALESCE(
            NULLIF(
              channel,
              ''
            ),
            'unknown'
          ) AS channel,

          campaign_id,
          adset_id,
          ad_id,
          creative_id,

          SUM(
            assisted_orders
          ) AS assisted_orders,

          SUM(
            converting_visitors
          ) AS converting_visitors,

          SUM(
            equivalent_order_credits
          ) AS equivalent_order_credits,

          SUM(
            attributed_revenue
          ) AS attributed_revenue

        FROM
          \`shopify-colab.brillare_shopify.attribution_creative_daily_v1\`

        WHERE
          order_date BETWEEN @start AND @end

          AND attribution_model = @model

        GROUP BY
          channel,
          campaign_id,
          adset_id,
          ad_id,
          creative_id

        ORDER BY
          attributed_revenue DESC

        LIMIT 20

      ),


      -- ======================================================
      -- 7. CURRENT DATA QUALITY
      --
      -- This is current infrastructure health, not a
      -- historical date-range metric.
      -- ======================================================

      health AS (

        SELECT

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            checked_at
          ) AS checked_at,

          raw_events,
          raw_visitors,

          marketing_touchpoints,

          sessionized_events,
          sessionized_visitors,

          raw_events_not_sessionized,
          visitors_not_sessionized,

          sessionization_coverage_pct,

          canonical_sessions,
          canonical_visitors,

          realtime_orders,

          orders_with_cart_token,
          exact_orders,
          ambiguous_orders,
          unmatched_orders,
          no_cart_token_orders,

          all_history_cart_token_coverage_pct,
          all_history_exact_match_rate_pct,
          exact_match_when_cart_available_pct,
          canonical_session_resolution_pct,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            latest_raw_event
          ) AS latest_raw_event,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            latest_realtime_order
          ) AS latest_realtime_order

        FROM
          \`shopify-colab.brillare_shopify.attribution_tracking_health_v1\`

        ORDER BY
          checked_at DESC

        LIMIT 1

      )


      -- ======================================================
      -- FINAL DATA CONTRACT
      -- ======================================================

      SELECT

        (
          SELECT AS STRUCT *
          FROM overview_summary
        ) AS summary,


        ARRAY(
          SELECT AS STRUCT *
          FROM new_repeat
        ) AS new_repeat,


        ARRAY(
          SELECT AS STRUCT *
          FROM journey_paths
        ) AS journey_paths,


        ARRAY(
          SELECT AS STRUCT *
          FROM channel_performance
        ) AS channel_performance,


        ARRAY(
          SELECT AS STRUCT *
          FROM channel_roles
        ) AS channel_roles,


        ARRAY(
          SELECT AS STRUCT *
          FROM creative_performance
        ) AS creatives,


        (
          SELECT AS STRUCT *
          FROM health
        ) AS health
    `;


    const [rows] =
      await bigquery.query({
        query,

        params: {
          start,
          end,
          model,
        },
      });


    const result =
      rows?.[0] || {};


    return NextResponse.json({

      ok: true,

      data: {

        summary:
          result.summary ||
          {},

        newRepeat:
          result.new_repeat ||
          [],

        journeyPaths:
          result.journey_paths ||
          [],

        channelPerformance:
          result.channel_performance ||
          [],

        channelRoles:
          result.channel_roles ||
          [],

        creatives:
          result.creatives ||
          [],

        health:
          result.health ||
          null,
      },

      meta: {
        start,
        end,
        attributionModel:
          model,

        source:
          "bigquery",
      },

    });

  } catch (error: any) {

    console.error(
      "ATTRIBUTION_OVERVIEW_API_ERROR",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          "Failed to load attribution overview",
      },
      {
        status: 500,
      }
    );
  }
}