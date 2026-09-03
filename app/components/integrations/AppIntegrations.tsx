'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Database,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
  Unplug,
} from 'lucide-react';

import type {
  IntegrationProvider,
  IntegrationStatus,
} from '@/lib/integrations/types';


export default function AppIntegrations() {

  const [
    integrations,
    setIntegrations,
  ] = useState<
    IntegrationProvider[]
  >([]);


  const [
    loading,
    setLoading,
  ] = useState(
    true
  );


  const [
    error,
    setError,
  ] = useState(
    ''
  );


  const [
    selected,
    setSelected,
  ] = useState<
    IntegrationProvider | null
  >(
    null
  );


  async function load() {

    try {

      setLoading(
        true
      );


      setError(
        ''
      );


      const response =
        await fetch(
          '/api/integrations',
          {
            cache:
              'no-store',
          }
        );


      const raw =
        await response.text();


      let json: any;


      try {

        json =
          JSON.parse(
            raw
          );

      } catch {

        throw new Error(
          `Integrations API returned ${response.status} instead of JSON`
        );

      }


      if (
        !response.ok ||
        !json?.ok
      ) {

        throw new Error(
          json?.error ||
          'Unable to load integrations'
        );

      }


      setIntegrations(
        json?.data?.integrations ||
        []
      );


    } catch (
      error: any
    ) {

      console.error(
        'APP_INTEGRATIONS_UI_ERROR',
        error
      );


      setError(
        error?.message ||
        'Unable to load integrations'
      );


    } finally {

      setLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      load();

    },
    []
  );


  const connectedCount =
    useMemo(
      () =>
        integrations.filter(
          item =>
            item.status ===
            'connected'
        ).length,
      [
        integrations,
      ]
    );


  const attentionCount =
    useMemo(
      () =>
        integrations.filter(
          item =>
            [
              'needs_attention',
              'authentication_expired',
              'failed',
            ].includes(
              item.status
            )
        ).length,
      [
        integrations,
      ]
    );


  if (loading) {

    return (

      <div className="flex min-h-[500px] items-center justify-center">

        <div className="text-center">

          <RefreshCw
            size={24}
            className="mx-auto animate-spin text-slate-400"
          />

          <p className="mt-3 text-sm font-medium text-slate-400">
            Loading integrations...
          </p>

        </div>

      </div>

    );

  }


  if (error) {

    return (

      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">

        <h3 className="font-black text-red-900">
          Integrations failed to load
        </h3>

        <p className="mt-1 text-sm text-red-700">
          {error}
        </p>

        <button
          type="button"
          onClick={
            load
          }
          className="mt-4 rounded-xl bg-red-900 px-4 py-2 text-xs font-black text-white"
        >
          Retry
        </button>

      </section>

    );

  }


  return (

    <div className="space-y-6">


      {/* =====================================================
          PAGE INTRO
      ===================================================== */}

      <section className="flex flex-wrap items-end justify-between gap-4">

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
            Data Sources
          </p>


          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">
            App Integrations
          </h1>


          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Connect the platforms Growth OS uses to understand revenue,
            customers, advertising and attribution.
          </p>

        </div>


        <button
          type="button"
          onClick={
            load
          }
          className="
            flex
            h-10
            items-center
            gap-2
            rounded-xl
            border
            border-slate-200
            bg-white
            px-4
            text-xs
            font-bold
            text-slate-700
            shadow-sm
            transition
            hover:bg-slate-50
          "
        >

          <RefreshCw
            size={14}
          />

          Refresh

        </button>

      </section>


      {/* =====================================================
          STATUS
      ===================================================== */}

      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-4">

        <SummaryMetric
          label="Available Sources"
          value={
            integrations.length
          }
        />

        <SummaryMetric
          label="Connected"
          value={
            connectedCount
          }
        />

        <SummaryMetric
          label="Needs Attention"
          value={
            attentionCount
          }
        />

        <SummaryMetric
          label="Connection Health"
          value={
            attentionCount === 0
              ? 'Healthy'
              : 'Review'
          }
          last
        />

      </section>


      {/* =====================================================
          COMMERCE
      ===================================================== */}

      <IntegrationSection

        title="Commerce"

        description="Connect commerce platforms that provide orders, customers and product data."

        integrations={
          integrations.filter(
            item =>
              item.category ===
              'commerce'
          )
        }

        onSelect={
          setSelected
        }

      />


      {/* =====================================================
          ADVERTISING
      ===================================================== */}

      <IntegrationSection

        title="Advertising"

        description="Connect paid media platforms to bring campaign, creative, spend and conversion data into Growth OS."

        integrations={
          integrations.filter(
            item =>
              item.category ===
              'advertising'
          )
        }

        onSelect={
          setSelected
        }

      />


      {/* =====================================================
          WAREHOUSE
      ===================================================== */}

      <IntegrationSection

        title="Data Warehouse"

        description="Configure the analytical warehouse used by Growth OS."

        integrations={
          integrations.filter(
            item =>
              item.category ===
              'warehouse'
          )
        }

        onSelect={
          setSelected
        }

      />


      {/* =====================================================
          MANAGEMENT DRAWER / MODAL
      ===================================================== */}

      {selected && (

        <IntegrationModal

          integration={
            selected
          }

          onClose={() =>
            setSelected(
              null
            )
          }

        />

      )}

    </div>

  );

}


