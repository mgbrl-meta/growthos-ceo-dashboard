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

import AppIntegrations
  from './integrations/AppIntegrations';


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
// AUTH RESPONSE
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
// SUBSCRIPTION RESPONSE
// ============================================================

type WorkspaceSubscriptionResponse = {

  ok:
    boolean;

  configured:
    boolean;

  subscription:
    {

      subscriptionId:
        string;

      status:
        string;

      planId:
        string;

      orderLimitOverrideMode:
        string;

      monthlyOrderLimitOverride:
        number | null;

      createdAt:
        string | null;

      updatedAt:
        string | null;

    }
    |
    null;

  plan:
    {

      planId:
        string;

      name:
        string;

      description:
        string | null;

      status:
        string;

      monthlyOrderLimit:
        number | null;

      effectiveMonthlyOrderLimit:
        number | null;

      maxUsers:
        number | null;

    }
    |
    null;

  modules:
    Array<{

      moduleId:
        string;

      name:
        string | null;

      description:
        string | null;

      category:
        string | null;

      routeKey:
        string | null;

      enabled:
        boolean;

      status:
        string | null;

      setupRequired:
        boolean;

    }>;

};


// ============================================================
// WORKSPACE USERS RESPONSE
// ============================================================

type WorkspaceUsersResponse = {

  ok:
    boolean;

  workspace?: {

    workspaceId:
      string;

    brandId:
      string;

  };

  summary?: {

    totalUsers:
      number;

    activeUsers:
      number;

    owners:
      number;

    admins:
      number;

  };

  users?: Array<{

    membershipId:
      string;

    userId:
      string;

    email:
      string | null;

    fullName:
      string | null;

    role:
      string;

    userStatus:
      string | null;

    membershipStatus:
      string;

    isDefault:
      boolean;

    membershipCreatedAt:
      string | null;

    membershipUpdatedAt:
      string | null;

    lastLoginAt:
      string | null;

  }>;

  meta?: {

    durationMs?:
      number;

  };

};


