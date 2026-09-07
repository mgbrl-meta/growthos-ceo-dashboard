import { GosAlert, GosDataTile, GosMetricCard, GosPanel, GosValueRow } from './ui/GrowthUI';

type CeoSummaryProps = {

  metrics:
    any;

  data:
    any[];

};


// ============================================================
// FORMATTERS
// ============================================================

const formatCurrency = (
  value:
    number = 0
) =>

  new Intl.NumberFormat(
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
      value || 0
    )
  );


const formatNumber = (
  value:
    number = 0,
  digits =
    2
) =>

  new Intl.NumberFormat(
    'en-IN',
    {

      maximumFractionDigits:
        digits,

    }
  ).format(
    Number(
      value || 0
    )
  );


const safeDivide = (
  a:
    any,
  b:
    any
) => {

  const numerator =
    Number(
      a || 0
    );


  const denominator =
    Number(
      b || 0
    );


  if (!denominator) {

    return 0;

  }


  return (
    numerator /
    denominator
  );

};


// ============================================================
// CEO SUMMARY
// ============================================================

export default function CeoSummary({

  metrics = {},

}: CeoSummaryProps) {

  return (

    <div className="space-y-3">


      {/* =====================================================
          PRIMARY KPIs
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-2.5

          sm:grid-cols-2
          xl:grid-cols-5
        "
      >

        <MetricCard

          title="Revenue"

          value={
            formatCurrency(
              metrics.revenue
            )
          }

          delta={
            metrics.revenueDelta
          }

          goodUp

        />


        <MetricCard

          title="Total Spend"

          value={
            formatCurrency(
              metrics.spend
            )
          }

          delta={
            metrics.spendDelta
          }

        />


        <MetricCard

          title="Contribution After Ads"

          value={
            formatCurrency(
              metrics.contribution
            )
          }

          delta={
            metrics.revenueDelta
            -
            metrics.spendDelta
          }

          goodUp

        />


        <MetricCard

          title="Blended ROAS"

          value={
            formatNumber(
              metrics.roas
            )
          }

          delta={
            metrics.roasDelta
          }

          goodUp

        />


        <MetricCard

          title="New CAC"

          value={
            formatCurrency(
              metrics.newCac
            )
          }

          delta={
            metrics.newCacDelta
          }

        />

      </section>


      {/* =====================================================
          CHANNEL + CUSTOMER
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          lg:grid-cols-2
        "
      >

        <Panel
          title="Channel Efficiency"
        >

          <ChannelRow

            name="Meta"

            spend={
              metrics.metaSpend
            }

            revenue={
              metrics.metaRevenue
            }

            total={
              metrics.spend
            }

          />


          <ChannelRow

            name="Google"

            spend={
              metrics.googleSpend
            }

            revenue={
              metrics.googleRevenue
            }

            total={
              metrics.spend
            }

          />


          <ChannelRow

            name="Organic / Direct"

            spend={
              0
            }

            revenue={
              metrics.organicRevenue
            }

            total={
              metrics.spend
            }

          />

        </Panel>


        <Panel
          title="Customer Economics"
        >

          <div
            className="
              grid
              grid-cols-2
              gap-2

              xl:grid-cols-3
            "
          >

            <DataTile

              label="New Customers"

              value={
                formatNumber(
                  metrics.newCustomers,
                  0
                )
              }

            />


            <DataTile

              label="Repeat Customers"

              value={
                formatNumber(
                  metrics.repeatCustomers,
                  0
                )
              }

            />


            <DataTile

              label="New Revenue"

              value={
                formatCurrency(
                  metrics.newRevenue
                )
              }

            />


            <DataTile

              label="Repeat Revenue"

              value={
                formatCurrency(
                  metrics.repeatRevenue
                )
              }

            />


            <DataTile

              label="New Revenue %"

              value={
                `${formatNumber(
                  metrics.newRevenuePct
                )}%`
              }

            />


            <DataTile

              label="Repeat Revenue %"

              value={
                `${formatNumber(
                  metrics.repeatRevenuePct
                )}%`
              }

            />

          </div>

        </Panel>

      </section>


      {/* =====================================================
          PROFITABILITY + ALERTS
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          lg:grid-cols-2
        "
      >

        <Panel
          title="Profitability Snapshot"
        >

          <div className="space-y-1.5">

            <ProfitLine

              label="Revenue"

              value={
                formatCurrency(
                  metrics.revenue
                )
              }

            />


            <ProfitLine

              label="Ad Spend"

              value={
                `- ${formatCurrency(
                  metrics.spend
                )}`
              }

            />


            <div
              className="
                flex
                min-h-[38px]
                items-center
                justify-between
                gap-3

                rounded-[9px]

                bg-slate-950

                px-3
                py-2

                text-white
              "
            >

              <span
                className="
                  text-[10px]
                  font-medium
                  text-slate-300
                "
              >
                Contribution After Ads
              </span>


              <strong
                className="
                  text-[12px]
                  font-semibold
                "
              >
                {formatCurrency(
                  metrics.contribution
                )}
              </strong>

            </div>

          </div>

        </Panel>


        <Panel
          title="CEO Alerts"
        >

          <div className="space-y-1.5">

            <AlertBox

              tone={
                metrics.contribution <
                  0

                  ? 'red'

                  : 'green'
              }

              title={
                metrics.contribution <
                  0

                  ? 'Negative after ads'

                  : 'Positive after ads'
              }

              text={
                `Contribution after ads is ${formatCurrency(
                  metrics.contribution
                )}.`
              }

            />


            <AlertBox

              tone={

                metrics.roas <
                  1

                  ? 'red'

                  : metrics.roas <
                      2

                    ? 'amber'

                    : 'green'

              }

              title={

                metrics.roas <
                  1

                  ? 'ROAS below 1.0'

                  : metrics.roas <
                      2

                    ? 'ROAS needs monitoring'

                    : 'ROAS healthy'

              }

              text={
                `Current blended ROAS is ${formatNumber(
                  metrics.roas
                )}.`
              }

            />


            <AlertBox

              tone={
                metrics.newCac >
                  metrics.aov

                  ? 'amber'

                  : 'green'
              }

              title={
                metrics.newCac >
                  metrics.aov

                  ? 'CAC above AOV'

                  : 'CAC quality acceptable'
              }

              text={
                `New CAC is ${formatCurrency(
                  metrics.newCac
                )} vs AOV ${formatCurrency(
                  metrics.aov
                )}.`
              }

            />

          </div>

        </Panel>

      </section>

    </div>

  );

}


// ============================================================
// METRIC CARD
// ============================================================

function MetricCard(props: any) { return <GosMetricCard {...props} />; }


// ============================================================
// PANEL
// ============================================================

function Panel({ title, children }: any) { return <GosPanel title={title}>{children}</GosPanel>; }


// ============================================================
// DATA TILE
// ============================================================

function DataTile({ label, value }: any) { return <GosDataTile label={label} value={value} />; }


// ============================================================
// CHANNEL ROW
// ============================================================

function ChannelRow({

  name,

  spend,

  revenue,

  total,

}: any) {


  const share =
    safeDivide(
      spend,
      total
    )
    *
    100;


  const roas =
    safeDivide(
      revenue,
      spend
    );


  return (

    <div
      className="
        border-b
        border-slate-100

        py-2

        first:pt-0
        last:border-0
        last:pb-0
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
          gap-3
        "
      >

        <strong
          className="
            text-[11px]
            font-semibold
            text-slate-800
          "
        >
          {name}
        </strong>


        <strong
          className="
            text-[11px]
            font-semibold
            text-slate-950
          "
        >
          {formatCurrency(
            spend
          )}
        </strong>

      </div>


      <div
        className="
          mt-1.5
          h-1
          overflow-hidden

          rounded-full

          bg-slate-100
        "
      >

        <div

          className="
            h-full

            rounded-full

            bg-slate-800
          "

          style={{
            width:
              `${Math.min(
                share,
                100
              )}%`,
          }}

        />

      </div>


      <div
        className="
          mt-1

          flex
          items-center
          justify-between
          gap-3

          text-[9px]
          font-medium
          text-slate-500
        "
      >

        <span>
          {formatNumber(
            share
          )}% spend share
        </span>


        <span className="text-right">
          Revenue {formatCurrency(
            revenue
          )}
          {' · '}
          ROAS {formatNumber(
            roas
          )}
        </span>

      </div>

    </div>

  );

}


// ============================================================
// ALERT
// ============================================================

function AlertBox({ tone, title, text }: any) { return <GosAlert tone={tone} title={title} text={text} />; }


// ============================================================
// PROFIT LINE
// ============================================================

function ProfitLine({ label, value }: any) { return <GosValueRow label={label} value={value} />; }
