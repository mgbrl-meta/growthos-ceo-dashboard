import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";


export async function GET() {
  try {

    const query = `
      SELECT
        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          checked_at
        ) AS checked_at,

        raw_events,
        raw_unique_events,
        raw_visitors,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          latest_raw_event
        ) AS latest_raw_event,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          latest_raw_ingestion
        ) AS latest_raw_ingestion,

        marketing_touchpoints,
        unique_marketing_touchpoints,
        touchpoint_visitors,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          latest_touchpoint_event
        ) AS latest_touchpoint_event,

        sessionized_events,
        sessionized_unique_events,
        sessionized_visitors,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          latest_sessionized_event
        ) AS latest_sessionized_event,

        raw_events_not_sessionized,
        visitors_not_sessionized,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          earliest_missing_event
        ) AS earliest_missing_event,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          latest_missing_event
        ) AS latest_missing_event,

        sessionization_coverage_pct,

        canonical_sessions,
        canonical_visitors,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          latest_session_end
        ) AS latest_session_end,

        realtime_orders,
        orders_with_cart_token,
        exact_orders,
        ambiguous_orders,
        unmatched_orders,
        no_cart_token_orders,
        exact_orders_with_session,

        all_history_cart_token_coverage_pct,
        all_history_exact_match_rate_pct,
        exact_match_when_cart_available_pct,
        canonical_session_resolution_pct,

        FORMAT_TIMESTAMP(
          '%Y-%m-%dT%H:%M:%SZ',
          latest_realtime_order
        ) AS latest_realtime_order

      FROM
        \`shopify-colab.brillare_shopify.attribution_tracking_health_v1\`

      ORDER BY
        checked_at DESC

      LIMIT 1
    `;


    const [rows] =
      await bigquery.query({
        query,
      });


    return NextResponse.json({
      ok: true,

      data: {
        health:
          rows?.[0] ||
          null,
      },
    });

  } catch (error: any) {
    console.error(
      "ATTRIBUTION_DATA_QUALITY_API_ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to load tracking health",
      },
      {
        status: 500,
      }
    );
  }
}