// ============================================================
// STORAGE
//
// PERSONAL UI PREFERENCES ONLY.
//
// NO BUSINESS DATA IS STORED HERE.
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
      'fixed'
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
  // AUTH CONTEXT
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
  // SUBSCRIPTION CONTEXT
  // ==========================================================

  const [
    subscriptionContext,
    setSubscriptionContext,
  ] =
    useState<WorkspaceSubscriptionResponse | null>(
      null
    );


  const [
    subscriptionLoading,
    setSubscriptionLoading,
  ] =
    useState(
      true
    );


  const [
    subscriptionError,
    setSubscriptionError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // USERS CONTEXT
  //
  // Loaded lazily only when Users & Access is opened.
  // ==========================================================

  const [
    usersContext,
    setUsersContext,
  ] =
    useState<WorkspaceUsersResponse | null>(
      null
    );


  const [
    usersLoading,
    setUsersLoading,
  ] =
    useState(
      false
    );


  const [
    usersLoaded,
    setUsersLoaded,
  ] =
    useState(
      false
    );


  const [
    usersError,
    setUsersError,
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
  // LOAD AUTH CONTEXT
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
        'GROWTH_OS_SETTINGS_AUTH_ERROR',
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


  // ==========================================================
  // LOAD SUBSCRIPTION
  // ==========================================================

  async function loadSubscriptionContext() {

    setSubscriptionLoading(
      true
    );


    setSubscriptionError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/workspace/subscription',
          {
            cache:
              'no-store',

            credentials:
              'same-origin',
          }
        );


      const json:
        WorkspaceSubscriptionResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          'Unable to load workspace subscription'
        );

      }


      setSubscriptionContext(
        json
      );

    } catch (
      error: any
    ) {

      console.error(
        'GROWTH_OS_SETTINGS_SUBSCRIPTION_ERROR',
        error
      );


      setSubscriptionContext(
        null
      );


      setSubscriptionError(
        String(
          error?.message
          ||
          'Unable to load subscription'
        )
      );

    } finally {

      setSubscriptionLoading(
        false
      );

    }

  }


  // ==========================================================
  // LOAD USERS
  // ==========================================================

  async function loadUsersContext() {

    setUsersLoading(
      true
    );


    setUsersError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/workspace/users',
          {
            cache:
              'no-store',

            credentials:
              'same-origin',
          }
        );


      const json:
        WorkspaceUsersResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          'Unable to load workspace users'
        );

      }


      setUsersContext(
        json
      );


      setUsersLoaded(
        true
      );

    } catch (
      error: any
    ) {

      console.error(
        'GROWTH_OS_SETTINGS_USERS_ERROR',
        error
      );


      setUsersContext(
        null
      );


      setUsersLoaded(
        true
      );


      setUsersError(
        String(
          error?.message
          ||
          'Unable to load workspace users'
        )
      );

    } finally {

      setUsersLoading(
        false
      );

    }

  }


  // ==========================================================
  // INITIAL SERVER LOAD
  // ==========================================================

  useEffect(
    () => {

      loadAuthContext();

      loadSubscriptionContext();

    },
    []
  );


  // ==========================================================
  // LAZY USERS LOAD
  // ==========================================================

  useEffect(
    () => {

      if (
        activeTab ===
          'Users & Access'
        &&
        !usersLoaded
        &&
        !usersLoading
      ) {

        loadUsersContext();

      }

    },
    [
      activeTab,
      usersLoaded,
      usersLoading,
    ]
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
        'fixed';


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
  // LOADING LOCAL PREFERENCES
  // ==========================================================

  if (
    !preferencesLoaded
  ) {

    return (

      <section className="gos-panel !p-4">

        <p className="text-[10px] text-slate-500">
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


          {activeTab ===
            'Plan & Billing' && (

            <PlanBillingSettings

              subscriptionContext={
                subscriptionContext
              }

              loading={
                subscriptionLoading
              }

              error={
                subscriptionError
              }

              reload={
                loadSubscriptionContext
              }

            />

          )}


          {activeTab ===
            'Modules' && (

            <ModuleSettings

              subscriptionContext={
                subscriptionContext
              }

              loading={
                subscriptionLoading
              }

              error={
                subscriptionError
              }

              reload={
                loadSubscriptionContext
              }

            />

          )}


          {activeTab ===
            'Integrations' && (

             <AppIntegrations />

          )}


          {activeTab ===
            'Users & Access' && (

            <UserAccessSettings

              usersContext={
                usersContext
              }

              subscriptionContext={
                subscriptionContext
              }

              currentRole={
                authContext?.activeContext?.role
                ??
                null
              }

              loading={
                usersLoading
                ||
                !usersLoaded
              }

              error={
                usersError
              }

              reload={
                loadUsersContext
              }

            />

          )}


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

      <LoadingPanel
        title="Workspace"
        text="Loading authenticated workspace..."
      />

    );

  }


  if (
    error
    ||
    !context
  ) {

    return (

      <ErrorPanel

        title="Unable to load workspace"

        error={
          error
          ||
          'Authenticated workspace context is unavailable.'
        }

        reload={
          reload
        }

      />

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
            value={context.workspaceName}
          />

          <ServerValue
            label="Brand"
            value={context.brandName}
          />

          <ServerValue
            label="Workspace ID"
            value={context.workspaceId}
            mono
          />

          <ServerValue
            label="Brand ID"
            value={context.brandId}
            mono
          />

          <ServerValue
            label="Workspace Slug"
            value={context.workspaceSlug}
          />

          <ServerValue
            label="Brand Slug"
            value={context.brandSlug}
          />

        </div>

      </section>


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
            value={context.currency}
          />

          <ServerValue
            label="Timezone"
            value={context.timezone}
          />

          <ServerValue
            label="Workspace Status"
            value="Active"
            status="green"
          />

          <ServerValue
            label="Your Role"
            value={formatRole(context.role)}
          />

        </div>

      </section>


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
            value={user?.email}
          />

          <ServerValue
            label="Name"
            value={user?.fullName}
          />

          <ServerValue
            label="User ID"
            value={user?.userId}
            mono
          />

          <ServerValue
            label="Authentication"
            value={formatAuthMethod(auth?.method)}
          />

        </div>


        <ServerNotice
          text="Workspace identity comes from the authenticated session and Growth OS control plane."
        />

      </section>

    </div>

  );

}


// ============================================================
// PLAN & BILLING
// ============================================================

function PlanBillingSettings({

  subscriptionContext,

  loading,

  error,

  reload,

}: {

  subscriptionContext:
    WorkspaceSubscriptionResponse |
    null;

  loading:
    boolean;

  error:
    string |
    null;

  reload:
    () => void;

}) {


  if (
    loading
  ) {

    return (

      <LoadingPanel
        title="Plan & Billing"
        text="Loading workspace subscription..."
      />

    );

  }


  if (
    error
  ) {

    return (

      <ErrorPanel

        title="Unable to load subscription"

        error={
          error
        }

        reload={
          reload
        }

      />

    );

  }


  if (
    !subscriptionContext?.configured
    ||
    !subscriptionContext.plan
    ||
    !subscriptionContext.subscription
  ) {

    return (

      <div className="space-y-3">

        <SectionHeader
          icon={WalletCards}
          title="Plan & Billing"
          description="Review your current Growth OS plan, capacity, usage and upgrades."
        />


        <section className="gos-panel !p-4">

          <p className="text-[10px] font-semibold text-slate-800">
            Subscription not configured
          </p>

          <p className="mt-1 text-[9px] text-slate-500">
            Your Growth OS administrator has not assigned a commercial plan to this brand.
          </p>

        </section>

      </div>

    );

  }


  const {
    plan,
    subscription,
  } =
    subscriptionContext;


  return (

    <div className="space-y-3">


      <SectionHeader

        icon={
          WalletCards
        }

        title="Plan & Billing"

        description="Review your current Growth OS plan, capacity and commercial access."

      />


      <section
        className="
          grid
          grid-cols-2
          gap-2

          xl:grid-cols-4
        "
      >

        <MetricCard
          label="Current Plan"
          value={plan.name}
        />

        <MetricCard
          label="Monthly Allowance"
          value={formatOrderLimit(
            plan.effectiveMonthlyOrderLimit
          )}
        />

        <MetricCard
          label="User Allowance"
          value={
            plan.maxUsers ===
              null

              ? 'Unlimited'

              : `${formatNumber(
                  plan.maxUsers
                )} users`
          }
        />

        <MetricCard
          label="Subscription"
          value={
            formatRole(
              subscription.status
            )
            ||
            '—'
          }
          tone="green"
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
              {plan.name}
            </h3>


            <p
              className="
                mt-1
                max-w-2xl

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              {plan.description ||
                'Growth OS commercial plan.'}
            </p>

          </div>


          <button

            type="button"

            disabled

            title="Plan comparison will be connected next"

            className="
              h-8
              shrink-0

              rounded-[8px]

              border
              border-slate-200

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
            label="Plan ID"
            value={plan.planId}
            mono
          />

          <ServerValue
            label="Plan Status"
            value={formatRole(plan.status)}
            status={
              plan.status ===
                'active'

                ? 'green'

                : undefined
            }
          />

          <ServerValue
            label="Base Order Limit"
            value={formatOrderLimit(
              plan.monthlyOrderLimit
            )}
          />

          <ServerValue
            label="Effective Order Limit"
            value={formatOrderLimit(
              plan.effectiveMonthlyOrderLimit
            )}
          />

          <ServerValue
            label="Order Limit Rule"
            value={formatRole(
              subscription.orderLimitOverrideMode
            )}
          />

          <ServerValue
            label="Last Updated"
            value={formatTimestamp(
              subscription.updatedAt
            )}
          />

        </div>

      </section>


      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Usage & Billing
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
            label="Current Order Usage"
            value="Not connected yet"
          />

          <ServerValue
            label="Billing Cycle"
            value="Not connected yet"
          />

          <ServerValue
            label="Next Renewal"
            value="Not connected yet"
          />

          <ServerValue
            label="Invoices"
            value="Not connected yet"
          />

        </div>


        <ServerNotice
          text="Plan entitlement is live. Usage metering, billing cycle, renewal and invoice history will be connected separately rather than showing estimated data."
        />

      </section>

    </div>

  );

}


// ============================================================
// MODULES
// ============================================================

function ModuleSettings({

  subscriptionContext,

  loading,

  error,

  reload,

}: {

  subscriptionContext:
    WorkspaceSubscriptionResponse |
    null;

  loading:
    boolean;

  error:
    string |
    null;

  reload:
    () => void;

}) {


  if (
    loading
  ) {

    return (

      <LoadingPanel
        title="Modules"
        text="Loading module entitlement..."
      />

    );

  }


  if (
    error
  ) {

    return (

      <ErrorPanel
        title="Unable to load modules"
        error={error}
        reload={reload}
      />

    );

  }


  const modules =
    subscriptionContext?.modules
    ||
    [];


  const enabledCount =
    modules.filter(
      module =>
        module.enabled
        &&
        module.status ===
          'active'
    ).length;


  return (

    <div className="space-y-3">


      <SectionHeader

        icon={
          Boxes
        }

        title="Modules"

        description="See which Growth OS capabilities are included in your current plan."

      />


      <section
        className="
          grid
          grid-cols-2
          gap-2

          md:grid-cols-3
        "
      >

        <MetricCard
          label="Available Modules"
          value={formatNumber(modules.length)}
        />

        <MetricCard
          label="Enabled"
          value={formatNumber(enabledCount)}
          tone="green"
        />

        <MetricCard
          label="Plan"
          value={
            subscriptionContext?.plan?.name
            ||
            '—'
          }
        />

      </section>


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


          <p className="mt-0.5 text-[9px] text-slate-500">
            Access shown below comes from your server-side plan entitlement.
          </p>

        </div>


        {modules.length ===
          0 ? (

          <EmptyServerState
            icon={Boxes}
            title="No module configuration found"
            description="No module entitlement was returned for the current workspace subscription."
          />

        ) : (

          <div
            className="
              grid
              grid-cols-1
              gap-2

              p-3

              md:grid-cols-2
            "
          >

            {modules.map(
              module => {

                const available =
                  module.enabled
                  &&
                  module.status ===
                    'active';


                return (

                  <div

                    key={
                      module.moduleId
                    }

                    className="
                      rounded-[10px]

                      border
                      border-slate-200

                      bg-slate-50

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

                      <div>

                        <p
                          className="
                            text-[11px]
                            font-semibold

                            text-slate-900
                          "
                        >
                          {module.name ||
                            module.moduleId}
                        </p>


                        <p
                          className="
                            mt-1

                            text-[8px]
                            leading-4

                            text-slate-500
                          "
                        >
                          {module.description ||
                            'Growth OS module.'}
                        </p>

                      </div>


                      <ModuleBadge
                        available={available}
                      />

                    </div>


                    <div
                      className="
                        mt-3

                        flex
                        flex-wrap
                        gap-1.5
                      "
                    >

                      {module.category && (

                        <SmallBadge>
                          {formatRole(
                            module.category
                          )}
                        </SmallBadge>

                      )}


                      {module.setupRequired && (

                        <SmallBadge>
                          Setup Required
                        </SmallBadge>

                      )}


                      {module.routeKey && (

                        <SmallBadge>
                          {module.routeKey}
                        </SmallBadge>

                      )}

                    </div>

                  </div>

                );

              }
            )}

          </div>

        )}

      </section>


      <ServerNotice
        text="Module access is read from the Growth OS control plane. The browser cannot enable a module by changing local settings."
      />

    </div>

  );

}


// ============================================================
// USERS & ACCESS
// ============================================================

function UserAccessSettings({

  usersContext,

  subscriptionContext,

  currentRole,

  loading,

  error,

  reload,

}: {

  usersContext:
    WorkspaceUsersResponse |
    null;

  subscriptionContext:
    WorkspaceSubscriptionResponse |
    null;

  currentRole:
    string |
    null;

  loading:
    boolean;

  error:
    string |
    null;

  reload:
    () => void;

}) {


  // ==========================================================
  // ADD USER STATE
  // ==========================================================

  const [
    showAddUser,
    setShowAddUser,
  ] =
    useState(
      false
    );


  const [
    newUserName,
    setNewUserName,
  ] =
    useState(
      ''
    );


  const [
    newUserEmail,
    setNewUserEmail,
  ] =
    useState(
      ''
    );


  const [
    newUserPassword,
    setNewUserPassword,
  ] =
    useState(
      ''
    );


  const [
    newUserRole,
    setNewUserRole,
  ] =
    useState<
      'owner'
      |
      'admin'
      |
      'analyst'
      |
      'viewer'
    >(
      'viewer'
    );


  const [
    userSaving,
    setUserSaving,
  ] =
    useState(
      false
    );


  const [
    userCreateError,
    setUserCreateError,
  ] =
    useState(
      ''
    );


  // ==========================================================
  // ADD WORKSPACE USER
  // ==========================================================

  async function addWorkspaceUser() {

    if (userSaving) {

      return;

    }


    const email =
      newUserEmail
        .trim()
        .toLowerCase();


    const fullName =
      newUserName
        .trim();


    if (!email) {

      setUserCreateError(
        'Email address is required.'
      );

      return;

    }


    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
          email
        )
    ) {

      setUserCreateError(
        'Enter a valid email address.'
      );

      return;

    }


    try {

      setUserSaving(
        true
      );


      setUserCreateError(
        ''
      );


      const response =
        await fetch(
          '/api/workspace/users',
          {

            method:
              'POST',

            cache:
              'no-store',

            credentials:
              'same-origin',

            headers: {

              'Content-Type':
                'application/json',

            },

            body:
              JSON.stringify({

                fullName,

                email,

                password:
                  newUserPassword,

                role:
                  newUserRole,

              }),

          }
        );


      const raw =
        await response.text();


      let json:
        any;


      try {

        json =
          JSON.parse(
            raw
          );

      } catch {

        throw new Error(
          `Users API returned HTTP ${response.status} instead of JSON`
        );

      }


      if (
        !response.ok
        ||
        !json?.ok
      ) {

        const apiError =
          String(
            json?.error
            ||
            'Unable to add user'
          );


        const friendlyErrors:
          Record<
            string,
            string
          > = {

          VALID_EMAIL_REQUIRED:
            'Enter a valid email address.',

          VALID_ROLE_REQUIRED:
            'Select a valid user role.',

          PASSWORD_MINIMUM_10_CHARACTERS:
            'New users require a password of at least 10 characters.',

          USER_ALREADY_HAS_ACCESS:
            'This user already has access to the current brand.',

          USER_LIMIT_REACHED:
            'Your current plan user limit has been reached.',

          USER_NOT_ACTIVE:
            'This Growth OS user is currently inactive.',

          SUBSCRIPTION_REQUIRED:
            'An active Growth OS subscription is required.',

          USER_MANAGEMENT_ACCESS_REQUIRED:
            'Only an active Owner or Admin can add users.',

          OWNER_ROLE_REQUIRED:
            'Only an Owner can grant the Owner role.',

          ACTIVE_BRAND_REQUIRED:
            'An active Growth OS brand is required.',

          UNAUTHENTICATED:
            'Your session has expired. Please sign in again.',

          INVALID_REQUEST_BODY:
            'The user details could not be processed.',

        };


        throw new Error(
          friendlyErrors[
            apiError
          ]
          ||
          apiError
        );

      }


      // ======================================================
      // SUCCESS
      // ======================================================

      setNewUserName(
        ''
      );


      setNewUserEmail(
        ''
      );


      setNewUserPassword(
        ''
      );


      setNewUserRole(
        'viewer'
      );


      setShowAddUser(
        false
      );


      // Reload canonical server user list.

      reload();


    } catch (
      createError:
        any
    ) {

      console.error(
        'GROWTH_OS_WORKSPACE_USER_CREATE_ERROR',
        createError
      );


      setUserCreateError(
        String(
          createError?.message
          ||
          'Unable to add user'
        )
      );

    } finally {

      setUserSaving(
        false
      );

    }

  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading
  ) {

    return (

      <LoadingPanel
        title="Users & Access"
        text="Loading workspace users..."
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

      <ErrorPanel
        title="Unable to load workspace users"
        error={error}
        reload={reload}
      />

    );

  }


  // ==========================================================
  // SERVER DATA
  // ==========================================================

  const users =
    usersContext?.users
    ||
    [];


  const summary =
    usersContext?.summary
    ||
    {

      totalUsers:
        users.length,

      activeUsers:
        users.filter(
          user =>
            user.userStatus ===
              'active'
            &&
            user.membershipStatus ===
              'active'
        ).length,

      owners:
        users.filter(
          user =>
            user.role ===
              'owner'
        ).length,

      admins:
        users.filter(
          user =>
            user.role ===
              'admin'
        ).length,

    };


  const maxUsers =
    subscriptionContext?.plan?.maxUsers
    ??
    null;


  const userAllowance =
    maxUsers ===
      null

      ? 'Unlimited'

      : `${formatNumber(
          summary.activeUsers
        )} / ${formatNumber(
          maxUsers
        )}`;


  const userLimitReached =
    maxUsers !==
      null
    &&
    summary.activeUsers >=
      maxUsers;


  const canManageUsers =
    currentRole ===
      'owner'
    ||
    currentRole ===
      'admin';


  const canGrantOwner =
    currentRole ===
      'owner';


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <SectionHeader

        icon={
          Users
        }

        title="Users & Access"

        description="Review people who can access the current brand and manage their workspace access."

      />


      {/* =====================================================
          ADD USER ACTION
      ===================================================== */}

      <div
        className="
          flex
          items-center
          justify-between
          gap-3
        "
      >

        <p
          className="
            text-[9px]
            text-slate-500
          "
        >
          {canManageUsers
            ? 'Owners and Admins can add users to this brand.'
            : 'Only an Owner or Admin can add users to this brand.'}
        </p>


        <button

          type="button"

          disabled={
            !canManageUsers
            ||
            userLimitReached
          }

          title={
            !canManageUsers

              ? 'Owner or Admin access is required'

              : userLimitReached

                ? 'Plan user limit reached'

                : 'Add a user'
          }

          onClick={
            () => {

              setUserCreateError(
                ''
              );


              setShowAddUser(
                current =>
                  !current
              );

            }
          }

          className="
            shrink-0

            rounded-lg

            bg-slate-950

            px-3
            py-2

            text-[10px]
            font-semibold

            text-white

            transition

            hover:bg-slate-800

            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >

          {showAddUser
            ? 'Cancel'
            : 'Add User'}

        </button>

      </div>


      {/* =====================================================
          ADD USER FORM
      ===================================================== */}

      {showAddUser &&
        canManageUsers && (

        <section
          className="
            gos-panel
            !p-3.5
          "
        >

          <div>

            <h3 className="gos-section-title">
              Add User
            </h3>


            <p
              className="
                mt-1

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              Add a person to the current authenticated brand.
            </p>

          </div>


          <div
            className="
              mt-4

              grid
              grid-cols-1
              gap-3

              md:grid-cols-2
            "
          >


            {/* FULL NAME */}

            <FormField label="Full Name">

              <input

                type="text"

                value={
                  newUserName
                }

                onChange={
                  event =>
                    setNewUserName(
                      event.target.value
                    )
                }

                placeholder="e.g. Rahul Sharma"

                autoComplete="name"

                className="gos-input w-full"
              />

            </FormField>


            {/* EMAIL */}

            <FormField label="Email">

              <input

                type="email"

                value={
                  newUserEmail
                }

                onChange={
                  event =>
                    setNewUserEmail(
                      event.target.value
                    )
                }

                placeholder="user@company.com"

                autoComplete="email"

                className="gos-input w-full"
              />

            </FormField>


            {/* PASSWORD */}

            <FormField label="Initial Password">

              <input

                type="password"

                value={
                  newUserPassword
                }

                onChange={
                  event =>
                    setNewUserPassword(
                      event.target.value
                    )
                }

                placeholder="Minimum 10 characters"

                autoComplete="new-password"

                className="gos-input w-full"
              />


              <span
                className="
                  mt-1
                  block

                  text-[8px]
                  leading-4

                  text-slate-400
                "
              >
                Required only when the email does not already have a Growth OS account.
              </span>

            </FormField>


            {/* ROLE */}

            <FormField label="Role">

              <select

                value={
                  newUserRole
                }

                onChange={
                  event =>
                    setNewUserRole(
                      event.target.value as
                        'owner'
                        |
                        'admin'
                        |
                        'analyst'
                        |
                        'viewer'
                    )
                }

                className="gos-input w-full"
              >

                <option value="viewer">
                  Viewer
                </option>

                <option value="analyst">
                  Analyst
                </option>

                <option value="admin">
                  Admin
                </option>

                {canGrantOwner && (

                  <option value="owner">
                    Owner
                  </option>

                )}

              </select>


              <span
                className="
                  mt-1
                  block

                  text-[8px]
                  leading-4

                  text-slate-400
                "
              >
                Admin can manage users. Only an Owner can grant Owner access.
              </span>

            </FormField>

          </div>


          {/* ERROR */}

          {userCreateError && (

            <div
              className="
                mt-3

                rounded-lg

                border
                border-red-200

                bg-red-50

                px-3
                py-2.5
              "
            >

              <p
                className="
                  text-[9px]
                  font-semibold

                  text-red-700
                "
              >
                {userCreateError}
              </p>

            </div>

          )}


          {/* ACTIONS */}

          <div
            className="
              mt-4

              flex
              items-center
              justify-end
              gap-2
            "
          >

            <button

              type="button"

              disabled={
                userSaving
              }

              onClick={
                () => {

                  setUserCreateError(
                    ''
                  );


                  setShowAddUser(
                    false
                  );

                }
              }

              className="
                rounded-lg

                border
                border-slate-200

                bg-white

                px-3
                py-2

                text-[10px]
                font-semibold

                text-slate-600

                transition

                hover:bg-slate-50

                disabled:opacity-40
              "
            >
              Cancel
            </button>


            <button

              type="button"

              disabled={
                userSaving
                ||
                !newUserEmail.trim()
              }

              onClick={
                addWorkspaceUser
              }

              className="
                rounded-lg

                bg-violet-600

                px-4
                py-2

                text-[10px]
                font-semibold

                text-white

                transition

                hover:bg-violet-700

                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >

              {userSaving
                ? 'Adding...'
                : 'Add User'}

            </button>

          </div>

        </section>

      )}


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          xl:grid-cols-4
        "
      >

        <MetricCard
          label="Total Users"
          value={
            formatNumber(
              summary.totalUsers
            )
          }
        />


        <MetricCard
          label="Active Users"
          value={
            formatNumber(
              summary.activeUsers
            )
          }
          tone="green"
        />


        <MetricCard
          label="Plan Usage"
          value={
            userAllowance
          }
        />


        <MetricCard
          label="Owners / Admins"
          value={
            `${formatNumber(
              summary.owners
            )} / ${formatNumber(
              summary.admins
            )}`
          }
        />

      </section>


      {/* =====================================================
          USER TABLE
      ===================================================== */}

      <section
        className="
          gos-panel
          !p-0
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
            gap-3

            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <div>

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
              Access is scoped to the current authenticated brand.
            </p>

          </div>


          {maxUsers !==
            null && (

            <span
              className="
                rounded-full

                border
                border-slate-200

                bg-slate-50

                px-2
                py-1

                text-[8px]
                font-semibold

                text-slate-500
              "
            >

              {formatNumber(
                summary.activeUsers
              )}

              {' / '}

              {formatNumber(
                maxUsers
              )}

              {' users'}

            </span>

          )}

        </div>


        {users.length ===
          0 ? (

          <EmptyServerState
            icon={
              Users
            }
            title="No users found"
            description="No Growth OS users are currently assigned to this brand."
          />

        ) : (

          <div className="overflow-x-auto">

            <table
              className="
                w-full
                min-w-[820px]

                border-collapse
              "
            >

              <thead>

                <tr
                  className="
                    border-b
                    border-slate-200

                    bg-slate-50
                  "
                >

                  <TableHeader>
                    User
                  </TableHeader>

                  <TableHeader>
                    Role
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Last Login
                  </TableHeader>

                  <TableHeader>
                    Default
                  </TableHeader>

                  <TableHeader>
                    Member Since
                  </TableHeader>

                </tr>

              </thead>


              <tbody>

                {users.map(
                  user => {

                    const active =
                      user.userStatus ===
                        'active'
                      &&
                      user.membershipStatus ===
                        'active';


                    const statusLabel =
                      getUserAccessStatus(
                        user.userStatus,
                        user.membershipStatus
                      );


                    return (

                      <tr

                        key={
                          user.membershipId
                        }

                        className="
                          border-b
                          border-slate-100

                          last:border-b-0

                          hover:bg-slate-50
                        "
                      >


                        {/* USER */}

                        <td className="px-3 py-2.5">

                          <div
                            className="
                              flex
                              items-center
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

                                rounded-full

                                bg-violet-50

                                text-[10px]
                                font-semibold

                                text-violet-700
                              "
                            >

                              {getUserInitials(
                                user.fullName,
                                user.email
                              )}

                            </div>


                            <div className="min-w-0">

                              <p
                                className="
                                  max-w-[240px]

                                  truncate

                                  text-[10px]
                                  font-semibold

                                  text-slate-900
                                "
                              >

                                {user.fullName
                                  ||
                                  user.email
                                  ||
                                  'Growth OS User'}

                              </p>


                              <p
                                className="
                                  mt-0.5
                                  max-w-[240px]

                                  truncate

                                  text-[8px]

                                  text-slate-500
                                "
                              >

                                {user.email
                                  ||
                                  user.userId}

                              </p>

                            </div>

                          </div>

                        </td>


                        {/* ROLE */}

                        <td className="px-3 py-2.5">

                          <RoleBadge
                            role={
                              user.role
                            }
                          />

                        </td>


                        {/* STATUS */}

                        <td className="px-3 py-2.5">

                          <StatusBadge
                            label={
                              statusLabel
                            }
                            active={
                              active
                            }
                          />

                        </td>


                        {/* LAST LOGIN */}

                        <td
                          className="
                            px-3
                            py-2.5

                            text-[9px]

                            text-slate-600
                          "
                        >

                          {formatTimestamp(
                            user.lastLoginAt
                          )
                          ||
                          'Never'}

                        </td>


                        {/* DEFAULT */}

                        <td className="px-3 py-2.5">

                          {user.isDefault ? (

                            <span
                              className="
                                rounded-full

                                border
                                border-violet-200

                                bg-violet-50

                                px-2
                                py-0.5

                                text-[8px]
                                font-semibold

                                text-violet-700
                              "
                            >
                              Default
                            </span>

                          ) : (

                            <span
                              className="
                                text-[9px]

                                text-slate-400
                              "
                            >
                              —
                            </span>

                          )}

                        </td>


                        {/* MEMBER SINCE */}

                        <td
                          className="
                            px-3
                            py-2.5

                            text-[9px]

                            text-slate-600
                          "
                        >

                          {formatDate(
                            user.membershipCreatedAt
                          )
                          ||
                          '—'}

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>


      <ServerNotice
        text="Users and roles are controlled by Growth OS server-side access rules. Browser storage cannot grant or modify workspace access."
      />

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

          <div className="flex items-start gap-3">

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

              <h2 className="text-[14px] font-semibold text-slate-950">
                My Preferences
              </h2>

              <p className="mt-0.5 text-[9px] text-slate-500">
                Personal interface preferences that apply only to you.
              </p>

            </div>

          </div>


          <div className="flex gap-2">

            <button
              type="button"
              onClick={resetPreferences}
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
              <RotateCcw size={12} />
              Reset
            </button>


            <button
              type="button"
              onClick={savePreferences}
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
                  <CheckCircle2 size={12} />
                  Saved
                </>

              ) : (

                <>
                  <Save size={12} />
                  Save
                </>

              )}

            </button>

          </div>

        </div>

      </section>


      <section className="gos-panel !p-3.5">

        <SectionHeading
          icon={SlidersHorizontal}
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
            icon={PanelLeft}
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
              value={sidebarMode}
              onChange={
                value =>
                  setSidebarMode(
                    value as SidebarMode
                  )
              }
            />

          </PreferenceRow>


          <PreferenceRow
            icon={LayoutDashboard}
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
              value={preferences.tableDensity}
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
          icon={CalendarDays}
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

          <FormField label="Default Landing Page">

            <select
              value={preferences.defaultLandingPage}
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
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>

                )
              )}

            </select>

          </FormField>


          <FormField label="Default Date Range">

            <select
              value={preferences.defaultDateRange}
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
// COMMON UI
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

      <div className="flex items-start gap-3">

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
          <Icon size={16} />
        </div>


        <div>

          <h2 className="text-[14px] font-semibold text-slate-950">
            {title}
          </h2>

          <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
            {description}
          </p>

        </div>

      </div>

    </section>

  );

}


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

    <div className="flex items-start gap-2.5">

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
        <Icon size={14} />
      </div>


      <div>

        <h3 className="text-[12px] font-semibold text-slate-900">
          {title}
        </h3>

        <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
          {description}
        </p>

      </div>

    </div>

  );

}


