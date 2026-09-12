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
      WITH channel_base AS (
        SELECT
          COALESCE(NULLIF(channel, ''), 'unknown') AS channel,

          ANY_VALUE(
            COALESCE(NULLIF(channel_group, ''), 'unknown')
          ) AS channel_group,

          SUM(assisted_orders)
            AS assisted_orders,

          SUM(credited_orders)
            AS credited_orders,

          SUM(credited_touch_rows)
            AS credited_touch_rows,

          SUM(equivalent_order_credits)
            AS equivalent_order_credits,

          SUM(attributed_revenue)
            AS attributed_revenue

        FROM
          \`shopify-colab.brillare_shopify.attribution_channel_daily_v1\`

        WHERE
          order_date BETWEEN @start AND @end
          AND attribution_model = @model

        GROUP BY
          channel
      ),


      roles AS (
        SELECT
          COALESCE(NULLIF(channel, ''), 'unknown') AS channel,

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
              AND touch_number < touch_count,
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
      )


      SELECT
        c.channel,
        c.channel_group,
        c.assisted_orders,
        c.credited_orders,
        c.credited_touch_rows,
        c.equivalent_order_credits,
        c.attributed_revenue,

        COALESCE(r.starter_orders, 0)
          AS starter_orders,

        COALESCE(r.assist_orders, 0)
          AS assist_orders,

        COALESCE(r.closer_orders, 0)
          AS closer_orders

      FROM
        channel_base c

      LEFT JOIN
        roles r

        ON c.channel = r.channel

      ORDER BY
        attributed_revenue DESC
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


    return NextResponse.json({
      ok: true,

      data: {
        channels: rows || [],
      },

      meta: {
        start,
        end,
        attributionModel: model,
        rowCount: rows?.length || 0,
      },
    });

  } catch (error: any) {
    console.error(
      "ATTRIBUTION_CHANNELS_API_ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to load channels",
      },
      {
        status: 500,
      }
    );
  }
}