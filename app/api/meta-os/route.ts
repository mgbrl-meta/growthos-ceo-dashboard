import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  requireLegacyBrillareDataScope,
} from '@/lib/tenancy/legacy-data-guard';

import { bigquery } from "@/lib/bigquery";

const TABLE = "shopify-colab.brillare_shopify.meta_ads_input";

/**
 * Canonical MetaOS data contract.
 *
 * The BigQuery table contains Meta-export column names. Every MetaOS query
 * should consume only these normalized aliases so the frontend and analytics
 * layers do not depend on raw source naming.
 */
const SOURCE_CTE = `
  WITH source AS (
    SELECT
      SAFE_CAST(Day AS DATE) AS date,

      CAST(Campaign_ID AS STRING) AS campaign_id,
      Campaign_name AS campaign_name,

      CAST(Ad_set_ID AS STRING) AS adset_id,
      Ad_set_name AS adset_name,

      CAST(Ad_ID AS STRING) AS ad_id,
      Ad_name AS creative_name,

      Objective AS objective,

      COALESCE(SAFE_CAST(Impressions AS FLOAT64), 0) AS impressions,
      COALESCE(SAFE_CAST(Reach AS FLOAT64), 0) AS reach,
      COALESCE(SAFE_CAST(Frequency AS FLOAT64), 0) AS source_frequency,

      COALESCE(SAFE_CAST(Amount_spent__INR_ AS FLOAT64), 0) AS spend,
      COALESCE(SAFE_CAST(Clicks__all_ AS FLOAT64), 0) AS clicks,
      COALESCE(SAFE_CAST(Link_clicks AS FLOAT64), 0) AS link_clicks,
      COALESCE(SAFE_CAST(Outbound_clicks AS FLOAT64), 0) AS outbound_clicks,

      COALESCE(SAFE_CAST(Landing_page_views AS FLOAT64), 0) AS lpv,
      COALESCE(SAFE_CAST(Adds_to_cart AS FLOAT64), 0) AS atc,
      COALESCE(SAFE_CAST(Checkouts_initiated AS FLOAT64), 0) AS checkout,
      COALESCE(SAFE_CAST(Adds_of_payment_info AS FLOAT64), 0) AS payment_info,

      COALESCE(SAFE_CAST(Purchases AS FLOAT64), 0) AS purchases,
      COALESCE(SAFE_CAST(Purchases_conversion_value AS FLOAT64), 0) AS revenue,

      COALESCE(SAFE_CAST(Video_plays AS FLOAT64), 0) AS video_plays,
      COALESCE(SAFE_CAST(_3_second_video_plays AS FLOAT64), 0) AS three_second_video_plays,
      COALESCE(SAFE_CAST(Video_average_play_time__in_seconds_ AS FLOAT64), 0) AS video_average_play_time,
      COALESCE(SAFE_CAST(ThruPlays AS FLOAT64), 0) AS thruplays
    FROM \`${TABLE}\`
    WHERE SAFE_CAST(Day AS DATE) IS NOT NULL
  )
`;

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

  const { searchParams } = new URL(req.url);

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const compareStart = searchParams.get("compareStart") || start;
  const compareEnd = searchParams.get("compareEnd") || end;
  const tab = searchParams.get("tab") || "overview";
  const campaign = searchParams.get("campaign") || "";

  if (!start || !end) {
    return Response.json(
      { error: "Missing required start or end date" },
      { status: 400 },
    );
  }

  let query = "";

  if (tab === "overview") {
    query = `
      ${SOURCE_CTE},
      current_period AS (
        SELECT
          SUM(spend) AS spend,
          SUM(revenue) AS revenue,
          SUM(purchases) AS purchases,
          SUM(impressions) AS impressions,
          SUM(reach) AS reach,
          SUM(clicks) AS clicks,
          SUM(link_clicks) AS link_clicks,
          SUM(lpv) AS lpv,
          SUM(atc) AS atc,
          SUM(checkout) AS checkout,
          SUM(payment_info) AS payment_info
        FROM source
        WHERE date BETWEEN DATE(@start) AND DATE(@end)
          AND (@campaign = '' OR campaign_name = @campaign)
      ),
      compare_period AS (
        SELECT
          SUM(spend) AS spend,
          SUM(revenue) AS revenue,
          SUM(purchases) AS purchases,
          SUM(impressions) AS impressions,
          SUM(reach) AS reach,
          SUM(clicks) AS clicks,
          SUM(link_clicks) AS link_clicks,
          SUM(lpv) AS lpv,
          SUM(atc) AS atc,
          SUM(checkout) AS checkout,
          SUM(payment_info) AS payment_info
        FROM source
        WHERE date BETWEEN DATE(@compareStart) AND DATE(@compareEnd)
          AND (@campaign = '' OR campaign_name = @campaign)
      )
      SELECT
        TO_JSON_STRING(current_period) AS current_data,
        TO_JSON_STRING(compare_period) AS compare_data
      FROM current_period, compare_period
    `;
  }

  if (tab === "trend") {
    query = `
      ${SOURCE_CTE}
      SELECT
        date,
        SUM(spend) AS spend,
        SUM(revenue) AS revenue,
        SUM(purchases) AS purchases,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        SUM(clicks) AS clicks,
        SUM(link_clicks) AS link_clicks,
        SUM(lpv) AS lpv,
        SUM(atc) AS atc,
        SUM(checkout) AS checkout,
        SUM(payment_info) AS payment_info,
        SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas,
        SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS cpa,
        SAFE_DIVIDE(SUM(revenue), SUM(purchases)) AS aov,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 AS ctr,
        SAFE_DIVIDE(SUM(link_clicks), SUM(impressions)) * 100 AS link_ctr,
        SAFE_DIVIDE(SUM(spend), SUM(clicks)) AS cpc,
        SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000 AS cpm,
        SAFE_DIVIDE(SUM(impressions), SUM(reach)) AS frequency
      FROM source
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
        AND (@campaign = '' OR campaign_name = @campaign)
      GROUP BY date
      ORDER BY date
    `;
  }

  if (tab === "campaign-list") {
    query = `
      ${SOURCE_CTE}
      SELECT DISTINCT campaign_name
      FROM source
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
        AND campaign_name IS NOT NULL
      ORDER BY campaign_name
    `;
  }

  if (tab === "campaign-weekly") {
    query = `
      ${SOURCE_CTE}
      SELECT
        FORMAT_DATE('%Y-%m', date) AS month,
        CASE
          WHEN EXTRACT(DAY FROM date) BETWEEN 1 AND 7 THEN 'W1'
          WHEN EXTRACT(DAY FROM date) BETWEEN 8 AND 14 THEN 'W2'
          WHEN EXTRACT(DAY FROM date) BETWEEN 15 AND 21 THEN 'W3'
          ELSE 'W4'
        END AS week,
        campaign_name,
        SUM(spend) AS spend,
        SUM(revenue) AS revenue,
        SUM(purchases) AS purchases,
        SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS cpa,
        SAFE_DIVIDE(SUM(revenue), SUM(purchases)) AS aov,
        SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas
      FROM source
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
      GROUP BY month, week, campaign_name
      ORDER BY month, week, campaign_name
    `;
  }

  if (tab === "campaign") {
    query = `
      ${SOURCE_CTE}
      SELECT
        campaign_id,
        campaign_name,
        ANY_VALUE(objective) AS objective,
        SUM(spend) AS spend,
        SUM(revenue) AS revenue,
        SUM(purchases) AS purchases,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        SUM(clicks) AS clicks,
        SUM(link_clicks) AS link_clicks,
        SUM(lpv) AS lpv,
        SUM(atc) AS atc,
        SUM(checkout) AS checkout,
        SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas,
        SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS cpa,
        SAFE_DIVIDE(SUM(revenue), SUM(purchases)) AS aov,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 AS ctr,
        SAFE_DIVIDE(SUM(link_clicks), SUM(impressions)) * 100 AS link_ctr,
        SAFE_DIVIDE(SUM(spend), SUM(clicks)) AS cpc,
        SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000 AS cpm,
        SAFE_DIVIDE(SUM(impressions), SUM(reach)) AS frequency
      FROM source
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
    `;
  }

  if (tab === "creative") {
    query = `
      ${SOURCE_CTE},
      campaign_avg AS (
        SELECT
          SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS campaign_roas,
          SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 AS campaign_ctr,
          SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS campaign_cpa,
          SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000 AS campaign_cpm
        FROM source
        WHERE date BETWEEN DATE(@start) AND DATE(@end)
          AND (@campaign = '' OR campaign_name = @campaign)
      )
      SELECT
        ad_id,
        ANY_VALUE(creative_name) AS creative_name,
        ANY_VALUE(campaign_name) AS campaign_name,
        SUM(spend) AS spend,
        SUM(revenue) AS revenue,
        SUM(purchases) AS purchases,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        SUM(clicks) AS clicks,
        SUM(link_clicks) AS link_clicks,
        SUM(lpv) AS lpv,
        SUM(atc) AS atc,
        SUM(checkout) AS checkout,
        SUM(payment_info) AS payment_info,
        SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas,
        SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS cpa,
        SAFE_DIVIDE(SUM(revenue), SUM(purchases)) AS aov,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 AS ctr,
        SAFE_DIVIDE(SUM(link_clicks), SUM(impressions)) * 100 AS link_ctr,
        SAFE_DIVIDE(SUM(spend), SUM(clicks)) AS cpc,
        SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000 AS cpm,
        SAFE_DIVIDE(SUM(impressions), SUM(reach)) AS frequency,
        ca.campaign_roas,
        ca.campaign_ctr,
        ca.campaign_cpa,
        ca.campaign_cpm,
        COALESCE(
          SAFE_DIVIDE(
            SAFE_DIVIDE(SUM(revenue), SUM(spend)),
            NULLIF(ca.campaign_roas, 0)
          ),
          0
        ) AS roas_index,
        COALESCE(
          SAFE_DIVIDE(
            SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100,
            NULLIF(ca.campaign_ctr, 0)
          ),
          0
        ) AS ctr_index
      FROM source
      CROSS JOIN campaign_avg ca
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
        AND (@campaign = '' OR campaign_name = @campaign)
      GROUP BY
        ad_id,
        ca.campaign_roas,
        ca.campaign_ctr,
        ca.campaign_cpa,
        ca.campaign_cpm
      ORDER BY spend DESC
    `;
  }

  if (tab === "adset") {
    query = `
      ${SOURCE_CTE},
      campaign_total AS (
        SELECT
          SUM(spend) AS campaign_spend,
          SUM(revenue) AS campaign_revenue,
          SUM(purchases) AS campaign_purchases,
          SUM(reach) AS campaign_reach
        FROM source
        WHERE date BETWEEN DATE(@start) AND DATE(@end)
          AND (@campaign = '' OR campaign_name = @campaign)
      )
      SELECT
        campaign_name,
        adset_id,
        adset_name,
        SUM(spend) AS spend,
        SUM(revenue) AS revenue,
        SUM(purchases) AS purchases,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        SUM(clicks) AS clicks,
        SUM(lpv) AS lpv,
        SUM(atc) AS atc,
        SUM(checkout) AS checkout,
        SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas,
        SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS cpa,
        SAFE_DIVIDE(SUM(impressions), SUM(reach)) AS frequency,
        SAFE_DIVIDE(SUM(spend), ct.campaign_spend) * 100 AS spend_share,
        SAFE_DIVIDE(SUM(reach), ct.campaign_reach) * 100 AS reach_contribution,
        ct.campaign_spend,
        ct.campaign_revenue,
        ct.campaign_purchases,
        ct.campaign_reach
      FROM source
      CROSS JOIN campaign_total ct
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
        AND (@campaign = '' OR campaign_name = @campaign)
      GROUP BY
        campaign_name,
        adset_id,
        adset_name,
        ct.campaign_spend,
        ct.campaign_revenue,
        ct.campaign_purchases,
        ct.campaign_reach
      ORDER BY spend DESC
    `;
  }

  if (tab === "funnel") {
    query = `
      ${SOURCE_CTE},
      current_period AS (
        SELECT
          SUM(impressions) AS impressions,
          SUM(clicks) AS clicks,
          SUM(link_clicks) AS link_clicks,
          SUM(lpv) AS lpv,
          SUM(atc) AS atc,
          SUM(checkout) AS checkout,
          SUM(payment_info) AS payment_info,
          SUM(purchases) AS purchases
        FROM source
        WHERE date BETWEEN DATE(@start) AND DATE(@end)
          AND (@campaign = '' OR campaign_name = @campaign)
      ),
      compare_period AS (
        SELECT
          SUM(impressions) AS impressions,
          SUM(clicks) AS clicks,
          SUM(link_clicks) AS link_clicks,
          SUM(lpv) AS lpv,
          SUM(atc) AS atc,
          SUM(checkout) AS checkout,
          SUM(payment_info) AS payment_info,
          SUM(purchases) AS purchases
        FROM source
        WHERE date BETWEEN DATE(@compareStart) AND DATE(@compareEnd)
          AND (@campaign = '' OR campaign_name = @campaign)
      )
      SELECT
        TO_JSON_STRING(current_period) AS current_data,
        TO_JSON_STRING(compare_period) AS compare_data
      FROM current_period, compare_period
    `;
  }

  if (tab === "creative-daily-4pi") {
    query = `
      ${SOURCE_CTE},
      daily_campaign AS (
        SELECT
          date,
          campaign_name,
          SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000 AS campaign_cpm,
          SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS campaign_cpa
        FROM source
        WHERE date BETWEEN DATE(@start) AND DATE(@end)
          AND (@campaign = '' OR campaign_name = @campaign)
        GROUP BY date, campaign_name
      )
      SELECT
        s.date,
        s.campaign_name,
        s.ad_id,
        ANY_VALUE(s.creative_name) AS creative_name,
        SUM(s.spend) AS spend,
        SUM(s.revenue) AS revenue,
        SUM(s.purchases) AS purchases,
        SUM(s.impressions) AS impressions,
        SUM(s.reach) AS reach,
        SUM(s.clicks) AS clicks,
        SUM(s.link_clicks) AS link_clicks,
        SAFE_DIVIDE(SUM(s.revenue), SUM(s.spend)) AS roas,
        SAFE_DIVIDE(SUM(s.spend), SUM(s.purchases)) AS cpa,
        SAFE_DIVIDE(SUM(s.clicks), SUM(s.impressions)) * 100 AS ctr,
        SAFE_DIVIDE(SUM(s.spend), SUM(s.impressions)) * 1000 AS cpm,
        SAFE_DIVIDE(SUM(s.impressions), SUM(s.reach)) AS frequency,
        dc.campaign_cpm,
        dc.campaign_cpa
      FROM source s
      LEFT JOIN daily_campaign dc
        ON s.date = dc.date
       AND s.campaign_name = dc.campaign_name
      WHERE s.date BETWEEN DATE(@start) AND DATE(@end)
        AND (@campaign = '' OR s.campaign_name = @campaign)
      GROUP BY
        s.date,
        s.campaign_name,
        s.ad_id,
        dc.campaign_cpm,
        dc.campaign_cpa
      ORDER BY creative_name, s.date
    `;
  }

  if (tab === "creative-alerts") {
    query = `
      ${SOURCE_CTE}
      SELECT
        ad_id,
        ANY_VALUE(creative_name) AS creative_name,
        ANY_VALUE(campaign_name) AS campaign_name,
        SUM(spend) AS spend,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        SUM(clicks) AS clicks,
        SUM(link_clicks) AS link_clicks,
        SUM(lpv) AS lpv,
        SUM(atc) AS atc,
        SUM(checkout) AS checkout,
        SUM(payment_info) AS payment_info,
        SUM(purchases) AS purchases,
        SUM(revenue) AS revenue,
        SUM(video_plays) AS video_plays,
        SUM(three_second_video_plays) AS three_second_video_plays,
        SUM(thruplays) AS thruplays,
        SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000 AS cpm,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 AS ctr,
        SAFE_DIVIDE(SUM(link_clicks), SUM(impressions)) * 100 AS link_ctr,
        SAFE_DIVIDE(SUM(spend), SUM(clicks)) AS cpc,
        SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS cpa,
        SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas,
        SAFE_DIVIDE(SUM(impressions), SUM(reach)) AS frequency
      FROM source
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
        AND (@campaign = '' OR campaign_name = @campaign)
      GROUP BY ad_id
      HAVING SUM(spend) > 0
      ORDER BY spend DESC
    `;
  }

  if (tab === "campaign-daily-chart") {
    query = `
      ${SOURCE_CTE}
      SELECT
        date,
        campaign_name,
        SUM(spend) AS spend,
        SUM(revenue) AS revenue,
        SUM(purchases) AS purchases,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        SUM(clicks) AS clicks,
        SUM(link_clicks) AS link_clicks,
        SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000 AS cpm,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 AS ctr,
        SAFE_DIVIDE(SUM(spend), SUM(purchases)) AS cpa,
        SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas
      FROM source
      WHERE date BETWEEN DATE(@start) AND DATE(@end)
        AND (@campaign = '' OR campaign_name = @campaign)
      GROUP BY date, campaign_name
      ORDER BY date, campaign_name
    `;
  }

  if (!query) {
    return Response.json(
      { error: `Invalid Meta OS tab: ${tab}` },
      { status: 400 },
    );
  }

  try {
    const [rows] = await bigquery.query({
      query,
      params: {
        start,
        end,
        compareStart,
        compareEnd,
        campaign,
      },
    });

    if (tab === "overview" || tab === "funnel") {
      const row = (rows[0] || {}) as {
        current_data?: string;
        compare_data?: string;
      };

      return Response.json({
        current: JSON.parse(row.current_data || "{}"),
        compare: JSON.parse(row.compare_data || "{}"),
      });
    }

    const dateTabs = new Set([
      "trend",
      "creative-daily-4pi",
      "campaign-daily-chart",
    ]);

    if (dateTabs.has(tab)) {
      return Response.json(
        rows.map((row: any) => ({
          ...row,
          date: row.date?.value || row.date,
        })),
      );
    }

    return Response.json(rows);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown BigQuery error";

    console.error("Meta OS API error", {
      tab,
      start,
      end,
      compareStart,
      compareEnd,
      campaign,
      message,
    });

    return Response.json(
      {
        error: message,
        tab,
      },
      { status: 500 },
    );
  }
}