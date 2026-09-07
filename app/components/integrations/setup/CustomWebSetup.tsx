import {
  Check,
  Code2,
} from 'lucide-react';

import IntegrationSetupShell from './IntegrationSetupShell';


// ============================================================
// PROPS
// ============================================================

type Props = {

  accountName?:
    string | null;

};


// ============================================================
// CUSTOM WEBSITE SETUP
//
// Connector implementation comes later.
//
// This component proves that Growth OS setup routing itself is
// provider-agnostic.
// ============================================================

export default function CustomWebSetup({

  accountName,

}: Props) {

  return (

    <IntegrationSetupShell

      providerLabel="Custom Website"

      accountName={
        accountName
        ||
        'Website'
      }

    >


      <div
        className="
          overflow-hidden

          rounded-lg

          border
          border-slate-200
        "
      >

        <SetupRow
          label="Website registered"
          completed
        />

        <SetupRow
          label="Install Growth OS tracking script"
        />

        <SetupRow
          label="Verify browser events"
        />

        <SetupRow
          label="Verify purchase event"
          last
        />

      </div>


      <div
        className="
          mt-3

          rounded-lg

          border
          border-slate-200

          bg-slate-50

          p-3
        "
      >

        <div className="flex gap-3">

          <Code2
            size={21}
            className="mt-0.5 shrink-0 text-slate-700"
          />


          <div>

            <div className="text-[11px] font-semibold text-slate-950">
              Tracking installation
            </div>


            <p className="mt-2 text-[10px] leading-5 text-slate-500">

              Growth OS will generate a website-specific
              tracking snippet here when the Custom Website
              connector is implemented.

            </p>

          </div>

        </div>

      </div>


      <a

        href="/"

        className="
          mt-2.5

          flex
          w-full
          items-center
          justify-center

          rounded-xl

          border
          border-slate-200

          px-3
          py-2

          text-[11px]
          font-semibold
          text-slate-800

          hover:bg-slate-50
        "
      >
        Open Growth OS
      </a>


    </IntegrationSetupShell>

  );

}


// ============================================================
// ROW
// ============================================================

function SetupRow({

  label,

  completed = false,

  last = false,

}: {

  label:
    string;

  completed?:
    boolean;

  last?:
    boolean;

}) {

  return (

    <div
      className={`
        flex
        items-center
        gap-3

        px-3
        py-2

        ${
          last
            ? ''
            : 'border-b border-slate-100'
        }
      `}
    >

      <div
        className={`
          flex
          h-6
          w-6
          shrink-0
          items-center
          justify-center

          rounded-full

          ${
            completed
              ? 'bg-emerald-50 text-emerald-600'
              : 'border border-slate-200 bg-white text-slate-300'
          }
        `}
      >

        {completed && (

          <Check
            size={14}
            strokeWidth={3}
          />

        )}

      </div>


      <span className="text-[10px] font-semibold text-slate-700">
        {label}
      </span>

    </div>

  );

}
