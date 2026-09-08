'use client';

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState,
} from 'react';

import {
  AlertCircle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  PanelLeft,
  Plug,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  Users,
  UserRound,
  WalletCards,
} from 'lucide-react';


// ============================================================
// SETTINGS TYPES
// ============================================================

type SettingsTab =
  | 'Workspace'
  | 'Plan & Billing'
  | 'Modules'
  | 'Integrations'
  | 'Users & Access'
  | 'My Preferences';


type SidebarMode =
  | 'cursor'
  | 'fixed';


type TableDensity =
  | 'compact'
  | 'comfortable';


type DefaultLandingPage =
  | 'CEO Summary'
  | 'Meta OS'
  | 'Google OS'
  | 'Attribution OS'
  | 'Retention OS'
  | 'Product OS';


type DefaultDateRange =
  | '7'
  | '14'
  | '30'
  | '90';


type UserPreferences = {

  tableDensity:
    TableDensity;

  defaultLandingPage:
    DefaultLandingPage;

  defaultDateRange:
    DefaultDateRange;

};


// ============================================================
// AUTH / WORKSPACE RESPONSE
// ============================================================

type AuthMeResponse = {

  ok:
    boolean;

  authenticated:
    boolean;

  user?: {

    userId:
      string;

    email:
      string | null;

    fullName:
      string | null;

    role:
      string | null;

  };

  activeContext?: {

    workspaceId:
      string | null;

    workspaceName:
      string | null;

    workspaceSlug:
      string | null;

    brandId:
      string | null;

    brandName:
      string | null;

    brandSlug:
      string | null;

    currency:
      string | null;

    timezone:
      string | null;

    role:
      string | null;

  };

  auth?: {

    source:
      string | null;

    method:
      string | null;

  };

  providerContext?: {

    shopId:
      string | null;

    shopDomain:
      string | null;

  };

};


// ============================================================
// STORAGE
//
// PERSONAL UI PREFERENCES ONLY.
//
// NO:
//
// brand
// plan
// billing
// modules
// integrations
// users
// permissions
// entitlement
//
// are stored here.
// ============================================================

const USER_PREFERENCES_KEY =
  'growth_os_user_preferences_v1';


const SIDEBAR_MODE_KEY =
  'growth_os_sidebar_mode_v1';


// ============================================================
// DEFAULT PERSONAL PREFERENCES
// ============================================================

const DEFAULT_PREFERENCES:
  UserPreferences = {

  tableDensity:
    'compact',

  defaultLandingPage:
    'CEO Summary',

  defaultDateRange:
    '30',

};


// ============================================================
// SETTINGS NAVIGATION
// ============================================================

const SETTINGS_TABS:
  Array<{
    id:
      SettingsTab;

    label:
      string;

    icon:
      any;
  }> = [

  {
    id:
      'Workspace',

    label:
      'Workspace',

    icon:
      Settings2,
  },

  {
    id:
      'Plan & Billing',

    label:
      'Plan & Billing',

    icon:
      CreditCard,
  },

  {
    id:
      'Modules',

    label:
      'Modules',

    icon:
      Boxes,
  },

  {
    id:
      'Integrations',

    label:
      'Integrations',

    icon:
      Plug,
  },

  {
    id:
      'Users & Access',

    label:
      'Users & Access',

    icon:
      Users,
  },

  {
    id:
      'My Preferences',

    label:
      'My Preferences',

    icon:
      UserRound,
  },

];


// ============================================================
// LANDING PAGE OPTIONS
// ============================================================

const LANDING_PAGE_OPTIONS:
  Array<{
    value:
      DefaultLandingPage;

    label:
      string;
  }> = [

  {
    value:
      'CEO Summary',

    label:
      'Command Center',
  },

  {
    value:
      'Meta OS',

    label:
      'Meta',
  },

  {
    value:
      'Google OS',

    label:
      'Google',
  },

  {
    value:
      'Attribution OS',

    label:
      'Attribution',
  },

  {
    value:
      'Retention OS',

    label:
      'Retention',
  },

  {
    value:
      'Product OS',

    label:
      'Product',
  },

];


// ============================================================
// MAIN
// ============================================================

