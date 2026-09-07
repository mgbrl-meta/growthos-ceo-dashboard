'use client';



import { GosCampaignPicker, GosDecisionRow, GosLoadingCard, GosMiniStat, GosPanel, GosStatusBadge } from '../ui/GrowthUI';
import {
  useEffect,
  useState,
} from 'react';


// ============================================================
// TYPES
// ============================================================

type Row =
  any;


type MetaParams = {

  targetRoas:
    number;

  targetCpa:
    number;

  scalePct:
    number;

  killPct:
    number;

  minSpend:
    number;

  minPurchases:
    number;

  maxCpa:
    number;

  minRoas:
    number;

  minCtr:
    number;

  maxFrequency:
    number;

  cpmIncreasePct:
    number;

};


// ============================================================
// AD SET ANALYSIS
// ============================================================

export default function MetaAdSetAnalysis({

  start,

  end,

  params,

  campaigns,

  selectedCampaign,

  setSelectedCampaign,

}: any) {


  const [
    rows,
    setRows,
  ] =
    useState<any[]>(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ''
    );


  // ==========================================================
  // AUTO SELECT FIRST CAMPAIGN
  // ==========================================================

  useEffect(
    () => {

      if (
        !selectedCampaign &&
        Array.isArray(
          campaigns
        ) &&
        campaigns.length >
          0
      ) {

        setSelectedCampaign(
          campaigns[0]
        );

      }

    },
    [
      campaigns,
      selectedCampaign,
      setSelectedCampaign,
    ]
  );


  // ==========================================================
  // LOAD AD SET DATA
  // ==========================================================

  useEffect(
    () => {

      if (
        !start ||
        !end ||
        !selectedCampaign
      ) {

        setRows(
          []
        );

        return;

      }


      let cancelled =
        false;


      async function load() {

        setLoading(
          true
        );


        setError(
          ''
        );


        try {

          const query =
            new URLSearchParams({

              tab:
                'adset',

              start,

              end,

              campaign:
                selectedCampaign,

            });


          const res =
            await fetch(
              `/api/meta-os?${query.toString()}`,
              {
                cache:
                  'no-store',
              }
            );


          const json =
            await res.json();


          if (
            !res.ok
          ) {

            throw new Error(
              json?.error ||
              'Failed to load ad sets'
            );

          }


          if (
            !cancelled
          ) {

            setRows(
              Array.isArray(
                json
              )
                ? json
                : []
            );

          }


        } catch (
          error:
            any
        ) {

          console.error(
            'Ad set analysis error',
            error
          );


          if (
            !cancelled
          ) {

            setRows(
              []
            );


            setError(
              error?.message ||
              'Failed to load ad sets'
            );

          }


        } finally {

          if (
            !cancelled
          ) {

            setLoading(
              false
            );

          }

        }

      }


      load();


      return () => {

        cancelled =
          true;

      };

    },
    [
      start,
      end,
      selectedCampaign,
    ]
  );


  // ==========================================================
  // NO CAMPAIGN
  // ==========================================================

  if (
    !selectedCampaign
  ) {

    return (

      <EmptyState

        title="No campaign selected"

        text="Select a campaign to analyse ad sets."

      />

    );

  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading
  ) {

    return (

      <LoadingCard
        text="Loading ad sets..."
      />

    );

  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    error
  ) {

    return (

      <div className="space-y-3">

        <CampaignPicker

          campaigns={
            campaigns
          }

          value={
            selectedCampaign
          }

          onChange={
            setSelectedCampaign
          }

        />


        <EmptyState

          title="Ad set data failed to load"

          text={
            error
          }

        />

      </div>

    );

  }


  // ==========================================================
  // NO DATA
  // ==========================================================

  if (
    rows.length ===
    0
  ) {

    return (

      <div className="space-y-3">

        <CampaignPicker

          campaigns={
            campaigns
          }

          value={
            selectedCampaign
          }

          onChange={
            setSelectedCampaign
          }

        />


        <EmptyState

          title="No ad set data"

          text={
            `No ad set records were returned for ${selectedCampaign} between ${start} and ${end}.`
          }

        />

      </div>

    );

  }


  // ==========================================================
  // BENCHMARK
  // ==========================================================

  const parentBenchmark = {

    spend:
      Number(
        rows[0]?.campaign_spend ||
        0
      ),

    revenue:
      Number(
        rows[0]?.campaign_revenue ||
        0
      ),

    purchases:
      Number(
        rows[0]?.campaign_purchases ||
        0
      ),

    roas:
      safeDivide(
        rows[0]?.campaign_revenue,
        rows[0]?.campaign_spend
      ),

    cpa:
      safeDivide(
        rows[0]?.campaign_spend,
        rows[0]?.campaign_purchases
      ),

    avgSpend:
      safeDivide(
        rows[0]?.campaign_spend,
        Math.max(
          rows.length,
          1
        )
      ),

  };


  const fallbackBenchmark =
    buildBenchmark(
      rows
    );


  const benchmark =
    parentBenchmark.spend

      ? parentBenchmark

      : fallbackBenchmark;


  // ==========================================================
  // DECISION BUCKETS
  // ==========================================================

  const enriched =
    rows
      .map(
        adset => {

          const decisionData =
            getDecisionBucket(
              adset,
              benchmark,
              params
            );


          return {

            ...adset,

            decision:
              decisionData.decision,

            reason:
              decisionData.reason,

          };

        }
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b.spend ||
            0
          )
          -
          Number(
            a.spend ||
            0
          )
      );


  const scale =
    enriched.filter(
      x =>
        x.decision ===
        'SCALE'
    );


  const test =
    enriched.filter(
      x =>
        x.decision ===
        'TEST'
    );


  const kill =
    enriched.filter(
      x =>
        x.decision ===
        'KILL'
    );


  const ignore =
    enriched.filter(
      x =>
        x.decision ===
        'IGNORE'
    );


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          CAMPAIGN PICKER
      ===================================================== */}

      <CampaignPicker

        campaigns={
          campaigns
        }

        value={
          selectedCampaign
        }

        onChange={
          setSelectedCampaign
        }

      />


      {/* =====================================================
          DECISION BUCKETS
      ===================================================== */}

      <Panel
        title="Ad Set Decision Buckets"
      >

        <p
          className="
            mb-3

            text-[10px]
            font-medium
            leading-4

            text-slate-500
          "
        >
          Ad sets are benchmarked against their parent campaign performance for the selected date range.
        </p>


        <div
          className="
            grid
            grid-cols-1
            gap-2.5

            md:grid-cols-2
            xl:grid-cols-4
          "
        >

          <DecisionBucket
            title="🟢 Scale"
            items={
              scale
            }
          />


          <DecisionBucket
            title="🟡 Test"
            items={
              test
            }
          />


          <DecisionBucket
            title="🔴 Kill / Fix"
            items={
              kill
            }
          />


          <DecisionBucket
            title="⚪ Ignore"
            items={
              ignore
            }
          />

        </div>

      </Panel>


      {/* =====================================================
          LEADERBOARD
      ===================================================== */}

      <Panel
        title="Ad Set Leaderboard"
      >

        <div className="space-y-2">

          {enriched.map(
            (
              adset,
              i
            ) => (

              <DecisionRow

                key={
                  i
                }

                title={
                  adset.adset_name ||
                  'Unnamed ad set'
                }

                status={
                  adset.decision
                }

                subtitle={
                  `Spend share ${formatNumber(
                    adset.spend_share
                  )}% · ${adset.reason}`
                }
              >

                <MiniStat

                  label="Spend"

                  value={
                    formatCurrency(
                      adset.spend
                    )
                  }

                />


                <MiniStat

                  label="Revenue"

                  value={
                    formatCurrency(
                      adset.revenue
                    )
                  }

                />


                <MiniStat

                  label="ROAS"

                  value={
                    formatNumber(
                      adset.roas
                    )
                  }

                />


                <MiniStat

                  label="CPA"

                  value={
                    formatCurrency(
                      adset.cpa
                    )
                  }

                />


                <MiniStat

                  label="Purchases"

                  value={
                    formatNumber(
                      adset.purchases,
                      0
                    )
                  }

                />


                <MiniStat

                  label="Freq"

                  value={
                    formatNumber(
                      adset.frequency
                    )
                  }

                />

              </DecisionRow>

            )
          )}

        </div>

      </Panel>

    </div>

  );

}


