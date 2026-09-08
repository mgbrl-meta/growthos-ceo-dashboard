'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react';


// ============================================================
// PLAN TYPES
// ============================================================

export type PlanStatus =
  | 'active'
  | 'draft'
  | 'archived';


// ============================================================
// MODULE TYPES
// ============================================================

export type ModuleType =
  | 'standard'
  | 'custom';


export type ModuleStatus =
  | 'active'
  | 'draft'
  | 'suspended';


export type SetupStatus =
  | 'ready'
  | 'setup_required'
  | 'configuring'
  | 'not_started';


export type ModuleCategory =
  | 'workspace'
  | 'growth'
  | 'customers'
  | 'commerce'
  | 'data'
  | 'system'
  | 'custom';


// ============================================================
// CLIENT TYPES
// ============================================================

export type ClientStatus =
  | 'active'
  | 'suspended'
  | 'setup';


export type ModuleOverride =
  | 'default'
  | 'enabled'
  | 'disabled';


// ============================================================
// USER TYPES
// ============================================================

export type UserScope =
  | 'platform'
  | 'client';


export type UserStatus =
  | 'active'
  | 'invited'
  | 'suspended';


export type UserRole =
  | 'platform_admin'
  | 'client_owner'
  | 'client_admin'
  | 'manager'
  | 'analyst'
  | 'operator'
  | 'viewer';


export type UserModulePermission =
  | 'inherit'
  | 'enabled'
  | 'disabled';


// ============================================================
// INTEGRATION TYPES
// ============================================================

export type IntegrationCategory =
  | 'commerce'
  | 'marketing'
  | 'analytics'
  | 'infrastructure'
  | 'custom';


export type IntegrationConnectionStatus =
  | 'connected'
  | 'setup_required'
  | 'configuring'
  | 'error'
  | 'disconnected'
  | 'suspended';


export type IntegrationDataStatus =
  | 'ready'
  | 'syncing'
  | 'stale'
  | 'error'
  | 'not_ready';


// ============================================================
// MODULE MODEL
// ============================================================

export type GrowthModule = {

  id:
    string;

  name:
    string;

  description:
    string;

  type:
    ModuleType;

  category:
    ModuleCategory;

  routeKey:
    string;

  status:
    ModuleStatus;

  setupStatus:
    SetupStatus;

  setupRequired:
    boolean;

  createdAt:
    string;

};


// ============================================================
// PLAN MODEL
// ============================================================

export type AdminPlan = {

  id:
    string;

  name:
    string;

  description:
    string;

  status:
    PlanStatus;

  modules:
    string[];

  // ----------------------------------------------------------
  // null = Unlimited
  // ----------------------------------------------------------

  monthlyOrderLimit:
    number | null;

  // ----------------------------------------------------------
  // null = Unlimited
  // ----------------------------------------------------------

  maxUsers:
    number | null;

  createdAt:
    string;

};


// ============================================================
// CLIENT MODEL
// ============================================================

export type AdminClient = {

  id:
    string;

  name:
    string;

  slug:
    string;

  domain:
    string;

  planId:
    string;

  status:
    ClientStatus;

  // ----------------------------------------------------------
  // LEGACY / TEMP COUNTS
  //
  // These remain for compatibility with existing UI files.
  // Actual counts should come from:
  //
  // getClientUserCount()
  // getClientIntegrationCount()
  // ----------------------------------------------------------

  users:
    number;

  integrations:
    number;

  createdAt:
    string;

  // ----------------------------------------------------------
  // ORDER LIMIT OVERRIDE
  //
  // undefined = use plan
  // null      = unlimited
  // number    = explicit client allowance
  // ----------------------------------------------------------

  monthlyOrderLimitOverride?:
    number | null;

  // ----------------------------------------------------------
  // MODULE OVERRIDES
  //
  // default  = use plan entitlement
  // enabled  = force enable for client
  // disabled = force disable for client
  // ----------------------------------------------------------

  moduleOverrides:
    Record<
      string,
      ModuleOverride
    >;

};


