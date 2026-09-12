import 'server-only';

export type GrowthOSApiPolicy = {

  moduleId:
    string;

  submoduleId?:
    string;

};


// ============================================================
// STATIC API POLICIES
// ============================================================

const EXACT_POLICIES:
  Record<
    string,
    GrowthOSApiPolicy
  > = {

  '/api/ceo-summary': {
    moduleId:
      'command-center',
  },


  // GOOGLE

  '/api/google-os/overview': {
    moduleId:
      'google',
    submoduleId:
      'overview',
  },

  '/api/google-os/channel-mix': {
    moduleId:
      'google',
    submoduleId:
      'channel-mix',
  },

  '/api/google-os/campaign': {
    moduleId:
      'google',
    submoduleId:
      'campaign',
  },

  '/api/google-os/search-terms': {
    moduleId:
      'google',
    submoduleId:
      'search-terms',
  },


  // ATTRIBUTION

  '/api/attribution-os/overview': {
    moduleId:
      'attribution',
    submoduleId:
      'overview',
  },

  '/api/attribution-os/journeys': {
    moduleId:
      'attribution',
    submoduleId:
      'journey-explorer',
  },

  '/api/attribution-os/channels': {
    moduleId:
      'attribution',
    submoduleId:
      'channels',
  },

  '/api/attribution-os/campaigns': {
    moduleId:
      'attribution',
    submoduleId:
      'campaigns',
  },

  '/api/attribution-os/creatives': {
    moduleId:
      'attribution',
    submoduleId:
      'creatives',
  },

  '/api/attribution-os/new-repeat': {
    moduleId:
      'attribution',
    submoduleId:
      'new-vs-repeat',
  },

  '/api/attribution-os/models': {
    moduleId:
      'attribution',
    submoduleId:
      'attribution-models',
  },

  '/api/attribution-os/data-quality': {
    moduleId:
      'attribution',
    submoduleId:
      'data-quality',
  },


  // PRODUCT

  '/api/product-os/overview': {
    moduleId:
      'product',
    submoduleId:
      'overview',
  },

  '/api/product-os/sku-performance': {
    moduleId:
      'product',
    submoduleId:
      'sku-performance',
  },

  '/api/product-os/demand-trends': {
    moduleId:
      'product',
    submoduleId:
      'demand-trends',
  },

  '/api/product-os/forecasting': {
    moduleId:
      'product',
    submoduleId:
      'forecasting',
  },

  '/api/product-os/seasonality': {
    moduleId:
      'product',
    submoduleId:
      'seasonality',
  },

};


// ============================================================
// RETENTION ROUTE FAMILY
// ============================================================

const RETENTION_PREFIX_POLICIES:
  Array<{
    prefix:
      string;

    submoduleId:
      string;
  }> = [

  // ACTION TRACKER
  { prefix: '/api/retention-os/action-tracker', submoduleId: 'action-tracker' },
  { prefix: '/api/retention-os/action-log', submoduleId: 'action-tracker' },

  // DAILY PLANNER
  { prefix: '/api/retention-os/daily-planner', submoduleId: 'daily-planner' },
  { prefix: '/api/retention-os/daily-execution-plan', submoduleId: 'daily-planner' },

  // OPPORTUNITY BANK
  { prefix: '/api/retention-os/opportunities', submoduleId: 'opportunity-bank' },

  // PATTERN DISCOVERY
  { prefix: '/api/retention-os/patterns', submoduleId: 'pattern-discovery' },
  { prefix: '/api/retention-os/pattern-actions', submoduleId: 'pattern-discovery' },

  // HYPOTHESIS LAB
  { prefix: '/api/retention-os/hypotheses', submoduleId: 'hypothesis-lab' },

  // LEARNING LOOP
  { prefix: '/api/retention-os/learning-', submoduleId: 'learning-loop' },
  { prefix: '/api/retention-os/confidence-', submoduleId: 'learning-loop' },

  // CUSTOMER JOURNEY
  { prefix: '/api/retention-os/customer-journey', submoduleId: 'customer-journey' },

  // SETTINGS
  { prefix: '/api/retention-os/global-settings', submoduleId: 'settings' },
  { prefix: '/api/retention-os/journey-settings', submoduleId: 'settings' },
  { prefix: '/api/retention-os/journey-health-settings', submoduleId: 'settings' },
  { prefix: '/api/retention-os/opportunity-settings', submoduleId: 'settings' },
  { prefix: '/api/retention-os/settings-health', submoduleId: 'settings' },
  { prefix: '/api/retention-os/product-master', submoduleId: 'settings' },
  { prefix: '/api/retention-os/routine-master', submoduleId: 'settings' },
  { prefix: '/api/retention-os/mapped-products', submoduleId: 'settings' },
  { prefix: '/api/retention-os/unmapped-products', submoduleId: 'settings' },

  // MISSION CONTROL / GENERAL RETENTION INTELLIGENCE
  { prefix: '/api/retention-os/mission-control', submoduleId: 'mission-control' },
  { prefix: '/api/retention-os/summary', submoduleId: 'mission-control' },
  { prefix: '/api/retention-os/forecast', submoduleId: 'mission-control' },

];


// ============================================================
// META TAB → SUBMODULE
// ============================================================

function resolveMetaPolicy(
  url:
    URL
):
  GrowthOSApiPolicy {

  const tab =
    url.searchParams.get(
      'tab'
    )
    ||
    'overview';


  if (
    tab === 'campaign'
    ||
    tab === 'campaign-list'
    ||
    tab === 'campaign-weekly'
    ||
    tab === 'campaign-daily-chart'
  ) {

    return {
      moduleId:
        'meta',
      submoduleId:
        'campaign-analysis',
    };

  }


  if (
    tab === 'adset'
  ) {

    return {
      moduleId:
        'meta',
      submoduleId:
        'ad-set-analysis',
    };

  }


  if (
    tab === 'creative'
    ||
    tab === 'creative-daily-4pi'
  ) {

    return {
      moduleId:
        'meta',
      submoduleId:
        'creative-analysis',
    };

  }


  if (
    tab === 'funnel'
  ) {

    return {
      moduleId:
        'meta',
      submoduleId:
        'funnel-analysis',
    };

  }


  if (
    tab === 'creative-alerts'
  ) {

    return {
      moduleId:
        'meta',
      submoduleId:
        'alerts-recommendations',
    };

  }


  return {
    moduleId:
      'meta',
    submoduleId:
      'overview',
  };

}


// ============================================================
// RESOLVE POLICY
// ============================================================

export function resolveGrowthOSApiPolicy(
  request:
    Request
):
  GrowthOSApiPolicy |
  null {

  const url =
    new URL(
      request.url
    );


  const pathname =
    url.pathname;


  if (
    pathname ===
      '/api/meta-os'
  ) {

    return resolveMetaPolicy(
      url
    );

  }


  const exact =
    EXACT_POLICIES[
      pathname
    ];


  if (exact) {

    return exact;

  }


  if (
    pathname.startsWith(
      '/api/retention-os/'
    )
  ) {

    for (
      const policy
      of RETENTION_PREFIX_POLICIES
    ) {

      if (
        pathname.startsWith(
          policy.prefix
        )
      ) {

        return {

          moduleId:
            'retention',

          submoduleId:
            policy.submoduleId,

        };

      }

    }


    // Remaining Retention intelligence APIs default to
    // Mission Control rather than bypassing protection.

    return {

      moduleId:
        'retention',

      submoduleId:
        'mission-control',

    };

  }


  return null;

}