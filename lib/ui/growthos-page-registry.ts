// ============================================================
// GROWTH OS PAGE PRESENTATION REGISTRY
//
// This is the single source of truth for page identity chrome:
// - module eyebrow
// - page title
// - page explanation
// - whether the universal Growth OS date control is relevant
//
// The actual page content remains inside each OS module. Keeping
// presentation metadata here prevents every module from inventing
// its own header format and makes future pages inherit one visual
// grammar automatically through GrowthOSPageShell.
// ============================================================

export type GrowthOSDateMode =
  | 'global'
  | 'none';

export type GrowthOSPageDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  dateMode: GrowthOSDateMode;
};

type ModulePageDefinitions = {
  default: GrowthOSPageDefinition;
  pages?: Record<string, Partial<GrowthOSPageDefinition>>;
};

const PAGE_REGISTRY: Record<string, ModulePageDefinitions> = {
  'CEO Summary': {
    default: {
      eyebrow: 'Command Center',
      title: 'Business Overview',
      description:
        'Revenue, media, customers and commerce in one place, with the key signals needed to run the business.',
      dateMode: 'global',
    },
  },

  'Meta OS': {
    default: {
      eyebrow: 'Meta OS',
      title: 'Meta Growth Intelligence',
      description:
        'Understand Meta performance, efficiency and scaling opportunities across the growth funnel.',
      dateMode: 'global',
    },
    pages: {
      Overview: {},
      'Campaign Analysis': {
        title: 'Campaign Analysis',
        description:
          'Evaluate campaign-level performance, efficiency and scaling opportunities across Meta.',
      },
      'Ad Set Analysis': {
        title: 'Ad Set Analysis',
        description:
          'Compare ad-set delivery, economics and efficiency to identify where budget should move.',
      },
      'Creative Analysis': {
        title: 'Creative Analysis',
        description:
          'Understand which creatives are creating demand, converting efficiently and showing fatigue.',
      },
      'Funnel Analysis': {
        title: 'Funnel Analysis',
        description:
          'Diagnose how Meta traffic moves from delivery and engagement through purchase, comparing the current period with the previous period at each funnel stage.',
      },
      'Alerts & Recommendations': {
        title: 'Alerts & Recommendations',
        description:
          'Prioritise Meta performance risks, opportunities and recommended operator actions.',
      },
      Settings: {
        title: 'Meta Settings',
        description:
          'Configure the thresholds and operating rules used by Meta Growth Intelligence.',
        dateMode: 'none',
      },
    },
  },

  'Google OS': {
    default: {
      eyebrow: 'Google OS',
      title: 'Intent Intelligence',
      description:
        'Understand how search demand converts into profitable growth across Google.',
      dateMode: 'global',
    },
    pages: {
      Overview: {},
      'Channel Mix': {
        title: 'Channel Mix',
        description:
          'Understand how Google demand, spend and revenue are distributed across channels and where budget can move.',
      },
      Campaign: {
        title: 'Campaign Analysis',
        description:
          'Evaluate campaign-level spend, revenue and efficiency to support budget decisions.',
      },
      'Ad Group': {
        title: 'Ad Group Analysis',
        description:
          'Inspect ad-group performance and identify where intent is translating into efficient growth.',
        dateMode: 'none',
      },
      'Search Terms': {
        title: 'Search Term Intelligence',
        description:
          'See the customer queries consuming spend, creating revenue and revealing new intent opportunities.',
      },
      Keywords: {
        title: 'Keyword Intelligence',
        description:
          'Evaluate keyword-level demand, efficiency and contribution to profitable search growth.',
        dateMode: 'none',
      },
      Funnel: {
        title: 'Google Funnel',
        description:
          'Diagnose how Google demand progresses from intent and traffic through conversion.',
        dateMode: 'none',
      },
      Alerts: {
        title: 'Alerts & Opportunities',
        description:
          'Surface Google performance risks and the highest-priority opportunities requiring action.',
        dateMode: 'none',
      },
      Settings: {
        title: 'Google Settings',
        description:
          'Configure the operating thresholds used by Google Intent Intelligence.',
        dateMode: 'none',
      },
    },
  },

  'Attribution OS': {
    default: {
      eyebrow: 'Attribution OS',
      title: 'Customer Journey Intelligence',
      description:
        'Understand the complete journey from discovery to purchase and how channels, campaigns and interactions contribute to orders and revenue.',
      dateMode: 'global',
    },
    pages: {
      Overview: {},
      'Journey Explorer': {
        title: 'Individual Customer Journeys',
        description:
          'Follow the complete sequence from discovery to purchase for individual customers and orders.',
      },
      Channels: {
        title: 'Channel Attribution',
        description:
          'Understand which channels start, assist and close customer journeys from discovery to purchase.',
      },
      Campaigns: {
        title: 'Campaign Attribution',
        description:
          'Measure campaign-level contribution across the complete customer journey.',
      },
      Creatives: {
        title: 'Creative Attribution',
        description:
          'Identify which individual ads and creatives start, assist and close customer journeys.',
      },
      'New vs Repeat': {
        title: 'New vs Repeat',
        description:
          'Understand how acquisition and repeat-customer journeys differ across the attribution path.',
      },
      'Attribution Models': {
        title: 'Attribution Models',
        description:
          'Compare how revenue credit changes under each attribution methodology.',
      },
      'Data Quality': {
        title: 'Data Quality',
        description:
          'Monitor collection, sessionization, identity matching and order resolution across the attribution system.',
        dateMode: 'none',
      },
    },
  },

  'Retention OS': {
    default: {
      eyebrow: 'Retention OS',
      title: 'Customer Retention Intelligence',
      description:
        'Identify repeat behaviour, retention opportunities and the next best customer actions.',
      dateMode: 'none',
    },
    pages: {
      'Mission Control': {
        title: 'Mission Control',
        description:
          'Retention decision engine powered by NBA v6: journey action, product action and expected business value.',
      },
      'Command Center': {
        title: 'Mission Control',
        description:
          'Retention decision engine powered by NBA v6: journey action, product action and expected business value.',
      },
      'Daily Planner': {
        title: 'Daily Planner',
        description:
          'Weekly Execution Planner: turn one next-best action per customer into executable campaign groups for the retention team.',
        dateMode: 'global',
      },
      'Opportunity Bank': {
        title: 'Opportunity Bank',
        description:
          'Ranked Retention Opportunities powered by expected profit, journey-state probability, pattern probability and strategic importance.',
      },
      'Pattern Discovery': {
        title: 'Pattern Discovery',
        description:
          'What should the operator act on? Find validated retention drivers, next-product sequences, routine completion, replenishment windows and controlled affinity tests.',
      },
      'Hypothesis Lab': {
        title: 'Hypothesis Lab',
        description:
          'What should we test? Turn generated hypotheses and operator-selected Pattern Discovery evidence into controlled retention tests.',
      },
      'Action Tracker': {
        title: 'Action Tracker',
        description:
          'Retention Execution Queue: configure, validate, export, send and measure frozen campaign audiences and retention actions.',
      },
      'Learning Loop': {
        title: 'Learning Loop',
        description:
          'Expected vs Actual Memory: store what worked, what failed, how accurate the engine was and what should change next.',
      },
      'Customer Journey': {
        title: 'Customer Journey',
        description:
          'Journey State Engine: understand journey stage, timing state, base probability, multiplier and state score for each customer.',
      },
      Settings: {
        title: 'Retention Settings',
        description:
          'Retention Brain Configuration: define how Retention OS ranks opportunities, hypotheses, actions and learnings.',
      },
    },
  },

  'Call Commerce': {
    default: {
      eyebrow: 'Call Commerce',
      title: 'Call Commerce',
      description: 'Operate inbound call leads from first call through qualification, follow-up and manually recorded conversion.',
      dateMode: 'global',
    },
    pages: {
      Summary: {},
      Calls: { title: 'Calls', description: 'Manage active call leads, repeated call attempts and agent workflow.' },
      'Events': { title: 'Events', description: 'Review call-specific Meta signal queue and delivery state.', dateMode: 'none' },
      Archive: { title: 'Archive', description: 'Review finalized and aged call leads retained by Call Commerce.', dateMode: 'none' },
      Reports: { title: 'Reports', description: 'Search and review call lead outcomes for operational reporting.' },
      'System Status': { title: 'System Status', description: 'Monitor calling connection, lead and Meta queue health.', dateMode: 'none' },
    },
  },

  'Product OS': {
    default: {
      eyebrow: 'Product OS',
      title: 'Product Intelligence',
      description:
        'Understand demand, inventory and SKU-level growth opportunities across the product portfolio.',
      dateMode: 'global',
    },
    pages: {
      Overview: {},
      'SKU Performance': {
        title: 'SKU Performance',
        description:
          'Compare SKU-level sales, units and growth to identify the products driving or dragging performance.',
      },
      'Demand Trends': {
        title: 'Demand Trends',
        description:
          'Track how product revenue, units and SKU momentum are changing through the selected period.',
      },
      'Inventory Health': {
        title: 'Inventory Health',
        description:
          'Monitor product availability and inventory risk against current demand.',
        dateMode: 'none',
      },
      Forecasting: {
        title: 'SKU Forecast',
        description:
          'Forecast SKU demand from the last calendar month, growth rate and capped seasonality index to support inventory and commercial planning.',
        dateMode: 'none',
      },
      Seasonality: {
        title: 'Seasonality Engine',
        description:
          'Understand recurring product demand patterns using the monthly SKU demand index, where 1.00 is an average month and values above 1 indicate stronger demand.',
        dateMode: 'none',
      },
      Insights: {
        title: 'Product Insights',
        description:
          'Surface the most important product growth signals, concentration risks and portfolio opportunities.',
        dateMode: 'none',
      },
      Settings: {
        title: 'Product Settings',
        description:
          'Configure Product OS rules and operating assumptions.',
        dateMode: 'none',
      },
    },
  },

  Settings: {
    default: {
      eyebrow: 'Growth OS',
      title: 'Settings',
      description:
        'Review and configure your workspace, subscription, modules, integrations, access, security, notifications, data controls and personal preferences.',
      dateMode: 'none',
    },
  },
};

function mergeDefinition(
  base: GrowthOSPageDefinition,
  override?: Partial<GrowthOSPageDefinition>
): GrowthOSPageDefinition {
  return {
    ...base,
    ...(override || {}),
  };
}

export function getGrowthOSPageDefinition(
  activeTab: string,
  activeSubTab?: string
): GrowthOSPageDefinition {
  const moduleDefinition =
    PAGE_REGISTRY[activeTab];

  if (!moduleDefinition) {
    return {
      eyebrow: 'Growth OS',
      title:
        activeSubTab ||
        activeTab ||
        'Workspace',
      description:
        'Growth OS intelligence workspace.',
      dateMode: 'none',
    };
  }

  if (!activeSubTab) {
    return moduleDefinition.default;
  }

  return mergeDefinition(
    moduleDefinition.default,
    moduleDefinition.pages?.[activeSubTab]
  );
}