export default function GrowthSettings() {


  // ==========================================================
  // SETTINGS NAVIGATION
  // ==========================================================

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<SettingsTab>(
      'Workspace'
    );


  // ==========================================================
  // PERSONAL PREFERENCES
  // ==========================================================

  const [
    sidebarMode,
    setSidebarMode,
  ] =
    useState<SidebarMode>(
      'cursor'
    );


  const [
    preferences,
    setPreferences,
  ] =
    useState<UserPreferences>(
      DEFAULT_PREFERENCES
    );


  const [
    preferencesLoaded,
    setPreferencesLoaded,
  ] =
    useState(
      false
    );


  const [
    saved,
    setSaved,
  ] =
    useState(
      false
    );


  // ==========================================================
  // AUTHENTICATED WORKSPACE
  //
  // SERVER-OWNED BUSINESS DATA.
  // ==========================================================

  const [
    authContext,
    setAuthContext,
  ] =
    useState<AuthMeResponse | null>(
      null
    );


  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(
      true
    );


  const [
    authError,
    setAuthError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // LOAD PERSONAL PREFERENCES
  // ==========================================================

  useEffect(
    () => {

      try {

        const storedSidebarMode =
          window.localStorage.getItem(
            SIDEBAR_MODE_KEY
          );


        if (
          storedSidebarMode ===
            'fixed'
          ||
          storedSidebarMode ===
            'cursor'
        ) {

          setSidebarMode(
            storedSidebarMode
          );

        }


        const storedPreferences =
          window.localStorage.getItem(
            USER_PREFERENCES_KEY
          );


        if (
          storedPreferences
        ) {

          const parsed =
            JSON.parse(
              storedPreferences
            ) as Partial<UserPreferences>;


          setPreferences({

            ...DEFAULT_PREFERENCES,

            ...parsed,

          });

        }

      } catch (
        error
      ) {

        console.error(
          'GROWTH_OS_USER_PREFERENCES_LOAD_ERROR',
          error
        );

      }


      setPreferencesLoaded(
        true
      );

    },
    []
  );


  // ==========================================================
  // LOAD AUTHENTICATED WORKSPACE
  // ==========================================================

  async function loadAuthContext() {

    setAuthLoading(
      true
    );


    setAuthError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/auth/me',
          {
            method:
              'GET',

            cache:
              'no-store',

            credentials:
              'same-origin',
          }
        );


      const json:
        AuthMeResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
        ||
        !json.authenticated
      ) {

        throw new Error(
          'Unable to load authenticated workspace'
        );

      }


      setAuthContext(
        json
      );

    } catch (
      error: any
    ) {

      console.error(
        'GROWTH_OS_SETTINGS_AUTH_CONTEXT_ERROR',
        error
      );


      setAuthContext(
        null
      );


      setAuthError(
        String(
          error?.message
          ||
          'Unable to load workspace'
        )
      );

    } finally {

      setAuthLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      loadAuthContext();

    },
    []
  );


  // ==========================================================
  // SAVE PERSONAL PREFERENCES
  // ==========================================================

  function savePreferences() {

    try {

      window.localStorage.setItem(
        SIDEBAR_MODE_KEY,
        sidebarMode
      );


      window.localStorage.setItem(
        USER_PREFERENCES_KEY,
        JSON.stringify(
          preferences
        )
      );


      window.dispatchEvent(

        new CustomEvent(
          'growth-os-sidebar-mode-updated',
          {
            detail:
              sidebarMode,
          }
        )

      );


      window.dispatchEvent(

        new CustomEvent(
          'growth-os-user-preferences-updated',
          {
            detail:
              preferences,
          }
        )

      );


      setSaved(
        true
      );


      window.setTimeout(
        () =>
          setSaved(
            false
          ),
        1600
      );

    } catch (
      error
    ) {

      console.error(
        'GROWTH_OS_USER_PREFERENCES_SAVE_ERROR',
        error
      );

    }

  }


  // ==========================================================
  // RESET PERSONAL PREFERENCES
  // ==========================================================

  function resetPreferences() {

    const nextSidebarMode:
      SidebarMode =
        'cursor';


    const nextPreferences:
      UserPreferences = {
        ...DEFAULT_PREFERENCES,
      };


    setSidebarMode(
      nextSidebarMode
    );


    setPreferences(
      nextPreferences
    );


    try {

      window.localStorage.setItem(
        SIDEBAR_MODE_KEY,
        nextSidebarMode
      );


      window.localStorage.setItem(
        USER_PREFERENCES_KEY,
        JSON.stringify(
          nextPreferences
        )
      );


      window.dispatchEvent(

        new CustomEvent(
          'growth-os-sidebar-mode-updated',
          {
            detail:
              nextSidebarMode,
          }
        )

      );


      window.dispatchEvent(

        new CustomEvent(
          'growth-os-user-preferences-updated',
          {
            detail:
              nextPreferences,
          }
        )

      );

    } catch (
      error
    ) {

      console.error(
        'GROWTH_OS_USER_PREFERENCES_RESET_ERROR',
        error
      );

    }

  }


  // ==========================================================
  // LOADING PERSONAL SETTINGS
  // ==========================================================

  if (
    !preferencesLoaded
  ) {

    return (

      <section className="gos-panel !p-4">

        <p
          className="
            text-[10px]
            text-slate-500
          "
        >
          Loading settings...
        </p>

      </section>

    );

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          SETTINGS INTRO
      ===================================================== */}

      <section className="gos-panel !p-3">

        <div
          className="
            flex
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

              rounded-[9px]

              bg-violet-50

              text-violet-600
            "
          >

            <Settings2
              size={16}
            />

          </div>


          <div>

            <h2
              className="
                text-[14px]
                font-semibold
                tracking-[-0.025em]

                text-slate-950
              "
            >
              Settings
            </h2>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Review your workspace, subscription, modules, connections, access and personal preferences.
            </p>

          </div>

        </div>

      </section>


      {/* =====================================================
          SETTINGS SHELL
      ===================================================== */}

      <div
        className="
          grid
          grid-cols-1
          gap-3

          lg:grid-cols-[230px_minmax(0,1fr)]
        "
      >


        {/* ===================================================
            LEFT NAVIGATION
        =================================================== */}

        <section
          className="
            gos-panel
            !p-2

            self-start
          "
        >

          <nav className="space-y-1">

            {SETTINGS_TABS.map(
              tab => {

                const Icon =
                  tab.icon;


                const active =
                  activeTab ===
                  tab.id;


                return (

                  <button

                    key={
                      tab.id
                    }

                    type="button"

                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }

                    className={`
                      flex
                      h-[34px]
                      w-full
                      items-center
                      gap-2.5

                      rounded-[8px]

                      px-3

                      text-left
                      text-[10px]
                      font-semibold

                      transition

                      ${
                        active

                          ? `
                            bg-slate-950
                            text-white
                          `

                          : `
                            text-slate-500

                            hover:bg-slate-100
                            hover:text-slate-900
                          `
                      }
                    `}
                  >

                    <Icon
                      size={14}
                    />


                    <span>
                      {tab.label}
                    </span>

                  </button>

                );

              }
            )}

          </nav>

        </section>


        {/* ===================================================
            CONTENT
        =================================================== */}

        <div className="min-w-0">


          {/* =================================================
              WORKSPACE
          ================================================= */}

          {activeTab ===
            'Workspace' && (

            <WorkspaceSettings

              authContext={
                authContext
              }

              loading={
                authLoading
              }

              error={
                authError
              }

              reload={
                loadAuthContext
              }

            />

          )}


          {/* =================================================
              PLAN & BILLING
          ================================================= */}

          {activeTab ===
            'Plan & Billing' && (

            <PlanBillingSettings />

          )}


          {/* =================================================
              MODULES
          ================================================= */}

          {activeTab ===
            'Modules' && (

            <ModuleSettings />

          )}


          {/* =================================================
              INTEGRATIONS
          ================================================= */}

          {activeTab ===
            'Integrations' && (

            <IntegrationSettings />

          )}


          {/* =================================================
              USERS
          ================================================= */}

          {activeTab ===
            'Users & Access' && (

            <UserAccessSettings />

          )}


          {/* =================================================
              PERSONAL PREFERENCES
          ================================================= */}

          {activeTab ===
            'My Preferences' && (

            <PreferenceSettings

              sidebarMode={
                sidebarMode
              }

              setSidebarMode={
                setSidebarMode
              }

              preferences={
                preferences
              }

              setPreferences={
                setPreferences
              }

              saved={
                saved
              }

              savePreferences={
                savePreferences
              }

              resetPreferences={
                resetPreferences
              }

            />

          )}

        </div>

      </div>

    </div>

  );

}


