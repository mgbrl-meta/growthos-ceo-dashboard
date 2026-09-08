'use client';

import {
  useEffect,
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
      tab:
        string
    ) => void;

  setActiveSubTab:
    (
      module:
        string,
      subTab:
        string
    ) => void;

  // ----------------------------------------------------------
  // TRUE  = fixed sidebar
  // FALSE = cursor / hover sidebar
  // ----------------------------------------------------------

  sidebarOpen:
    boolean;

  setSidebarOpen:
    (
      open:
        boolean
    ) => void;

};


type NavigationItem = {

  name:
    string;

  label:
    string;

  icon:
    typeof CircleGauge;

  // ----------------------------------------------------------
  // Static module identity only.
  //
  // IMPORTANT:
  // AppSidebar does NOT calculate entitlement.
  //
  // This ID will later be matched against the access response
  // coming from the server/control plane.
  // ----------------------------------------------------------

  moduleId:
    string |
    null;

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
// PERSONAL SIDEBAR PREFERENCE
// ============================================================

const SIDEBAR_MODE_KEY =
  'growth_os_sidebar_mode_v1';


// ============================================================
// NAVIGATION
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

        moduleId:
          'command-center',

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

        moduleId:
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

        moduleId:
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

        moduleId:
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

        moduleId:
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

        moduleId:
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
  //
  // These are workspace/platform operational pages.
  //
  // Access rules will later come from server-side permission
  // data instead of being decided inside this component.
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

        moduleId:
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

        moduleId:
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

        moduleId:
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

        moduleId:
          null,

        children:
          [],

      },

    ],

  },

];