/* ============================================================
   SECTION
============================================================ */

function IntegrationSection({
  title,
  description,
  integrations,
  onSelect,
}: {

  title:
    string;

  description:
    string;

  integrations:
    IntegrationProvider[];

  onSelect:
    (
      integration:
        IntegrationProvider
    ) => void;

}) {

  return (

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">


      <div className="grid gap-5 border-b border-slate-100 px-5 py-5 lg:grid-cols-[360px_minmax(0,1fr)]">


        <div>

          <h2 className="text-sm font-black text-slate-950">
            {title}
          </h2>


          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            {description}
          </p>

        </div>


        <div className="space-y-3">

          {integrations.map(
            integration => (

              <IntegrationRow

                key={
                  integration.id
                }

                integration={
                  integration
                }

                onClick={() =>
                  onSelect(
                    integration
                  )
                }

              />

            )
          )}

        </div>

      </div>

    </section>

  );

}


/* ============================================================
   INTEGRATION ROW
============================================================ */

function IntegrationRow({
  integration,
  onClick,
}: {

  integration:
    IntegrationProvider;

  onClick:
    () => void;

}) {

  return (

    <button

      type="button"

      onClick={
        onClick
      }

      className="
        group
        flex
        w-full
        items-center
        gap-4
        rounded-xl
        border
        border-slate-200
        bg-white
        p-4
        text-left
        transition
        hover:border-slate-300
        hover:bg-slate-50
      "
    >


      <ProviderIcon
        id={
          integration.id
        }
      />


      <div className="min-w-0 flex-1">

        <div className="flex flex-wrap items-center gap-2">


          <p className="text-sm font-black text-slate-950">
            {integration.name}
          </p>


          <StatusBadge
            status={
              integration.status
            }
          />

        </div>


        <p className="mt-1 text-xs leading-5 text-slate-500">
          {integration.description}
        </p>


        {integration.accountName && (

          <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
            {integration.accountName}
          </p>

        )}

      </div>


      <ChevronRight
        size={17}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
      />

    </button>

  );

}


/* ============================================================
   MODAL
============================================================ */

