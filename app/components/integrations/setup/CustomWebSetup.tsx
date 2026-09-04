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

          rounded-2xl

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
          mt-6

          rounded-2xl

          border
          border-slate-200

          bg-slate-50

          p-5
        "
      >

        <div className="flex gap-3">

          <Code2
            size={21}
            className="mt-0.5 shrink-0 text-slate-700"
          />


          <div>

            <div className="text-sm font-black text-slate-950">
              Tracking installation
            </div>


            <p className="mt-2 text-xs leading-5 text-slate-500">

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
          mt-4

          flex
          w-full
          items-center
          justify-center

          rounded-xl

          border
          border-slate-200

          px-5
          py-3

          text-sm
          font-black
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

        px-4
        py-3

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


      <span className="text-xs font-semibold text-slate-700">
        {label}
      </span>

    </div>

  );

}