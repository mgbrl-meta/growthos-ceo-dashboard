import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";


export async function GET(req: Request) {
  try {
    const { searchParams } =
      new URL(req.url);

    const start =
      searchParams.get("start");

    const end =
      searchParams.get("end");


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
      SELECT
        attribution_model,

        SUM(total_orders)
          AS total_orders,

        CAST(
          SUM(total_order_revenue)
          AS FLOAT64
        ) AS total_order_revenue,

        SUM(deterministic_orders)
          AS deterministic_orders,

        CAST(
          SUM(deterministic_revenue)
          AS FLOAT64
        ) AS deterministic_revenue,

        SAFE_MULTIPLY(
          SAFE_DIVIDE(
            SUM(deterministic_orders),
            SUM(total_orders)
          ),
          100
        ) AS deterministic_order_match_rate_pct,

        SAFE_MULTIPLY(
          SAFE_DIVIDE(
            SUM(deterministic_revenue),
            SUM(total_order_revenue)
          ),
          100
        ) AS deterministic_revenue_coverage_pct,

        SUM(attributed_orders)
          AS attributed_orders,

        SUM(attributed_revenue)
          AS attributed_revenue,

        SAFE_DIVIDE(
          SUM(
            avg_sessions_to_purchase
            *
            deterministic_orders
          ),
          SUM(deterministic_orders)
        ) AS avg_sessions_to_purchase,

        SAFE_DIVIDE(
          SUM(
            avg_marketing_touches_to_purchase
            *
            deterministic_orders
          ),
          SUM(deterministic_orders)
        ) AS avg_marketing_touches_to_purchase,

        SAFE_DIVIDE(
          SUM(
            avg_days_to_purchase
            *
            deterministic_orders
          ),
          SUM(deterministic_orders)
        ) AS avg_days_to_purchase,

        SUM(multi_session_orders)
          AS multi_session_orders,

        SUM(multi_touch_orders)
          AS multi_touch_orders

      FROM
        \`shopify-colab.brillare_shopify.attribution_overview_v1\`

      WHERE
        order_date BETWEEN @start AND @end

      GROUP BY
        attribution_model

      ORDER BY
        attributed_revenue DESC
    `;


    const [rows] =
      await bigquery.query({
        query,
        params: {
          start,
          end,
        },
      });


    return NextResponse.json({
      ok: true,

      data: {
        models: rows || [],
      },

      meta: {
        start,
        end,
      },
    });

  } catch (error: any) {
    console.error(
      "ATTRIBUTION_MODELS_API_ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to load attribution models",
      },
      {
        status: 500,
      }
    );
  }
}