// ============================================================
// USER MODEL
// ============================================================

export type AdminUser = {

  id:
    string;

  name:
    string;

  email:
    string;

  scope:
    UserScope;

  // ----------------------------------------------------------
  // null for platform-level administrators
  // ----------------------------------------------------------

  clientId:
    string | null;

  role:
    UserRole;

  status:
    UserStatus;

  // ----------------------------------------------------------
  // USER MODULE PERMISSION
  //
  // inherit  = use client's final entitlement
  // enabled  = allow IF client has access
  // disabled = deny for this user
  //
  // User cannot elevate beyond client entitlement.
  // ----------------------------------------------------------

  modulePermissions:
    Record<
      string,
      UserModulePermission
    >;

  createdAt:
    string;

};


// ============================================================
// INTEGRATION PROVIDER MODEL
// ============================================================

export type AdminIntegrationProvider = {

  id:
    string;

  name:
    string;

  description:
    string;

  category:
    IntegrationCategory;

};


// ============================================================
// CLIENT INTEGRATION MODEL
// ============================================================

export type AdminClientIntegration = {

  id:
    string;

  clientId:
    string;

  providerId:
    string;

  accountName:
    string;

  externalAccountId:
    string;

  connectionStatus:
    IntegrationConnectionStatus;

  dataStatus:
    IntegrationDataStatus;

  syncEnabled:
    boolean;

  lastSuccessfulSyncAt:
    string | null;

  createdAt:
    string;

};


// ============================================================
// INITIAL MODULES
// ============================================================

const INITIAL_MODULES:
  GrowthModule[] = [

  {
    id:
      'command-center',

    name:
      'Command Center',

    description:
      'Executive business overview and cross-channel intelligence.',

    type:
      'standard',

    category:
      'workspace',

    routeKey:
      'CEO Summary',

    status:
      'active',

    setupStatus:
      'ready',

    setupRequired:
      false,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'meta',

    name:
      'Meta',

    description:
      'Meta performance, campaigns, creatives and recommendations.',

    type:
      'standard',

    category:
      'growth',

    routeKey:
      'Meta OS',

    status:
      'active',

    setupStatus:
      'ready',

    setupRequired:
      true,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'google',

    name:
      'Google',

    description:
      'Google Ads, search intent and product performance intelligence.',

    type:
      'standard',

    category:
      'growth',

    routeKey:
      'Google OS',

    status:
      'active',

    setupStatus:
      'ready',

    setupRequired:
      true,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'attribution',

    name:
      'Attribution',

    description:
      'Customer journey and multi-touch attribution intelligence.',

    type:
      'standard',

    category:
      'growth',

    routeKey:
      'Attribution OS',

    status:
      'active',

    setupStatus:
      'ready',

    setupRequired:
      true,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'retention',

    name:
      'Retention',

    description:
      'Customer retention, opportunities and next best actions.',

    type:
      'standard',

    category:
      'customers',

    routeKey:
      'Retention OS',

    status:
      'active',

    setupStatus:
      'ready',

    setupRequired:
      true,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'product',

    name:
      'Product',

    description:
      'SKU, demand, inventory and product intelligence.',

    type:
      'standard',

    category:
      'commerce',

    routeKey:
      'Product OS',

    status:
      'active',

    setupStatus:
      'ready',

    setupRequired:
      true,

    createdAt:
      '08 Sep 2026',
  },

];


// ============================================================
// INITIAL PLANS
// ============================================================

