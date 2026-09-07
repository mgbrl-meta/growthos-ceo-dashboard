import type {
  ReactNode,
} from 'react';

import {
  CheckCircle2,
} from 'lucide-react';


// ============================================================
// PROPS
// ============================================================

type Props = {

  providerLabel:
    string;

  accountName?:
    string | null;

  children:
    ReactNode;

};


// ============================================================
// GENERIC CONNECTOR SETUP SHELL
//
// Reused by:
//
// Shopify
// Custom Website
// Meta
// Google
// future connectors
// ============================================================

export default function IntegrationSetupShell({

  providerLabel,

  accountName,

  children,

}: Props) {

  return (

    <main
      className="
        flex
        min-h-screen
        items-center
        justify-center

        bg-[#f5f6f8]

        px-3
        py-10
      "
    >

      <section
        className="
          w-full
          max-w-[660px]

          rounded-xl

          border
          border-slate-200

          bg-white

          p-4

          shadow-sm
        "
      >


        {/* ==================================================
            GROWTH OS
        ================================================== */}

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center

              rounded-xl

              bg-gradient-to-br
              from-violet-500
              to-blue-500

              text-base
              font-semibold
              text-white
            "
          >
            G
          </div>


          <div>

            <div className="text-[14px] font-semibold tracking-[-0.035em] text-slate-950">
              Growth OS
            </div>

            <div className="text-[10px] text-slate-400">
              {providerLabel} Connector
            </div>

          </div>

        </div>


        {/* ==================================================
            CONNECTED
        ================================================== */}

        <div className="mt-10">

          <div className="flex items-center gap-2 text-emerald-600">

            <CheckCircle2
              size={21}
            />

            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
              Connected successfully
            </span>

          </div>


          <h1
            className="
              mt-2.5

              text-[30px]
              font-semibold
              tracking-[-0.05em]

              text-slate-950
            "
          >
            Complete your setup
          </h1>


          <p className="mt-3 text-[11px] leading-6 text-slate-500">

            {accountName
              ? `${accountName} is connected to Growth OS.`
              : `${providerLabel} is connected to Growth OS.`}

          </p>

        </div>


        {/* ==================================================
            PROVIDER-SPECIFIC CONTENT
        ================================================== */}

        <div className="mt-2.5">

          {children}

        </div>

      </section>

    </main>

  );

}