// ============================================================
// BENCHMARK
// ============================================================

function buildBenchmark(
  rows:
    any[]
) {

  const spend =
    sum(
      rows,
      'spend'
    );


  const revenue =
    sum(
      rows,
      'revenue'
    );


  const purchases =
    sum(
      rows,
      'purchases'
    );


  const impressions =
    sum(
      rows,
      'impressions'
    );


  const clicks =
    sum(
      rows,
      'clicks'
    );


  const reach =
    sum(
      rows,
      'reach'
    );


  return {

    spend,

    revenue,

    purchases,

    impressions,

    clicks,

    reach,

    roas:
      safeDivide(
        revenue,
        spend
      ),

    cpa:
      safeDivide(
        spend,
        purchases
      ),

    ctr:
      safeDivide(
        clicks,
        impressions
      )
      *
      100,

    frequency:
      safeDivide(
        impressions,
        reach
      ),

    avgSpend:
      safeDivide(
        spend,
        Math.max(
          rows.length,
          1
        )
      ),

  };

}


// ============================================================
// DECISION ENGINE
// ============================================================

function getDecisionBucket(

  row:
    any,

  benchmark:
    any,

  params:
    MetaParams

) {

  const spend =
    Number(
      row.spend ||
      0
    );


  const roas =
    Number(
      row.roas ||
      0
    );


  const cpa =
    Number(
      row.cpa ||
      0
    );


  const purchases =
    Number(
      row.purchases ||
      0
    );


  const hasEnoughData =
    spend >=
      params.minSpend
    &&
    purchases >=
      params.minPurchases;


  const roasIndex =
    safeDivide(
      roas,
      benchmark.roas
    );


  const cpaIndex =
    safeDivide(
      cpa,
      benchmark.cpa
    );


  const spendIndex =
    safeDivide(
      spend,
      benchmark.avgSpend ||
      benchmark.spend
    );


  if (
    !hasEnoughData
  ) {

    if (
      roasIndex >=
        1.1
      ||
      cpaIndex <=
        0.9
    ) {

      return {

        decision:
          'TEST',

        reason:
          'Low data, but early efficiency is better than benchmark',

      };

    }


    return {

      decision:
        'IGNORE',

      reason:
        'Low signal / not enough spend or purchases yet',

    };

  }


  if (
    roasIndex >=
      1.1
    &&
    cpaIndex <=
      0.9
  ) {

    return {

      decision:
        'SCALE',

      reason:
        'ROAS better than benchmark and CPA lower than benchmark',

    };

  }


  if (
    roasIndex <=
      0.85
    &&
    cpaIndex >=
      1.15
  ) {

    return {

      decision:
        'KILL',

      reason:
        'ROAS below benchmark and CPA above benchmark',

    };

  }


  if (
    spendIndex <
      0.7
    &&
    (
      roasIndex >=
        1
      ||
      cpaIndex <=
        1
    )
  ) {

    return {

      decision:
        'TEST',

      reason:
        'Under-spent but performance is near or better than benchmark',

    };

  }


  return {

    decision:
      'IGNORE',

    reason:
      'Average performance; no clear scale or kill signal',

  };

}


