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
  Bell,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Database,
  CheckCircle2,
  CreditCard,
  EllipsisVertical,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  PanelLeft,
  Plug,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserRound,
  WalletCards,
} from 'lucide-react';

import AppIntegrations
  from './integrations/AppIntegrations';

import BillingSettingsV1
  from './BillingSettingsV1';

import AuditLogSettings
  from './AuditLogSettings';

import DataAccountSettings
  from './DataAccountSettings';

import NotificationSettings
  from './NotificationSettings';

import CommercialReadinessSettings
  from './CommercialReadinessSettings';

import {
  GROWTHOS_SUBMODULES,
} from '@/lib/auth/submodule-registry';

import {
  DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES,
  readGrowthOSPersonalPreferences,
  resetGrowthOSPersonalPreferences,
  writeGrowthOSPersonalPreferences,
} from '@/lib/preferences/client-preferences';


// ============================================================
// SETTINGS TYPES
// ============================================================

type SettingsTab =
  | 'Workspace'
  | 'Plan & Billing'
  | 'Modules'
  | 'Integrations'
  | 'Users & Access'
  | 'Security'
  | 'Notifications'
  | 'Audit Log'
  | 'Data & Account'
  | 'My Preferences'
  | 'Launch Readiness';


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
// USER ACCESS TYPES
// ============================================================

type WorkspaceUserRole =
  | 'owner'
  | 'admin'
  | 'analyst'
  | 'viewer';


type UserAccessPermission =
  | 'inherit'
  | 'viewer'
  | 'editor'
  | 'disabled';


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
// DEFAULT PERSONAL PREFERENCES
//
// Storage/runtime behavior is centralized in:
// lib/preferences/client-preferences.ts
// ============================================================

