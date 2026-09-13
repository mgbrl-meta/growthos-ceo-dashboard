'use client';

import {
  useEffect,
  useMemo,
  useRef,
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

import GrowthSettings
  from './settings/GrowthSettings';

import type {
  ClientEffectiveAccess,
} from '@/lib/auth/client-effective-access';

import {
  getGrowthOSSubmodules,
} from '@/lib/auth/submodule-registry';

import {
  applyGrowthOSTableDensity,
  DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES,
  GROWTH_OS_PREFERENCES_UPDATED_EVENT,
  readGrowthOSPersonalPreferences,
  type GrowthOSDefaultDateRange,
  type GrowthOSPersonalPreferences,
} from '@/lib/preferences/client-preferences';

import {
  Activity,
  History,
} from 'lucide-react';


type Row = any;


// ============================================================
// CANONICAL DASHBOARD MODULE NAVIGATION
//
// moduleId = server/control-plane identity
// tab      = current client navigation identity
// ============================================================

const MODULE_NAVIGATION = [

  {
    moduleId:
      'command-center',

    tab:
      'CEO Summary',
  },

  {
    moduleId:
      'meta',

    tab:
      'Meta OS',
  },

  {
    moduleId:
      'google',

    tab:
      'Google OS',
  },

  {
    moduleId:
      'attribution',

    tab:
      'Attribution OS',
  },

  {
    moduleId:
      'retention',

    tab:
      'Retention OS',
  },

  {
    moduleId:
      'product',

    tab:
      'Product OS',
  },

] as const;


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


function buildRollingDateRange(
  range:
    GrowthOSDefaultDateRange
) {

  const days =
    Number(
      range
    );


  const currentEnd =
    new Date();


  const currentStart =
    new Date(
      currentEnd
    );


  currentStart.setDate(
    currentEnd.getDate()
    -
    days
    +
    1
  );


  const compareEnd =
    new Date(
      currentStart
    );


  compareEnd.setDate(
    currentStart.getDate()
    -
    1
  );


  const compareStart =
    new Date(
      compareEnd
    );


  compareStart.setDate(
    compareEnd.getDate()
    -
    days
    +
    1
  );


  return {
    currentStart,
    currentEnd,
    compareStart,
    compareEnd,
  };

}


function dateRangeToPreset(
  range:
    GrowthOSDefaultDateRange
) {

  switch (
    range
  ) {

    case '7':
      return 'l7' as const;

    case '14':
      return 'l14' as const;

    case '90':
      return 'l90' as const;

    default:
      return 'l30' as const;

  }

}


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
    false
  );


  /* ==========================================================
     EFFECTIVE ACCESS
  ========================================================== */

  const [
    effectiveAccess,
    setEffectiveAccess,
  ] =
    useState<
      ClientEffectiveAccess |
      null
    >(
      null
    );


  const [
    accessLoading,
    setAccessLoading,
  ] =
    useState(
      true
    );


  const [
    accessError,
    setAccessError,
  ] =
    useState(
      ''
    );


  /* ==========================================================
     PERSONAL RUNTIME PREFERENCES
  ========================================================== */

  const [
    runtimePreferences,
    setRuntimePreferences,
  ] =
    useState<
      GrowthOSPersonalPreferences
    >(
      DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES
    );


  const [
    preferencesReady,
    setPreferencesReady,
  ] =
    useState(
      false
    );


  const [
    initialLandingResolved,
    setInitialLandingResolved,
  ] =
    useState(
      false
    );


  const initialLandingAppliedRef =
    useRef(
      false
    );


  /* ==========================================================
     LOAD CURRENT EFFECTIVE ACCESS

     Browser never supplies workspace / brand identity.

     The server resolves the current authenticated tenant and
     returns the canonical effective-access snapshot.
  ========================================================== */

  useEffect(
    () => {

      let cancelled =
        false;


      async function loadAccess() {

        try {

          setAccessLoading(
            true
          );


          setAccessError(
            ''
          );


          const response =
            await fetch(
              '/api/auth/effective-access',
              {

                cache:
                  'no-store',

                credentials:
                  'same-origin',

              }
            );


          const json =
            await response.json();


          if (
            response.status ===
              401
          ) {

            window.location.assign(
              '/login'
            );


            return;

          }


          if (
            !response.ok
            ||
            !json?.ok
            ||
            !json?.access
          ) {

            throw new Error(
              json?.error
              ||
              'Unable to load Growth OS access'
            );

          }


          if (!cancelled) {

            setEffectiveAccess(
              json.access
            );

          }

        } catch (
          error:
            any
        ) {

          if (!cancelled) {

            setEffectiveAccess(
              null
            );


            setAccessError(
              String(
                error?.message
                ||
                'Unable to load Growth OS access'
              )
            );

          }

        } finally {

          if (!cancelled) {

            setAccessLoading(
              false
            );

          }

        }

      }


      loadAccess();


      return () => {

        cancelled =
          true;

      };

    },
    []
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
      | 'l90'
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
       LAST 90 DAYS
    ======================================================== */

    if (
      preset ===
      'l90'
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
        89
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
     LOAD USER-SCOPED RUNTIME PREFERENCES

     The dashboard waits for these defaults before rendering any
     analytical module. This prevents an initial 30-day request
     when the user's saved default is 7 / 14 / 90 days.
  ========================================================== */

  useEffect(
    () => {

      if (!effectiveAccess) {
        return;
      }


      const stored =
        readGrowthOSPersonalPreferences(
          effectiveAccess.userId
        );


      setRuntimePreferences(
        stored
      );


      applyGrowthOSTableDensity(
        stored.tableDensity
      );


      const range =
        buildRollingDateRange(
          stored.defaultDateRange
        );


      setStart(
        formatDate(
          range.currentStart
        )
      );


      setEnd(
        formatDate(
          range.currentEnd
        )
      );


      setCompareStart(
        formatDate(
          range.compareStart
        )
      );


      setCompareEnd(
        formatDate(
          range.compareEnd
        )
      );


      initialLandingAppliedRef.current =
        false;


      setInitialLandingResolved(
        false
      );


      setPreferencesReady(
        true
      );

    },
    [
      effectiveAccess?.userId,
    ]
  );


  /* ==========================================================
     LIVE PREFERENCE UPDATES

     Interface preferences such as density/sidebar should take
     effect immediately. Landing/date defaults remain "next open"
     defaults and therefore do not forcibly navigate or replace a
     user's current date selection after Save.
  ========================================================== */

  useEffect(
    () => {

      function handlePreferencesUpdate(
        event:
          Event
      ) {

        const customEvent =
          event as CustomEvent<{
            userId?: string;
            preferences?: GrowthOSPersonalPreferences;
          }>;


        const detail =
          customEvent.detail;


        if (
          !detail?.preferences
        ) {
          return;
        }


        if (
          detail.userId
          && effectiveAccess?.userId
          && detail.userId !==
            effectiveAccess.userId
        ) {
          return;
        }


        setRuntimePreferences(
          previous => ({
            ...previous,
            sidebarMode:
              detail.preferences!.sidebarMode,
            tableDensity:
              detail.preferences!.tableDensity,
          })
        );


        applyGrowthOSTableDensity(
          detail.preferences.tableDensity
        );

      }


      window.addEventListener(
        GROWTH_OS_PREFERENCES_UPDATED_EVENT,
        handlePreferencesUpdate
      );


      return () => {

        window.removeEventListener(
          GROWTH_OS_PREFERENCES_UPDATED_EVENT,
          handlePreferencesUpdate
        );

      };

    },
    [
      effectiveAccess?.userId,
    ]
  );


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
     INITIAL CEO DATA LOAD

     Do not call Command Center APIs until effective access has
     resolved. A user without Command Center access must never
     generate a speculative CEO Summary request.
  ========================================================== */

  useEffect(
    () => {

      if (
        !effectiveAccess
        || !preferencesReady
        || !initialLandingResolved
        || activeTab !==
          'CEO Summary'
      ) {

        return;

      }


      const commandCenterPermission =
        effectiveAccess
          .modules[
            'command-center'
          ]
          ?.effectivePermission;


      if (
        !commandCenterPermission
        ||
        commandCenterPermission ===
          'disabled'
      ) {

        return;

      }


      fetchData();

      // Access resolution triggers the one initial CEO load.
      // eslint-disable-next-line react-hooks/exhaustive-deps

    },
    [
      effectiveAccess,
      preferencesReady,
      initialLandingResolved,
      activeTab,
    ]
  );


  /* ==========================================================
     DEFAULT LANDING PAGE

     Apply once when the app opens. If the preferred module is
     unavailable, fall back to the first module the user can use.
  ========================================================== */

  useEffect(
    () => {

      if (
        !effectiveAccess
        || !preferencesReady
        || initialLandingAppliedRef.current
      ) {
        return;
      }


      const preferred =
        MODULE_NAVIGATION.find(
          item =>
            item.tab ===
              runtimePreferences.defaultLandingPage
        );


      const preferredAllowed =
        Boolean(
          preferred
        )
        && effectiveAccess
          .modules[
            preferred!.moduleId
          ]
          ?.effectivePermission !==
          'disabled';


      const firstAllowed =
        MODULE_NAVIGATION.find(
          item =>
            effectiveAccess
              .modules[
                item.moduleId
              ]
              ?.effectivePermission !==
            'disabled'
        );


      setActiveTab(
        preferredAllowed
          ? preferred!.tab
          : firstAllowed?.tab
            || 'Settings'
      );


      initialLandingAppliedRef.current =
        true;


      setInitialLandingResolved(
        true
      );

    },
    [
      effectiveAccess,
      preferencesReady,
      runtimePreferences.defaultLandingPage,
    ]
  );


  /* ==========================================================
     MODULE FALLBACK

     If the current module becomes unavailable, immediately
     move to the first allowed module.

     Settings remains available as the final safe destination.
  ========================================================== */

  useEffect(
    () => {

      if (!effectiveAccess) {

        return;

      }


      if (
        activeTab ===
          'Settings'
      ) {

        return;

      }


      const currentModule =
        MODULE_NAVIGATION.find(
          item =>
            item.tab ===
              activeTab
        );


      const currentAllowed =
        Boolean(
          currentModule
        )
        &&
        effectiveAccess
          .modules[
            currentModule!
              .moduleId
          ]
          ?.effectivePermission
        !==
        'disabled';


      if (currentAllowed) {

        return;

      }


      const firstAllowed =
        MODULE_NAVIGATION.find(
          item =>
            effectiveAccess
              .modules[
                item.moduleId
              ]
              ?.effectivePermission
            !==
            'disabled'
        );


      setActiveTab(
        firstAllowed
          ?.tab
        ||
        'Settings'
      );

    },
    [
      effectiveAccess,
      activeTab,
    ]
  );


  /* ==========================================================
     SUBMODULE FALLBACK

     Each module remembers the selected subtab. If permissions
     later remove that subtab, automatically select the first
     allowed submodule from the canonical registry.
  ========================================================== */

  useEffect(
    () => {

      if (!effectiveAccess) {

        return;

      }


      let changed =
        false;


      const nextSubTabs =
        {
          ...activeSubTabs,
        };


      for (
        const item
        of MODULE_NAVIGATION
      ) {

        const moduleAccess =
          effectiveAccess
            .modules[
              item.moduleId
            ];


        if (
          !moduleAccess
          ||
          moduleAccess
            .effectivePermission ===
            'disabled'
        ) {

          continue;

        }


        const registry =
          getGrowthOSSubmodules(
            item.moduleId
          );


        if (
          registry.length ===
          0
        ) {

          continue;

        }


        const selectedLabel =
          activeSubTabs[
            item.tab
          ];


        const selectedDefinition =
          registry.find(
            submodule =>
              submodule.label ===
                selectedLabel
          );


        const selectedAllowed =
          Boolean(
            selectedDefinition
          )
          &&
          moduleAccess
            .submodules[
              selectedDefinition!
                .submoduleId
            ]
            ?.effectivePermission
          !==
          'disabled';


        if (selectedAllowed) {

          continue;

        }


        const firstAllowed =
          registry.find(
            submodule =>
              moduleAccess
                .submodules[
                  submodule.submoduleId
                ]
                ?.effectivePermission
              !==
              'disabled'
          );


        if (
          firstAllowed
          &&
          nextSubTabs[
            item.tab
          ] !==
            firstAllowed.label
        ) {

          nextSubTabs[
            item.tab
          ] =
            firstAllowed.label;


          changed =
            true;

        }

      }


      if (changed) {

        setActiveSubTabs(
          nextSubTabs
        );

      }

    },
    [
      effectiveAccess,
      activeSubTabs,
    ]
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
     DIRECT COMPONENT ACCESS GUARD

     Sidebar filtering is only navigation UX.

     These checks also prevent a denied module from rendering
     if activeTab is manipulated or becomes stale.
  ========================================================== */

  function moduleVisible(
    moduleId:
      string
  ) {

    return (
      effectiveAccess
        ?.modules[
          moduleId
        ]
        ?.effectivePermission
      !==
      'disabled'
    );

  }


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
     ACCESS RESOLUTION UI
  ========================================================== */

  if (
    accessLoading
    || !preferencesReady
    || !initialLandingResolved
  ) {

    return (

      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center

          bg-[#f5f6f8]
        "
      >

        <div
          className="
            text-sm
            font-semibold

            text-slate-500
          "
        >
          Loading Growth OS access…
        </div>

      </main>

    );

  }


  if (
    accessError
    ||
    !effectiveAccess
  ) {

    return (

      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center

          bg-[#f5f6f8]

          px-6
        "
      >

        <section
          className="
            w-full
            max-w-md

            rounded-2xl
            border
            border-slate-200

            bg-white

            p-6

            shadow-sm
          "
        >

          <h2
            className="
              text-base
              font-bold

              text-slate-950
            "
          >
            Access unavailable
          </h2>


          <p
            className="
              mt-2

              text-sm
              leading-6

              text-slate-500
            "
          >
            {accessError
              ||
              'Growth OS could not resolve your current access.'}
          </p>

        </section>

      </main>

    );

  }


  /* ==========================================================
     UI
  ========================================================== */

  return (

    <main
      data-growth-os-table-density={
        runtimePreferences.tableDensity
      }
      className="min-h-screen bg-[#f5f6f8]"
    >


      <div className="flex min-h-screen">


        {/* ====================================================
            GLOBAL SIDEBAR
        ==================================================== */}

        <AppSidebar

          access={
            effectiveAccess
          }

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

                      defaultPreset={
                        dateRangeToPreset(
                          runtimePreferences.defaultDateRange
                        )
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
              max-w-[1880px]

              px-3
              py-2.5

              md:px-3
              xl:px-3
            "
          >

            <div className="text-slate-950">


              {/* ==============================================
                  COMMAND CENTER
              ============================================== */}

              {activeTab ===
                'CEO Summary'
                &&
                moduleVisible(
                  'command-center'
                ) && (

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
                'Meta OS'
                &&
                moduleVisible(
                  'meta'
                ) && (

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
                'Google OS'
                &&
                moduleVisible(
                  'google'
                ) && (

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
                'Attribution OS'
                &&
                moduleVisible(
                  'attribution'
                ) && (

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
                'Retention OS'
                &&
                moduleVisible(
                  'retention'
                ) && (

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
                'Product OS'
                &&
                moduleVisible(
                  'product'
                ) && (

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
      className="gos-panel"
    >

      <div
        className="
          flex
          h-9
          w-9
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
          mt-3

          text-[10px]
          font-semibold
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

          text-[14px]
          font-semibold
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

          text-[11px]
          leading-6

          text-slate-500
        "
      >
        {description}
      </p>


      <span
        className="
          mt-3
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
