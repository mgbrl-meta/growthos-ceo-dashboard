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


export async function GET(
  req: Request
) {

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

    const {
      searchParams,
    } =
      new URL(
        req.url
      );


    const start =
      searchParams.get(
        "start"
      );


    const end =
      searchParams.get(
        "end"
      );


    if (
      !start ||
      !end
    ) {

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

        tracked_customer_type,


        SUM(
          orders
        ) AS orders,


        SUM(
          customers
        ) AS customers,


        CAST(
          SUM(
            revenue
          )
          AS FLOAT64
        ) AS revenue,


        SAFE_DIVIDE(
          SUM(
            revenue
          ),
          SUM(
            orders
          )
        ) AS avg_order_value,


        SAFE_DIVIDE(

          SUM(
            avg_sessions_to_purchase
            *
            orders
          ),

          SUM(
            orders
          )

        ) AS avg_sessions_to_purchase,


        SAFE_DIVIDE(

          SUM(
            avg_marketing_touches
            *
            orders
          ),

          SUM(
            orders
          )

        ) AS avg_marketing_touches,


        SAFE_DIVIDE(

          SUM(
            avg_days_to_purchase
            *
            orders
          ),

          SUM(
            orders
          )

        ) AS avg_days_to_purchase


      FROM
        \`shopify-colab.brillare_shopify.attribution_new_repeat_v1\`


      WHERE
        order_date
        BETWEEN @start
        AND @end


      GROUP BY
        tracked_customer_type


      ORDER BY
        orders DESC

    `;


    const [
      rows,
    ] =
      await bigquery.query(
        {
          query,

          params: {
            start,
            end,
          },
        }
      );


    return NextResponse.json(
      {

        ok: true,


        data: {

          segments:
            rows ||
            [],

        },


        meta: {

          start,

          end,

          rowCount:
            rows?.length ||
            0,

          source:
            "bigquery",

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      "ATTRIBUTION_NEW_REPEAT_API_ERROR",
      error
    );


    return NextResponse.json(
      {

        ok: false,

        error:
          error?.message ||
          "Failed to load new vs repeat",

      },
      {
        status: 500,
      }
    );

  }

}