function IntegrationModal({
  integration,
  onClose,
}: {

  integration:
    IntegrationProvider;

  onClose:
    () => void;

}) {

  const connected =
    integration.status ===
    'connected';


  return (

    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">


      <div className="w-full max-w-[620px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">


        <div className="flex items-start gap-4 border-b border-slate-100 p-6">


          <ProviderIcon
            id={
              integration.id
            }
            large
          />


          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-2">

              <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">
                {integration.name}
              </h2>

              <StatusBadge
                status={
                  integration.status
                }
              />

            </div>


            <p className="mt-1 text-sm leading-6 text-slate-500">
              {integration.description}
            </p>

          </div>


          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            ×
          </button>

        </div>


        <div className="space-y-5 p-6">


          {integration.accountName && (

            <InfoRow
              label="Account"
              value={
                integration.accountName
              }
            />

          )}


          {integration.accountId && (

            <InfoRow
              label="Account ID"
              value={
                integration.accountId
              }
            />

          )}


          <div>

            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Available Data
            </p>


            <div className="mt-3 flex flex-wrap gap-2">

              {integration.capabilities.map(
                capability => (

                  <span
                    key={
                      capability
                    }
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600"
                  >
                    {capability}
                  </span>

                )
              )}

            </div>

          </div>


          {!connected && (

            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">

              <p className="text-xs font-black text-violet-900">
                Self-service connection
              </p>

              <p className="mt-1 text-xs leading-5 text-violet-700">
                This provider will connect through Growth OS without manually configuring the dashboard.
              </p>

            </div>

          )}


          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">


            <button
              type="button"
              onClick={
                onClose
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600"
            >
              Cancel
            </button>


            {connected ? (

              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
              >
                Manage Connection

                <ExternalLink
                  size={13}
                />
              </button>

            ) : (

              <button
                type="button"

                /*
                 * OAuth connection comes in the next step.
                 */
                onClick={() => {

  if (
    integration.id ===
    'meta_ads'
  ) {

    window.location.href =
      '/api/integrations/meta/connect';

    return;

  }


  alert(
    `${integration.name} self-service connection will be added next.`
  );

}}

                className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white transition hover:bg-violet-700"
              >
                Connect {integration.shortName}
              </button>

            )}

          </div>

        </div>

      </div>

    </div>

  );

}


/* ============================================================
   PROVIDER ICON
============================================================ */

function ProviderIcon({
  id,
  large = false,
}: {

  id:
    string;

  large?:
    boolean;

}) {

  const size =
    large
      ? 'h-12 w-12'
      : 'h-10 w-10';


  if (
    id ===
    'shopify'
  ) {

    return (

      <div className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600`}>

        <ShoppingBag
          size={
            large
              ? 22
              : 18
          }
        />

      </div>

    );

  }


  if (
    id ===
    'meta_ads'
  ) {

  return (

    <div
      className={`
        flex
        ${size}
        shrink-0
        items-center
        justify-center
        rounded-xl
        bg-blue-50
        text-blue-600
      `}
    >

      <span
        className={
          large
            ? 'text-lg font-black'
            : 'text-sm font-black'
        }
      >
        M
      </span>

    </div>

  );

  }


  if (
    id ===
    'google_ads'
  ) {

    return (

      <div className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600`}>

        <span className="text-sm font-black">
          G
        </span>

      </div>

    );

  }


  return (

    <div className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600`}>

      <Database
        size={
          large
            ? 22
            : 18
        }
      />

    </div>

  );

}


/* ============================================================
   STATUS
============================================================ */

function StatusBadge({
  status,
}: {

  status:
    IntegrationStatus;

}) {

  if (
    status ===
    'connected'
  ) {

    return (

      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">

        <Check
          size={10}
        />

        Connected

      </span>

    );

  }


  if (
    status ===
    'syncing'
  ) {

    return (

      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">

        <RefreshCw
          size={10}
          className="animate-spin"
        />

        Syncing

      </span>

    );

  }


  if (
    [
      'needs_attention',
      'authentication_expired',
      'failed',
    ].includes(
      status
    )
  ) {

    return (

      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">

        <AlertTriangle
          size={10}
        />

        Needs attention

      </span>

    );

  }


  return (

    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">

      <Unplug
        size={10}
      />

      Not connected

    </span>

  );

}


/* ============================================================
   INFO
============================================================ */

function InfoRow({
  label,
  value,
}: {

  label:
    string;

  value:
    string;

}) {

  return (

    <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4">

      <span className="text-xs font-semibold text-slate-400">
        {label}
      </span>

      <strong className="max-w-[360px] text-right text-xs text-slate-800">
        {value}
      </strong>

    </div>

  );

}


/* ============================================================
   SUMMARY
============================================================ */

function SummaryMetric({
  label,
  value,
  last = false,
}: {

  label:
    string;

  value:
    string | number;

  last?:
    boolean;

}) {

  return (

    <div
      className={
        last
          ? 'p-4'
          : 'border-b border-r border-slate-200 p-4'
      }
    >

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
        {value}
      </p>

    </div>

  );

}