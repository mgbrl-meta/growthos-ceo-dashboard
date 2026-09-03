'use client';

import type {
  ReactNode,
} from 'react';


// ============================================================
// PROPS
//
// Sub-navigation is controlled by AppSidebar.
// AppHeader only owns:
//
// - page identity
// - page title/subtitle
// - optional right-side actions
// ============================================================

type Props = {

  activeTab: string;

  actions?: ReactNode;

};


// ============================================================
// HEADER CONTENT
// ============================================================

const TITLES: Record<
  string,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
  }
> = {


  // ==========================================================
  // COMMAND CENTER
  // ==========================================================

  'CEO Summary': {

    eyebrow:
      'Command Center',

    title:
      'Business Overview',

    subtitle:
      'Revenue, media, customers and commerce in one place.',

  },


  // ==========================================================
  // META
  // ==========================================================

  'Meta OS': {

    eyebrow:
      'Meta OS',

    title:
      'Meta Growth Intelligence',

    subtitle:
      'Understand performance, efficiency and scaling opportunities.',

  },


  // ==========================================================
  // GOOGLE
  // ==========================================================

  'Google OS': {

    eyebrow:
      'Google OS',

    title:
      'Intent Intelligence',

    subtitle:
      'Understand how search demand converts into profitable growth.',

  },


  // ==========================================================
  // ATTRIBUTION
  // ==========================================================

  'Attribution OS': {

    eyebrow:
      'Attribution OS',

    title:
      'Customer Journey Intelligence',

    subtitle:
      'Understand the complete journey from discovery to purchase.',

  },


  // ==========================================================
  // RETENTION
  // ==========================================================

  'Retention OS': {

    eyebrow:
      'Retention OS',

    title:
      'Customer Retention Intelligence',

    subtitle:
      'Identify repeat behaviour, opportunities and next best actions.',

  },


  // ==========================================================
  // PRODUCT
  // ==========================================================

  'Product OS': {

    eyebrow:
      'Product OS',

    title:
      'Product Intelligence',

    subtitle:
      'Understand demand, inventory and SKU-level growth opportunities.',

  },


  // ==========================================================
  // APP INTEGRATIONS
  // ==========================================================

  'App Integrations': {

    eyebrow:
      'Data Sources',

    title:
      'App Integrations',

    subtitle:
      'Manage connected commerce, marketing and infrastructure platforms.',

  },


  // ==========================================================
  // DATA HEALTH
  // ==========================================================

  'Data Health': {

    eyebrow:
      'Data Sources',

    title:
      'Data Health',

    subtitle:
      'Monitor collection, ingestion, processing and data freshness.',

  },


  // ==========================================================
  // SYNC HISTORY
  // ==========================================================

  'Sync History': {

    eyebrow:
      'Data Sources',

    title:
      'Sync History',

    subtitle:
      'Review scheduled jobs, successful refreshes, failures and retries.',

  },


  // ==========================================================
  // SETTINGS
  // ==========================================================

  'Settings': {

    eyebrow:
      'Growth OS',

    title:
      'Settings',

    subtitle:
      'Configure tools, integrations, rules, access and plans.',

  },

};


// ============================================================
// APP HEADER
// ============================================================

export default function AppHeader({

  activeTab,

  actions,

}: Props) {


  const content =
    TITLES[
      activeTab
    ]
    ||
    TITLES[
      'CEO Summary'
    ];


  return (

    <header
      className="
        sticky
        top-0
        z-40

        border-b
        border-slate-200/80

        bg-white/95

        backdrop-blur-xl
      "
    >


      <div
        className="
          flex
          min-h-[72px]

          items-center
          justify-between

          gap-6

          px-6

          xl:px-8
        "
      >


        {/* ===================================================
            PAGE IDENTITY
        =================================================== */}

        <div className="min-w-0">


          <div
            className="
              text-[9px]
              font-black
              uppercase
              tracking-[0.18em]

              text-violet-600
            "
          >
            {content.eyebrow}
          </div>


          <h1
            className="
              mt-0.5

              truncate

              text-[20px]
              font-black

              tracking-[-0.035em]

              text-slate-950
            "
          >
            {content.title}
          </h1>


          <p
            className="
              mt-0.5

              hidden

              text-[11px]

              text-slate-400

              xl:block
            "
          >
            {content.subtitle}
          </p>


        </div>


        {/* ===================================================
            RIGHT-SIDE ACTIONS

            Examples:
            - date control
            - refresh
            - future contextual actions
        =================================================== */}

        {actions && (

          <div className="ml-auto shrink-0">

            {actions}

          </div>

        )}


      </div>


    </header>

  );

}