// ============================================================
// GROWTH OS SUBMODULE REGISTRY
//
// Canonical stable IDs for user-access permissions.
//
// IMPORTANT:
//
// Labels may change in the UI.
// submoduleId must remain stable once used in permissions.
// ============================================================

export type GrowthOSSubmoduleDefinition = {

  moduleId:
    string;

  submoduleId:
    string;

  label:
    string;

  // Optional seed defaults used only when a capability is first
  // registered in the control plane. Existing Admin-managed values
  // are never overwritten by these defaults.
  defaultAccessMode?:
    'standard' | 'plan' | 'custom';

  defaultReleaseStage?:
    'draft' | 'internal' | 'beta' | 'live' | 'archived';

};


// ============================================================
// REGISTRY
// ============================================================

export const GROWTHOS_SUBMODULES:
  GrowthOSSubmoduleDefinition[] = [

  // ==========================================================
  // META
  // ==========================================================

  {
    moduleId: 'meta',
    submoduleId: 'overview',
    label: 'Overview',
  },

  {
    moduleId: 'meta',
    submoduleId: 'campaign-analysis',
    label: 'Campaign Analysis',
  },

  {
    moduleId: 'meta',
    submoduleId: 'ad-set-analysis',
    label: 'Ad Set Analysis',
  },

  {
    moduleId: 'meta',
    submoduleId: 'creative-analysis',
    label: 'Creative Analysis',
  },

  {
    moduleId: 'meta',
    submoduleId: 'funnel-analysis',
    label: 'Funnel Analysis',
  },

  {
    moduleId: 'meta',
    submoduleId: 'alerts-recommendations',
    label: 'Alerts & Recommendations',
  },

  {
    moduleId: 'meta',
    submoduleId: 'settings',
    label: 'Settings',
  },


  // ==========================================================
  // GOOGLE
  // ==========================================================

  {
    moduleId: 'google',
    submoduleId: 'overview',
    label: 'Overview',
  },

  {
    moduleId: 'google',
    submoduleId: 'channel-mix',
    label: 'Channel Mix',
  },

  {
    moduleId: 'google',
    submoduleId: 'campaign',
    label: 'Campaign',
  },

  {
    moduleId: 'google',
    submoduleId: 'ad-group',
    label: 'Ad Group',
  },

  {
    moduleId: 'google',
    submoduleId: 'search-terms',
    label: 'Search Terms',
  },

  {
    moduleId: 'google',
    submoduleId: 'keywords',
    label: 'Keywords',
  },

  {
    moduleId: 'google',
    submoduleId: 'funnel',
    label: 'Funnel',
  },

  {
    moduleId: 'google',
    submoduleId: 'alerts',
    label: 'Alerts',
  },

  {
    moduleId: 'google',
    submoduleId: 'settings',
    label: 'Settings',
  },


  // ==========================================================
  // ATTRIBUTION
  // ==========================================================

  {
    moduleId: 'attribution',
    submoduleId: 'overview',
    label: 'Overview',
  },

  {
    moduleId: 'attribution',
    submoduleId: 'journey-explorer',
    label: 'Journey Explorer',
  },

  {
    moduleId: 'attribution',
    submoduleId: 'channels',
    label: 'Channels',
  },

  {
    moduleId: 'attribution',
    submoduleId: 'campaigns',
    label: 'Campaigns',
  },

  {
    moduleId: 'attribution',
    submoduleId: 'creatives',
    label: 'Creatives',
  },

  {
    moduleId: 'attribution',
    submoduleId: 'new-vs-repeat',
    label: 'New vs Repeat',
  },

  {
    moduleId: 'attribution',
    submoduleId: 'attribution-models',
    label: 'Attribution Models',
  },

  {
    moduleId: 'attribution',
    submoduleId: 'data-quality',
    label: 'Data Quality',
  },


  // ==========================================================
  // RETENTION
  // ==========================================================

  {
    moduleId: 'retention',
    submoduleId: 'mission-control',
    label: 'Mission Control',
  },

  {
    moduleId: 'retention',
    submoduleId: 'daily-planner',
    label: 'Daily Planner',
  },

  {
    moduleId: 'retention',
    submoduleId: 'opportunity-bank',
    label: 'Opportunity Bank',
  },

  {
    moduleId: 'retention',
    submoduleId: 'pattern-discovery',
    label: 'Pattern Discovery',
  },

  {
    moduleId: 'retention',
    submoduleId: 'hypothesis-lab',
    label: 'Hypothesis Lab',
  },

  {
    moduleId: 'retention',
    submoduleId: 'action-tracker',
    label: 'Action Tracker',
  },

  {
    moduleId: 'retention',
    submoduleId: 'learning-loop',
    label: 'Learning Loop',
  },

  {
    moduleId: 'retention',
    submoduleId: 'customer-journey',
    label: 'Customer Journey',
  },

  {
    moduleId: 'retention',
    submoduleId: 'settings',
    label: 'Settings',
  },


  // ==========================================================
  // PRODUCT
  // ==========================================================

  {
    moduleId: 'product',
    submoduleId: 'overview',
    label: 'Overview',
  },

  {
    moduleId: 'product',
    submoduleId: 'sku-performance',
    label: 'SKU Performance',
  },

  {
    moduleId: 'product',
    submoduleId: 'demand-trends',
    label: 'Demand Trends',
  },

  {
    moduleId: 'product',
    submoduleId: 'inventory-health',
    label: 'Inventory Health',
  },

  {
    moduleId: 'product',
    submoduleId: 'forecasting',
    label: 'Forecasting',
  },

  {
    moduleId: 'product',
    submoduleId: 'seasonality',
    label: 'Seasonality',
  },

  {
    moduleId: 'product',
    submoduleId: 'insights',
    label: 'Insights',
  },

  {
    moduleId: 'product',
    submoduleId: 'settings',
    label: 'Settings',
  },


  // ==========================================================
  // CALL COMMERCE
  // ==========================================================

  { moduleId: 'call-commerce', submoduleId: 'summary', label: 'Summary', defaultAccessMode: 'plan', defaultReleaseStage: 'live' },
  { moduleId: 'call-commerce', submoduleId: 'calls', label: 'Calls', defaultAccessMode: 'plan', defaultReleaseStage: 'live' },
  { moduleId: 'call-commerce', submoduleId: 'meta-events', label: 'Events', defaultAccessMode: 'plan', defaultReleaseStage: 'live' },
  { moduleId: 'call-commerce', submoduleId: 'archive', label: 'Archive', defaultAccessMode: 'plan', defaultReleaseStage: 'live' },
  { moduleId: 'call-commerce', submoduleId: 'reports', label: 'Reports', defaultAccessMode: 'plan', defaultReleaseStage: 'live' },
  { moduleId: 'call-commerce', submoduleId: 'system-status', label: 'System Status', defaultAccessMode: 'plan', defaultReleaseStage: 'live' },
  { moduleId: 'call-commerce', submoduleId: 'settings', label: 'Settings', defaultAccessMode: 'plan', defaultReleaseStage: 'live' },


  // ==========================================================
  // SETTINGS
  //
  // Settings itself is a protected parent module. Individual
  // sections are registered as controllable submodules so Admin
  // can release them to everyone, a plan, or selected clients.
  // Existing client behaviour is preserved by seeding these
  // sections as Standard + Live on first registration.
  // ==========================================================

  {
    moduleId: 'settings',
    submoduleId: 'workspace',
    label: 'Workspace',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'plan-billing',
    label: 'Plan & Billing',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'modules',
    label: 'Modules',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'integrations',
    label: 'Integrations',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'users-access',
    label: 'Users & Access',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'security',
    label: 'Security',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'notifications',
    label: 'Notifications',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'audit-log',
    label: 'Audit Log',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'data-account',
    label: 'Data & Account',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'my-preferences',
    label: 'My Preferences',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

  {
    moduleId: 'settings',
    submoduleId: 'launch-readiness',
    label: 'Launch Readiness',
    defaultAccessMode: 'standard',
    defaultReleaseStage: 'live',
  },

];


// ============================================================
// READ MODULE SUBMODULES
// ============================================================

export function getGrowthOSSubmodules(
  moduleId: string
) {

  const normalizedModuleId =
    String(
      moduleId
      ||
      ''
    ).trim();


  return GROWTHOS_SUBMODULES.filter(
    item =>
      item.moduleId ===
        normalizedModuleId
  );

}


// ============================================================
// VALIDATE MODULE + SUBMODULE
// ============================================================

export function isGrowthOSSubmodule(
  moduleId: string,
  submoduleId: string
) {

  const normalizedModuleId =
    String(
      moduleId
      ||
      ''
    ).trim();


  const normalizedSubmoduleId =
    String(
      submoduleId
      ||
      ''
    ).trim();


  return GROWTHOS_SUBMODULES.some(
    item =>
      item.moduleId ===
        normalizedModuleId
      &&
      item.submoduleId ===
        normalizedSubmoduleId
  );

}


// ============================================================
// FIND SUBMODULE
// ============================================================

export function getGrowthOSSubmodule(
  moduleId: string,
  submoduleId: string
) {

  return (
    GROWTHOS_SUBMODULES.find(
      item =>
        item.moduleId ===
          moduleId
        &&
        item.submoduleId ===
          submoduleId
    )
    ??
    null
  );

}