// ============================================================
// HELPERS
// ============================================================

function sum(
  rows:
    Row[],
  key:
    string
) {

  return rows.reduce(
    (
      acc,
      row
    ) =>
      acc
      +
      Number(
        row[key] ||
        0
      ),
    0
  );

}


function safeDivide(
  a:
    any,
  b:
    any
) {

  const numerator =
    Number(
      a ||
      0
    );


  const denominator =
    Number(
      b ||
      0
    );


  if (
    !denominator
  ) {

    return 0;

  }


  return (
    numerator /
    denominator
  );

}


function formatCurrency(
  value:
    number = 0
) {

  return new Intl.NumberFormat(
    'en-IN',
    {

      style:
        'currency',

      currency:
        'INR',

      maximumFractionDigits:
        0,

    }
  ).format(
    Number(
      value ||
      0
    )
  );

}


function formatNumber(
  value:
    number = 0,
  digits =
    2
) {

  return new Intl.NumberFormat(
    'en-IN',
    {

      maximumFractionDigits:
        digits,

    }
  ).format(
    Number(
      value ||
      0
    )
  );

}


// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({

  title,

  text,

}: any) {

  return (

    <div
      className="
        rounded-[10px]

        border
        border-dashed
        border-slate-300

        bg-white

        px-3
        py-2
      "
    >

      <h3
        className="
          text-[12px]
          font-semibold

          text-slate-900
        "
      >
        {title}
      </h3>


      <p
        className="
          mt-1

          text-[10px]
          font-medium
          leading-4

          text-slate-500
        "
      >
        {text}
      </p>

    </div>

  );

}