function MetricCard({

  label,

  value,

  tone =
    'default',

}: {

  label:
    string;

  value:
    string;

  tone?:
    'default'
    |
    'green';

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
        className={`
          mt-2

          truncate

          text-[16px]
          font-semibold

          ${
            tone ===
              'green'

              ? 'text-emerald-700'

              : 'text-slate-950'
          }
        `}
      >
        {value}
      </p>

    </div>

  );

}


function ModuleBadge({

  available,

}: {

  available:
    boolean;

}) {

  return (

    <span
      className={`
        shrink-0

        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${
          available

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-slate-200
              bg-slate-100
              text-slate-500
            `
        }
      `}
    >
      {available
        ? 'Included'
        : 'Not Included'
      }
    </span>

  );

}


function RoleBadge({

  role,

}: {

  role:
    string;

}) {

  return (

    <span
      className="
        rounded-full

        border
        border-violet-200

        bg-violet-50

        px-2
        py-0.5

        text-[8px]
        font-semibold

        text-violet-700
      "
    >
      {formatRole(
        role
      )
      ||
      role}
    </span>

  );

}


function StatusBadge({

  label,

  active,

}: {

  label:
    string;

  active:
    boolean;

}) {

  return (

    <span
      className={`
        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${
          active

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-amber-200
              bg-amber-50
              text-amber-700
            `
        }
      `}
    >
      {label}
    </span>

  );

}