// ============================================================
// MAIN
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
  // HOVER STATE
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
  // Fixed mode:
  //
  // sidebarOpen = true
  //
  // Hover mode:
  //
  // sidebarOpen = false
  // hovered     = true temporarily
  // ----------------------------------------------------------

  const expanded =
    sidebarOpen
    ||
    hovered;


  // ==========================================================
  // APPLY SIDEBAR MODE
  // ==========================================================

  function applySidebarMode(
    mode:
      string |
      null
  ) {

    if (
      mode ===
      'fixed'
    ) {

      setSidebarOpen(
        true
      );


      setHovered(
        false
      );


      return;

    }


    if (
      mode ===
      'cursor'
    ) {

      setSidebarOpen(
        false
      );

    }

  }


  // ==========================================================
  // LOAD PERSONAL SIDEBAR PREFERENCE
  //
  // This is the ONLY local configuration this component reads.
  // ==========================================================

  useEffect(
    () => {

      try {

        applySidebarMode(

          window.localStorage.getItem(
            SIDEBAR_MODE_KEY
          )

        );

      } catch (
        error
      ) {

        console.error(
          'SIDEBAR_MODE_READ_ERROR',
          error
        );

      }


      // ------------------------------------------------------
      // SAME TAB
      //
      // GrowthSettings dispatches this after a user changes
      // their personal sidebar preference.
      // ------------------------------------------------------

      function handleSidebarModeUpdate(
        event:
          Event
      ) {

        const customEvent =
          event as
            CustomEvent<
              string
            >;


        applySidebarMode(
          customEvent.detail
        );

      }


      // ------------------------------------------------------
      // OTHER TAB / WINDOW
      // ------------------------------------------------------

      function handleStorage(
        event:
          StorageEvent
      ) {

        if (
          event.key !==
          SIDEBAR_MODE_KEY
        ) {

          return;

        }


        applySidebarMode(
          event.newValue
        );

      }


      window.addEventListener(
        'growth-os-sidebar-mode-updated',
        handleSidebarModeUpdate
      );


      window.addEventListener(
        'storage',
        handleStorage
      );


      return () => {

        window.removeEventListener(
          'growth-os-sidebar-mode-updated',
          handleSidebarModeUpdate
        );


        window.removeEventListener(
          'storage',
          handleStorage
        );

      };

    },
    [
      setSidebarOpen,
    ]
  );


  // ==========================================================
  // SIDEBAR MODE TOGGLE
  // ==========================================================

  function toggleSidebarMode() {

    const nextFixed =
      !sidebarOpen;


    const nextMode =
      nextFixed
        ? 'fixed'
        : 'cursor';


    setSidebarOpen(
      nextFixed
    );


    // --------------------------------------------------------
    // If switching from fixed → hover while cursor is already
    // inside, keep it expanded until the user leaves.
    // --------------------------------------------------------

    if (
      !nextFixed
    ) {

      setHovered(
        true
      );

    } else {

      setHovered(
        false
      );

    }


    try {

      window.localStorage.setItem(
        SIDEBAR_MODE_KEY,
        nextMode
      );


      window.dispatchEvent(

        new CustomEvent(
          'growth-os-sidebar-mode-updated',
          {
            detail:
              nextMode,
          }
        )

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


  // ==========================================================
  // HOVER OPEN
  // ==========================================================

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


  // ==========================================================
  // HOVER CLOSE
  // ==========================================================

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


  // ==========================================================
  // CLEANUP
  // ==========================================================

  useEffect(
    () => {

      return () => {

        clearTimers();

      };

    },
    []
  );


  // ==========================================================
  // SELECT MODULE
  //
  // IMPORTANT:
  //
  // No plan calculation.
  // No tool.enabled.
  // No requiredPlan.
  // No local entitlement.
  //
  // Access will later already be resolved before navigation is
  // given to this component.
  // ==========================================================

  function selectModule(
    module:
      string
  ) {

    setActiveTab(
      module
    );

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    // ========================================================
    // LAYOUT SLOT
    //
    // Hover mode:
    // page reserves 64px
    // sidebar overlays to 220px
    //
    // Fixed mode:
    // page reserves 220px
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

        <div
          className="
            flex
            h-full
            flex-col
          "
        >


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
                FIXED / HOVER TOGGLE
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

                    ? 'Switch to hover mode'

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
              group => (

                <div

                  key={
                    group.label
                  }

                  className="mb-3"

                >


                  {/* =========================================
                      GROUP LABEL
                  ========================================= */}

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


                  {/* =========================================
                      ITEMS
                  ========================================= */}

                  <div className="space-y-1">

                    {group.items.map(
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


                        return (

                          <div
                            key={
                              item.name
                            }
                          >


                            {/* =================================
                                MODULE BUTTON
                            ================================= */}

                            <button

                              type="button"

                              title={
                                item.label
                              }

                              onClick={() =>
                                selectModule(
                                  item.name
                                )
                              }

                              className={`
                                flex
                                h-[34px]
                                w-full
                                items-center

                                rounded-xl

                                transition-all
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

                                    : `
                                      text-slate-400

                                      hover:bg-white/[0.06]
                                      hover:text-white
                                    `
                                }
                              `}
                            >

                              <Icon

                                size={
                                  16
                                }

                                strokeWidth={
                                  active

                                    ? 2.3

                                    : 1.8
                                }

                                className="shrink-0"

                              />


                              {expanded && (

                                <>

                                  <span
                                    className="
                                      min-w-0
                                      flex-1

                                      truncate

                                      text-left
                                      text-[12px]
                                      font-semibold
                                    "
                                  >
                                    {item.label}
                                  </span>


                                  {item.children.length >
                                    0 && (

                                    <ChevronDown

                                      size={
                                        13
                                      }

                                      className={`
                                        shrink-0

                                        transition-transform
                                        duration-150

                                        ${
                                          active

                                            ? 'rotate-180'

                                            : ''
                                        }
                                      `}

                                    />

                                  )}

                                </>

                              )}

                            </button>


                            {/* =================================
                                SUB NAVIGATION
                            ================================= */}

                            {expanded
                              &&
                              active
                              &&
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
                                            min-h-[28px]
                                            w-full
                                            items-center

                                            rounded-lg

                                            px-2.5
                                            py-1.5

                                            text-left
                                            text-[10px]
                                            font-medium

                                            transition-colors
                                            duration-150

                                            ${
                                              selected

                                                ? `
                                                  bg-white/[0.08]

                                                  text-white
                                                `

                                                : `
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

              )
            )}

          </div>


          {/* =================================================
              PERSONAL SETTINGS
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
                  16
                }

                strokeWidth={
                  activeTab ===
                    'Settings'

                    ? 2.3

                    : 1.8
                }

                className="shrink-0"

              />


              {expanded && (

                <span
                  className="
                    text-[12px]
                    font-semibold
                  "
                >
                  Settings
                </span>

              )}

            </button>

          </div>

        </div>

      </aside>

    </div>

  );

}