// ============================================================
// WORKSPACE
//
// REAL SERVER DATA
//
// Source:
//
// signed session
//      ↓
// /api/auth/me
//      ↓
// growthos_control workspaces / brands
// ============================================================

function WorkspaceSettings({

  authContext,

  loading,

  error,

  reload,

}: {

  authContext:
    AuthMeResponse |
    null;

  loading:
    boolean;

  error:
    string |
    null;

  reload:
    () => void;

}) {


  const context =
    authContext?.activeContext;


  const user =
    authContext?.user;


  const auth =
    authContext?.auth;


  if (
    loading
  ) {

    return (

      <div className="space-y-3">

        <SectionHeader

          icon={
            Settings2
          }

          title="Workspace"

          description="Business and workspace information associated with your current Growth OS brand."

        />


        <section className="gos-panel !p-4">

          <p className="text-[10px] text-slate-500">
            Loading authenticated workspace...
          </p>

        </section>

      </div>

    );

  }


  if (
    error
    ||
    !context
  ) {

    return (

      <div className="space-y-3">

        <SectionHeader

          icon={
            Settings2
          }

          title="Workspace"

          description="Business and workspace information associated with your current Growth OS brand."

        />


        <section
          className="
            rounded-[10px]

            border
            border-red-200

            bg-red-50

            p-3
          "
        >

          <div
            className="
              flex
              items-start
              justify-between
              gap-3
            "
          >

            <div
              className="
                flex
                items-start
                gap-2
              "
            >

              <AlertCircle
                size={14}
                className="
                  mt-0.5

                  text-red-600
                "
              />


              <div>

                <p
                  className="
                    text-[10px]
                    font-semibold

                    text-red-800
                  "
                >
                  Unable to load workspace
                </p>


                <p
                  className="
                    mt-0.5

                    text-[9px]

                    text-red-700
                  "
                >
                  {error ||
                    'Authenticated workspace context is unavailable.'}
                </p>

              </div>

            </div>


            <button

              type="button"

              onClick={
                reload
              }

              className="
                h-7
                shrink-0

                rounded-[7px]

                border
                border-red-200

                bg-white

                px-2.5

                text-[9px]
                font-semibold

                text-red-700
              "
            >
              Retry
            </button>

          </div>

        </section>

      </div>

    );

  }


  return (

    <div className="space-y-3">


      <SectionHeader

        icon={
          Settings2
        }

        title="Workspace"

        description="Business and workspace information associated with your current Growth OS brand."

      />


      {/* =====================================================
          IDENTITY
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Workspace Identity
        </h3>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-2

            md:grid-cols-2
          "
        >

          <ServerValue

            label="Workspace Name"

            value={
              context.workspaceName
            }

          />


          <ServerValue

            label="Brand"

            value={
              context.brandName
            }

          />


          <ServerValue

            label="Workspace ID"

            value={
              context.workspaceId
            }

            mono

          />


          <ServerValue

            label="Brand ID"

            value={
              context.brandId
            }

            mono

          />


          <ServerValue

            label="Workspace Slug"

            value={
              context.workspaceSlug
            }

          />


          <ServerValue

            label="Brand Slug"

            value={
              context.brandSlug
            }

          />

        </div>

      </section>


      {/* =====================================================
          LOCALIZATION
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Business Configuration
        </h3>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-2

            md:grid-cols-2
          "
        >

          <ServerValue

            label="Currency"

            value={
              context.currency
            }

          />


          <ServerValue

            label="Timezone"

            value={
              context.timezone
            }

          />


          <ServerValue

            label="Workspace Status"

            value="Active"

            status="green"

          />


          <ServerValue

            label="Your Role"

            value={
              formatRole(
                context.role
              )
            }

          />

        </div>

      </section>


      {/* =====================================================
          CURRENT USER
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Current User
        </h3>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-2

            md:grid-cols-2
          "
        >

          <ServerValue

            label="Email"

            value={
              user?.email
            }

          />


          <ServerValue

            label="Name"

            value={
              user?.fullName
            }

          />


          <ServerValue

            label="User ID"

            value={
              user?.userId
            }

            mono

          />


          <ServerValue

            label="Authentication"

            value={
              formatAuthMethod(
                auth?.method
              )
            }

          />

        </div>


        <ServerNotice
          text="Workspace identity is read from the authenticated Growth OS session and server-side control plane. It cannot be changed through browser storage."
        />

      </section>

    </div>

  );

}


// ============================================================
// PLAN + BILLING
//
// NEXT SERVER CONNECTION.
// ============================================================

function PlanBillingSettings() {

  return (

    <div className="space-y-3">

      <SectionHeader

        icon={
          WalletCards
        }

        title="Plan & Billing"

        description="Review your current Growth OS plan, capacity, usage and available upgrades."

      />


      <section
        className="
          grid
          grid-cols-2
          gap-2

          xl:grid-cols-4
        "
      >

        <ServerMetric
          label="Current Plan"
        />

        <ServerMetric
          label="Monthly Allowance"
        />

        <ServerMetric
          label="Current Usage"
        />

        <ServerMetric
          label="User Allowance"
        />

      </section>


      <section className="gos-panel !p-3.5">

        <div
          className="
            flex
            flex-col
            gap-3

            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div>

            <h3 className="gos-section-title">
              Subscription
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              Billing cycle, renewal, invoices and commercial usage will appear here.
            </p>

          </div>


          <button

            type="button"

            disabled

            className="
              h-8

              rounded-[8px]

              bg-slate-100

              px-3

              text-[9px]
              font-semibold

              text-slate-400
            "
          >
            Compare Plans
          </button>

        </div>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-2

            md:grid-cols-2
          "
        >

          <ServerValue
            label="Billing Cycle"
            value={null}
          />

          <ServerValue
            label="Next Renewal"
            value={null}
          />

          <ServerValue
            label="Current Period"
            value={null}
          />

          <ServerValue
            label="Usage Reset"
            value={null}
          />

        </div>


        <ServerNotice
          text="Plan and usage will be read from the brand subscription and usage control plane. Customers can initiate an upgrade without directly modifying entitlement."
        />

      </section>

    </div>

  );

}


// ============================================================
// MODULES
// ============================================================

function ModuleSettings() {

  return (

    <div className="space-y-3">

      <SectionHeader

        icon={
          Boxes
        }

        title="Modules"

        description="See which Growth OS capabilities are included in your current plan."

      />


      <section className="gos-panel !p-0">

        <div
          className="
            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <h3 className="gos-section-title">
            Module Access
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Plan entitlement and brand-specific module access will be shown here.
          </p>

        </div>


        <EmptyServerState

          icon={
            Boxes
          }

          title="Module entitlement is server controlled"

          description="Available, enabled and upgrade-eligible modules will be loaded from the Growth OS control plane."

        />

      </section>

    </div>

  );

}


// ============================================================
// INTEGRATIONS
// ============================================================

function IntegrationSettings() {

  return (

    <div className="space-y-3">

      <SectionHeader

        icon={
          Plug
        }

        title="Integrations"

        description="Review the platforms connected to this Growth OS workspace."

      />


      <section className="gos-panel !p-0">

        <div
          className="
            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <h3 className="gos-section-title">
            Connected Sources
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Shopify, Meta, Google and other source connections will appear here.
          </p>

        </div>


        <EmptyServerState

          icon={
            Plug
          }

          title="Integration data will come from the server"

          description="Connection status, account identity and data readiness will be read from the shared integration control plane."

        />

      </section>

    </div>

  );

}


// ============================================================
// USERS
// ============================================================

function UserAccessSettings() {

  return (

    <div className="space-y-3">

      <SectionHeader

        icon={
          Users
        }

        title="Users & Access"

        description="Review people who can access the current brand and their membership roles."

      />


      <section className="gos-panel !p-0">

        <div
          className="
            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <h3 className="gos-section-title">
            Workspace Users
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Owner, Admin, Analyst and Viewer memberships will be displayed here.
          </p>

        </div>


        <EmptyServerState

          icon={
            Users
          }

          title="User access is centrally managed"

          description="Memberships will be loaded from growthos_control.users and brand_memberships."

        />

      </section>

    </div>

  );

}


// ============================================================
// PERSONAL PREFERENCES
// ============================================================

function PreferenceSettings({

  sidebarMode,

  setSidebarMode,

  preferences,

  setPreferences,

  saved,

  savePreferences,

  resetPreferences,

}: {

  sidebarMode:
    SidebarMode;

  setSidebarMode:
    (
      mode:
        SidebarMode
    ) => void;

  preferences:
    UserPreferences;

  setPreferences:
    Dispatch<
      SetStateAction<
        UserPreferences
      >
    >;

  saved:
    boolean;

  savePreferences:
    () => void;

  resetPreferences:
    () => void;

}) {

  return (

    <div className="space-y-3">


      <section className="gos-panel !p-3.5">

        <div
          className="
            flex
            flex-col
            gap-3

            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div
            className="
              flex
              items-start
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

                rounded-[9px]

                bg-violet-50

                text-violet-600
              "
            >

              <UserRound
                size={16}
              />

            </div>


            <div>

              <h2
                className="
                  text-[14px]
                  font-semibold

                  text-slate-950
                "
              >
                My Preferences
              </h2>


              <p
                className="
                  mt-0.5

                  text-[9px]

                  text-slate-500
                "
              >
                Personal interface preferences that apply only to you.
              </p>

            </div>

          </div>


          <div className="flex gap-2">

            <button

              type="button"

              onClick={
                resetPreferences
              }

              className="
                inline-flex
                h-8
                items-center
                gap-1.5

                rounded-[8px]

                border
                border-slate-200

                bg-white

                px-3

                text-[9px]
                font-semibold

                text-slate-600
              "
            >

              <RotateCcw
                size={12}
              />

              Reset

            </button>


            <button

              type="button"

              onClick={
                savePreferences
              }

              className={`
                inline-flex
                h-8
                items-center
                gap-1.5

                rounded-[8px]

                px-3

                text-[9px]
                font-semibold

                ${
                  saved

                    ? `
                      bg-emerald-600
                      text-white
                    `

                    : `
                      bg-slate-950
                      text-white
                    `
                }
              `}
            >

              {saved ? (

                <>
                  <CheckCircle2
                    size={12}
                  />

                  Saved
                </>

              ) : (

                <>
                  <Save
                    size={12}
                  />

                  Save
                </>

              )}

            </button>

          </div>

        </div>

      </section>


      <section className="gos-panel !p-3.5">

        <SectionHeading

          icon={
            SlidersHorizontal
          }

          title="Interface"

          description="Choose how the Growth OS workspace behaves for you."

        />


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-3

            lg:grid-cols-2
          "
        >

          <PreferenceRow

            icon={
              PanelLeft
            }

            title="Sidebar"

            description="Choose between hover expansion or a permanently fixed sidebar."

          >

            <SegmentedControl

              options={[
                {
                  value:
                    'cursor',

                  label:
                    'Hover',
                },

                {
                  value:
                    'fixed',

                  label:
                    'Fixed',
                },
              ]}

              value={
                sidebarMode
              }

              onChange={
                value =>
                  setSidebarMode(
                    value as SidebarMode
                  )
              }

            />

          </PreferenceRow>


          <PreferenceRow

            icon={
              LayoutDashboard
            }

            title="Table Density"

            description="Control how much information appears vertically in data-heavy screens."

          >

            <SegmentedControl

              options={[
                {
                  value:
                    'compact',

                  label:
                    'Compact',
                },

                {
                  value:
                    'comfortable',

                  label:
                    'Comfortable',
                },
              ]}

              value={
                preferences.tableDensity
              }

              onChange={
                value =>
                  setPreferences(
                    previous => ({

                      ...previous,

                      tableDensity:
                        value as TableDensity,

                    })
                  )
              }

            />

          </PreferenceRow>

        </div>

      </section>


      <section className="gos-panel !p-3.5">

        <SectionHeading

          icon={
            CalendarDays
          }

          title="Personal Defaults"

          description="Choose the initial Growth OS view you prefer."

        />


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-3

            md:grid-cols-2
          "
        >

          <FormField
            label="Default Landing Page"
          >

            <select

              value={
                preferences.defaultLandingPage
              }

              onChange={
                event =>
                  setPreferences(
                    previous => ({

                      ...previous,

                      defaultLandingPage:
                        event.target.value as DefaultLandingPage,

                    })
                  )
              }

              className="gos-input w-full"

            >

              {LANDING_PAGE_OPTIONS.map(
                option => (

                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>

                )
              )}

            </select>

          </FormField>


          <FormField
            label="Default Date Range"
          >

            <select

              value={
                preferences.defaultDateRange
              }

              onChange={
                event =>
                  setPreferences(
                    previous => ({

                      ...previous,

                      defaultDateRange:
                        event.target.value as DefaultDateRange,

                    })
                  )
              }

              className="gos-input w-full"

            >

              <option value="7">
                Last 7 Days
              </option>

              <option value="14">
                Last 14 Days
              </option>

              <option value="30">
                Last 30 Days
              </option>

              <option value="90">
                Last 90 Days
              </option>

            </select>

          </FormField>

        </div>

      </section>

    </div>

  );

}


// ============================================================
// SECTION HEADER
// ============================================================

function SectionHeader({

  icon:
    Icon,

  title,

  description,

}: {

  icon:
    any;

  title:
    string;

  description:
    string;

}) {

  return (

    <section className="gos-panel !p-3.5">

      <div
        className="
          flex
          items-start
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

            rounded-[9px]

            bg-violet-50

            text-violet-600
          "
        >

          <Icon
            size={16}
          />

        </div>


        <div>

          <h2
            className="
              text-[14px]
              font-semibold

              text-slate-950
            "
          >
            {title}
          </h2>


          <p
            className="
              mt-0.5

              text-[9px]
              leading-4

              text-slate-500
            "
          >
            {description}
          </p>

        </div>

      </div>

    </section>

  );

}


// ============================================================
// SECTION HEADING
// ============================================================

function SectionHeading({

  icon:
    Icon,

  title,

  description,

}: {

  icon:
    any;

  title:
    string;

  description:
    string;

}) {

  return (

    <div
      className="
        flex
        items-start
        gap-2.5
      "
    >

      <div
        className="
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center

          rounded-[8px]

          bg-slate-100

          text-slate-600
        "
      >

        <Icon
          size={14}
        />

      </div>


      <div>

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
            mt-0.5

            text-[9px]
            leading-4

            text-slate-500
          "
        >
          {description}
        </p>

      </div>

    </div>

  );

}


// ============================================================
// SERVER VALUE
// ============================================================

function ServerValue({

  label,

  value,

  mono =
    false,

  status,

}: {

  label:
    string;

  value:
    string |
    null |
    undefined;

  mono?:
    boolean;

  status?:
    'green';

}) {

  return (

    <div
      className="
        flex
        min-h-[40px]
        items-center
        justify-between
        gap-3

        rounded-[8px]

        border
        border-slate-200

        bg-slate-50

        px-3
      "
    >

      <span
        className="
          text-[9px]

          text-slate-500
        "
      >
        {label}
      </span>


      {status ===
        'green' ? (

        <span
          className="
            rounded-full

            border
            border-emerald-200

            bg-emerald-50

            px-2
            py-0.5

            text-[8px]
            font-semibold

            text-emerald-700
          "
        >
          {value ||
            '—'}
        </span>

      ) : (

        <span
          className={`
            max-w-[65%]

            truncate

            text-right
            text-[10px]
            font-semibold

            ${
              value

                ? 'text-slate-800'

                : 'text-slate-400'
            }

            ${
              mono

                ? 'font-mono'

                : ''
            }
          `}
        >
          {value ||
            '—'}
        </span>

      )}

    </div>

  );

}


// ============================================================
// SERVER METRIC PLACEHOLDER
// ============================================================

function ServerMetric({

  label,

}: {

  label:
    string;

}) {

  return (

    <div
      className="
        gos-card

        min-h-[70px]

        px-3
        py-2.5
      "
    >

      <p className="gos-label">
        {label}
      </p>


      <p
        className="
          mt-2

          text-[17px]
          font-semibold

          text-slate-400
        "
      >
        —
      </p>

    </div>

  );

}


// ============================================================
// SERVER NOTICE
// ============================================================

function ServerNotice({

  text,

}: {

  text:
    string;

}) {

  return (

    <div
      className="
        mt-3

        rounded-[9px]

        border
        border-violet-200

        bg-violet-50

        px-3
        py-2.5
      "
    >

      <p
        className="
          text-[8px]
          leading-4

          text-violet-700
        "
      >
        {text}
      </p>

    </div>

  );

}


// ============================================================
// EMPTY SERVER STATE
// ============================================================

function EmptyServerState({

  icon:
    Icon,

  title,

  description,

}: {

  icon:
    any;

  title:
    string;

  description:
    string;

}) {

  return (

    <div
      className="
        flex
        min-h-[180px]
        items-center
        justify-center

        px-4
        py-8
      "
    >

      <div
        className="
          max-w-[430px]

          text-center
        "
      >

        <div
          className="
            mx-auto

            flex
            h-9
            w-9
            items-center
            justify-center

            rounded-[9px]

            bg-slate-100

            text-slate-500
          "
        >

          <Icon
            size={16}
          />

        </div>


        <p
          className="
            mt-2.5

            text-[11px]
            font-semibold

            text-slate-800
          "
        >
          {title}
        </p>


        <p
          className="
            mx-auto
            mt-1

            max-w-[400px]

            text-[9px]
            leading-4

            text-slate-500
          "
        >
          {description}
        </p>

      </div>

    </div>

  );

}


// ============================================================
// PREFERENCE ROW
// ============================================================

function PreferenceRow({

  icon:
    Icon,

  title,

  description,

  children,

}: {

  icon:
    any;

  title:
    string;

  description:
    string;

  children:
    ReactNode;

}) {

  return (

    <div
      className="
        flex
        min-h-[78px]
        items-center
        justify-between
        gap-4

        rounded-[10px]

        border
        border-slate-200

        bg-slate-50

        px-3
        py-2.5
      "
    >

      <div
        className="
          flex
          min-w-0
          items-start
          gap-2.5
        "
      >

        <div
          className="
            flex
            h-7
            w-7
            shrink-0
            items-center
            justify-center

            rounded-[7px]

            bg-white

            text-slate-500

            shadow-sm
          "
        >

          <Icon
            size={13}
          />

        </div>


        <div className="min-w-0">

          <p
            className="
              text-[10px]
              font-semibold

              text-slate-800
            "
          >
            {title}
          </p>


          <p
            className="
              mt-0.5

              max-w-[430px]

              text-[8px]
              leading-4

              text-slate-500
            "
          >
            {description}
          </p>

        </div>

      </div>


      <div className="shrink-0">

        {children}

      </div>

    </div>

  );

}


// ============================================================
// SEGMENTED CONTROL
// ============================================================

function SegmentedControl({

  options,

  value,

  onChange,

}: {

  options:
    Array<{
      value:
        string;

      label:
        string;
    }>;

  value:
    string;

  onChange:
    (
      value:
        string
    ) => void;

}) {

  return (

    <div
      className="
        flex

        rounded-[8px]

        border
        border-slate-200

        bg-white

        p-0.5
      "
    >

      {options.map(
        option => {

          const active =
            option.value ===
            value;


          return (

            <button

              key={
                option.value
              }

              type="button"

              onClick={() =>
                onChange(
                  option.value
                )
              }

              className={`
                h-7

                rounded-[6px]

                px-2.5

                text-[9px]
                font-semibold

                transition

                ${
                  active

                    ? `
                      bg-slate-950
                      text-white
                    `

                    : `
                      text-slate-500

                      hover:bg-slate-100
                      hover:text-slate-800
                    `
                }
              `}
            >
              {option.label}
            </button>

          );

        }
      )}

    </div>

  );

}


// ============================================================
// FORM FIELD
// ============================================================

function FormField({

  label,

  children,

}: {

  label:
    string;

  children:
    ReactNode;

}) {

  return (

    <label className="block">

      <span
        className="
          mb-1.5
          block

          text-[9px]
          font-semibold
          uppercase
          tracking-[0.05em]

          text-slate-500
        "
      >
        {label}
      </span>


      {children}

    </label>

  );

}


// ============================================================
// FORMAT ROLE
// ============================================================

function formatRole(
  value:
    string |
    null |
    undefined
) {

  if (!value) {

    return null;

  }


  return value
    .split(
      '_'
    )
    .map(
      part =>
        part
          .charAt(
            0
          )
          .toUpperCase()
        +
        part.slice(
          1
        )
    )
    .join(
      ' '
    );

}


// ============================================================
// FORMAT AUTH METHOD
// ============================================================

function formatAuthMethod(
  value:
    string |
    null |
    undefined
) {

  if (!value) {

    return null;

  }


  if (
    value ===
    'password'
  ) {

    return 'Password';

  }


  if (
    value ===
    'shopify'
  ) {

    return 'Shopify';

  }


  return value;
}