function SmallBadge({

  children,

}: {

  children:
    ReactNode;

}) {

  return (

    <span
      className="
        rounded-full

        border
        border-slate-200

        bg-white

        px-2
        py-0.5

        text-[8px]
        font-medium

        text-slate-500
      "
    >
      {children}
    </span>

  );

}


function TableHeader({

  children,

}: {

  children:
    ReactNode;

}) {

  return (

    <th
      className="
        px-3
        py-2

        text-left

        text-[8px]
        font-semibold
        uppercase
        tracking-[0.06em]

        text-slate-500
      "
    >
      {children}
    </th>

  );

}


function LoadingPanel({

  title,

  text,

}: {

  title:
    string;

  text:
    string;

}) {

  return (

    <div className="space-y-3">

      <section className="gos-panel !p-3.5">

        <h2 className="text-[14px] font-semibold text-slate-950">
          {title}
        </h2>

      </section>


      <section className="gos-panel !p-4">

        <p className="text-[10px] text-slate-500">
          {text}
        </p>

      </section>

    </div>

  );

}


function ErrorPanel({

  title,

  error,

  reload,

}: {

  title:
    string;

  error:
    string;

  reload:
    () => void;

}) {

  return (

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

        <div className="flex items-start gap-2">

          <AlertCircle
            size={14}
            className="mt-0.5 text-red-600"
          />

          <div>

            <p className="text-[10px] font-semibold text-red-800">
              {title}
            </p>

            <p className="mt-0.5 text-[9px] text-red-700">
              {error}
            </p>

          </div>

        </div>


        <button
          type="button"
          onClick={reload}
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

  );

}


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

      <span className="text-[9px] text-slate-500">
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

      <p className="text-[8px] leading-4 text-violet-700">
        {text}
      </p>

    </div>

  );

}


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

      <div className="max-w-[430px] text-center">

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
          <Icon size={16} />
        </div>

        <p className="mt-2.5 text-[11px] font-semibold text-slate-800">
          {title}
        </p>

        <p className="mx-auto mt-1 max-w-[400px] text-[9px] leading-4 text-slate-500">
          {description}
        </p>

      </div>

    </div>

  );

}


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

      <div className="flex min-w-0 items-start gap-2.5">

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
          <Icon size={13} />
        </div>


        <div className="min-w-0">

          <p className="text-[10px] font-semibold text-slate-800">
            {title}
          </p>

          <p className="mt-0.5 max-w-[430px] text-[8px] leading-4 text-slate-500">
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
              key={option.value}
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
// FORMATTERS
// ============================================================

