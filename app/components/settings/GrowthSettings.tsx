'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  Boxes,
  CheckCircle2,
  CreditCard,
  Database,
  PlugZap,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';


/* ============================================================
   TYPES
============================================================ */

type SettingsTab =
  | 'General'
  | 'Tools & Modules'
  | 'Integrations'
  | 'Business Rules'
  | 'Data & Sync'
  | 'Users & Access'
  | 'Plans & Usage';


type Plan =
  | 'starter'
  | 'pro'
  | 'advanced'
  | 'enterprise';


type BillingCycle =
  | 'monthly'
  | 'annual';


type ToolConfig = {
  id: string;
  name: string;
  description: string;

  enabled: boolean;

  requiredPlan: Plan;

  source: string;

  status:
    | 'connected'
    | 'review'
    | 'disabled';
};


type IntegrationConfig = {
  id: string;
  name: string;

  status:
    | 'connected'
    | 'not_connected'
    | 'review';

  account: string;

  lastSync: string;
};


type PlatformSettings = {

  general: {

    workspaceName: string;

    storeDomain: string;

    currency: string;

    timezone: string;

    financialYearStart: string;

    defaultDateRange: string;

  };


  tools:
    ToolConfig[];


  integrations:
    IntegrationConfig[];


  businessRules: {

    meta: {

      targetRoas: number;

      targetCpa: number;

      minSpend: number;

      minPurchases: number;

      scalePct: number;

    };


    google: {

      targetRoas: number;

      maxCpa: number;

      minClicks: number;

      wasteLimit: number;

    };


    attribution: {

      defaultModel: string;

      sessionWindowMinutes: number;

      deterministicOnly: boolean;

      includeDirect: boolean;

    };

  };


  plan: {

    currentPlan:
      Plan;

    billingCycle:
      BillingCycle;

  };

};


/* ============================================================
   DEFAULT SETTINGS
============================================================ */

const DEFAULT_SETTINGS: PlatformSettings = {

  general: {

    workspaceName:
      'Brillare',

    storeDomain:
      'brillare.co.in',

    currency:
      'INR',

    timezone:
      'Asia/Kolkata',

    financialYearStart:
      'April',

    defaultDateRange:
      'Last 30 Days',

  },


  tools: [

    {
      id:
        'meta',

      name:
        'Meta OS',

      description:
        'Paid social intelligence, campaign analysis and budget decisions.',

      enabled:
        true,

      requiredPlan:
        'pro',

      source:
        'Meta Ads + BigQuery',

      status:
        'connected',
    },


    {
      id:
        'google',

      name:
        'Google OS',

      description:
        'Search, Shopping, keyword and intent intelligence.',

      enabled:
        true,

      requiredPlan:
        'pro',

      source:
        'Google Ads + BigQuery',

      status:
        'connected',
    },


    {
      id:
        'attribution',

      name:
        'Attribution OS',

      description:
        'Deterministic customer journey and marketing attribution.',

      enabled:
        true,

      requiredPlan:
        'advanced',

      source:
        'Shopify Pixel + BigQuery',

      status:
        'connected',
    },


    {
      id:
        'retention',

      name:
        'Retention OS',

      description:
        'Customer lifecycle, opportunities, actions and learning loop.',

      enabled:
        true,

      requiredPlan:
        'advanced',

      source:
        'Shopify + BigQuery',

      status:
        'connected',
    },


    {
      id:
        'product',

      name:
        'Product OS',

      description:
        'SKU performance, demand, forecasting and inventory intelligence.',

      enabled:
        true,

      requiredPlan:
        'pro',

      source:
        'Shopify + BigQuery',

      status:
        'connected',
    },


    {
      id:
        'ai',

      name:
        'AI Intelligence',

      description:
        'Cross-system reasoning, business Q&A and autonomous agents.',

      enabled:
        false,

      requiredPlan:
        'enterprise',

      source:
        'LLM + Growth OS',

      status:
        'disabled',
    },

  ],


  integrations: [

    {
      id:
        'shopify',

      name:
        'Shopify',

      status:
        'connected',

      account:
        'Brillare',

      lastSync:
        'Realtime',
    },


    {
      id:
        'bigquery',

      name:
        'Google BigQuery',

      status:
        'connected',

      account:
        'shopify-colab',

      lastSync:
        'Connected',
    },


    {
      id:
        'meta',

      name:
        'Meta Ads',

      status:
        'connected',

      account:
        'Configured',

      lastSync:
        'Data available',
    },


    {
      id:
        'google',

      name:
        'Google Ads',

      status:
        'connected',

      account:
        'Configured',

      lastSync:
        'Data available',
    },


    {
      id:
        'whatsapp',

      name:
        'WhatsApp',

      status:
        'review',

      account:
        'Not configured globally',

      lastSync:
        '—',
    },


    {
      id:
        'slack',

      name:
        'Slack',

      status:
        'not_connected',

      account:
        'Not connected',

      lastSync:
        '—',
    },

  ],


  businessRules: {

    meta: {

      targetRoas:
        0.8,

      targetCpa:
        1800,

      minSpend:
        10000,

      minPurchases:
        3,

      scalePct:
        10,

    },


    google: {

      targetRoas:
        5,

      maxCpa:
        1000,

      minClicks:
        20,

      wasteLimit:
        5000,

    },


    attribution: {

      defaultModel:
        'LAST_NON_DIRECT',

      sessionWindowMinutes:
        30,

      deterministicOnly:
        true,

      includeDirect:
        true,

    },

  },


  plan: {

    currentPlan:
      'advanced',

    billingCycle:
      'monthly',

  },

};