const INITIAL_PLANS:
  AdminPlan[] = [

  {
    id:
      'starter',

    name:
      'Starter',

    description:
      'Accessible Growth OS for smaller and emerging businesses.',

    status:
      'active',

    modules: [
      'command-center',
      'meta',
    ],

    monthlyOrderLimit:
      2500,

    maxUsers:
      3,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'pro',

    name:
      'Pro',

    description:
      'Growth intelligence for scaling commerce businesses.',

    status:
      'active',

    modules: [
      'command-center',
      'meta',
      'google',
      'product',
    ],

    monthlyOrderLimit:
      10000,

    maxUsers:
      8,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'advanced',

    name:
      'Advanced',

    description:
      'Full intelligence stack including attribution and retention.',

    status:
      'active',

    modules: [
      'command-center',
      'meta',
      'google',
      'attribution',
      'retention',
      'product',
    ],

    monthlyOrderLimit:
      50000,

    maxUsers:
      20,

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'enterprise',

    name:
      'Enterprise',

    description:
      'Full Growth OS for high-volume and enterprise businesses.',

    status:
      'active',

    modules: [
      'command-center',
      'meta',
      'google',
      'attribution',
      'retention',
      'product',
    ],

    monthlyOrderLimit:
      null,

    maxUsers:
      null,

    createdAt:
      '08 Sep 2026',
  },

];


// ============================================================
// INITIAL CLIENTS
// ============================================================

const INITIAL_CLIENTS:
  AdminClient[] = [

  {
    id:
      'brillare',

    name:
      'Brillare',

    slug:
      'brillare',

    domain:
      'brillare.co.in',

    planId:
      'advanced',

    status:
      'active',

    users:
      4,

    integrations:
      3,

    createdAt:
      '08 Sep 2026',

    moduleOverrides:
      {},

  },


  {
    id:
      'root-deep',

    name:
      'The Root Deep',

    slug:
      'the-root-deep',

    domain:
      'the-root-deep.myshopify.com',

    planId:
      'pro',

    status:
      'setup',

    users:
      2,

    integrations:
      1,

    createdAt:
      '04 Sep 2026',

    moduleOverrides:
      {},

  },

];


// ============================================================
// INITIAL USERS
// ============================================================

const INITIAL_USERS:
  AdminUser[] = [

  // ==========================================================
  // PLATFORM ADMIN
  // ==========================================================

  {
    id:
      'platform-admin',

    name:
      'Platform Admin',

    email:
      'admin@growthos.local',

    scope:
      'platform',

    clientId:
      null,

    role:
      'platform_admin',

    status:
      'active',

    modulePermissions:
      {},

    createdAt:
      '08 Sep 2026',
  },


  // ==========================================================
  // BRILLARE
  // ==========================================================

  {
    id:
      'brillare-owner',

    name:
      'Workspace Owner',

    email:
      'owner@brillare.co.in',

    scope:
      'client',

    clientId:
      'brillare',

    role:
      'client_owner',

    status:
      'active',

    modulePermissions:
      {},

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'brillare-performance',

    name:
      'Performance Manager',

    email:
      'performance@brillare.co.in',

    scope:
      'client',

    clientId:
      'brillare',

    role:
      'manager',

    status:
      'active',

    modulePermissions: {

      retention:
        'disabled',

    },

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'brillare-analyst',

    name:
      'Business Analyst',

    email:
      'analyst@brillare.co.in',

    scope:
      'client',

    clientId:
      'brillare',

    role:
      'analyst',

    status:
      'active',

    modulePermissions:
      {},

    createdAt:
      '08 Sep 2026',
  },


  // ==========================================================
  // ROOT DEEP
  // ==========================================================

  {
    id:
      'root-deep-admin',

    name:
      'Workspace Admin',

    email:
      'admin@therootdeep.com',

    scope:
      'client',

    clientId:
      'root-deep',

    role:
      'client_admin',

    status:
      'active',

    modulePermissions:
      {},

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'root-deep-viewer',

    name:
      'Viewer',

    email:
      'viewer@therootdeep.com',

    scope:
      'client',

    clientId:
      'root-deep',

    role:
      'viewer',

    status:
      'invited',

    modulePermissions: {

      product:
        'disabled',

    },

    createdAt:
      '08 Sep 2026',
  },

];


