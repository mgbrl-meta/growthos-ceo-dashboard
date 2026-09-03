'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Database,
  GitBranch,
  History,
  Lock,
  Megaphone,
  PackageSearch,
  Plug,
  Repeat2,
  Search,
  Settings,
} from 'lucide-react';


/* ============================================================
   TYPES
============================================================ */

type Props = {

  activeTab: string;

  activeSubTabs:
    Record<
      string,
      string
    >;

  setActiveTab: (
    tab: string
  ) => void;

  setActiveSubTab: (
    module: string,
    subTab: string
  ) => void;

  sidebarOpen: boolean;

  setSidebarOpen: (
    open: boolean
  ) => void;

};


type Plan =
  | 'starter'
  | 'pro'
  | 'advanced'
  | 'enterprise';


type ToolSetting = {

  id: string;

  name: string;

  enabled: boolean;

  requiredPlan:
    Plan;

};


type PlatformSettings = {

  tools?:
    ToolSetting[];

  plan?: {

    currentPlan?:
      Plan;

  };

};


/* ============================================================
   SETTINGS STORAGE
============================================================ */

const STORAGE_KEY =
  'growth_os_global_settings_v1';


/* ============================================================
   PLAN HIERARCHY
============================================================ */

const PLAN_ORDER:
  Record<
    Plan,
    number
  > = {

  starter:
    1,

  pro:
    2,

  advanced:
    3,

  enterprise:
    4,

};


/* ============================================================
   NAVIGATION CONFIGURATION

   toolId:
   - null = always available
   - string = controlled from Global Settings
============================================================ */

const groups = [

  /* ==========================================================
     WORKSPACE
  ========================================================== */

  {
    label:
      'Workspace',

    items: [

      {
        name:
          'CEO Summary',

        label:
          'Command Center',

        icon:
          CircleGauge,

        toolId:
          null,

        children:
          [],
      },

    ],
  },


  /* ==========================================================
     GROWTH
  ========================================================== */

  {
    label:
      'Growth',

    items: [

      {
        name:
          'Meta OS',

        label:
          'Meta',

        icon:
          Megaphone,

        toolId:
          'meta',

        children: [

          'Overview',
          'Campaign Analysis',
          'Ad Set Analysis',
          'Creative Analysis',
          'Funnel Analysis',
          'Alerts & Recommendations',
          'Settings',

        ],
      },


      {
        name:
          'Google OS',

        label:
          'Google',

        icon:
          Search,

        toolId:
          'google',

        children: [

          'Overview',
          'Channel Mix',
          'Campaign',
          'Ad Group',
          'Search Terms',
          'Keywords',
          'Funnel',
          'Alerts',
          'Settings',

        ],
      },


      {
        name:
          'Attribution OS',

        label:
          'Attribution',

        icon:
          GitBranch,

        toolId:
          'attribution',

        children: [

          'Overview',
          'Journey Explorer',
          'Channels',
          'Campaigns',
          'Creatives',
          'New vs Repeat',
          'Attribution Models',
          'Data Quality',

        ],
      },

    ],
  },


  /* ==========================================================
     CUSTOMERS
  ========================================================== */

  {
    label:
      'Customers',

    items: [

      {
        name:
          'Retention OS',

        label:
          'Retention',

        icon:
          Repeat2,

        toolId:
          'retention',

        children: [

          'Mission Control',
          'Daily Planner',
          'Opportunity Bank',
          'Pattern Discovery',
          'Hypothesis Lab',
          'Action Tracker',
          'Learning Loop',
          'Customer Journey',
          'Settings',

        ],
      },

    ],
  },


  /* ==========================================================
     COMMERCE
  ========================================================== */

  {
    label:
      'Commerce',

    items: [

      {
        name:
          'Product OS',

        label:
          'Product',

        icon:
          PackageSearch,

        toolId:
          'product',

        children: [

          'Overview',
          'SKU Performance',
          'Demand Trends',
          'Inventory Health',
          'Forecasting',
          'Seasonality',
          'Insights',
          'Settings',

        ],
      },

    ],
  },


  /* ==========================================================
     DATA SOURCES

     These are platform-level pages.
     They are NOT controlled by plan/tool settings.
  ========================================================== */

  {
    label:
      'Data Sources',

    items: [

      {
        name:
          'App Integrations',

        label:
          'App Integrations',

        icon:
          Plug,

        toolId:
          null,

        children:
          [],
      },


      {
        name:
          'Data Health',

        label:
          'Data Health',

        icon:
          Activity,

        toolId:
          null,

        children:
          [],
      },


      {
        name:
          'Sync History',

        label:
          'Sync History',

        icon:
          History,

        toolId:
          null,

        children:
          [],
      },

    ],
  },

  {
  label: 'System',

  items: [
    {
      name: 'Warehouse Audit',
      label: 'Warehouse',
      icon: Database,

      children: [],
    },
  ],
},

];


