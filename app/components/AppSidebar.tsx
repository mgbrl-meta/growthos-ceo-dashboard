'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Activity,
  ChevronDown,
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


// ============================================================
// TYPES
// ============================================================

type Props = {

  activeTab:
    string;

  activeSubTabs:
    Record<
      string,
      string
    >;

  setActiveTab:
    (
      tab: string
    ) => void;

  setActiveSubTab:
    (
      module: string,
      subTab: string
    ) => void;

  // TRUE  = fixed / always expanded
  // FALSE = cursor / hover expansion

  sidebarOpen:
    boolean;

  setSidebarOpen:
    (
      open: boolean
    ) => void;

};


type Plan =
  | 'starter'
  | 'pro'
  | 'advanced'
  | 'enterprise';


type ToolSetting = {

  id:
    string;

  name:
    string;

  enabled:
    boolean;

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


// ============================================================
// STORAGE
// ============================================================

const STORAGE_KEY =
  'growth_os_global_settings_v1';


const SIDEBAR_MODE_KEY =
  'growth_os_sidebar_mode_v1';


// ============================================================
// PLAN HIERARCHY
// ============================================================

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


// ============================================================
// NAVIGATION TYPES
// ============================================================

type NavigationItem = {

  name:
    string;

  label:
    string;

  icon:
    typeof CircleGauge;

  toolId:
    string | null;

  children:
    string[];

};


type NavigationGroup = {

  label:
    string;

  items:
    NavigationItem[];

};


// ============================================================
// NAVIGATION CONFIGURATION
// ============================================================

const groups:
  NavigationGroup[] = [

  // ==========================================================
  // WORKSPACE
  // ==========================================================

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


  // ==========================================================
  // GROWTH
  // ==========================================================

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


  // ==========================================================
  // CUSTOMERS
  // ==========================================================

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


  // ==========================================================
  // COMMERCE
  // ==========================================================

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


  // ==========================================================
  // DATA SOURCES
  // ==========================================================

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


  // ==========================================================
  // SYSTEM
  // ==========================================================

  {

    label:
      'System',

    items: [

      {

        name:
          'Warehouse Audit',

        label:
          'Warehouse',

        icon:
          Database,

        toolId:
          null,

        children:
          [],

      },

    ],

  },

];


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AppSidebar({

  activeTab,

  activeSubTabs,

  setActiveTab,

  setActiveSubTab,

  sidebarOpen,

  setSidebarOpen,

}: Props) {


  // ==========================================================
  // HOVER EXPANSION
  // ==========================================================

  const [
    hovered,
    setHovered,
  ] =
    useState(
      false
    );


  const openTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      >
      |
      null
    >(
      null
    );


  const closeTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      >
      |
      null
    >(
      null
    );


  // ----------------------------------------------------------
  // Expanded when:
  //
  // sidebarOpen = fixed mode
  // hovered     = cursor mode temporary expansion
  // ----------------------------------------------------------

  const expanded =
    sidebarOpen ||
    hovered;


  // ==========================================================
  // RESTORE SAVED SIDEBAR MODE
  // ==========================================================

  useEffect(
    () => {

      try {

        const savedMode =
          window.localStorage.getItem(
            SIDEBAR_MODE_KEY
          );


        if (
          savedMode ===
          'fixed'
        ) {

          setSidebarOpen(
            true
          );

        }


        if (
          savedMode ===
          'cursor'
        ) {

          setSidebarOpen(
            false
          );

        }

      } catch (
        error
      ) {

        console.error(
          'SIDEBAR_MODE_READ_ERROR',
          error
        );

      }

    },
    [
      setSidebarOpen,
    ]
  );


  // ==========================================================
  // TOGGLE SIDEBAR MODE
  // ==========================================================

  function toggleSidebarMode() {

    const nextFixed =
      !sidebarOpen;


    setSidebarOpen(
      nextFixed
    );


    // --------------------------------------------------------
    // When changing from fixed -> cursor while the mouse is
    // already inside the sidebar, keep it open until mouse
    // leaves. This prevents an abrupt collapse under cursor.
    // --------------------------------------------------------

    setHovered(
      !nextFixed
    );


    try {

      window.localStorage.setItem(
        SIDEBAR_MODE_KEY,
        nextFixed
          ? 'fixed'
          : 'cursor'
      );

    } catch (
      error
    ) {

      console.error(
        'SIDEBAR_MODE_SAVE_ERROR',
        error
      );

    }

  }


  // ==========================================================
  // TIMER HELPERS
  // ==========================================================

  function clearTimers() {

    if (
      openTimer.current
    ) {

      clearTimeout(
        openTimer.current
      );

      openTimer.current =
        null;

    }


    if (
      closeTimer.current
    ) {

      clearTimeout(
        closeTimer.current
      );

      closeTimer.current =
        null;

    }

  }


  function handleMouseEnter() {

    if (
      sidebarOpen
    ) {

      return;

    }


    if (
      closeTimer.current
    ) {

      clearTimeout(
        closeTimer.current
      );

      closeTimer.current =
        null;

    }


    openTimer.current =
      setTimeout(
        () => {

          setHovered(
            true
          );

        },
        120
      );

  }


  function handleMouseLeave() {

    if (
      sidebarOpen
    ) {

      return;

    }


    if (
      openTimer.current
    ) {

      clearTimeout(
        openTimer.current
      );

      openTimer.current =
        null;

    }


    closeTimer.current =
      setTimeout(
        () => {

          setHovered(
            false
          );

        },
        350
      );

  }


  useEffect(
    () => {

      return () => {

        clearTimers();

      };

    },
    []
  );


  // ==========================================================
  // SETTINGS STATE
  // ==========================================================

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


  // ==========================================================
  // READ SAVED SETTINGS
  // ==========================================================

  function readSettings() {

    try {

      const raw =
        window
          .localStorage
          .getItem(
            STORAGE_KEY
          );


      if (!raw) {

        setPlatformSettings({

          tools:
            [],

          plan: {

            currentPlan:
              'advanced',

          },

        });


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


  // ==========================================================
  // INITIAL SETTINGS LOAD
  // ==========================================================

  useEffect(
    () => {

      readSettings();


      function handleSettingsUpdate(
        event: Event
      ) {

        const customEvent =
          event as
            CustomEvent<
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


  // ==========================================================
  // CURRENT PLAN
  // ==========================================================

  const currentPlan =
    (
      platformSettings
        ?.plan
        ?.currentPlan
      ||
      'advanced'
    ) as Plan;


  // ==========================================================
  // TOOL LOOKUP MAP
  // ==========================================================

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
          of platformSettings.tools
          ||
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


  // ==========================================================
  // TOOL ACCESS
  // ==========================================================

  function getToolState(
    toolId:
      string |
      null
  ) {

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


  // ==========================================================
  // SAFETY GUARD
  // ==========================================================

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


          if (
            !access.visible
          ) {

            setActiveTab(
              'CEO Summary'
            );

            return;

          }


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


  // ==========================================================
  // SELECT MODULE
  // ==========================================================

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


    if (
      !access.visible
    ) {

      return;

    }


    if (
      !access.allowed
    ) {

      setActiveTab(
        'Settings'
      );

      return;

    }


    setActiveTab(
      module
    );

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    // ========================================================
    // FIXED 64PX LAYOUT SLOT
    //
    // The page always reserves 64px.
    // Expanded sidebar overlays to 220px.
    // ========================================================

    <div
      className={`
        relative
        h-screen
        shrink-0

        transition-[width]
        duration-200
        ease-out

        ${
          sidebarOpen
          ? 'w-[220px]'
          : 'w-[64px]'
        }
      `}
    >

      <aside

        onMouseEnter={
          handleMouseEnter
        }

        onMouseLeave={
          handleMouseLeave
        }

        className={`
          fixed
          left-0
          top-0
          z-50

          h-screen

          overflow-hidden

          border-r
          border-slate-700/70

          bg-[#111827]

          text-white

          transition-[width,box-shadow]
          duration-200
          ease-out

          ${
            expanded

              ? `
                w-[220px]

                shadow-[14px_0_32px_rgba(15,23,42,0.18)]
              `

              : `
                w-[64px]
              `
          }
        `}
      >

        <div className="flex h-full flex-col">


          {/* =================================================
              BRAND
          ================================================= */}

          <div
            className="
              flex
              h-[60px]
              shrink-0
              items-center

              border-b
              border-white/5

              px-3
            "
          >

            <div
              className="
                flex
                min-w-0
                flex-1
                items-center
                gap-3
              "
            >


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

                  text-[11px]
                  font-semibold
                  text-white

                  shadow-sm
                  shadow-violet-950/40
                "
              >
                G
              </div>


              <div
                className={`
                  min-w-0
                  whitespace-nowrap

                  transition-all
                  duration-150

                  ${
                    expanded

                      ? `
                        translate-x-0
                        opacity-100
                      `

                      : `
                        pointer-events-none
                        -translate-x-1
                        opacity-0
                      `
                  }
                `}
              >

                <div
                  className="
                    text-[15px]
                    font-semibold
                    tracking-[-0.03em]
                  "
                >
                  Growth OS
                </div>


                <div
                  className="
                    text-[10px]
                    font-medium
                    text-slate-400
                  "
                >
                  Business Intelligence
                </div>

              </div>

            </div>


            {/* ===============================================
                SIDEBAR MODE TOGGLE
            =============================================== */}

            {expanded && (

              <button

                type="button"

                role="switch"

                aria-checked={
                  sidebarOpen
                }

                aria-label="Toggle fixed sidebar"

                title={
                  sidebarOpen
                    ? 'Switch to cursor mode'
                    : 'Keep sidebar fixed'
                }

                onClick={
                  toggleSidebarMode
                }

                className={`
                  relative

                  ml-2

                  flex
                  h-5
                  w-9
                  shrink-0
                  items-center

                  rounded-full

                  p-[2px]

                  transition-colors
                  duration-200

                  focus:outline-none
                  focus:ring-2
                  focus:ring-violet-400/30

                  ${
                    sidebarOpen

                      ? `
                        bg-violet-500
                      `

                      : `
                        bg-white/15

                        hover:bg-white/20
                      `
                  }
                `}
              >

                <span
                  className={`
                    block

                    h-4
                    w-4

                    rounded-full

                    bg-white

                    shadow-sm

                    transition-transform
                    duration-200

                    ${
                      sidebarOpen

                        ? `
                          translate-x-4
                        `

                        : `
                          translate-x-0
                        `
                    }
                  `}
                />

              </button>

            )}

          </div>


          {/* =================================================
              NAVIGATION
          ================================================= */}

          <div
            className="
              flex-1
              overflow-y-auto
              overflow-x-hidden

              px-2
              py-2.5
            "
          >


            {groups.map(
              group => {


                const visibleItems =
                  group.items.filter(
                    item =>
                      getToolState(
                        item.toolId
                      ).visible
                  );


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

                    className="mb-3"

                  >


                    {/* =======================================
                        GROUP LABEL
                    ======================================= */}

                    <div
                      className={`
                        mb-2
                        h-[12px]

                        whitespace-nowrap

                        px-3

                        text-[9px]
                        font-bold
                        uppercase
                        tracking-[0.17em]

                        text-slate-600

                        transition-opacity
                        duration-150

                        ${
                          expanded
                            ? 'opacity-100'
                            : 'opacity-0'
                        }
                      `}
                    >
                      {group.label}
                    </div>


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


                              {/* ===========================
                                  MODULE
                              =========================== */}

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
                                  h-[34px]
                                  w-full
                                  items-center

                                  rounded-xl

                                  transition-colors
                                  duration-150

                                  ${
                                    expanded

                                      ? `
                                        gap-3
                                        px-3
                                      `

                                      : `
                                        justify-center
                                      `
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
                                          text-slate-300

                                          hover:bg-white/[0.08]
                                          hover:text-white
                                        `

                                        : `
                                          text-slate-500

                                          hover:bg-white/[0.04]
                                          hover:text-slate-400
                                        `
                                  }
                                `}
                              >


                                <Icon

                                  size={
                                    17
                                  }

                                  className="shrink-0"

                                  strokeWidth={
                                    active
                                      ? 2.4
                                      : 1.8
                                  }

                                />


                                <div
                                  className={`
                                    flex
                                    min-w-0
                                    flex-1
                                    items-center

                                    whitespace-nowrap

                                    transition-opacity
                                    duration-150

                                    ${
                                      expanded

                                        ? `
                                          opacity-100
                                        `

                                        : `
                                          pointer-events-none
                                          opacity-0
                                        `
                                    }
                                  `}
                                >

                                  <span
                                    className="
                                      text-[13px]
                                      font-semibold
                                    "
                                  >
                                    {item.label}
                                  </span>


                                  {!access.allowed ? (

                                    <Lock

                                      size={
                                        13
                                      }

                                      className="
                                        ml-auto
                                        shrink-0
                                        text-slate-600
                                      "

                                    />

                                  ) : (

                                    item.children.length >
                                      0 && (

                                      <ChevronDown

                                        size={
                                          14
                                        }

                                        className={`
                                          ml-auto
                                          shrink-0

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

                                </div>

                              </button>


                              {/* ===========================
                                  SUB NAVIGATION
                              =========================== */}

                              {expanded &&
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

                                                    text-slate-400

                                                    hover:bg-white/[0.06]
                                                    hover:text-white
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


          {/* =================================================
              GLOBAL SETTINGS
          ================================================= */}

          <div
            className="
              shrink-0

              border-t
              border-white/5

              p-2
            "
          >

            <button

              type="button"

              title="Settings"

              onClick={() =>
                setActiveTab(
                  'Settings'
                )
              }

              className={`
                flex
                h-[34px]
                w-full
                items-center

                rounded-xl

                transition-colors
                duration-150

                ${
                  expanded

                    ? `
                      gap-3
                      px-3
                    `

                    : `
                      justify-center
                    `
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

                size={
                  17
                }

                className="shrink-0"

                strokeWidth={
                  activeTab ===
                    'Settings'
                    ? 2.4
                    : 1.8
                }

              />


              <span
                className={`
                  whitespace-nowrap

                  text-[13px]
                  font-semibold

                  transition-opacity
                  duration-150

                  ${
                    expanded

                      ? `
                        opacity-100
                      `

                      : `
                        pointer-events-none
                        opacity-0
                      `
                  }
                `}
              >
                Settings
              </span>

            </button>

          </div>


          {/* =================================================
              STATUS
          ================================================= */}

          <div
            className="
              shrink-0

              border-t
              border-white/5

              p-3
            "
          >


            {expanded ? (

              <div
                className="
                  rounded-xl

                  border
                  border-white/[0.10]

                  bg-white/[0.05]

                  p-3
                "
              >

                <div
                  className="
                    flex
                    items-center
                    gap-2

                    whitespace-nowrap
                  "
                >


                  <span
                    className="
                      relative
                      flex
                      h-2
                      w-2
                      shrink-0
                    "
                  >

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


                  <span
                    className="
                      text-[11px]
                      font-semibold
                      text-slate-300
                    "
                  >
                    Live data connected
                  </span>

                </div>

              </div>

            ) : (

              <div
                className="
                  flex
                  justify-center
                  py-2
                "
              >

                <span
                  className="
                    h-2
                    w-2

                    rounded-full

                    bg-emerald-500
                  "
                />

              </div>

            )}

          </div>

        </div>

      </aside>

    </div>

  );

}


// ============================================================
// HELPERS
// ============================================================

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