const STORAGE_KEY =
  'growth_os_global_settings_v1';


/* ============================================================
   SETTINGS NAVIGATION
============================================================ */

const SETTINGS_TABS: {
  name: SettingsTab;
  icon: any;
}[] = [

  {
    name:
      'General',

    icon:
      Settings2,
  },

  {
    name:
      'Tools & Modules',

    icon:
      Boxes,
  },

  {
    name:
      'Integrations',

    icon:
      PlugZap,
  },

  {
    name:
      'Business Rules',

    icon:
      SlidersHorizontal,
  },

  {
    name:
      'Data & Sync',

    icon:
      Database,
  },

  {
    name:
      'Users & Access',

    icon:
      Users,
  },

  {
    name:
      'Plans & Usage',

    icon:
      CreditCard,
  },

];


/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function GrowthSettings() {

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<SettingsTab>(
      'General'
    );


  const [
    settings,
    setSettings,
  ] =
    useState<PlatformSettings>(
      DEFAULT_SETTINGS
    );


  const [
    saved,
    setSaved,
  ] =
    useState(
      false
    );


  /* =========================================================
     LOAD LOCAL SETTINGS
  ========================================================= */

  useEffect(
    () => {

      try {

        const raw =
          window.localStorage.getItem(
            STORAGE_KEY
          );


        if (!raw) {

          return;

        }


        const parsed =
          JSON.parse(
            raw
          );


        setSettings({

          ...DEFAULT_SETTINGS,

          ...parsed,


          general: {

            ...DEFAULT_SETTINGS.general,

            ...(parsed.general || {}),

          },


          tools:

            Array.isArray(
              parsed.tools
            )

              ? parsed.tools

              : DEFAULT_SETTINGS.tools,


          integrations:

            Array.isArray(
              parsed.integrations
            )

              ? parsed.integrations

              : DEFAULT_SETTINGS.integrations,


          businessRules: {

            meta: {

              ...DEFAULT_SETTINGS.businessRules.meta,

              ...(parsed.businessRules?.meta || {}),

            },


            google: {

              ...DEFAULT_SETTINGS.businessRules.google,

              ...(parsed.businessRules?.google || {}),

            },


            attribution: {

              ...DEFAULT_SETTINGS.businessRules.attribution,

              ...(parsed.businessRules?.attribution || {}),

            },

          },


          plan: {

            ...DEFAULT_SETTINGS.plan,

            ...(parsed.plan || {}),

          },

        });


      } catch (
        error
      ) {

        console.error(
          'GLOBAL_SETTINGS_LOAD_ERROR',
          error
        );

      }

    },
    []
  );


  /* =========================================================
     SAVE SETTINGS
  ========================================================= */

  function saveSettings() {

    try {

      window.localStorage.setItem(

        STORAGE_KEY,

        JSON.stringify(
          settings
        )

      );


      /*
       * Same-browser-tab event.
       *
       * AppSidebar listens for this and updates immediately.
       */
      window.dispatchEvent(

        new CustomEvent(
          'growth-os-settings-updated',
          {
            detail:
              settings,
          }
        )

      );


      setSaved(
        true
      );


      window.setTimeout(
        () => {

          setSaved(
            false
          );

        },
        1800
      );


    } catch (
      error
    ) {

      console.error(
        'GLOBAL_SETTINGS_SAVE_ERROR',
        error
      );

    }

  }


  /* =========================================================
     TOOL UPDATE
  ========================================================= */

  function updateTool(
    id: string,
    patch: Partial<ToolConfig>
  ) {

    setSettings(
      previous => ({

        ...previous,

        tools:
          previous.tools.map(
            tool => {

              if (
                tool.id !==
                id
              ) {

                return tool;

              }


              return {

                ...tool,

                ...patch,

              };

            }
          ),

      })
    );

  }


  /* =========================================================
     UPDATE META RULE
  ========================================================= */

  function updateMetaRule(
    key:
      keyof PlatformSettings['businessRules']['meta'],
    value: number
  ) {

    setSettings(
      previous => ({

        ...previous,

        businessRules: {

          ...previous.businessRules,

          meta: {

            ...previous.businessRules.meta,

            [key]:
              value,

          },

        },

      })
    );

  }


  /* =========================================================
     UPDATE GOOGLE RULE
  ========================================================= */

  function updateGoogleRule(
    key:
      keyof PlatformSettings['businessRules']['google'],
    value: number
  ) {

    setSettings(
      previous => ({

        ...previous,

        businessRules: {

          ...previous.businessRules,

          google: {

            ...previous.businessRules.google,

            [key]:
              value,

          },

        },

      })
    );

  }


  /* =========================================================
     UI
  ========================================================= */

  return (

    <div className="space-y-5">


      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <section className="flex flex-wrap items-start justify-between gap-4">

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
            Growth OS
          </p>


          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">
            Settings
          </h1>


          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage workspace configuration, tools, integrations,
            business rules and commercial access.
          </p>

        </div>


        <button
          type="button"

          onClick={
            saveSettings
          }

          className="
            flex
            h-10
            items-center
            gap-2
            rounded-xl
            bg-slate-950
            px-4
            text-xs
            font-black
            text-white
            shadow-sm
            transition
            hover:bg-slate-800
          "
        >

          {saved ? (

            <CheckCircle2
              size={15}
            />

          ) : (

            <Save
              size={15}
            />

          )}


          {saved
            ? 'Saved'
            : 'Save Changes'}

        </button>

      </section>


      {/* =====================================================
          SETTINGS SHELL
      ===================================================== */}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">


        {/* ===================================================
            LOCAL SETTINGS NAV
        =================================================== */}

        <aside className="self-start rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">

          {SETTINGS_TABS.map(
            item => {

              const Icon =
                item.icon;


              const selected =
                activeTab ===
                item.name;


              return (

                <button
                  key={
                    item.name
                  }

                  type="button"

                  onClick={() =>
                    setActiveTab(
                      item.name
                    )
                  }

                  className={`
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-2.5
                    text-left
                    text-xs
                    font-bold
                    transition

                    ${
                      selected

                        ? `
                          bg-slate-950
                          text-white
                        `

                        : `
                          text-slate-500
                          hover:bg-slate-50
                          hover:text-slate-950
                        `
                    }
                  `}
                >

                  <Icon
                    size={15}
                  />

                  {item.name}

                </button>

              );

            }
          )}

        </aside>


        {/* ===================================================
            CONTENT
        =================================================== */}

        <div className="min-w-0">


          {/* =================================================
              GENERAL
          ================================================= */}

          {activeTab ===
            'General' && (

            <SettingsPanel
              title="General"
              description="Workspace-wide settings used across Growth OS."
            >

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">


                <Field
                  label="Workspace Name"
                >

                  <input

                    value={
                      settings.general.workspaceName
                    }

                    onChange={
                      event => {

                        const value =
                          event.target.value;


                        setSettings(
                          previous => ({

                            ...previous,

                            general: {

                              ...previous.general,

                              workspaceName:
                                value,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  />

                </Field>


                <Field
                  label="Store Domain"
                >

                  <input

                    value={
                      settings.general.storeDomain
                    }

                    onChange={
                      event => {

                        const value =
                          event.target.value;


                        setSettings(
                          previous => ({

                            ...previous,

                            general: {

                              ...previous.general,

                              storeDomain:
                                value,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  />

                </Field>


                <Field
                  label="Currency"
                >

                  <select

                    value={
                      settings.general.currency
                    }

                    onChange={
                      event => {

                        const value =
                          event.target.value;


                        setSettings(
                          previous => ({

                            ...previous,

                            general: {

                              ...previous.general,

                              currency:
                                value,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  >

                    <option value="INR">
                      INR — Indian Rupee
                    </option>

                    <option value="USD">
                      USD — US Dollar
                    </option>

                    <option value="GBP">
                      GBP — Pound
                    </option>

                    <option value="EUR">
                      EUR — Euro
                    </option>

                  </select>

                </Field>


                <Field
                  label="Timezone"
                >

                  <select

                    value={
                      settings.general.timezone
                    }

                    onChange={
                      event => {

                        const value =
                          event.target.value;


                        setSettings(
                          previous => ({

                            ...previous,

                            general: {

                              ...previous.general,

                              timezone:
                                value,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  >

                    <option value="Asia/Kolkata">
                      Asia/Kolkata
                    </option>

                    <option value="UTC">
                      UTC
                    </option>

                    <option value="America/New_York">
                      America/New York
                    </option>

                    <option value="Europe/London">
                      Europe/London
                    </option>

                  </select>

                </Field>


                <Field
                  label="Financial Year Starts"
                >

                  <select

                    value={
                      settings.general.financialYearStart
                    }

                    onChange={
                      event => {

                        const value =
                          event.target.value;


                        setSettings(
                          previous => ({

                            ...previous,

                            general: {

                              ...previous.general,

                              financialYearStart:
                                value,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  >

                    <option value="January">
                      January
                    </option>

                    <option value="April">
                      April
                    </option>

                    <option value="July">
                      July
                    </option>

                    <option value="October">
                      October
                    </option>

                  </select>

                </Field>


                <Field
                  label="Default Date Range"
                >

                  <select

                    value={
                      settings.general.defaultDateRange
                    }

                    onChange={
                      event => {

                        const value =
                          event.target.value;


                        setSettings(
                          previous => ({

                            ...previous,

                            general: {

                              ...previous.general,

                              defaultDateRange:
                                value,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  >

                    <option value="Yesterday">
                      Yesterday
                    </option>

                    <option value="Last 7 Days">
                      Last 7 Days
                    </option>

                    <option value="Last 14 Days">
                      Last 14 Days
                    </option>

                    <option value="Last 30 Days">
                      Last 30 Days
                    </option>

                    <option value="Month to Date">
                      Month to Date
                    </option>

                  </select>

                </Field>


              </div>

            </SettingsPanel>

          )}


          {/* =================================================
              TOOLS & MODULES
          ================================================= */}

          {activeTab ===
            'Tools & Modules' && (

            <SettingsPanel
              title="Tools & Modules"
              description="Control which operating systems are available and which plan unlocks them."
            >

              <div className="space-y-3">

                {settings.tools.map(
                  tool => (

                    <div
                      key={
                        tool.id
                      }

                      className="
                        grid
                        grid-cols-1
                        gap-4
                        rounded-2xl
                        border
                        border-slate-200
                        p-4
                        lg:grid-cols-[minmax(0,1.4fr)_180px_150px_100px]
                        lg:items-center
                      "
                    >


                      <div>

                        <div className="flex items-center gap-2">

                          <h3 className="text-sm font-black text-slate-950">
                            {tool.name}
                          </h3>


                          <StatusBadge
                            status={
                              tool.status
                            }
                          />

                        </div>


                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {tool.description}
                        </p>


                        <p className="mt-2 text-[10px] font-semibold text-slate-400">
                          {tool.source}
                        </p>

                      </div>


                      <Field
                        label="Required Plan"
                      >

                        <select

                          value={
                            tool.requiredPlan
                          }

                          onChange={
                            event => {

                              const nextPlan =
                                parsePlan(
                                  event.target.value
                                );


                              updateTool(
                                tool.id,
                                {
                                  requiredPlan:
                                    nextPlan,
                                }
                              );

                            }
                          }

                          className={
                            inputClass
                          }

                        >

                          <option value="starter">
                            Starter
                          </option>

                          <option value="pro">
                            Pro
                          </option>

                          <option value="advanced">
                            Advanced
                          </option>

                          <option value="enterprise">
                            Enterprise
                          </option>

                        </select>

                      </Field>


                      <div>

                        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                          Availability
                        </p>


                        <span className="text-xs font-bold text-slate-600">

                          {tool.enabled
                            ? 'Enabled'
                            : 'Disabled'}

                        </span>

                      </div>


                      <div className="flex justify-end">

                        <Toggle

                          checked={
                            tool.enabled
                          }

                          onChange={
                            value => {

                              updateTool(
                                tool.id,
                                {

                                  enabled:
                                    value,

                                  status:
                                    value
                                      ? 'connected'
                                      : 'disabled',

                                }
                              );

                            }
                          }

                        />

                      </div>

                    </div>

                  )
                )}

              </div>

            </SettingsPanel>

          )}


          {/* =================================================
              INTEGRATIONS
          ================================================= */}

          {activeTab ===
            'Integrations' && (

            <SettingsPanel
              title="Integrations"
              description="Manage external platforms and Growth OS data connections."
            >

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                {settings.integrations.map(
                  integration => (

                    <div
                      key={
                        integration.id
                      }

                      className="rounded-2xl border border-slate-200 p-5"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">

                            <PlugZap
                              size={16}
                            />

                          </div>


                          <h3 className="mt-4 text-sm font-black text-slate-950">
                            {integration.name}
                          </h3>


                          <p className="mt-1 text-xs text-slate-500">
                            {integration.account}
                          </p>

                        </div>


                        <StatusBadge
                          status={
                            integration.status
                          }
                        />

                      </div>


                      <div className="mt-4 border-t border-slate-100 pt-4">

                        <div className="flex items-center justify-between">

                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            Last Sync
                          </span>


                          <span className="text-xs font-semibold text-slate-700">
                            {integration.lastSync}
                          </span>

                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            </SettingsPanel>

          )}


          {/* =================================================
              BUSINESS RULES
          ================================================= */}

          {activeTab ===
            'Business Rules' && (

            <div className="space-y-5">


              {/* META */}

              <SettingsPanel
                title="Meta OS Rules"
                description="Default decision thresholds used by Meta intelligence."
              >

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">

                  <NumberField

                    label="Target ROAS"

                    value={
                      settings.businessRules.meta.targetRoas
                    }

                    onChange={
                      value =>
                        updateMetaRule(
                          'targetRoas',
                          value
                        )
                    }

                  />


                  <NumberField

                    label="Target CPA"

                    value={
                      settings.businessRules.meta.targetCpa
                    }

                    onChange={
                      value =>
                        updateMetaRule(
                          'targetCpa',
                          value
                        )
                    }

                  />


                  <NumberField

                    label="Min Spend"

                    value={
                      settings.businessRules.meta.minSpend
                    }

                    onChange={
                      value =>
                        updateMetaRule(
                          'minSpend',
                          value
                        )
                    }

                  />


                  <NumberField

                    label="Min Purchases"

                    value={
                      settings.businessRules.meta.minPurchases
                    }

                    onChange={
                      value =>
                        updateMetaRule(
                          'minPurchases',
                          value
                        )
                    }

                  />


                  <NumberField

                    label="Scale %"

                    value={
                      settings.businessRules.meta.scalePct
                    }

                    onChange={
                      value =>
                        updateMetaRule(
                          'scalePct',
                          value
                        )
                    }

                  />

                </div>

              </SettingsPanel>


              {/* GOOGLE */}

              <SettingsPanel
                title="Google OS Rules"
                description="Default search and Shopping efficiency thresholds."
              >

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

                  <NumberField

                    label="Target ROAS"

                    value={
                      settings.businessRules.google.targetRoas
                    }

                    onChange={
                      value =>
                        updateGoogleRule(
                          'targetRoas',
                          value
                        )
                    }

                  />


                  <NumberField

                    label="Max CPA"

                    value={
                      settings.businessRules.google.maxCpa
                    }

                    onChange={
                      value =>
                        updateGoogleRule(
                          'maxCpa',
                          value
                        )
                    }

                  />


                  <NumberField

                    label="Minimum Clicks"

                    value={
                      settings.businessRules.google.minClicks
                    }

                    onChange={
                      value =>
                        updateGoogleRule(
                          'minClicks',
                          value
                        )
                    }

                  />


                  <NumberField

                    label="Waste Limit"

                    value={
                      settings.businessRules.google.wasteLimit
                    }

                    onChange={
                      value =>
                        updateGoogleRule(
                          'wasteLimit',
                          value
                        )
                    }

                  />

                </div>

              </SettingsPanel>


              {/* ATTRIBUTION */}

              <SettingsPanel
                title="Attribution Rules"
                description="Global defaults for deterministic attribution and journey analysis."
              >

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">


                  <Field
                    label="Default Attribution Model"
                  >

                    <select

                      value={
                        settings.businessRules.attribution.defaultModel
                      }

                      onChange={
                        event => {

                          const value =
                            event.target.value;


                          setSettings(
                            previous => ({

                              ...previous,

                              businessRules: {

                                ...previous.businessRules,

                                attribution: {

                                  ...previous.businessRules.attribution,

                                  defaultModel:
                                    value,

                                },

                              },

                            })
                          );

                        }
                      }

                      className={
                        inputClass
                      }

                    >

                      <option value="FIRST_TOUCH">
                        First Touch
                      </option>

                      <option value="LAST_TOUCH">
                        Last Touch
                      </option>

                      <option value="LAST_NON_DIRECT">
                        Last Non Direct
                      </option>

                      <option value="LINEAR">
                        Linear
                      </option>

                      <option value="POSITION_40_20_40">
                        Position 40/20/40
                      </option>

                      <option value="TIME_DECAY_7D">
                        Time Decay 7D
                      </option>

                    </select>

                  </Field>


                  <NumberField

                    label="Session Window Minutes"

                    value={
                      settings.businessRules.attribution.sessionWindowMinutes
                    }

                    onChange={
                      value =>

                        setSettings(
                          previous => ({

                            ...previous,

                            businessRules: {

                              ...previous.businessRules,

                              attribution: {

                                ...previous.businessRules.attribution,

                                sessionWindowMinutes:
                                  value,

                              },

                            },

                          })
                        )
                    }

                  />


                  <BooleanSetting

                    title="Deterministic Attribution Only"

                    description="Do not use fuzzy identity matching."

                    checked={
                      settings.businessRules.attribution.deterministicOnly
                    }

                    onChange={
                      value =>

                        setSettings(
                          previous => ({

                            ...previous,

                            businessRules: {

                              ...previous.businessRules,

                              attribution: {

                                ...previous.businessRules.attribution,

                                deterministicOnly:
                                  value,

                              },

                            },

                          })
                        )
                    }

                  />


                  <BooleanSetting

                    title="Include Direct"

                    description="Keep Direct as a visible journey channel."

                    checked={
                      settings.businessRules.attribution.includeDirect
                    }

                    onChange={
                      value =>

                        setSettings(
                          previous => ({

                            ...previous,

                            businessRules: {

                              ...previous.businessRules,

                              attribution: {

                                ...previous.businessRules.attribution,

                                includeDirect:
                                  value,

                              },

                            },

                          })
                        )
                    }

                  />

                </div>

              </SettingsPanel>

            </div>

          )}


          {/* =================================================
              DATA & SYNC
          ================================================= */}

          {activeTab ===
            'Data & Sync' && (

            <SettingsPanel
              title="Data & Sync"
              description="Operational visibility into Growth OS data pipelines."
            >

              <div className="space-y-3">

                <SyncRow
                  name="Shopify Orders"
                  mode="Realtime + Incremental"
                  schedule="Continuous"
                  status="Healthy"
                />


                <SyncRow
                  name="Meta Ads"
                  mode="Scheduled Import"
                  schedule="Daily"
                  status="Healthy"
                />


                <SyncRow
                  name="Google Ads"
                  mode="Scheduled Import"
                  schedule="Daily"
                  status="Healthy"
                />


                <SyncRow
                  name="Attribution Pixel"
                  mode="Realtime"
                  schedule="Continuous"
                  status="Healthy"
                />


                <SyncRow
                  name="Attribution Master Refresh"
                  mode="BigQuery Procedure"
                  schedule="Daily"
                  status="Review"
                />

              </div>


              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">

                <div className="flex gap-3">

                  <Database
                    size={18}
                    className="mt-0.5 text-slate-500"
                  />


                  <div>

                    <p className="text-sm font-black text-slate-900">
                      V2: live scheduler control
                    </p>


                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      This screen will later read Cloud Scheduler,
                      BigQuery refresh history and Cloud Run health
                      directly instead of static configuration.
                    </p>

                  </div>

                </div>

              </div>

            </SettingsPanel>

          )}


          {/* =================================================
              USERS & ACCESS
          ================================================= */}

          {activeTab ===
            'Users & Access' && (

            <SettingsPanel
              title="Users & Access"
              description="Role-based access control for Growth OS."
            >

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

                <RoleCard
                  title="Owner"
                  description="Full platform, billing and configuration access."
                  permissions="All tools"
                />


                <RoleCard
                  title="Admin"
                  description="Manage tools, data and business settings."
                  permissions="All tools except billing"
                />


                <RoleCard
                  title="Viewer"
                  description="Read-only reporting and intelligence."
                  permissions="Configured modules"
                />

              </div>


              <div className="mt-5 rounded-2xl bg-slate-50 p-5">

                <div className="flex gap-3">

                  <ShieldCheck
                    size={18}
                    className="text-violet-600"
                  />


                  <div>

                    <p className="text-sm font-black">
                      Authentication integration comes next
                    </p>


                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      User roles will be linked to the Shopify-installed
                      entry path and public Growth OS authentication.
                    </p>

                  </div>

                </div>

              </div>

            </SettingsPanel>

          )}


          {/* =================================================
              PLANS & USAGE
          ================================================= */}

          {activeTab ===
            'Plans & Usage' && (

            <SettingsPanel
              title="Plans & Usage"
              description="Configure Growth OS commercial plans and tool entitlements."
            >

              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">


                <Field
                  label="Current Plan"
                >

                  <select

                    value={
                      settings.plan.currentPlan
                    }

                    onChange={
                      event => {

                        const nextPlan =
                          parsePlan(
                            event.target.value
                          );


                        setSettings(
                          previous => ({

                            ...previous,

                            plan: {

                              ...previous.plan,

                              currentPlan:
                                nextPlan,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  >

                    <option value="starter">
                      Starter
                    </option>

                    <option value="pro">
                      Pro
                    </option>

                    <option value="advanced">
                      Advanced
                    </option>

                    <option value="enterprise">
                      Enterprise
                    </option>

                  </select>

                </Field>


                <Field
                  label="Billing Cycle"
                >

                  <select

                    value={
                      settings.plan.billingCycle
                    }

                    onChange={
                      event => {

                        const nextBillingCycle =
                          parseBillingCycle(
                            event.target.value
                          );


                        setSettings(
                          previous => ({

                            ...previous,

                            plan: {

                              ...previous.plan,

                              billingCycle:
                                nextBillingCycle,

                            },

                          })
                        );

                      }
                    }

                    className={
                      inputClass
                    }

                  >

                    <option value="monthly">
                      Monthly
                    </option>

                    <option value="annual">
                      Annual
                    </option>

                  </select>

                </Field>

              </div>


              {/* PLAN ENTITLEMENT TABLE */}

              <div className="overflow-hidden rounded-2xl border border-slate-200">

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[760px]">

                    <thead>

                      <tr className="bg-slate-50">

                        <th className={tableHead}>
                          Tool
                        </th>

                        <th className={tableHead}>
                          Required Plan
                        </th>

                        <th className={tableHead}>
                          Enabled
                        </th>

                        <th className={tableHead}>
                          Access
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {settings.tools.map(
                        tool => {

                          const allowed =
                            hasPlanAccess(
                              settings.plan.currentPlan,
                              tool.requiredPlan
                            );


                          return (

                            <tr
                              key={
                                tool.id
                              }

                              className="border-t border-slate-100"
                            >

                              <td className={tableCell}>

                                <strong className="text-slate-900">
                                  {tool.name}
                                </strong>

                              </td>


                              <td className={tableCell}>

                                {prettyPlan(
                                  tool.requiredPlan
                                )}

                              </td>


                              <td className={tableCell}>

                                {tool.enabled
                                  ? 'Yes'
                                  : 'No'}

                              </td>


                              <td className={tableCell}>

                                <span
                                  className={`
                                    inline-flex
                                    rounded-full
                                    px-2.5
                                    py-1
                                    text-[10px]
                                    font-black

                                    ${
                                      allowed

                                        ? 'bg-emerald-50 text-emerald-700'

                                        : 'bg-amber-50 text-amber-700'
                                    }
                                  `}
                                >

                                  {allowed
                                    ? 'Included'
                                    : 'Upgrade required'}

                                </span>

                              </td>

                            </tr>

                          );

                        }
                      )}

                    </tbody>

                  </table>

                </div>

              </div>


              {/* USAGE PLACEHOLDERS */}

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">

                <UsageCard
                  label="Orders"
                  value="Not connected"
                />


                <UsageCard
                  label="Tracked Visitors"
                  value="Not connected"
                />


                <UsageCard
                  label="AI Requests"
                  value="Not connected"
                />


                <UsageCard
                  label="Users"
                  value="Not connected"
                />

              </div>

            </SettingsPanel>

          )}

        </div>

      </section>

    </div>

  );

}


/* ============================================================
   UI CONSTANTS
============================================================ */

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100';


const tableHead =
  'px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide text-slate-400';


const tableCell =
  'px-4 py-3 text-xs text-slate-600';


/* ============================================================
   SETTINGS PANEL
============================================================ */

function SettingsPanel({
  title,
  description,
  children,
}: any) {

  return (

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="mb-5">

        <h2 className="text-base font-black tracking-[-0.025em] text-slate-950">
          {title}
        </h2>


        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>

      </div>


      {children}

    </section>

  );

}


/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  children,
}: any) {

  return (

    <label>

      <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>


      {children}

    </label>

  );

}


/* ============================================================
   NUMBER FIELD
============================================================ */

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number
  ) => void;
}) {

  return (

    <Field
      label={
        label
      }
    >

      <input

        type="number"

        value={
          value
        }

        onChange={
          event => {

            const nextValue =
              Number(
                event.target.value
              );


            onChange(
              Number.isFinite(
                nextValue
              )
                ? nextValue
                : 0
            );

          }
        }

        className={
          inputClass
        }

      />

    </Field>

  );

}


/* ============================================================
   TOGGLE
============================================================ */

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {

  return (

    <button

      type="button"

      aria-pressed={
        checked
      }

      onClick={() =>
        onChange(
          !checked
        )
      }

      className={`
        relative
        h-6
        w-11
        rounded-full
        transition

        ${
          checked
            ? 'bg-violet-600'
            : 'bg-slate-300'
        }
      `}
    >

      <span
        className={`
          absolute
          top-1
          h-4
          w-4
          rounded-full
          bg-white
          shadow
          transition-all

          ${
            checked
              ? 'left-6'
              : 'left-1'
          }
        `}
      />

    </button>

  );

}


/* ============================================================
   STATUS BADGE
============================================================ */

function StatusBadge({
  status,
}: {
  status: string;
}) {

  const connected =
    status ===
    'connected';


  const disabled =
    status ===
    'disabled'
    ||
    status ===
    'not_connected';


  return (

    <span
      className={`
        inline-flex
        rounded-full
        px-2.5
        py-1
        text-[9px]
        font-black
        uppercase
        tracking-wide

        ${
          connected

            ? 'bg-emerald-50 text-emerald-700'

            : disabled

              ? 'bg-slate-100 text-slate-500'

              : 'bg-amber-50 text-amber-700'
        }
      `}
    >

      {String(
        status
      ).replaceAll(
        '_',
        ' '
      )}

    </span>

  );

}


/* ============================================================
   BOOLEAN SETTING
============================================================ */

function BooleanSetting({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {

  return (

    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">

      <div>

        <p className="text-xs font-black text-slate-900">
          {title}
        </p>


        <p className="mt-1 text-[10px] text-slate-500">
          {description}
        </p>

      </div>


      <Toggle
        checked={
          checked
        }

        onChange={
          onChange
        }
      />

    </div>

  );

}


/* ============================================================
   SYNC ROW
============================================================ */

function SyncRow({
  name,
  mode,
  schedule,
  status,
}: {
  name: string;
  mode: string;
  schedule: string;
  status: string;
}) {

  return (

    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 px-4 py-3 md:grid-cols-[minmax(0,1fr)_180px_120px_90px] md:items-center">

      <div>

        <p className="text-xs font-black text-slate-900">
          {name}
        </p>


        <p className="mt-1 text-[10px] text-slate-400">
          {mode}
        </p>

      </div>


      <span className="text-xs font-semibold text-slate-600">
        {schedule}
      </span>


      <span className="text-xs font-semibold text-slate-600">
        {status}
      </span>


      <button

        type="button"

        className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-black text-slate-600 hover:bg-slate-50"

      >

        <RefreshCw
          size={11}
        />

        Run

      </button>

    </div>

  );

}


/* ============================================================
   ROLE CARD
============================================================ */

function RoleCard({
  title,
  description,
  permissions,
}: {
  title: string;
  description: string;
  permissions: string;
}) {

  return (

    <div className="rounded-2xl border border-slate-200 p-5">

      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">

        <Users
          size={16}
        />

      </div>


      <h3 className="mt-4 text-sm font-black text-slate-900">
        {title}
      </h3>


      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>


      <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {permissions}
      </p>

    </div>

  );

}


/* ============================================================
   USAGE CARD
============================================================ */

function UsageCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (

    <div className="rounded-xl bg-slate-50 p-4">

      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>


      <p className="mt-2 text-sm font-black text-slate-900">
        {value}
      </p>

    </div>

  );

}


/* ============================================================
   PARSERS

   These intentionally avoid inline "as Plan" inside JSX.
============================================================ */

function parsePlan(
  value: string
): Plan {

  if (
    value ===
    'starter'
    ||
    value ===
    'pro'
    ||
    value ===
    'advanced'
    ||
    value ===
    'enterprise'
  ) {

    return value;

  }


  return 'starter';

}


function parseBillingCycle(
  value: string
): BillingCycle {

  if (
    value ===
    'annual'
  ) {

    return 'annual';

  }


  return 'monthly';

}


/* ============================================================
   PLAN ACCESS
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


function hasPlanAccess(
  current: Plan,
  required: Plan
) {

  return (
    PLAN_ORDER[
      current
    ]
    >=
    PLAN_ORDER[
      required
    ]
  );

}


/* ============================================================
   PLAN LABEL
============================================================ */

function prettyPlan(
  value: Plan
) {

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