function formatNumber(
  value:
    number
) {

  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  );

}


function formatOrderLimit(
  value:
    number |
    null
) {

  if (
    value ===
    null
  ) {

    return 'Unlimited';

  }


  return `${formatNumber(
    value
  )} orders`;
}


function formatTimestamp(
  value:
    string |
    null |
    undefined
) {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleString(
    'en-IN',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    }
  );

}


function formatDate(
  value:
    string |
    null |
    undefined
) {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleDateString(
    'en-IN',
    {
      dateStyle:
        'medium',
    }
  );

}


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


  return formatRole(
    value
  );

}


// ============================================================
// USER HELPERS
// ============================================================

function getUserInitials(

  fullName:
    string |
    null |
    undefined,

  email:
    string |
    null |
    undefined

) {

  const name =
    String(
      fullName
      ||
      ''
    ).trim();


  if (name) {

    const parts =
      name
        .split(
          /\s+/
        )
        .filter(
          Boolean
        );


    if (
      parts.length ===
      1
    ) {

      return parts[0]
        .slice(
          0,
          2
        )
        .toUpperCase();

    }


    return (
      (
        parts[0]?.[0]
        ||
        ''
      )
      +
      (
        parts[
          parts.length - 1
        ]?.[0]
        ||
        ''
      )
    ).toUpperCase();

  }


  const normalizedEmail =
    String(
      email
      ||
      ''
    ).trim();


  if (
    normalizedEmail
  ) {

    return normalizedEmail
      .slice(
        0,
        2
      )
      .toUpperCase();

  }


  return 'U';

}


function getUserAccessStatus(

  userStatus:
    string |
    null |
    undefined,

  membershipStatus:
    string |
    null |
    undefined

) {

  if (
    userStatus ===
      'suspended'
  ) {

    return 'Suspended';

  }


  if (
    userStatus ===
      'inactive'
  ) {

    return 'User Inactive';

  }


  if (
    membershipStatus ===
      'inactive'
  ) {

    return 'Access Inactive';

  }


  if (
    userStatus ===
      'active'
    &&
    membershipStatus ===
      'active'
  ) {

    return 'Active';

  }


  return 'Inactive';

}