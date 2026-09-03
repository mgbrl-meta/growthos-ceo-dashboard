'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import DateControl
  from './DateControl';

import CeoSummary
  from './CeoSummary';

import GoogleOS
  from './GoogleOS';

import MetaOS
  from './MetaOS';

import ProductOS
  from './ProductOS';

import RetentionOS
  from './RetentionOS';

import AttributionOS
  from './AttributionOS';

import AppSidebar
  from './AppSidebar';

import AppHeader
  from './AppHeader';

import AppIntegrations
  from './integrations/AppIntegrations';

import GrowthSettings
  from './settings/GrowthSettings';

import WarehouseAudit
  from './warehouse/WarehouseAudit';  

import {
  Activity,
  History,
} from 'lucide-react';


type Row = any;


/* ============================================================
   HELPERS
============================================================ */

const pctChange = (
  current: number,
  previous: number
) => {

  if (
    !previous ||
    previous === 0
  ) {

    return 0;

  }


  return (
    (
      Number(
        current || 0
      )
      -
      Number(
        previous || 0
      )
    )
    /
    Number(
      previous || 0
    )
  ) * 100;

};


const safeDivide = (
  a: any,
  b: any
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


const sum = (
  rows: Row[],
  key: string
) => {

  return rows.reduce(
    (
      total,
      row
    ) =>
      total
      +
      Number(
        row?.[key] || 0
      ),
    0
  );

};


/* ============================================================
   DASHBOARD
============================================================ */

export default function GrowthOSDashboard() {


  /* ==========================================================
     DATE FORMATTER
  ========================================================== */

  const formatDate = (
    date: Date
  ) =>
    date
      .toISOString()
      .split('T')[0];


  /* ==========================================================
     GLOBAL NAVIGATION
  ========================================================== */

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    'CEO Summary'
  );


  /* ==========================================================
     SUBTAB STATE

     Each OS remembers where the user was.
  ========================================================== */

  const [
    activeSubTabs,
    setActiveSubTabs,
  ] = useState<
    Record<
      string,
      string
    >
  >({

    'Meta OS':
      'Settings',

    'Google OS':
      'Settings',

    'Attribution OS':
      'Overview',

    'Retention OS':
      'Mission Control',

    'Product OS':
      'Overview',

  });


  const setActiveSubTab = (
    module: string,
    subTab: string
  ) => {

    setActiveSubTabs(
      previous => ({

        ...previous,

        [module]:
          subTab,

      })
    );

  };


  /* ==========================================================
     SIDEBAR
  ========================================================== */

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(
    true
  );


  /* ==========================================================
     INITIAL DATE RANGE

     Default = Last 30 Days
  ========================================================== */

  const initialEndDate =
    new Date();


  const initialStartDate =
    new Date();


  initialStartDate.setDate(
    initialEndDate.getDate()
    -
    29
  );


  const initialCompareEndDate =
    new Date(
      initialStartDate
    );


  initialCompareEndDate.setDate(
    initialStartDate.getDate()
    -
    1
  );


  const initialCompareStartDate =
    new Date(
      initialCompareEndDate
    );


  initialCompareStartDate.setDate(
    initialCompareEndDate.getDate()
    -
    29
  );


  const [
    start,
    setStart,
  ] = useState(
    formatDate(
      initialStartDate
    )
  );


  const [
    end,
    setEnd,
  ] = useState(
    formatDate(
      initialEndDate
    )
  );


  const [
    compareStart,
    setCompareStart,
  ] = useState(
    formatDate(
      initialCompareStartDate
    )
  );


  const [
    compareEnd,
    setCompareEnd,
  ] = useState(
    formatDate(
      initialCompareEndDate
    )
  );


  /* ==========================================================
     DATE PRESETS
  ========================================================== */

  const setPreset = (
    preset:
      | 'yesterday'
      | 'l7'
      | 'l14'
      | 'l30'
      | 'mtd'
      | 'lastMonth'
  ) => {

    const today =
      new Date();


    let currentStart =
      new Date();


    let currentEnd =
      new Date();


    /* ========================================================
       YESTERDAY
    ======================================================== */

    if (
      preset ===
      'yesterday'
    ) {

      const yesterday =
        new Date(
          today
        );


      yesterday.setDate(
        today.getDate()
        -
        1
      );


      currentStart =
        yesterday;


      currentEnd =
        yesterday;

    }


    /* ========================================================
       LAST 7 DAYS
    ======================================================== */

    if (
      preset ===
      'l7'
    ) {

      currentEnd =
        today;


      currentStart =
        new Date(
          today
        );


      currentStart.setDate(
        today.getDate()
        -
        6
      );

    }


    /* ========================================================
       LAST 14 DAYS
    ======================================================== */

    if (
      preset ===
      'l14'
    ) {

      currentEnd =
        today;


      currentStart =
        new Date(
          today
        );


      currentStart.setDate(
        today.getDate()
        -
        13
      );

    }


    /* ========================================================
       LAST 30 DAYS
    ======================================================== */

    if (
      preset ===
      'l30'
    ) {

      currentEnd =
        today;


      currentStart =
        new Date(
          today
        );


      currentStart.setDate(
        today.getDate()
        -
        29
      );

    }


    /* ========================================================
       MONTH TO DATE
    ======================================================== */

    if (
      preset ===
      'mtd'
    ) {

      currentEnd =
        today;


      currentStart =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        );

    }


    /* ========================================================
       LAST MONTH
    ======================================================== */

    if (
      preset ===
      'lastMonth'
    ) {

      currentStart =
        new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          1
        );


      currentEnd =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          0
        );

    }


    /* ========================================================
       COMPARISON RANGE

       Same number of days immediately before
       selected current range.
    ======================================================== */

    const days =
      Math.round(
        (
          currentEnd.getTime()
          -
          currentStart.getTime()
        )
        /
        (
          1000
          *
          60
          *
          60
          *
          24
        )
      )
      +
      1;


    const nextCompareEnd =
      new Date(
        currentStart
      );


    nextCompareEnd.setDate(
      currentStart.getDate()
      -
      1
    );


    const nextCompareStart =
      new Date(
        nextCompareEnd
      );


    nextCompareStart.setDate(
      nextCompareEnd.getDate()
      -
      days
      +
      1
    );


    setStart(
      formatDate(
        currentStart
      )
    );


    setEnd(
      formatDate(
        currentEnd
      )
    );


    setCompareStart(
      formatDate(
        nextCompareStart
      )
    );


    setCompareEnd(
      formatDate(
        nextCompareEnd
      )
    );

  };


  /* ==========================================================
     CEO SUMMARY DATA
  ========================================================== */

  const [
    data,
    setData,
  ] = useState<Row[]>(
    []
  );


  const [
    compareData,
    setCompareData,
  ] = useState<Row[]>(
    []
  );


  const [
    loading,
    setLoading,
  ] = useState(
    false
  );


  /* ==========================================================
     FETCH CEO SUMMARY
  ========================================================== */

  const fetchData =
    async () => {

      setLoading(
        true
      );


      try {

        const currentRes =
          await fetch(
            `/api/ceo-summary?start=${start}&end=${end}`
          );


        if (
          !currentRes.ok
        ) {

          throw new Error(
            `CEO Summary request failed: ${currentRes.status}`
          );

        }


        const currentJson =
          await currentRes.json();


        const compareRes =
          await fetch(
            `/api/ceo-summary?start=${compareStart}&end=${compareEnd}`
          );


        if (
          !compareRes.ok
        ) {

          throw new Error(
            `CEO comparison request failed: ${compareRes.status}`
          );

        }


        const compareJson =
          await compareRes.json();


        setData(
          Array.isArray(
            currentJson
          )
            ? currentJson
            : []
        );


        setCompareData(
          Array.isArray(
            compareJson
          )
            ? compareJson
            : []
        );


      } catch (
        error
      ) {

        console.error(
          'DASHBOARD_FETCH_ERROR',
          error
        );


        setData(
          []
        );


        setCompareData(
          []
        );


      } finally {

        setLoading(
          false
        );

      }

    };


  /* ==========================================================
     INITIAL DATA LOAD
  ========================================================== */

  useEffect(
    () => {

      fetchData();

      // Initial load only.
      // eslint-disable-next-line react-hooks/exhaustive-deps

    },
    []
  );


  /* ==========================================================
     CEO METRICS
  ========================================================== */

  const metrics =
    useMemo(
      () => {

        const revenue =
          sum(
            data,
            'revenue'
          );


        const spend =
          sum(
            data,
            'total_spend'
          );


        const metaSpend =
          sum(
            data,
            'meta_spend'
          );


        const googleSpend =
          sum(
            data,
            'google_spend'
          );


        const metaRevenue =
          sum(
            data,
            'meta_revenue'
          );


        const googleRevenue =
          sum(
            data,
            'google_revenue'
          );


        const orders =
          sum(
            data,
            'orders'
          );


        const customers =
          sum(
            data,
            'customers'
          );


        const newCustomers =
          sum(
            data,
            'new_customers'
          );


        const repeatCustomers =
          sum(
            data,
            'repeat_customers'
          );


        const newRevenue =
          sum(
            data,
            'new_customer_revenue'
          );


        const repeatRevenue =
          sum(
            data,
            'repeat_customer_revenue'
          );


        const compareRevenue =
          sum(
            compareData,
            'revenue'
          );


        const compareSpend =
          sum(
            compareData,
            'total_spend'
          );


        const compareNewCustomers =
          sum(
            compareData,
            'new_customers'
          );


        const roas =
          safeDivide(
            revenue,
            spend
          );


        const compareRoas =
          safeDivide(
            compareRevenue,
            compareSpend
          );


        const newCac =
          safeDivide(
            spend,
            newCustomers
          );


        const compareNewCac =
          safeDivide(
            compareSpend,
            compareNewCustomers
          );


        return {

          revenue,

          spend,

          contribution:
            revenue
            -
            spend,

          roas,

          roi:
            safeDivide(
              revenue
              -
              spend,
              spend
            ),

          cac:
            safeDivide(
              spend,
              customers
            ),

          newCac,

          aov:
            safeDivide(
              revenue,
              orders
            ),

          orders,

          customers,

          newCustomers,

          repeatCustomers,

          newRevenue,

          repeatRevenue,

          metaSpend,

          googleSpend,

          metaRevenue,

          googleRevenue,

          organicRevenue:
            Math.max(
              revenue
              -
              metaRevenue
              -
              googleRevenue,
              0
            ),

          revenueDelta:
            pctChange(
              revenue,
              compareRevenue
            ),

          spendDelta:
            pctChange(
              spend,
              compareSpend
            ),

          roasDelta:
            pctChange(
              roas,
              compareRoas
            ),

          newCacDelta:
            pctChange(
              newCac,
              compareNewCac
            ),

          repeatRevenuePct:
            safeDivide(
              repeatRevenue,
              revenue
            )
            *
            100,

          newRevenuePct:
            safeDivide(
              newRevenue,
              revenue
            )
            *
            100,

        };

      },
      [
        data,
        compareData,
      ]
    );


  /* ==========================================================
     DATE CONTROL VISIBILITY

     Date controls belong on analytical OS pages.
     They are not required on platform administration pages.
  ========================================================== */

  const showDateControl =
    [

      'CEO Summary',
      'Meta OS',
      'Google OS',
      'Attribution OS',
      'Retention OS',
      'Product OS',

    ].includes(
      activeTab
    );


  /* ==========================================================
     UI
  ========================================================== */

  return (

    <main className="min-h-screen bg-[#f5f6f8]">


      <div className="flex min-h-screen">


        {/* ====================================================
            GLOBAL SIDEBAR
        ==================================================== */}

        <AppSidebar

          activeTab={
            activeTab
          }

          activeSubTabs={
            activeSubTabs
          }

          setActiveTab={
            setActiveTab
          }

          setActiveSubTab={
            setActiveSubTab
          }

          sidebarOpen={
            sidebarOpen
          }

          setSidebarOpen={
            setSidebarOpen
          }

        />


        {/* ====================================================
            APPLICATION
        ==================================================== */}

        <section className="min-w-0 flex-1">


          {/* ==================================================
              GLOBAL HEADER
          ================================================== */}

          <AppHeader

            activeTab={
              activeTab
            }

            actions={

              showDateControl

                ? (

                    <DateControl

                      start={
                        start
                      }

                      end={
                        end
                      }

                      compareStart={
                        compareStart
                      }

                      compareEnd={
                        compareEnd
                      }

                      setStart={
                        setStart
                      }

                      setEnd={
                        setEnd
                      }

                      setCompareStart={
                        setCompareStart
                      }

                      setCompareEnd={
                        setCompareEnd
                      }

                      onApply={
                        fetchData
                      }

                      loading={
                        loading
                      }

                      setPreset={
                        setPreset
                      }

                    />

                  )

                : null

            }

          />


          {/* ==================================================
              MAIN WORKSPACE
          ================================================== */}

          <div
            className="
              mx-auto
              max-w-[1680px]

              px-4
              py-5

              md:px-6
              xl:px-8
            "
          >

            <div className="text-slate-950">


              {/* ==============================================
                  COMMAND CENTER
              ============================================== */}

              {activeTab ===
                'CEO Summary' && (

                <CeoSummary

                  metrics={
                    metrics
                  }

                  data={
                    data
                  }

                />

              )}


              {/* ==============================================
                  META OS
              ============================================== */}

              {activeTab ===
                'Meta OS' && (

                <MetaOS

                  activeMetaTab={
                    activeSubTabs[
                      'Meta OS'
                    ]
                  }

                  start={
                    start
                  }

                  end={
                    end
                  }

                  compareStart={
                    compareStart
                  }

                  compareEnd={
                    compareEnd
                  }

                />

              )}


              {/* ==============================================
                  GOOGLE OS
              ============================================== */}

              {activeTab ===
                'Google OS' && (

                <GoogleOS

                  startDate={
                    start
                  }

                  endDate={
                    end
                  }

                  compareStartDate={
                    compareStart
                  }

                  compareEndDate={
                    compareEnd
                  }

                  activeGoogleTab={
                    activeSubTabs[
                      'Google OS'
                    ]
                  }


                />

              )}


              {/* ==============================================
                  ATTRIBUTION OS
              ============================================== */}

              {activeTab ===
                'Attribution OS' && (

                <AttributionOS

                  startDate={
                    start
                  }

                  endDate={
                    end
                  }

                  compareStartDate={
                    compareStart
                  }

                  compareEndDate={
                    compareEnd
                  }

                  activeTab={
                    activeSubTabs[
                      'Attribution OS'
                    ]
                  }

                />

              )}


              {/* ==============================================
                  RETENTION OS
              ============================================== */}

              {activeTab ===
                'Retention OS' && (

                <RetentionOS

                  selectedDate={
                    end
                  }

                  activeTab={
                    activeSubTabs[
                      'Retention OS'
                    ]
                  }

                  
                />

              )}


              {/* ==============================================
                  PRODUCT OS
              ============================================== */}

              {activeTab ===
                'Product OS' && (

                <ProductOS

                  startDate={
                    start
                  }

                  endDate={
                    end
                  }

                  compareStartDate={
                    compareStart
                  }

                  compareEndDate={
                    compareEnd
                  }

                  activeTab={
                    activeSubTabs[
                      'Product OS'
                    ]
                  }

                
                />

              )}


              {/* ==============================================
                  APP INTEGRATIONS
              ============================================== */}

              {activeTab ===
                'App Integrations' && (

                <AppIntegrations />

              )}

              {/* ==========================================================
    WAREHOUSE AUDIT
========================================================== */}


              {activeTab ===
  'Warehouse Audit' && (

  <WarehouseAudit />

)}


              {/* ==============================================
                  DATA HEALTH
              ============================================== */}

              {activeTab ===
                'Data Health' && (

                <PlatformPlaceholder

                  icon={
                    Activity
                  }

                  eyebrow="Data Sources"

                  title="Data Health"

                  description="Monitor the health of Shopify, BigQuery, marketing integrations, attribution collection and scheduled pipelines."

                  status="Infrastructure screen ready to connect"

                />

              )}


              {/* ==============================================
                  SYNC HISTORY
              ============================================== */}

              {activeTab ===
                'Sync History' && (

                <PlatformPlaceholder

                  icon={
                    History
                  }

                  eyebrow="Data Sources"

                  title="Sync History"

                  description="Review ingestion runs, scheduled refreshes, failures, retries and the latest successful sync for every Growth OS data source."

                  status="Sync history screen ready to connect"

                />

              )}


              {/* ==============================================
                  GLOBAL SETTINGS
              ============================================== */}

              {activeTab ===
                'Settings' && (

                <GrowthSettings />

              )}


            </div>

          </div>

        </section>

      </div>

    </main>

  );

}