// ============================================================
// LOADING
// ============================================================

function LoadingCard({ text }: any) { return <GosLoadingCard text={text} />; }


// ============================================================
// PANEL
// ============================================================

function Panel({ title, children }: any) { return <GosPanel title={title}>{children}</GosPanel>; }


// ============================================================
// CAMPAIGN PICKER
// ============================================================

function CampaignPicker({ campaigns, value, onChange }: any) { return <GosCampaignPicker campaigns={campaigns} value={value} onChange={onChange} />; }


// ============================================================
// MINI STAT
// ============================================================

function MiniStat({ label, value }: any) { return <GosMiniStat label={label} value={value} />; }


// ============================================================
// DECISION ROW
// ============================================================

function DecisionRow({ title, subtitle, status, children }: any) { return <GosDecisionRow title={title} subtitle={subtitle} status={status}>{children}</GosDecisionRow>; }


// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }: any) { return <GosStatusBadge status={status} />; }


// ============================================================
// DECISION BUCKET
// ============================================================

function DecisionBucket({

  title,

  items,

}: any) {

  return (

    <div
      className="
        rounded-[10px]

        border
        border-slate-200

        bg-slate-50

        p-2.5
      "
    >

      <div
        className="
          mb-2

          flex
          items-center
          justify-between
          gap-2
        "
      >

        <h3
          className="
            text-[11px]
            font-semibold

            text-slate-800
          "
        >
          {title}
        </h3>


        <span
          className="
            inline-flex
            min-w-5
            items-center
            justify-center

            rounded-full

            bg-white

            px-1.5
            py-0.5

            text-[8px]
            font-semibold

            text-slate-500
          "
        >
          {items.length}
        </span>

      </div>


      {items.length ===
      0 ? (

        <p
          className="
            py-1

            text-[9px]
            font-medium

            text-slate-400
          "
        >
          No items
        </p>

      ) : (

        <div className="space-y-1.5">

          {items
            .slice(
              0,
              8
            )
            .map(
              (
                item:
                  any,
                i:
                  number
              ) => (

                <div

                  key={
                    i
                  }

                  className="
                    rounded-[8px]

                    border
                    border-slate-200

                    bg-white

                    p-2
                  "
                >

                  <p
                    className="
                      line-clamp-2

                      text-[10px]
                      font-semibold
                      leading-[14px]

                      text-slate-800
                    "
                  >
                    {item.campaign_name ||
                      item.adset_name ||
                      'Unnamed'}
                  </p>


                  <p
                    className="
                      mt-1

                      text-[8px]
                      font-medium
                      leading-[13px]

                      text-slate-500
                    "
                  >
                    Spend {formatCurrency(
                      item.spend
                    )}
                    {' · '}
                    ROAS {formatNumber(
                      item.roas
                    )}
                    {' · '}
                    CPA {formatCurrency(
                      item.cpa
                    )}
                  </p>


                  <p
                    className="
                      mt-1

                      text-[9px]
                      font-medium
                      leading-[14px]

                      text-slate-600
                    "
                  >
                    {item.reason}
                  </p>

                </div>

              )
            )}

        </div>

      )}

    </div>

  );

}