// ============================================================
// INTEGRATION PROVIDERS
//
// This is the platform-level provider registry.
// Later it can move to persistent configuration.
// ============================================================

const INTEGRATION_PROVIDERS:
  AdminIntegrationProvider[] = [

  {
    id:
      'shopify',

    name:
      'Shopify',

    description:
      'Commerce, customers, orders, products and storefront journey data.',

    category:
      'commerce',
  },


  {
    id:
      'meta',

    name:
      'Meta Ads',

    description:
      'Meta campaign, ad set, creative and conversion performance.',

    category:
      'marketing',
  },


  {
    id:
      'google_ads',

    name:
      'Google Ads',

    description:
      'Google campaign, keyword, search-term and shopping performance.',

    category:
      'marketing',
  },

];


// ============================================================
// INITIAL CLIENT INTEGRATIONS
// ============================================================

const INITIAL_INTEGRATIONS:
  AdminClientIntegration[] = [

  // ==========================================================
  // BRILLARE
  // ==========================================================

  {
    id:
      'brillare-shopify',

    clientId:
      'brillare',

    providerId:
      'shopify',

    accountName:
      'Brillare Store',

    externalAccountId:
      'brillare.co.in',

    connectionStatus:
      'connected',

    dataStatus:
      'ready',

    syncEnabled:
      true,

    lastSuccessfulSyncAt:
      '08 Sep 2026 12:00',

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'brillare-meta',

    clientId:
      'brillare',

    providerId:
      'meta',

    accountName:
      'Brillare Meta Ads',

    externalAccountId:
      'Connected Meta account',

    connectionStatus:
      'connected',

    dataStatus:
      'ready',

    syncEnabled:
      true,

    lastSuccessfulSyncAt:
      '08 Sep 2026 12:00',

    createdAt:
      '08 Sep 2026',
  },


  {
    id:
      'brillare-google',

    clientId:
      'brillare',

    providerId:
      'google_ads',

    accountName:
      'Brillare Google Ads',

    externalAccountId:
      'Connected Google Ads account',

    connectionStatus:
      'connected',

    dataStatus:
      'ready',

    syncEnabled:
      true,

    lastSuccessfulSyncAt:
      '08 Sep 2026 12:00',

    createdAt:
      '08 Sep 2026',
  },


  // ==========================================================
  // ROOT DEEP
  // ==========================================================

  {
    id:
      'root-deep-shopify',

    clientId:
      'root-deep',

    providerId:
      'shopify',

    accountName:
      'The Root Deep Store',

    externalAccountId:
      'the-root-deep.myshopify.com',

    connectionStatus:
      'connected',

    dataStatus:
      'ready',

    syncEnabled:
      true,

    lastSuccessfulSyncAt:
      '08 Sep 2026 12:00',

    createdAt:
      '04 Sep 2026',
  },

];


// ============================================================
// STORE VALUE
// ============================================================

