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
      searchParams.get("model") ||
      "LAST_NON_DIRECT";


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
      WITH campaign_base AS (
        SELECT
          COALESCE(NULLIF(channel, ''), 'unknown')
            AS channel,

          COALESCE(NULLIF(source, ''), 'unknown')
            AS source,

          COALESCE(NULLIF(campaign_id, ''), 'UNMAPPED')
            AS campaign_id,

          SUM(assisted_orders)
            AS assisted_orders,

          SUM(converting_visitors)
            AS converting_visitors,

          SUM(credited_touch_rows)
            AS credited_touch_rows,

          SUM(equivalent_order_credits)
            AS equivalent_order_credits,

          SUM(attributed_revenue)
            AS attributed_revenue

        FROM
          \`shopify-colab.brillare_shopify.attribution_campaign_daily_v1\`

        WHERE
          order_date BETWEEN @start AND @end
          AND attribution_model = @model

        GROUP BY
          channel,
          source,
          campaign_id
      ),


      roles AS (
        SELECT
          COALESCE(NULLIF(channel, ''), 'unknown')
            AS channel,

          COALESCE(NULLIF(campaign_id, ''), 'UNMAPPED')
            AS campaign_id,

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
          channel,
          campaign_id
      )


      SELECT
        c.*,

        COALESCE(r.starter_orders, 0)
          AS starter_orders,

        COALESCE(r.assist_orders, 0)
          AS assist_orders,

        COALESCE(r.closer_orders, 0)
          AS closer_orders

      FROM
        campaign_base c

      LEFT JOIN
        roles r

        ON c.channel = r.channel
        AND c.campaign_id = r.campaign_id

      ORDER BY
        attributed_revenue DESC

      LIMIT 250
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
        campaigns: rows || [],
      },

      meta: {
        start,
        end,
        attributionModel: model,
      },
    });

  } catch (error: any) {
    console.error(
      "ATTRIBUTION_CAMPAIGNS_API_ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to load campaigns",
      },
      {
        status: 500,
      }
    );
  }
}