const DEFAULT_PREFERENCES:
  UserPreferences = {

  tableDensity:
    DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES.tableDensity,

  defaultLandingPage:
    DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES.defaultLandingPage,

  defaultDateRange:
    DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES.defaultDateRange,

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
      'Security',

    label:
      'Security',

    icon:
      ShieldCheck,
  },

  {
    id:
      'Notifications',

    label:
      'Notifications',

    icon:
      Bell,
  },

  {
    id:
      'Audit Log',

    label:
      'Audit Log',

    icon:
      History,
  },

  {
    id:
      'Data & Account',

    label:
      'Data & Account',

    icon:
      Database,
  },

  {
    id:
      'My Preferences',

    label:
      'My Preferences',

    icon:
      UserRound,
  },

  {
    id:
      'Launch Readiness',

    label:
      'Launch Readiness',

    icon:
      ClipboardCheck,
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
  //
  // Preferences are scoped to the authenticated Growth OS user.
  // Legacy unscoped localStorage values are migrated once by the
  // shared preference helper.
  // ==========================================================

  useEffect(
    () => {

      if (authLoading) {
        return;
      }


      try {

        const stored =
          readGrowthOSPersonalPreferences(
            authContext?.user?.userId
            ?? null
          );


        setSidebarMode(
          stored.sidebarMode
        );


        setPreferences({

          tableDensity:
            stored.tableDensity,

          defaultLandingPage:
            stored.defaultLandingPage,

          defaultDateRange:
            stored.defaultDateRange,

        });

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
    [
      authLoading,
      authContext?.user?.userId,
    ]
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

      writeGrowthOSPersonalPreferences(
        authContext?.user?.userId
        ?? null,
        {

          sidebarMode,

          tableDensity:
            preferences.tableDensity,

          defaultLandingPage:
            preferences.defaultLandingPage,

          defaultDateRange:
            preferences.defaultDateRange,

        }
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

    try {

      const next =
        resetGrowthOSPersonalPreferences(
          authContext?.user?.userId
          ?? null
        );


      setSidebarMode(
        next.sidebarMode
      );


      setPreferences({

        tableDensity:
          next.tableDensity,

        defaultLandingPage:
          next.defaultLandingPage,

        defaultDateRange:
          next.defaultDateRange,

      });


      setSaved(
        false
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
              Review your workspace, subscription, access, security, notifications, data controls and personal preferences.
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
  usersContext={usersContext}
  subscriptionContext={subscriptionContext}
  currentUserId={
    authContext?.user?.userId
    ?? null
  }
  currentRole={
    authContext?.activeContext?.role
    ?? null
  }
  loading={
    usersLoading
    ||
    !usersLoaded
  }
  error={usersError}
  reload={loadUsersContext}
/> 

          )}


          {activeTab ===
            'Security' && (

            <SecuritySettings
              authContext={
                authContext
              }
            />

          )}


          {activeTab ===
            'Notifications' && (

            <NotificationSettings />

          )}


          {activeTab ===
            'Audit Log' && (

            <AuditLogSettings />

          )}


          {activeTab ===
            'Data & Account' && (

            <DataAccountSettings />

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


          {activeTab ===
            'Launch Readiness' && (

            <CommercialReadinessSettings />

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
          Workspace Details
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

  return (

    <BillingSettingsV1
      subscriptionContext={subscriptionContext}
      loading={loading}
      error={error}
      reload={reload}
    />

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

        description="See the modules included for this workspace and which ones still need setup."

      />


      <section className="gos-panel !p-3.5">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Current Plan
            </p>
            <p className="mt-1 text-[13px] font-semibold text-slate-950">
              {subscriptionContext?.plan?.name || '—'}
            </p>
          </div>

          <div className="text-[9px] text-slate-500">
            <span className="font-semibold text-slate-800">{formatNumber(enabledCount)}</span>
            {' of '}
            <span className="font-semibold text-slate-800">{formatNumber(modules.length)}</span>
            {' modules available'}
          </div>

        </div>

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
            These are the modules currently available to this workspace. Modules that still need connection or setup are marked below.
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


                    {module.setupRequired && (

                      <div className="mt-3">
                        <SmallBadge>
                          Setup Required
                        </SmallBadge>
                      </div>

                    )}

                  </div>

                );

              }
            )}

          </div>

        )}

      </section>



    </div>

  );

}


// ============================================================
// USERS & ACCESS
// ============================================================

function UserAccessSettings({

  usersContext,

  subscriptionContext,

  currentUserId,

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

  currentUserId:
    string |
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
  // ADD USER / PROVISIONING STATE
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
    newUserRole,
    setNewUserRole,
  ] =
    useState<WorkspaceUserRole>(
      'viewer'
    );


  const [
    provisioningMembershipId,
    setProvisioningMembershipId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    provisioningUserId,
    setProvisioningUserId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    modulePermissions,
    setModulePermissions,
  ] =
    useState<
      Record<
        string,
        UserAccessPermission
      >
    >({});


  const [
    submodulePermissions,
    setSubmodulePermissions,
  ] =
    useState<
      Record<
        string,
        UserAccessPermission
      >
    >({});


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
  // ACCESS FORM MODE
  // ==========================================================

  const [
    accessFormMode,
    setAccessFormMode,
  ] =
    useState<
      'add'
      |
      'edit'
      |
      'resume'
    >(
      'add'
    );  


  // ==========================================================
  // USER ACTION MENU / EDIT ACCESS STATE
  // ==========================================================

  const [
    actionMenu,
    setActionMenu,
  ] =
    useState<{
      userId:
        string;

      top:
        number;

      left:
        number;
    } | null>(
      null
    );

 
  const [
    userActionSavingId,
    setUserActionSavingId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    userActionError,
    setUserActionError,
  ] =
    useState(
      ''
    );


  // ==========================================================
  // PROVISIONING HELPERS
  // ==========================================================

  const activeModules =
    (
      subscriptionContext?.modules
      ||
      []
    ).filter(
      module =>
        module.status ===
          'active'
    );


  function defaultModulePermission(

    module:
      WorkspaceSubscriptionResponse['modules'][number],

    role:
      WorkspaceUserRole

  ):
    UserAccessPermission {

    if (!module.enabled) {

      return 'disabled';

    }


    if (
      role ===
        'viewer'
    ) {

      return 'viewer';

    }


    return 'editor';

  }


  function buildInitialModulePermissions(
    role:
      WorkspaceUserRole
  ) {

    const next:
      Record<
        string,
        UserAccessPermission
      > = {};


    for (
      const module
      of activeModules
    ) {

      next[
        module.moduleId
      ] =
        defaultModulePermission(
          module,
          role
        );

    }


    return next;

  }


  function buildInitialSubmodulePermissions(

    nextModulePermissions:
      Record<
        string,
        UserAccessPermission
      >

  ) {

    const next:
      Record<
        string,
        UserAccessPermission
      > = {};


    const moduleMap =
      new Map(
        activeModules.map(
          module => [
            module.moduleId,
            module,
          ]
        )
      );


    for (
      const submodule
      of GROWTHOS_SUBMODULES
    ) {

      const module =
        moduleMap.get(
          submodule.moduleId
        );


      if (
        !module
        ||
        !module.enabled
        ||
        nextModulePermissions[
          submodule.moduleId
        ] ===
          'disabled'
      ) {

        continue;

      }


      next[
        `${submodule.moduleId}:${submodule.submoduleId}`
      ] =
        'inherit';

    }


    return next;

  }


  function resetProvisioningDraft() {

    setNewUserName(
      ''
    );


    setNewUserEmail(
      ''
    );


    setNewUserRole(
      'viewer'
    );


    setProvisioningMembershipId(
      null
    );


    setProvisioningUserId(
      null
    );


    const nextModulePermissions =
      buildInitialModulePermissions(
        'viewer'
      );


    setModulePermissions(
      nextModulePermissions
    );


    setSubmodulePermissions(
      buildInitialSubmodulePermissions(
        nextModulePermissions
      )
    );


    setUserCreateError(
      ''
    );

  }


    function openAddUserForm() {

    resetProvisioningDraft();


    setAccessFormMode(
      'add'
    );


    setUserActionError(
      ''
    );


    setShowAddUser(
      true
    );

  }


  function closeAddUserForm() {

    resetProvisioningDraft();


    setShowAddUser(
      false
    );

  }


  function handleNewUserRoleChange(
    role:
      WorkspaceUserRole
  ) {

    const nextModulePermissions =
      buildInitialModulePermissions(
        role
      );


    setNewUserRole(
      role
    );


    setModulePermissions(
      nextModulePermissions
    );


    setSubmodulePermissions(
      buildInitialSubmodulePermissions(
        nextModulePermissions
      )
    );

  }


  function updateModulePermission(

    moduleId:
      string,

    permission:
      UserAccessPermission

  ) {

    const previousPermission =
      modulePermissions[
        moduleId
      ];


    setModulePermissions(
      previous => ({
        ...previous,
        [moduleId]:
          permission,
      })
    );


    const moduleSubmodules =
      GROWTHOS_SUBMODULES.filter(
        submodule =>
          submodule.moduleId ===
            moduleId
      );


    setSubmodulePermissions(
      previous => {

        const next = {
          ...previous,
        };


        for (
          const submodule
          of moduleSubmodules
        ) {

          const key =
            `${moduleId}:${submodule.submoduleId}`;


          if (
            permission ===
              'disabled'
          ) {

            next[
              key
            ] =
              'disabled';


            continue;

          }


          if (
            previousPermission ===
              'disabled'
            ||
            !next[
              key
            ]
            ||
            (
              permission ===
                'viewer'
              &&
              next[
                key
              ] ===
                'editor'
            )
          ) {

            next[
              key
            ] =
              'inherit';

          }

        }


        return next;

      }
    );

  }

  async function openEditUserAccess(
  user:
    NonNullable<
      WorkspaceUsersResponse['users']
    >[number]
) {

  try {

    setUserActionError(
      ''
    );


    setUserCreateError(
      ''
    );


    setUserActionSavingId(
      user.userId
    );


    const response =
      await fetch(
        `/api/workspace/users/access?membershipId=${encodeURIComponent(
          user.membershipId
        )}`,
        {
          cache:
            'no-store',

          credentials:
            'same-origin',
        }
      );


    const json =
      await readApiJson(
        response,
        'User access API'
      );


    if (
      !response.ok
      ||
      !json?.ok
    ) {

      throw new Error(
        String(
          json?.error
          ||
          'Unable to load user access'
        )
      );

    }


    const normalizedRole:
      WorkspaceUserRole =
        (
          user.role ===
            'owner'
          ||
          user.role ===
            'admin'
          ||
          user.role ===
            'analyst'
          ||
          user.role ===
            'viewer'
        )
          ? user.role
          : 'viewer';


    // ========================================================
    // CURRENT MODULE PERMISSIONS
    // ========================================================

    const nextModulePermissions =
      buildInitialModulePermissions(
        normalizedRole
      );


    for (
      const item
      of json.modulePermissions
      ||
      []
    ) {

      nextModulePermissions[
        String(
          item.moduleId
        )
      ] =
        item.permission as
          UserAccessPermission;

    }


    // ========================================================
    // CURRENT SUBMODULE PERMISSIONS
    // ========================================================

    const nextSubmodulePermissions =
      buildInitialSubmodulePermissions(
        nextModulePermissions
      );


    for (
      const item
      of json.submodulePermissions
      ||
      []
    ) {

      nextSubmodulePermissions[
        `${item.moduleId}:${item.submoduleId}`
      ] =
        item.permission as
          UserAccessPermission;

    }


    setNewUserName(
      user.fullName
      ||
      ''
    );


    setNewUserEmail(
      user.email
      ||
      ''
    );


    setNewUserRole(
      normalizedRole
    );


    setProvisioningMembershipId(
      user.membershipId
    );


    setProvisioningUserId(
      user.userId
    );


    setModulePermissions(
      nextModulePermissions
    );


    setSubmodulePermissions(
      nextSubmodulePermissions
    );


    setAccessFormMode(
      'edit'
    );
    
    setActionMenu(
      null
    );


    setShowAddUser(
      true
    );

  } catch (
    accessError:
      any
  ) {

    console.error(
      'GROWTH_OS_USER_ACCESS_LOAD_ERROR',
      accessError
    );


    setUserActionError(
      String(
        accessError?.message
        ||
        'Unable to load user access'
      )
    );

  } finally {

    setUserActionSavingId(
      null
    );

  }

}


  function friendlyProvisioningError(
    apiError:
      string
  ) {

    const errors:
      Record<
        string,
        string
      > = {

      VALID_EMAIL_REQUIRED:
        'Enter a valid email address.',

      VALID_ROLE_REQUIRED:
        'Select a valid user role.',

      PASSWORD_MINIMUM_10_CHARACTERS:
        'Passwords must be at least 10 characters.',

      USER_ALREADY_HAS_ACCESS:
        'This user already has active access to the current brand.',

      USER_LIMIT_REACHED:
        'Your current plan user limit has been reached.',

      USER_NOT_ACTIVE:
        'This Growth OS user is currently inactive.',

      SUBSCRIPTION_REQUIRED:
        'An active Growth OS subscription is required.',

      USER_MANAGEMENT_ACCESS_REQUIRED:
        'Only an active Owner or Admin can manage users.',

      OWNER_ROLE_REQUIRED:
        'Only an Owner can grant the Owner role.',

      ACTIVE_BRAND_REQUIRED:
        'An active Growth OS brand is required.',

      UNAUTHENTICATED:
        'Your session has expired. Please sign in again.',

      INVALID_REQUEST_BODY:
        'The request could not be processed.',

      MODULE_PERMISSIONS_REQUIRED:
        'Configure module access before activation.',

      INVALID_MODULE_PERMISSION:
        'One or more module permissions are invalid.',

      MODULE_NOT_FOUND:
        'A selected module is no longer available.',

      MODULE_NOT_ACTIVE:
        'A selected module is no longer active.',

      MODULE_NOT_AVAILABLE_FOR_BRAND:
        'A permission cannot exceed the modules available to this brand.',

      SUBMODULE_PERMISSIONS_REQUIRED:
        'Configure submodule access before activation.',

      INVALID_SUBMODULE_PERMISSION:
        'One or more submodule permissions are invalid.',

      SUBMODULE_NOT_FOUND:
        'A selected submodule is no longer available.',

      PARENT_MODULE_DISABLED:
        'A disabled module cannot grant access to its submodules.',

      SUBMODULE_PERMISSION_EXCEEDS_MODULE:
        'A submodule permission cannot exceed its parent module permission.',

      USER_MODULE_ACCESS_REQUIRED:
        'Complete module access before activating this user.',

      USER_SUBMODULE_ACCESS_REQUIRED:
        'Complete submodule access before activating this user.',

      WORKSPACE_MEMBERSHIP_NOT_FOUND:
        'The selected workspace membership could not be found.',

      WORKSPACE_USER_NOT_FOUND:
        'This user no longer belongs to the current brand.',

      CANNOT_MODIFY_SELF_ACCESS:
        'You cannot modify your own access from this screen.',

    };


    return (
      errors[
        apiError
      ]
      ||
      apiError
      ||
      'Unable to configure user access.'
    );

  }


  async function readApiJson(
    response:
      Response,

    label:
      string
  ) {

    const raw =
      await response.text();


    try {

      return JSON.parse(
        raw
      );

    } catch {

      throw new Error(
        `${label} returned HTTP ${response.status} instead of JSON`
      );

    }

  }


  // ==========================================================
  // ADD / RESUME + CONFIGURE + ACTIVATE USER
  //
  // One-screen UX.
  //
  // Backend safety remains multi-step:
  //
  // 1. create/resume INACTIVE membership
  // 2. save module permissions
  // 3. save submodule permissions
  // 4. activate
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


    if (
      activeModules.length ===
        0
    ) {

      setUserCreateError(
        'No active Growth OS modules are available for this brand.'
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


      let membershipId =
        provisioningMembershipId;


      let userId =
        provisioningUserId;


      let effectiveRole:
        WorkspaceUserRole =
          newUserRole;


      // ======================================================
      // 1. CREATE OR RESUME IDENTITY / MEMBERSHIP
      // ======================================================

      if (
        !membershipId
        ||
        !userId
      ) {

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

                  role:
                    newUserRole,

                }),

            }
          );


        const json =
          await readApiJson(
            response,
            'Users API'
          );


        if (
          !response.ok
          ||
          !json?.ok
        ) {

          throw new Error(
            friendlyProvisioningError(
              String(
                json?.error
                ||
                'Unable to add user'
              )
            )
          );

        }


        membershipId =
          String(
            json?.user?.membershipId
            ||
            ''
          ).trim();


        userId =
          String(
            json?.user?.userId
            ||
            ''
          ).trim();


        if (
          !membershipId
          ||
          !userId
        ) {

          throw new Error(
            'User was created but provisioning identity was not returned.'
          );

        }


        const returnedRole =
          String(
            json?.user?.role
            ||
            newUserRole
          );


        if (
          returnedRole ===
            'owner'
          ||
          returnedRole ===
            'admin'
          ||
          returnedRole ===
            'analyst'
          ||
          returnedRole ===
            'viewer'
        ) {

          effectiveRole =
            returnedRole;

        }


        setProvisioningMembershipId(
          membershipId
        );


        setProvisioningUserId(
          userId
        );


        setNewUserRole(
          effectiveRole
        );


      }


      // ======================================================
      // 2. MODULE PERMISSIONS
      // ======================================================

      const defaultModulePermissions =
        buildInitialModulePermissions(
          effectiveRole
        );


      const resolvedModulePermissions = {

        ...defaultModulePermissions,

        ...modulePermissions,

      };


      const modulePermissionPayload =
        activeModules.map(
          module => ({

            moduleId:
              module.moduleId,

            permission:
              module.enabled

                ? (
                    resolvedModulePermissions[
                      module.moduleId
                    ]
                    ||
                    defaultModulePermission(
                      module,
                      effectiveRole
                    )
                  )

                : 'disabled',

          })
        );


      const moduleResponse =
        await fetch(
          '/api/workspace/users/modules',
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

                membershipId,

                permissions:
                  modulePermissionPayload,

              }),

          }
        );


      const moduleJson =
        await readApiJson(
          moduleResponse,
          'Module access API'
        );


      if (
        !moduleResponse.ok
        ||
        !moduleJson?.ok
      ) {

        throw new Error(
          friendlyProvisioningError(
            String(
              moduleJson?.error
              ||
              'Unable to configure module access'
            )
          )
        );

      }


      // ======================================================
      // 3. SUBMODULE PERMISSIONS
      // ======================================================

      const activeModuleMap =
        new Map(
          activeModules.map(
            module => [
              module.moduleId,
              module,
            ]
          )
        );


      const applicableSubmodules =
        GROWTHOS_SUBMODULES.filter(
          submodule => {

            const module =
              activeModuleMap.get(
                submodule.moduleId
              );


            return Boolean(
              module
              &&
              module.enabled
              &&
              resolvedModulePermissions[
                submodule.moduleId
              ] !==
                'disabled'
            );

          }
        );


      if (
        applicableSubmodules.length >
          0
      ) {

        const initialSubmodulePermissions =
          buildInitialSubmodulePermissions(
            resolvedModulePermissions
          );


        const resolvedSubmodulePermissions = {

          ...initialSubmodulePermissions,

          ...submodulePermissions,

        };


        const submodulePermissionPayload =
          applicableSubmodules.map(
            submodule => {

              const key =
                `${submodule.moduleId}:${submodule.submoduleId}`;


              let permission =
                resolvedSubmodulePermissions[
                  key
                ]
                ||
                'inherit';


              if (
                resolvedModulePermissions[
                  submodule.moduleId
                ] ===
                  'viewer'
                &&
                permission ===
                  'editor'
              ) {

                permission =
                  'inherit';

              }


              return {

                moduleId:
                  submodule.moduleId,

                submoduleId:
                  submodule.submoduleId,

                permission,

              };

            }
          );


        const submoduleResponse =
          await fetch(
            '/api/workspace/users/submodules',
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

                  membershipId,

                  permissions:
                    submodulePermissionPayload,

                }),

            }
          );


        const submoduleJson =
          await readApiJson(
            submoduleResponse,
            'Submodule access API'
          );


        if (
          !submoduleResponse.ok
          ||
          !submoduleJson?.ok
        ) {

          throw new Error(
            friendlyProvisioningError(
              String(
                submoduleJson?.error
                ||
                'Unable to configure submodule access'
              )
            )
          );

        }

      }

            // ======================================================
      // EDIT MODE COMPLETE
      //
      // Existing active user:
      //
      // module + submodule permissions have now been saved.
      // Do NOT run activation again.
      // ======================================================

      if (
        accessFormMode ===
          'edit'
      ) {

        closeAddUserForm();


        await reload();


        return;

      }


      // ======================================================
      // 4. ACTIVATE
      // ======================================================

      const activationResponse =
        await fetch(
          '/api/workspace/users',
          {

            method:
              'PATCH',

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

                userId,

                action:
                  'activate',

              }),

          }
        );


      const activationJson =
        await readApiJson(
          activationResponse,
          'User activation API'
        );


      if (
        !activationResponse.ok
        ||
        !activationJson?.ok
      ) {

        throw new Error(
          friendlyProvisioningError(
            String(
              activationJson?.error
              ||
              'Unable to activate user'
            )
          )
        );

      }


      // ======================================================
      // 5. INVITE NEW / RESUMED USER
      //
      // Existing users who already have a password are simply
      // left on their current credentials. New users receive a
      // one-time set-password invitation.
      // ======================================================

      let inviteWarning =
        '';


      if (
        accessFormMode ===
          'add'
        ||
        accessFormMode ===
          'resume'
      ) {

        try {

          const inviteResponse =
            await fetch(
              '/api/auth/invite',
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
                    userId,
                  }),

              }
            );


          const inviteJson =
            await readApiJson(
              inviteResponse,
              'Invite API'
            );


          if (
            !inviteResponse.ok
            ||
            !inviteJson?.ok
          ) {

            inviteWarning =
              'User access was activated, but the invitation email could not be sent. You can retry the invite after email delivery is configured.';

          }

        } catch {

          inviteWarning =
            'User access was activated, but the invitation email could not be sent.';

        }

      }


      // ======================================================
      // COMPLETE
      // ======================================================

      closeAddUserForm();


      await reload();


      if (inviteWarning) {

        setUserActionError(
          inviteWarning
        );

      }


    } catch (
      createError:
        any
    ) {

      // Expected validation / provisioning failures are shown
      // inline rather than promoted to a Next.js error overlay.
      console.warn(
        'GROWTH_OS_WORKSPACE_USER_PROVISIONING',
        createError
      );


      setUserCreateError(
        String(
          createError?.message
          ||
          'Unable to configure user access'
        )
      );

    } finally {

      setUserSaving(
        false
      );

    }

  }


  // ==========================================================
  // USER ACTION ERROR MESSAGES
  // ==========================================================

  function getUserActionErrorMessage(
    apiError:
      string
  ) {

    const friendlyErrors:
      Record<
        string,
        string
      > = {

      VALID_ROLE_REQUIRED:
        'Select a valid user role.',

      VALID_USER_ACTION_REQUIRED:
        'Select a valid user action.',

      USER_ID_REQUIRED:
        'The selected user could not be resolved.',

      WORKSPACE_USER_NOT_FOUND:
        'This user no longer has access to the current brand.',

      USER_MANAGEMENT_ACCESS_REQUIRED:
        'Only an active Owner or Admin can manage users.',

      OWNER_ROLE_REQUIRED:
        'Only an Owner can modify or grant Owner access.',

      LAST_OWNER_REQUIRED:
        'The final active Owner cannot be demoted, suspended or removed.',

      CANNOT_MODIFY_SELF:
        'You cannot change or suspend your own access.',

      CANNOT_DELETE_SELF:
        'You cannot remove your own access.',

      USER_LIMIT_REACHED:
        'Your current plan user limit has been reached.',

      SUBSCRIPTION_REQUIRED:
        'An active Growth OS subscription is required.',

      ACTIVE_BRAND_REQUIRED:
        'An active Growth OS brand is required.',

      UNAUTHENTICATED:
        'Your session has expired. Please sign in again.',

      INVALID_REQUEST_BODY:
        'The user action could not be processed.',

    };


    return (
      friendlyErrors[
        apiError
      ]
      ||
      apiError
      ||
      'Unable to update user access.'
    );

  }


  // ==========================================================
  // PATCH USER ACCESS
  // ==========================================================

  async function patchWorkspaceUserAccess(

    userId:
      string,

    payload:
      Record<
        string,
        unknown
      >

  ) {

    if (
      userActionSavingId
    ) {

      return false;

    }


    try {

      setUserActionSavingId(
        userId
      );


      setUserActionError(
        ''
      );


      const response =
        await fetch(
          '/api/workspace/users',
          {

            method:
              'PATCH',

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

                userId,

                ...payload,

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

        throw new Error(
          getUserActionErrorMessage(
            String(
              json?.error
              ||
              'Unable to update user access'
            )
          )
        );

      }


      setActionMenu(
        null
      );


      reload();


      return true;


    } catch (
      actionError:
        any
    ) {

      console.error(
        'GROWTH_OS_WORKSPACE_USER_ACTION_ERROR',
        actionError
      );


      setUserActionError(
        String(
          actionError?.message
          ||
          'Unable to update user access'
        )
      );


      return false;


    } finally {

      setUserActionSavingId(
        null
      );

    }

  }


  // ==========================================================
  // SAVE ROLE
  // ==========================================================

  

  // ==========================================================
  // SUSPEND / REACTIVATE
  // ==========================================================

  async function suspendWorkspaceUser(

    userId:
      string,

    email:
      string |
      null

  ) {

    const confirmed =
      window.confirm(
        `Suspend access for ${email || 'this user'} on the current brand?`
      );


    if (!confirmed) {

      return;

    }


    await patchWorkspaceUserAccess(
      userId,
      {
        action:
          'suspend',
      }
    );

  }


    // ==========================================================
  // RESUME INCOMPLETE USER PROVISIONING
  // ==========================================================

  function resumeWorkspaceUserSetup(
    user:
      NonNullable<
        WorkspaceUsersResponse['users']
      >[number]
  ) {

    const normalizedRole:
      WorkspaceUserRole =
        (
          user.role ===
            'owner'
          ||
          user.role ===
            'admin'
          ||
          user.role ===
            'analyst'
          ||
          user.role ===
            'viewer'
        )

          ? user.role

          : 'viewer';


    const nextModulePermissions =
      buildInitialModulePermissions(
        normalizedRole
      );


    setUserActionError(
      ''
    );


    setUserCreateError(
      ''
    );


    setNewUserName(
      user.fullName
      ||
      ''
    );


    setNewUserEmail(
      user.email
      ||
      ''
    );


    setNewUserRole(
      normalizedRole
    );


    setProvisioningMembershipId(
      user.membershipId
    );


    setProvisioningUserId(
      user.userId
    );


    setModulePermissions(
      nextModulePermissions
    );


    setSubmodulePermissions(
      buildInitialSubmodulePermissions(
        nextModulePermissions
      )
    );

    setAccessFormMode(
      'resume'
    );


    setShowAddUser(
      true
    );


    setActionMenu(
      null
    );

  }


  // ==========================================================
  // ACTIVATE / RESUME USER ACCESS
  //
  // Suspended users with complete permissions reactivate
  // immediately.
  //
  // Incomplete users reopen the one-screen access form.
  // ==========================================================

  async function activateWorkspaceUser(
    user:
      NonNullable<
        WorkspaceUsersResponse['users']
      >[number]
  ) {

    if (
      userActionSavingId
    ) {

      return;

    }


    try {

      setUserActionSavingId(
        user.userId
      );


      setUserActionError(
        ''
      );


      const response =
        await fetch(
          '/api/workspace/users',
          {

            method:
              'PATCH',

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

                userId:
                  user.userId,

                action:
                  'activate',

              }),

          }
        );


      const json =
        await readApiJson(
          response,
          'User activation API'
        );


      if (
        !response.ok
        ||
        !json?.ok
      ) {

        const apiError =
          String(
            json?.error
            ||
            'Unable to activate user access'
          );


        if (
          apiError ===
            'USER_MODULE_ACCESS_REQUIRED'
          ||
          apiError ===
            'USER_SUBMODULE_ACCESS_REQUIRED'
        ) {

          resumeWorkspaceUserSetup(
            user
          );


          return;

        }


        throw new Error(
          getUserActionErrorMessage(
            apiError
          )
        );

      }


      await reload();


    } catch (
      actionError:
        any
    ) {

      console.warn(
        'GROWTH_OS_WORKSPACE_USER_ACTIVATE',
        actionError
      );


      setUserActionError(
        String(
          actionError?.message
          ||
          'Unable to activate user access'
        )
      );

    } finally {

      setUserActionSavingId(
        null
      );

    }

  }


  // ==========================================================
  // DELETE BRAND ACCESS
  // ==========================================================

  async function deleteWorkspaceUserAccess(

    userId:
      string,

    email:
      string |
      null

  ) {

    if (
      userActionSavingId
    ) {

      return;

    }


    const confirmed =
      window.confirm(
        `Remove ${email || 'this user'} from the current brand?\n\nThis removes only their access to this brand. Their global Growth OS user account will remain.`
      );


    if (!confirmed) {

      return;

    }


    try {

      setUserActionSavingId(
        userId
      );


      setUserActionError(
        ''
      );


      const response =
        await fetch(
          '/api/workspace/users',
          {

            method:
              'DELETE',

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
                userId,
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

        throw new Error(
          getUserActionErrorMessage(
            String(
              json?.error
              ||
              'Unable to remove user access'
            )
          )
        );

      }


      setActionMenu(
        null
      );


      reload();


    } catch (
      deleteError:
        any
    ) {

      console.error(
        'GROWTH_OS_WORKSPACE_USER_DELETE_ERROR',
        deleteError
      );


      setUserActionError(
        String(
          deleteError?.message
          ||
          'Unable to remove user access'
        )
      );


    } finally {

      setUserActionSavingId(
        null
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


  const actionMenuUser =
    actionMenu

      ? (
          users.find(
            user =>
              user.userId ===
                actionMenu.userId
          )
          ||
          null
        )

      : null;

  
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

        description="Manage the people, roles and module access for this workspace."

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
            ? 'Invite team members and manage who can access this workspace.'
            : 'Only an Owner or Admin can add users to this workspace.'}
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

              if (
                showAddUser
              ) {

                closeAddUserForm();

              } else {

                openAddUserForm();

              }

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
          ADD USER — ONE-SCREEN PROVISIONING
      ===================================================== */}

      {showAddUser &&
        canManageUsers && (

        <section
          className="
            gos-panel
            !p-3.5
          "
        >

          <div
            className="
              flex
              flex-col
              gap-3

              lg:flex-row
              lg:items-start
              lg:justify-between
            "
          >

            <div>

              <h3 className="gos-section-title">
                {accessFormMode ===
                  'edit'

                  ? 'Edit User Access'

                  : accessFormMode ===
                      'resume'

                    ? 'Resume User Setup'

                    : 'Add User'}
              </h3>


              <p
                className="
                  mt-1
                  max-w-3xl

                  text-[9px]
                  leading-4

                  text-slate-500
                "
              >
                Add the person you want to invite, choose their role, and select the modules they should be able to access.
              </p>

            </div>


            {accessFormMode ===
              'resume'
              &&provisioningMembershipId && (

              <span
                className="
                  shrink-0

                  rounded-full

                  border
                  border-amber-200

                  bg-amber-50

                  px-2.5
                  py-1

                  text-[8px]
                  font-semibold

                  text-amber-700
                "
              >
                Incomplete setup
              </span>

            )}

          </div>


          {/* ===============================================
              USER DETAILS
          =============================================== */}

          <div
            className="
              mt-4

              rounded-[10px]

              border
              border-slate-200

              bg-slate-50

              p-3
            "
          >

            <div>

              <p className="text-[10px] font-semibold text-slate-900">
                User Details
              </p>

              <p className="mt-0.5 text-[8px] leading-4 text-slate-500">
                Enter the user details and choose their workspace role.
              </p>

            </div>


            <div
              className="
                mt-3

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

                  disabled={
                    userSaving
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

                  disabled={
                    userSaving
                    ||
                    Boolean(
                      provisioningMembershipId
                    )
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


              <div className="rounded-[8px] border border-violet-100 bg-violet-50 px-3 py-2 text-[9px] leading-5 text-violet-700">
                New users receive a secure email invitation and set their own password.
              </div>


              {/* ROLE */}

              <FormField label="Role">

                <select

                  value={
                    newUserRole
                  }

                  disabled={
                    userSaving
                    ||
                    Boolean(
                      provisioningMembershipId
                    )
                  }

                  onChange={
                    event =>
                      handleNewUserRoleChange(
                        event.target.value as
                          WorkspaceUserRole
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

          </div>


          {/* ===============================================
              MODULE ACCESS
          =============================================== */}

          <div
            className="
              mt-3

              rounded-[10px]

              border
              border-slate-200

              bg-white

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

                <p className="text-[10px] font-semibold text-slate-900">
                  Module Access
                </p>

                <p className="mt-0.5 text-[8px] leading-4 text-slate-500">
                  Choose the maximum access this user receives inside each Growth OS module.
                </p>

              </div>


              <span
                className="
                  shrink-0

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
                {activeModules.length} modules
              </span>

            </div>


            {activeModules.length ===
              0 ? (

              <div
                className="
                  mt-3

                  rounded-lg

                  border
                  border-amber-200

                  bg-amber-50

                  px-3
                  py-2.5
                "
              >
                <p className="text-[9px] font-semibold text-amber-800">
                  No active modules are available for this brand.
                </p>
              </div>

            ) : (

              <div
                className="
                  mt-3

                  grid
                  grid-cols-1
                  gap-2

                  lg:grid-cols-2
                "
              >

                {activeModules.map(
                  module => {

                    const permission =
                      modulePermissions[
                        module.moduleId
                      ]
                      ||
                      defaultModulePermission(
                        module,
                        newUserRole
                      );


                    return (

                      <div
                        key={
                          module.moduleId
                        }
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3

                          rounded-[9px]

                          border
                          border-slate-200

                          bg-slate-50

                          px-3
                          py-2.5
                        "
                      >

                        <div className="min-w-0">

                          <div className="flex items-center gap-2">

                            <p
                              className="
                                truncate

                                text-[9px]
                                font-semibold

                                text-slate-800
                              "
                            >
                              {module.name ||
                                module.moduleId}
                            </p>


                            <ModuleBadge
                              available={
                                module.enabled
                              }
                            />

                          </div>


                          {module.description && (

                            <p
                              className="
                                mt-1
                                max-w-[420px]

                                text-[8px]
                                leading-4

                                text-slate-500
                              "
                            >
                              {module.description}
                            </p>

                          )}

                        </div>


                        <select

                          value={
                            permission
                          }

                          disabled={
                            userSaving
                            ||
                            !module.enabled
                          }

                          onChange={
                            event =>
                              updateModulePermission(
                                module.moduleId,
                                event.target.value as
                                  UserAccessPermission
                              )
                          }

                          className="
                            h-8
                            min-w-[104px]
                            shrink-0

                            rounded-[7px]

                            border
                            border-slate-200

                            bg-white

                            px-2

                            text-[8px]
                            font-semibold

                            text-slate-700

                            outline-none

                            disabled:bg-slate-100
                            disabled:text-slate-400
                          "
                        >

                          <option value="viewer">
                            Viewer
                          </option>

                          <option value="editor">
                            Editor
                          </option>

                          <option value="disabled">
                            Disabled
                          </option>

                        </select>

                      </div>

                    );

                  }
                )}

              </div>

            )}

          </div>


          {/* ===============================================
              SUBMODULE ACCESS
          =============================================== */}

          <div
            className="
              mt-3

              rounded-[10px]

              border
              border-slate-200

              bg-white

              p-3
            "
          >

            <div>

              <p className="text-[10px] font-semibold text-slate-900">
                Submodule Access
              </p>

              <p className="mt-0.5 text-[8px] leading-4 text-slate-500">
                Fine-tune individual screens. Inherit uses the permission selected for the parent module.
              </p>

            </div>


            <div className="mt-3 space-y-3">

              {activeModules.map(
                module => {

                  const parentPermission =
                    modulePermissions[
                      module.moduleId
                    ]
                    ||
                    defaultModulePermission(
                      module,
                      newUserRole
                    );


                  const submodules =
                    GROWTHOS_SUBMODULES.filter(
                      submodule =>
                        submodule.moduleId ===
                          module.moduleId
                    );


                  if (
                    !module.enabled
                    ||
                    parentPermission ===
                      'disabled'
                    ||
                    submodules.length ===
                      0
                  ) {

                    return null;

                  }


                  return (

                    <div

                      key={
                        module.moduleId
                      }

                      className="
                        overflow-hidden

                        rounded-[9px]

                        border
                        border-slate-200
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

                          bg-slate-50

                          px-3
                          py-2
                        "
                      >

                        <div>

                          <p className="text-[9px] font-semibold text-slate-800">
                            {module.name ||
                              module.moduleId}
                          </p>

                          <p className="mt-0.5 text-[8px] text-slate-500">
                            Parent access: {formatRole(
                              parentPermission
                            )}
                          </p>

                        </div>


                        <span className="text-[8px] font-medium text-slate-400">
                          {submodules.length} screens
                        </span>

                      </div>


                      <div
                        className="
                          grid
                          grid-cols-1
                          gap-px

                          bg-slate-200

                          md:grid-cols-2
                        "
                      >

                        {submodules.map(
                          submodule => {

                            const key =
                              `${submodule.moduleId}:${submodule.submoduleId}`;


                            const value =
                              submodulePermissions[
                                key
                              ]
                              ||
                              'inherit';


                            return (

                              <div

                                key={
                                  key
                                }

                                className="
                                  flex
                                  min-h-[42px]
                                  items-center
                                  justify-between
                                  gap-3

                                  bg-white

                                  px-3
                                  py-2
                                "
                              >

                                <span className="text-[8px] font-medium text-slate-600">
                                  {submodule.label}
                                </span>


                                <select

                                  value={
                                    parentPermission ===
                                      'viewer'
                                    &&
                                    value ===
                                      'editor'

                                      ? 'inherit'

                                      : value
                                  }

                                  disabled={
                                    userSaving
                                  }

                                  onChange={
                                    event =>
                                      setSubmodulePermissions(
                                        previous => ({
                                          ...previous,
                                          [key]:
                                            event.target.value as
                                              UserAccessPermission,
                                        })
                                      )
                                  }

                                  className="
                                    h-7
                                    min-w-[92px]

                                    rounded-[7px]

                                    border
                                    border-slate-200

                                    bg-white

                                    px-1.5

                                    text-[8px]
                                    font-semibold

                                    text-slate-700

                                    outline-none
                                  "
                                >

                                  <option value="inherit">
                                    Inherit
                                  </option>

                                  <option value="viewer">
                                    Viewer
                                  </option>

                                  {parentPermission !==
                                    'viewer' && (

                                    <option value="editor">
                                      Editor
                                    </option>

                                  )}

                                  <option value="disabled">
                                    Disabled
                                  </option>

                                </select>

                              </div>

                            );

                          }
                        )}

                      </div>

                    </div>

                  );

                }
              )}


              {activeModules.every(
                module => {

                  const parentPermission =
                    modulePermissions[
                      module.moduleId
                    ]
                    ||
                    defaultModulePermission(
                      module,
                      newUserRole
                    );


                  return (
                    !module.enabled
                    ||
                    parentPermission ===
                      'disabled'
                    ||
                    GROWTHOS_SUBMODULES.every(
                      submodule =>
                        submodule.moduleId !==
                          module.moduleId
                    )
                  );

                }
              ) && (

                <div
                  className="
                    rounded-lg

                    border
                    border-slate-200

                    bg-slate-50

                    px-3
                    py-3

                    text-center
                  "
                >
                  <p className="text-[8px] text-slate-500">
                    No submodules require configuration for the selected module access.
                  </p>
                </div>

              )}

            </div>

          </div>


          {/* ===============================================
              ERROR
          =============================================== */}

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


          {/* ===============================================
              ACTIONS
          =============================================== */}

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
                closeAddUserForm
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
                ||
                activeModules.length ===
                  0
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

                ? (
                    accessFormMode ===
                      'edit'

                      ? 'Saving Access...'

                      : 'Saving & Activating...'
                  )

                : accessFormMode ===
                    'edit'

                  ? 'Save Access'

                  : accessFormMode ===
                      'resume'

                  ? 'Save Access & Activate'

                  : 'Add & Activate User'}

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
              People who currently have access to this workspace.
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

                  <TableHeader>
                    Actions
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


                    const isCurrentUser =
                      Boolean(
                        currentUserId
                        &&
                        user.userId ===
                          currentUserId
                      );


                    const isOwner =
                      user.role ===
                        'owner';


                    const canManageThisUser =
                      canManageUsers
                      &&
                      !isCurrentUser
                      &&
                      !(
                        currentRole ===
                          'admin'
                        &&
                        isOwner
                      );


                    const actionSaving =
                      userActionSavingId ===
                        user.userId;


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


                        {/* ACTIONS */}

                        <td className="px-3 py-2.5 text-right">

                          <button

                            type="button"

                            disabled={
                              !canManageThisUser
                              ||
                              actionSaving
                            }

                            title={
                              isCurrentUser

                                ? 'You cannot modify your own access'

                                : currentRole ===
                                    'admin'
                                  &&
                                  isOwner

                                  ? 'Admins cannot modify an Owner'

                                  : !canManageUsers

                                    ? 'Owner or Admin access is required'

                                    : 'User actions'
                            }

                            onClick={
                              event => {

                                if (
                                  !canManageThisUser
                                ) {

                                  return;

                                }


                                const rect =
                                  event
                                    .currentTarget
                                    .getBoundingClientRect();


                                const menuWidth =
                                  184;


                                const left =
                                  Math.min(
                                    Math.max(
                                      8,
                                      rect.right
                                      -
                                      menuWidth
                                    ),
                                    Math.max(
                                      8,
                                      window.innerWidth
                                      -
                                      menuWidth
                                      -
                                      8
                                    )
                                  );


                                setUserActionError(
                                  ''
                                );


                                setActionMenu({

                                  userId:
                                    user.userId,

                                  top:
                                    rect.bottom
                                    +
                                    6,

                                  left,

                                });

                              }
                            }

                            className="
                              inline-flex
                              h-7
                              w-7
                              items-center
                              justify-center

                              rounded-[7px]

                              border
                              border-slate-200

                              bg-white

                              text-slate-500

                              transition

                              hover:bg-slate-100
                              hover:text-slate-900

                              disabled:cursor-not-allowed
                              disabled:opacity-30
                            "
                          >

                            <EllipsisVertical
                              size={14}
                            />

                          </button>

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


      {/* =====================================================
          USER ACTION ERROR
      ===================================================== */}

      {userActionError && (

        <div
          className="
            rounded-[9px]

            border
            border-red-200

            bg-red-50

            px-3
            py-2.5
          "
        >

          <p className="text-[9px] font-semibold text-red-700">
            {userActionError}
          </p>

        </div>

      )}


      {/* =====================================================
          FLOATING DOTTED ACTION MENU
      ===================================================== */}

      {actionMenu &&
        actionMenuUser && (

        <>

          <button
            type="button"
            aria-label="Close user actions"
            onClick={() =>
              setActionMenu(
                null
              )
            }
            className="
              fixed
              inset-0
              z-40

              cursor-default

              bg-transparent
            "
          />


          <div

            style={{
              top:
                actionMenu.top,

              left:
                actionMenu.left,
            }}

            className="
              fixed
              z-50

              w-[184px]

              overflow-hidden

              rounded-[10px]

              border
              border-slate-200

              bg-white

              p-1

              shadow-xl
            "
          >

            <button

              type="button"

              onClick={() => {

                const targetUser =
                  actionMenuUser;


                setActionMenu(
                  null
                );


                openEditUserAccess(
                  targetUser
                );

              }}

              className="
                flex
                w-full
                items-center

                rounded-[7px]

                px-3
                py-2

                text-left
                text-[9px]
                font-semibold

                text-slate-700

                transition

                hover:bg-slate-100
              "
            >
              Edit Access
            </button>


            {actionMenuUser.membershipStatus ===
              'active' ? (

              <button

                type="button"

                onClick={() => {

                  setActionMenu(
                    null
                  );


                  suspendWorkspaceUser(
                    actionMenuUser.userId,
                    actionMenuUser.email
                  );

                }}

                className="
                  flex
                  w-full
                  items-center

                  rounded-[7px]

                  px-3
                  py-2

                  text-left
                  text-[9px]
                  font-semibold

                  text-amber-700

                  transition

                  hover:bg-amber-50
                "
              >
                Suspend Access
              </button>

            ) : (

              <button

                type="button"

                onClick={() => {

                  const targetUser =
                    actionMenuUser;

                  setActionMenu(
                    null
                  );


                  activateWorkspaceUser(
                     targetUser
                  );

                }}

                className="
                  flex
                  w-full
                  items-center

                  rounded-[7px]

                  px-3
                  py-2

                  text-left
                  text-[9px]
                  font-semibold

                  text-emerald-700

                  transition

                  hover:bg-emerald-50
                "
              >
                {userActionSavingId ===
                  actionMenuUser.userId

                  ? 'Working...'

                  : 'Reactivate / Resume Setup'}
              </button>

            )}


            <div className="my-1 border-t border-slate-100" />


            <button

              type="button"

              onClick={() => {

                setActionMenu(
                  null
                );


                deleteWorkspaceUserAccess(
                  actionMenuUser.userId,
                  actionMenuUser.email
                );

              }}

              className="
                flex
                w-full
                items-center

                rounded-[7px]

                px-3
                py-2

                text-left
                text-[9px]
                font-semibold

                text-red-700

                transition

                hover:bg-red-50
              "
            >
              Delete Access
            </button>

          </div>

        </>

      )}

      

    </div>

  );

}


// ============================================================
// SECURITY
// ============================================================

type SecuritySession = {

  sessionId:
    string;

  workspaceId:
    string;

  brandId:
    string;

  createdAt:
    string | null;

  lastSeenAt:
    string | null;

  expiresAt:
    string | null;

  ipAddress:
    string | null;

  userAgent:
    string | null;

  current:
    boolean;

};


function SecuritySettings({

  authContext,

}: {

  authContext:
    AuthMeResponse |
    null;

}) {

  const [
    currentPassword,
    setCurrentPassword,
  ] =
    useState('');


  const [
    newPassword,
    setNewPassword,
  ] =
    useState('');


  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('');


  const [
    passwordSaving,
    setPasswordSaving,
  ] =
    useState(false);


  const [
    passwordMessage,
    setPasswordMessage,
  ] =
    useState('');


  const [
    passwordError,
    setPasswordError,
  ] =
    useState('');


  const [
    sessions,
    setSessions,
  ] =
    useState<SecuritySession[]>([]);


  const [
    sessionsLoading,
    setSessionsLoading,
  ] =
    useState(true);


  const [
    sessionsError,
    setSessionsError,
  ] =
    useState('');


  const [
    sessionSavingId,
    setSessionSavingId,
  ] =
    useState<string | null>(
      null
    );


  const [
    logoutAllSaving,
    setLogoutAllSaving,
  ] =
    useState(false);


  const authMethod =
    authContext?.auth?.method
    ||
    null;


  const passwordManaged =
    authMethod ===
      'password';


  async function loadSessions() {

    setSessionsLoading(
      true
    );


    setSessionsError(
      ''
    );


    try {

      const response =
        await fetch(
          '/api/auth/sessions',
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
        !response.ok
        ||
        !json?.ok
      ) {

        throw new Error(
          json?.error
          ||
          'Unable to load sessions'
        );

      }


      setSessions(
        Array.isArray(
          json?.sessions
        )
          ? json.sessions
          : []
      );

    } catch (
      error: any
    ) {

      setSessionsError(
        String(
          error?.message
          ||
          'Unable to load active sessions'
        )
      );

    } finally {

      setSessionsLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      loadSessions();

    },
    []
  );


  async function changePassword() {

    if (
      passwordSaving
    ) {

      return;

    }


    setPasswordError(
      ''
    );


    setPasswordMessage(
      ''
    );


    if (
      !currentPassword
    ) {

      setPasswordError(
        'Enter your current password.'
      );


      return;

    }


    if (
      newPassword.length <
        10
    ) {

      setPasswordError(
        'New password must be at least 10 characters.'
      );


      return;

    }


    if (
      newPassword !==
        confirmPassword
    ) {

      setPasswordError(
        'New passwords do not match.'
      );


      return;

    }


    try {

      setPasswordSaving(
        true
      );


      const response =
        await fetch(
          '/api/auth/change-password',
          {
            method:
              'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                currentPassword,
                newPassword,
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok
        ||
        !json?.ok
      ) {

        const friendly:
          Record<string, string> = {

          CURRENT_PASSWORD_INVALID:
            'Current password is incorrect.',

          NEW_PASSWORD_MUST_BE_DIFFERENT:
            'Choose a password different from your current password.',

          PASSWORD_REQUIREMENTS_NOT_MET:
            'New password must be at least 10 characters.',

          PASSWORD_LOGIN_NOT_CONFIGURED:
            'Password login is not configured for this account.',

        };


        throw new Error(
          friendly[
            String(
              json?.error
              ||
              ''
            )
          ]
          ||
          json?.error
          ||
          'Unable to change password'
        );

      }


      setCurrentPassword(
        ''
      );


      setNewPassword(
        ''
      );


      setConfirmPassword(
        ''
      );


      setPasswordMessage(
        'Password updated. Other signed-in devices have been signed out.'
      );


      await loadSessions();

    } catch (
      error: any
    ) {

      setPasswordError(
        String(
          error?.message
          ||
          'Unable to change password'
        )
      );

    } finally {

      setPasswordSaving(
        false
      );

    }

  }


  async function logoutCurrent() {

    try {

      await fetch(
        '/api/auth/logout',
        {
          method:
            'POST',

          credentials:
            'same-origin',
        }
      );

    } finally {

      window.location.assign(
        '/login'
      );

    }

  }


  async function logoutAll() {

    if (
      logoutAllSaving
    ) {

      return;

    }


    const confirmed =
      window.confirm(
        'Sign out every Growth OS session for your account?'
      );


    if (!confirmed) {

      return;

    }


    try {

      setLogoutAllSaving(
        true
      );


      await fetch(
        '/api/auth/logout-all',
        {
          method:
            'POST',

          credentials:
            'same-origin',
        }
      );

    } finally {

      window.location.assign(
        '/login'
      );

    }

  }


  async function revokeSession(
    sessionId:
      string,
    current:
      boolean
  ) {

    if (
      sessionSavingId
    ) {

      return;

    }


    try {

      setSessionSavingId(
        sessionId
      );


      const response =
        await fetch(
          '/api/auth/sessions/revoke',
          {
            method:
              'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                sessionId,
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok
        ||
        !json?.ok
      ) {

        throw new Error(
          json?.error
          ||
          'Unable to revoke session'
        );

      }


      if (
        current
        ||
        json?.currentRevoked
      ) {

        window.location.assign(
          '/login'
        );


        return;

      }


      await loadSessions();

    } catch (
      error: any
    ) {

      setSessionsError(
        String(
          error?.message
          ||
          'Unable to revoke session'
        )
      );

    } finally {

      setSessionSavingId(
        null
      );

    }

  }


  function formatSecurityDate(
    value:
      string | null
  ) {

    if (!value) {

      return '—';

    }


    try {

      return new Intl.DateTimeFormat(
        'en-IN',
        {
          dateStyle:
            'medium',

          timeStyle:
            'short',
        }
      ).format(
        new Date(
          value
        )
      );

    } catch {

      return value;

    }

  }



  function formatSessionDevice(
    userAgent:
      string | null
  ) {

    const ua =
      String(userAgent || '').toLowerCase();

    if (!ua) {
      return 'Unknown device';
    }

    const browser =
      ua.includes('edg/')
        ? 'Edge'
        : ua.includes('chrome/')
          ? 'Chrome'
          : ua.includes('firefox/')
            ? 'Firefox'
            : ua.includes('safari/')
              ? 'Safari'
              : 'Browser';

    const device =
      ua.includes('iphone')
        ? 'iPhone'
        : ua.includes('ipad')
          ? 'iPad'
          : ua.includes('android')
            ? 'Android'
            : ua.includes('windows')
              ? 'Windows'
              : ua.includes('mac os') || ua.includes('macintosh')
                ? 'Mac'
                : ua.includes('linux')
                  ? 'Linux'
                  : 'Device';

    return `${browser} on ${device}`;

  }


  return (

    <div className="space-y-3">

      <section className="gos-panel !p-3">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-violet-50 text-violet-600">
            <ShieldCheck size={16} />
          </div>

          <div>
            <h2 className="text-[14px] font-semibold tracking-[-0.025em] text-slate-950">
              Security
            </h2>
            <p className="mt-0.5 text-[9px] text-slate-500">
              Manage your sign-in, password and devices currently using your account.
            </p>
          </div>

        </div>

      </section>


      {!passwordManaged && (

        <section className="gos-panel !p-3">
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} className="mt-0.5 text-emerald-600" />
            <div>
              <p className="text-[11px] font-semibold text-slate-900">
                Sign-in managed by Shopify
              </p>
              <p className="mt-1 text-[9px] leading-5 text-slate-500">
                You signed in through Shopify. Password changes are managed through Shopify, while this page still shows the Growth OS sessions available to your account.
              </p>
            </div>
          </div>
        </section>

      )}


      {passwordManaged && (

        <section className="gos-panel !p-3">

          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-violet-600" />
            <h3 className="text-[12px] font-semibold text-slate-950">
              Change Password
            </h3>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">

            <FormField label="Current Password">
              <input
                type="password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                className="gos-input w-full"
              />
            </FormField>

            <FormField label="New Password">
              <input
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Minimum 10 characters"
                className="gos-input w-full"
              />
            </FormField>

            <FormField label="Confirm New Password">
              <input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="gos-input w-full"
              />
            </FormField>

          </div>

          {passwordError && (
            <p className="mt-3 text-[9px] font-semibold text-red-700">
              {passwordError}
            </p>
          )}

          {passwordMessage && (
            <p className="mt-3 text-[9px] font-semibold text-emerald-700">
              {passwordMessage}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={passwordSaving}
              onClick={changePassword}
              className="rounded-[8px] bg-slate-950 px-4 py-2 text-[9px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {passwordSaving ? 'Updating...' : 'Change Password'}
            </button>
          </div>

        </section>

      )}


      <section className="gos-panel !p-3">

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MonitorSmartphone size={15} className="text-violet-600" />
            <div>
              <h3 className="text-[12px] font-semibold text-slate-950">
                Active Sessions
              </h3>
              <p className="mt-0.5 text-[9px] text-slate-500">
                Review devices currently signed in to your Growth OS account.
              </p>
            </div>
          </div>

          {passwordManaged && (
            <button
              type="button"
              onClick={loadSessions}
              disabled={sessionsLoading}
              className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Refresh
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <p className="mt-4 text-[9px] text-slate-500">
            Loading active sessions...
          </p>
        ) : sessionsError ? (
          <p className="mt-4 text-[9px] font-semibold text-red-700">
            {sessionsError}
          </p>
        ) : sessions.length === 0 ? (
          <p className="mt-4 text-[9px] text-slate-500">
            {passwordManaged ? 'No active sessions found.' : 'No Growth OS sessions are available to manage here.'}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {sessions.map(session => (
              <div
                key={session.sessionId}
                className="flex flex-col gap-3 rounded-[10px] border border-slate-200 bg-white px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold text-slate-900">
                      {session.current ? 'Current session' : 'Growth OS session'}
                    </p>
                    {session.current && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-semibold text-emerald-700">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[8px] text-slate-500">
                    {formatSessionDevice(session.userAgent)}
                  </p>
                  <p className="mt-1 text-[8px] text-slate-400">
                    Last active {formatSecurityDate(session.lastSeenAt || session.createdAt)}{session.ipAddress ? ` · IP ${session.ipAddress}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={sessionSavingId === session.sessionId}
                  onClick={() => revokeSession(session.sessionId, session.current)}
                  className="shrink-0 rounded-[8px] border border-red-200 bg-white px-3 py-2 text-[9px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  {sessionSavingId === session.sessionId ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            ))}
          </div>
        )}

      </section>


      <section className="gos-panel !p-3">

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-[12px] font-semibold text-slate-950">
              Session Controls
            </h3>
            <p className="mt-1 text-[9px] leading-5 text-slate-500">
              Sign out this browser, or sign out all devices using your Growth OS password account.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={logoutCurrent}
              className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={13} />
              Logout
            </button>

            {passwordManaged && (
              <button
                type="button"
                disabled={logoutAllSaving}
                onClick={logoutAll}
                className="rounded-[8px] bg-red-600 px-3 py-2 text-[9px] font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {logoutAllSaving ? 'Signing out...' : 'Sign Out All Devices'}
              </button>
            )}
          </div>
        </div>

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
                Choose how Growth OS looks and opens for your account.
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
          description="Choose how the interface is displayed for you."
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
          description="Choose the page and date range Growth OS should open with."
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