type AdminStoreValue = {

  // ==========================================================
  // DATA
  // ==========================================================

  clients:
    AdminClient[];

  plans:
    AdminPlan[];

  modules:
    GrowthModule[];

  users:
    AdminUser[];

  integrationProviders:
    AdminIntegrationProvider[];

  integrations:
    AdminClientIntegration[];


  // ==========================================================
  // MUTATIONS
  // ==========================================================

  setClients:
    Dispatch<
      SetStateAction<
        AdminClient[]
      >
    >;

  setPlans:
    Dispatch<
      SetStateAction<
        AdminPlan[]
      >
    >;

  setModules:
    Dispatch<
      SetStateAction<
        GrowthModule[]
      >
    >;

  setUsers:
    Dispatch<
      SetStateAction<
        AdminUser[]
      >
    >;

  setIntegrations:
    Dispatch<
      SetStateAction<
        AdminClientIntegration[]
      >
    >;


  // ==========================================================
  // LOOKUPS
  // ==========================================================

  getPlan:
    (
      planId:
        string
    ) =>
      AdminPlan |
      undefined;

  getModule:
    (
      moduleId:
        string
    ) =>
      GrowthModule |
      undefined;

  getClient:
    (
      clientId:
        string
    ) =>
      AdminClient |
      undefined;

  getUser:
    (
      userId:
        string
    ) =>
      AdminUser |
      undefined;

  getIntegrationProvider:
    (
      providerId:
        string
    ) =>
      AdminIntegrationProvider |
      undefined;


  // ==========================================================
  // CLIENT ACCESS
  // ==========================================================

  getClientModuleAccess:
    (
      client:
        AdminClient,
      moduleId:
        string
    ) => {

      planIncluded:
        boolean;

      override:
        ModuleOverride;

      enabled:
        boolean;

    };

  getClientOrderLimit:
    (
      client:
        AdminClient
    ) =>
      number |
      null;


  // ==========================================================
  // USERS
  // ==========================================================

  getClientUsers:
    (
      clientId:
        string
    ) =>
      AdminUser[];

  getClientUserCount:
    (
      clientId:
        string
    ) =>
      number;

  getUserModuleAccess:
    (
      user:
        AdminUser,
      moduleId:
        string
    ) => {

      clientEnabled:
        boolean;

      permission:
        UserModulePermission;

      enabled:
        boolean;

    };


  // ==========================================================
  // INTEGRATIONS
  // ==========================================================

  getClientIntegrations:
    (
      clientId:
        string
    ) =>
      AdminClientIntegration[];

  getClientIntegrationCount:
    (
      clientId:
        string
    ) =>
      number;

};


// ============================================================
// CONTEXT
// ============================================================

const AdminStoreContext =
  createContext<
    AdminStoreValue |
    null
  >(
    null
  );


// ============================================================
// PROVIDER
// ============================================================