/* ============================================================
   PLATFORM PLACEHOLDER
============================================================ */

function PlatformPlaceholder({

  icon:
    Icon,

  eyebrow,

  title,

  description,

  status,

}: {

  icon:
    any;

  eyebrow:
    string;

  title:
    string;

  description:
    string;

  status:
    string;

}) {

  return (

    <section
      className="
        rounded-2xl
        border
        border-slate-200

        bg-white

        p-8

        shadow-sm
      "
    >

      <div
        className="
          flex
          h-11
          w-11
          items-center
          justify-center

          rounded-xl

          bg-violet-50

          text-violet-600
        "
      >

        <Icon
          size={19}
        />

      </div>


      <p
        className="
          mt-5

          text-[10px]
          font-black
          uppercase
          tracking-[0.18em]

          text-violet-600
        "
      >
        {eyebrow}
      </p>


      <h2
        className="
          mt-1

          text-2xl
          font-black
          tracking-[-0.04em]

          text-slate-950
        "
      >
        {title}
      </h2>


      <p
        className="
          mt-2
          max-w-2xl

          text-sm
          leading-6

          text-slate-500
        "
      >
        {description}
      </p>


      <span
        className="
          mt-6
          inline-flex

          rounded-full

          bg-slate-100

          px-3
          py-1.5

          text-[10px]
          font-bold

          text-slate-500
        "
      >
        {status}
      </span>

    </section>

  );

}