/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function AppSidebar({

  activeTab,

  activeSubTabs,

  setActiveTab,

  setActiveSubTab,

  sidebarOpen,

  setSidebarOpen,

}: Props) {


  /* ==========================================================
     SETTINGS STATE

     V1:
     Read from localStorage.

     Later:
     Replace this with global settings API/provider.
  ========================================================== */

  const [
    platformSettings,
    setPlatformSettings,
  ] =
    useState<
      PlatformSettings
    >({

      tools:
        [],

      plan: {

        currentPlan:
          'advanced',

      },

    });


  /* ==========================================================
     READ SAVED SETTINGS
  ========================================================== */

  function readSettings() {

    try {

      const raw =
        window.localStorage.getItem(
          STORAGE_KEY
        );


      /*
       * No saved settings yet:
       * preserve existing Growth OS behaviour.
       */
      if (!raw) {

        setPlatformSettings(
          {
            tools:
              [],

            plan: {
              currentPlan:
                'advanced',
            },
          }
        );


        return;

      }


      const parsed =
        JSON.parse(
          raw
        );


      setPlatformSettings(
        parsed
      );


    } catch (
      error
    ) {

      console.error(
        'SIDEBAR_SETTINGS_READ_ERROR',
        error
      );

    }

  }


  /* ==========================================================
     INITIAL SETTINGS LOAD
     +
     LIVE SETTINGS UPDATE EVENTS
  ========================================================== */

  useEffect(
    () => {

      readSettings();


      /*
       * Same-tab updates.
       *
       * GrowthSettings dispatches this event
       * after Save Changes.
       */
      function handleSettingsUpdate(
        event: Event
      ) {

        const customEvent =
          event as CustomEvent<
            PlatformSettings
          >;


        if (
          customEvent.detail
        ) {

          setPlatformSettings(
            customEvent.detail
          );

          return;

        }


        readSettings();

      }


      /*
       * Cross-tab / cross-window localStorage update.
       */
      function handleStorage() {

        readSettings();

      }


      window.addEventListener(
        'growth-os-settings-updated',
        handleSettingsUpdate
      );


      window.addEventListener(
        'storage',
        handleStorage
      );


      return () => {

        window.removeEventListener(
          'growth-os-settings-updated',
          handleSettingsUpdate
        );


        window.removeEventListener(
          'storage',
          handleStorage
        );

      };

    },
    []
  );


  /* ==========================================================
     CURRENT PLAN
  ========================================================== */

  const currentPlan =
    (
      platformSettings
        ?.plan
        ?.currentPlan
      ||
      'advanced'
    ) as Plan;


  /* ==========================================================
     TOOL LOOKUP MAP
  ========================================================== */

  const toolMap =
    useMemo(
      () => {

        const map =
          new Map<
            string,
            ToolSetting
          >();


        for (
          const tool
          of platformSettings.tools ||
          []
        ) {

          map.set(
            tool.id,
            tool
          );

        }


        return map;

      },
      [
        platformSettings,
      ]
    );


  /* ==========================================================
     TOOL ACCESS

     visible:
       false = tool disabled by workspace admin

     allowed:
       false = tool enabled but current plan too low
  ========================================================== */

  function getToolState(
    toolId:
      string |
      null
  ) {

    /*
     * Platform pages are always available.
     */
    if (!toolId) {

      return {

        visible:
          true,

        allowed:
          true,

        requiredPlan:
          null as Plan | null,

      };

    }


    const tool =
      toolMap.get(
        toolId
      );


    /*
     * No saved configuration for this tool yet.
     *
     * Preserve existing app behaviour.
     */
    if (!tool) {

      return {

        visible:
          true,

        allowed:
          true,

        requiredPlan:
          null as Plan | null,

      };

    }


    /*
     * Disabled tool:
     * remove from navigation entirely.
     */
    if (!tool.enabled) {

      return {

        visible:
          false,

        allowed:
          false,

        requiredPlan:
          tool.requiredPlan,

      };

    }


    const currentLevel =
      PLAN_ORDER[
        currentPlan
      ];


    const requiredLevel =
      PLAN_ORDER[
        tool.requiredPlan
      ];


    return {

      visible:
        true,

      allowed:
        currentLevel >=
        requiredLevel,

      requiredPlan:
        tool.requiredPlan,

    };

  }


  /* ==========================================================
     SAFETY GUARD

     Example:
     User is currently inside Google OS.
     Then admin disables Google OS in Settings.

     We must not leave hidden Google UI mounted.
  ========================================================== */

  useEffect(
    () => {

      for (
        const group
        of groups
      ) {

        for (
          const item
          of group.items
        ) {

          if (
            item.name !==
            activeTab
          ) {

            continue;

          }


          const access =
            getToolState(
              item.toolId
            );


          /*
           * Disabled module:
           * return to Command Center.
           */
          if (
            !access.visible
          ) {

            setActiveTab(
              'CEO Summary'
            );

            return;

          }


          /*
           * Enabled but plan locked:
           * send to global settings.
           */
          if (
            !access.allowed
          ) {

            setActiveTab(
              'Settings'
            );

            return;

          }

        }

      }

    },
    [
      platformSettings,
      activeTab,
      setActiveTab,
    ]
  );


  /* ==========================================================
     SELECT MODULE
  ========================================================== */

  function selectModule(

    module:
      string,

    toolId:
      string |
      null

  ) {

    const access =
      getToolState(
        toolId
      );


    /*
     * Disabled modules shouldn't normally
     * render at all, but keep this guard.
     */
    if (
      !access.visible
    ) {

      return;

    }


    /*
     * Tool exists but current plan
     * does not permit access.
     */
    if (
      !access.allowed
    ) {

      setActiveTab(
        'Settings'
      );


      if (!sidebarOpen) {

        setSidebarOpen(
          true
        );

      }


      return;

    }


    setActiveTab(
      module
    );


    /*
     * When sidebar is collapsed,
     * reopen it so child navigation
     * becomes visible.
     */
    if (!sidebarOpen) {

      setSidebarOpen(
        true
      );

    }

  }


  /* ==========================================================
     UI
  ========================================================== */

  return (

    <aside
      className={`
        sticky
        top-0
        z-50
        h-screen
        shrink-0

        border-r
        border-slate-800

        bg-[#0e1420]

        text-white

        transition-all
        duration-300

        ${
          sidebarOpen
            ? 'w-[230px]'
            : 'w-[68px]'
        }
      `}
    >


      {/* =====================================================
          SIDEBAR OPEN / CLOSE
      ===================================================== */}

      <button
        type="button"

        onClick={() =>
          setSidebarOpen(
            !sidebarOpen
          )
        }

        title={
          sidebarOpen
            ? 'Collapse sidebar'
            : 'Open sidebar'
        }

        className="
          absolute
          -right-3.5
          top-[22px]
          z-[100]

          flex
          h-7
          w-7
          items-center
          justify-center

          rounded-full

          border
          border-slate-200

          bg-white

          text-slate-600

          shadow-md

          transition

          hover:bg-slate-50
          hover:text-slate-950
        "
      >

        {sidebarOpen ? (

          <ChevronLeft
            size={15}
            strokeWidth={2.3}
          />

        ) : (

          <ChevronRight
            size={15}
            strokeWidth={2.3}
          />

        )}

      </button>


      <div className="flex h-full flex-col">


        {/* ===================================================
            BRAND
        =================================================== */}

        <div
          className={`
            flex
            h-[70px]
            items-center

            border-b
            border-white/5

            ${
              sidebarOpen
                ? 'px-4'
                : 'justify-center'
            }
          `}
        >

          <div className="flex items-center gap-3">


            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center

                rounded-xl

                bg-gradient-to-br
                from-violet-500
                to-blue-500

                text-sm
                font-black
                text-white

                shadow-lg
                shadow-violet-950/40
              "
            >
              G
            </div>


            {sidebarOpen && (

              <div>

                <div className="text-[15px] font-black tracking-[-0.03em]">
                  Growth OS
                </div>


                <div className="text-[10px] font-medium text-slate-500">
                  Business Intelligence
                </div>

              </div>

            )}

          </div>

        </div>


        {/* ===================================================
            NAVIGATION
        =================================================== */}

        <div className="flex-1 overflow-y-auto px-2 py-4">


          {groups.map(
            group => {


              /*
               * Remove disabled tools before rendering.
               */
              const visibleItems =
                group.items.filter(
                  item =>
                    getToolState(
                      item.toolId
                    ).visible
                );


              /*
               * Don't render an empty group heading.
               */
              if (
                visibleItems.length ===
                0
              ) {

                return null;

              }


              return (

                <div
                  key={
                    group.label
                  }

                  className="mb-5"
                >


                  {/* =========================================
                      GROUP LABEL
                  ========================================= */}

                  {sidebarOpen && (

                    <div
                      className="
                        mb-2
                        px-3

                        text-[9px]
                        font-bold
                        uppercase
                        tracking-[0.17em]

                        text-slate-600
                      "
                    >
                      {group.label}
                    </div>

                  )}


                  <div className="space-y-1">


                    {visibleItems.map(
                      item => {

                        const Icon =
                          item.icon;


                        const active =
                          activeTab ===
                          item.name;


                        const activeSubTab =
                          activeSubTabs[
                            item.name
                          ];


                        const access =
                          getToolState(
                            item.toolId
                          );


                        return (

                          <div
                            key={
                              item.name
                            }
                          >


                            {/* =============================
                                MODULE
                            ============================= */}

                            <button
                              type="button"

                              title={

                                access.allowed

                                  ? item.label

                                  : `${item.label} — ${prettyPlan(
                                      access.requiredPlan
                                    )} plan required`

                              }

                              onClick={() =>
                                selectModule(
                                  item.name,
                                  item.toolId
                                )
                              }

                              className={`
                                flex
                                w-full
                                items-center

                                rounded-xl

                                transition-all
                                duration-200


                                ${
                                  sidebarOpen

                                    ? 'gap-3 px-3 py-2.5'

                                    : 'justify-center py-2.5'
                                }


                                ${
                                  active

                                    ? `
                                      bg-white
                                      text-slate-950
                                      shadow-sm
                                    `

                                    : access.allowed

                                      ? `
                                        text-slate-400

                                        hover:bg-white/[0.06]
                                        hover:text-white
                                      `

                                      : `
                                        text-slate-600

                                        hover:bg-white/[0.04]
                                        hover:text-slate-400
                                      `
                                }
                              `}
                            >


                              <Icon
                                size={17}

                                strokeWidth={
                                  active
                                    ? 2.4
                                    : 1.8
                                }
                              />


                              {sidebarOpen && (

                                <>

                                  <span className="text-[13px] font-semibold">
                                    {item.label}
                                  </span>


                                  {/* PLAN LOCK */}

                                  {!access.allowed ? (

                                    <Lock
                                      size={13}
                                      className="ml-auto text-slate-600"
                                    />

                                  ) : (

                                    item.children.length >
                                    0 && (

                                      <ChevronDown
                                        size={14}

                                        className={`
                                          ml-auto
                                          transition-transform

                                          ${
                                            active
                                              ? 'rotate-180'
                                              : ''
                                          }
                                        `}
                                      />

                                    )

                                  )}

                                </>

                              )}

                            </button>


                            {/* =============================
                                SUB NAVIGATION

                                Render only for active,
                                accessible module.
                            ============================= */}

                            {sidebarOpen &&
                              active &&
                              access.allowed &&
                              item.children.length >
                                0 && (

                              <div
                                className="
                                  ml-[22px]
                                  mt-1

                                  border-l
                                  border-white/10

                                  pl-3
                                "
                              >

                                <div className="space-y-0.5">


                                  {item.children.map(
                                    subTab => {

                                      const selected =
                                        activeSubTab ===
                                        subTab;


                                      return (

                                        <button
                                          key={
                                            subTab
                                          }

                                          type="button"

                                          onClick={() =>
                                            setActiveSubTab(
                                              item.name,
                                              subTab
                                            )
                                          }

                                          className={`
                                            relative

                                            flex
                                            w-full
                                            items-center

                                            rounded-lg

                                            px-2.5
                                            py-1.5

                                            text-left
                                            text-[11px]

                                            transition


                                            ${
                                              selected

                                                ? `
                                                  bg-violet-500/10

                                                  font-bold

                                                  text-violet-300
                                                `

                                                : `
                                                  font-medium

                                                  text-slate-500

                                                  hover:bg-white/[0.04]
                                                  hover:text-slate-200
                                                `
                                            }
                                          `}
                                        >


                                          {selected && (

                                            <span
                                              className="
                                                absolute
                                                -left-[13px]

                                                h-4
                                                w-[2px]

                                                rounded-full

                                                bg-violet-400
                                              "
                                            />

                                          )}


                                          {subTab}

                                        </button>

                                      );

                                    }
                                  )}

                                </div>

                              </div>

                            )}

                          </div>

                        );

                      }
                    )}

                  </div>

                </div>

              );

            }
          )}

        </div>


        {/* ===================================================
            GLOBAL SETTINGS
        =================================================== */}

        <div className="border-t border-white/5 p-2">


          <button
            type="button"

            title="Settings"

            onClick={() => {

              setActiveTab(
                'Settings'
              );


              if (!sidebarOpen) {

                setSidebarOpen(
                  true
                );

              }

            }}

            className={`
              flex
              w-full
              items-center

              rounded-xl

              transition


              ${
                sidebarOpen
                  ? 'gap-3 px-3 py-2.5'
                  : 'justify-center py-2.5'
              }


              ${
                activeTab ===
                'Settings'

                  ? `
                    bg-white
                    text-slate-950
                  `

                  : `
                    text-slate-400

                    hover:bg-white/[0.06]
                    hover:text-white
                  `
              }
            `}
          >


            <Settings
              size={17}

              strokeWidth={
                activeTab ===
                'Settings'
                  ? 2.4
                  : 1.8
              }
            />


            {sidebarOpen && (

              <span className="text-[13px] font-semibold">
                Settings
              </span>

            )}

          </button>

        </div>


        {/* ===================================================
            STATUS
        =================================================== */}

        <div className="border-t border-white/5 p-3">


          {sidebarOpen ? (

            <div
              className="
                rounded-xl

                border
                border-white/[0.06]

                bg-white/[0.03]

                p-3
              "
            >

              <div className="flex items-center gap-2">


                <span className="relative flex h-2 w-2">

                  <span
                    className="
                      absolute

                      inline-flex

                      h-full
                      w-full

                      animate-ping

                      rounded-full

                      bg-emerald-400

                      opacity-50
                    "
                  />


                  <span
                    className="
                      relative

                      inline-flex

                      h-2
                      w-2

                      rounded-full

                      bg-emerald-500
                    "
                  />

                </span>


                <span className="text-[11px] font-semibold text-slate-300">
                  Live data connected
                </span>

              </div>

            </div>

          ) : (

            <div className="flex justify-center py-2">

              <span className="h-2 w-2 rounded-full bg-emerald-500" />

            </div>

          )}

        </div>

      </div>

    </aside>

  );

}


/* ============================================================
   HELPERS
============================================================ */

function prettyPlan(
  value:
    Plan |
    null
) {

  if (!value) {

    return '';

  }


  return (
    value
      .charAt(
        0
      )
      .toUpperCase()
    +
    value.slice(
      1
    )
  );

}