export function AdminStoreProvider({

  children,

}: {

  children:
    ReactNode;

}) {


  // ==========================================================
  // CLIENT STATE
  // ==========================================================

  const [
    clients,
    setClients,
  ] =
    useState<
      AdminClient[]
    >(
      INITIAL_CLIENTS
    );


  // ==========================================================
  // PLAN STATE
  // ==========================================================

  const [
    plans,
    setPlans,
  ] =
    useState<
      AdminPlan[]
    >(
      INITIAL_PLANS
    );


  // ==========================================================
  // MODULE STATE
  // ==========================================================

  const [
    modules,
    setModules,
  ] =
    useState<
      GrowthModule[]
    >(
      INITIAL_MODULES
    );


  // ==========================================================
  // USER STATE
  // ==========================================================

  const [
    users,
    setUsers,
  ] =
    useState<
      AdminUser[]
    >(
      INITIAL_USERS
    );


  // ==========================================================
  // INTEGRATION STATE
  // ==========================================================

  const [
    integrations,
    setIntegrations,
  ] =
    useState<
      AdminClientIntegration[]
    >(
      INITIAL_INTEGRATIONS
    );


  // ==========================================================
  // PLAN LOOKUP
  // ==========================================================

  function getPlan(
    planId:
      string
  ) {

    return plans.find(
      plan =>
        plan.id ===
        planId
    );

  }


  // ==========================================================
  // MODULE LOOKUP
  // ==========================================================

  function getModule(
    moduleId:
      string
  ) {

    return modules.find(
      module =>
        module.id ===
        moduleId
    );

  }


  // ==========================================================
  // CLIENT LOOKUP
  // ==========================================================

  function getClient(
    clientId:
      string
  ) {

    return clients.find(
      client =>
        client.id ===
        clientId
    );

  }


  // ==========================================================
  // USER LOOKUP
  // ==========================================================

  function getUser(
    userId:
      string
  ) {

    return users.find(
      user =>
        user.id ===
        userId
    );

  }


  // ==========================================================
  // INTEGRATION PROVIDER LOOKUP
  // ==========================================================

  function getIntegrationProvider(
    providerId:
      string
  ) {

    return INTEGRATION_PROVIDERS.find(
      provider =>
        provider.id ===
        providerId
    );

  }


  // ==========================================================
  // CLIENT MODULE ACCESS
  //
  // PLAN
  // +
  // CLIENT OVERRIDE
  // =
  // CLIENT FINAL ACCESS
  // ==========================================================

  function getClientModuleAccess(

    client:
      AdminClient,

    moduleId:
      string

  ) {

    const plan =
      getPlan(
        client.planId
      );


    const planIncluded =
      Boolean(
        plan
          ?.modules
          ?.includes(
            moduleId
          )
      );


    const override =
      client
        .moduleOverrides
        ?.[moduleId]
      ||
      'default';


    let enabled =
      planIncluded;


    // --------------------------------------------------------
    // CLIENT FORCE ENABLE
    // --------------------------------------------------------

    if (
      override ===
      'enabled'
    ) {

      enabled =
        true;

    }


    // --------------------------------------------------------
    // CLIENT FORCE DISABLE
    // --------------------------------------------------------

    if (
      override ===
      'disabled'
    ) {

      enabled =
        false;

    }


    // --------------------------------------------------------
    // COMMAND CENTER IS MANDATORY
    // --------------------------------------------------------

    if (
      moduleId ===
      'command-center'
    ) {

      enabled =
        true;

    }


    // --------------------------------------------------------
    // GLOBAL MODULE SUSPENSION OVERRIDES EVERYTHING
    // --------------------------------------------------------

    const module =
      getModule(
        moduleId
      );


    if (
      !module
      ||
      module.status ===
        'suspended'
    ) {

      enabled =
        false;

    }


    return {

      planIncluded,

      override,

      enabled,

    };

  }


  // ==========================================================
  // CLIENT ORDER LIMIT
  //
  // PLAN DEFAULT
  // +
  // CLIENT OVERRIDE
  // =
  // FINAL CLIENT ALLOWANCE
  // ==========================================================

  function getClientOrderLimit(
    client:
      AdminClient
  ) {

    // --------------------------------------------------------
    // Explicit client override exists.
    // --------------------------------------------------------

    if (
      client.monthlyOrderLimitOverride !==
      undefined
    ) {

      return (
        client.monthlyOrderLimitOverride
      );

    }


    // --------------------------------------------------------
    // Otherwise inherit from plan.
    // --------------------------------------------------------

    const plan =
      getPlan(
        client.planId
      );


    return (
      plan
        ?.monthlyOrderLimit
      ??
      null
    );

  }


  // ==========================================================
  // CLIENT USERS
  // ==========================================================

  function getClientUsers(
    clientId:
      string
  ) {

    return users.filter(
      user =>
        user.scope ===
          'client'
        &&
        user.clientId ===
          clientId
    );

  }


  // ==========================================================
  // CLIENT USER COUNT
  // ==========================================================

  function getClientUserCount(
    clientId:
      string
  ) {

    return getClientUsers(
      clientId
    ).length;

  }


  // ==========================================================
  // USER MODULE ACCESS
  //
  // CLIENT FINAL ACCESS
  // +
  // USER PERMISSION
  // =
  // FINAL USER ACCESS
  //
  // User cannot elevate beyond client entitlement.
  // ==========================================================

  function getUserModuleAccess(

    user:
      AdminUser,

    moduleId:
      string

  ) {


    // --------------------------------------------------------
    // PLATFORM ADMIN
    // --------------------------------------------------------

    if (
      user.scope ===
        'platform'
    ) {

      const module =
        getModule(
          moduleId
        );


      const enabled =
        Boolean(
          module
          &&
          module.status !==
            'suspended'
        );


      return {

        clientEnabled:
          true,

        permission:
          'enabled' as UserModulePermission,

        enabled,

      };

    }


    // --------------------------------------------------------
    // USER MUST HAVE CLIENT
    // --------------------------------------------------------

    if (
      !user.clientId
    ) {

      return {

        clientEnabled:
          false,

        permission:
          'inherit' as UserModulePermission,

        enabled:
          false,

      };

    }


    const client =
      getClient(
        user.clientId
      );


    if (!client) {

      return {

        clientEnabled:
          false,

        permission:
          'inherit' as UserModulePermission,

        enabled:
          false,

      };

    }


    // --------------------------------------------------------
    // SUSPENDED CLIENT BLOCKS USER
    // --------------------------------------------------------

    if (
      client.status ===
      'suspended'
    ) {

      return {

        clientEnabled:
          false,

        permission:
          user
            .modulePermissions
            ?.[moduleId]
          ||
          'inherit',

        enabled:
          false,

      };

    }


    const clientAccess =
      getClientModuleAccess(
        client,
        moduleId
      );


    const permission =
      user
        .modulePermissions
        ?.[moduleId]
      ||
      'inherit';


    let enabled =
      clientAccess.enabled;


    // --------------------------------------------------------
    // USER DENY
    // --------------------------------------------------------

    if (
      permission ===
      'disabled'
    ) {

      enabled =
        false;

    }


    // --------------------------------------------------------
    // USER ENABLE
    //
    // Can only confirm something already enabled for client.
    // --------------------------------------------------------

    if (
      permission ===
      'enabled'
    ) {

      enabled =
        clientAccess.enabled;

    }


    // --------------------------------------------------------
    // SUSPENDED USER
    // --------------------------------------------------------

    if (
      user.status ===
      'suspended'
    ) {

      enabled =
        false;

    }


    return {

      clientEnabled:
        clientAccess.enabled,

      permission,

      enabled,

    };

  }


  // ==========================================================
  // CLIENT INTEGRATIONS
  // ==========================================================

  function getClientIntegrations(
    clientId:
      string
  ) {

    return integrations.filter(
      integration =>
        integration.clientId ===
        clientId
    );

  }


  // ==========================================================
  // CLIENT INTEGRATION COUNT
  // ==========================================================

  function getClientIntegrationCount(
    clientId:
      string
  ) {

    return getClientIntegrations(
      clientId
    ).length;

  }


  // ==========================================================
  // STORE VALUE
  // ==========================================================

  const value =
    useMemo<AdminStoreValue>(
      () => ({

        // ----------------------------------------------------
        // DATA
        // ----------------------------------------------------

        clients,

        plans,

        modules,

        users,

        integrationProviders:
          INTEGRATION_PROVIDERS,

        integrations,


        // ----------------------------------------------------
        // MUTATIONS
        // ----------------------------------------------------

        setClients,

        setPlans,

        setModules,

        setUsers,

        setIntegrations,


        // ----------------------------------------------------
        // LOOKUPS
        // ----------------------------------------------------

        getPlan,

        getModule,

        getClient,

        getUser,

        getIntegrationProvider,


        // ----------------------------------------------------
        // ENTITLEMENT
        // ----------------------------------------------------

        getClientModuleAccess,

        getClientOrderLimit,

        getClientUsers,

        getClientUserCount,

        getUserModuleAccess,


        // ----------------------------------------------------
        // INTEGRATIONS
        // ----------------------------------------------------

        getClientIntegrations,

        getClientIntegrationCount,

      }),
      [
        clients,
        plans,
        modules,
        users,
        integrations,
      ]
    );


  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (

    <AdminStoreContext.Provider
      value={
        value
      }
    >

      {children}

    </AdminStoreContext.Provider>

  );

}


// ============================================================
// STORE HOOK
// ============================================================

export function useAdminStore() {

  const context =
    useContext(
      AdminStoreContext
    );


  if (!context) {

    throw new Error(
      'useAdminStore must be used inside AdminStoreProvider'
    );

  }


  return context;

}