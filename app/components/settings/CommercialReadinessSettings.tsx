'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react';


type ReadinessCheck = {
  id: string;
  category: string;
  label: string;
  status: 'pass' | 'warning' | 'pending' | 'blocker';
  detail: string;
};


type ReadinessResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  readiness?: {
    status: 'ready' | 'needs_live_qa' | 'blocked';
    checks: ReadinessCheck[];
    summary: {
      pass: number;
      warning: number;
      pending: number;
      blocker: number;
    };
  };
};


function statusClasses(
  status:
    ReadinessCheck['status']
) {

  if (
    status ===
      'pass'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (
    status ===
      'blocker'
  ) {
    return 'border-red-200 bg-red-50 text-red-800';
  }

  if (
    status ===
      'warning'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-sky-200 bg-sky-50 text-sky-800';

}


function clientCheckCopy(check: ReadinessCheck) {
  const copy: Record<string, { label: string; category: string; detail: string }> = {
    runtime_access: {
      label: 'Module Access',
      category: 'Access',
      detail: check.status === 'pass'
        ? 'Your workspace has active Growth OS module access.'
        : 'Growth OS module access still needs to be completed for this workspace.',
    },
    subscription: {
      label: 'Subscription',
      category: 'Billing',
      detail: check.status === 'pass'
        ? 'Your Growth OS subscription is active.'
        : 'Your Growth OS subscription needs attention before launch.',
    },
    workspace_owner: {
      label: 'Workspace Owner',
      category: 'Access',
      detail: check.status === 'pass'
        ? 'An active workspace owner is configured.'
        : 'An active workspace owner still needs to be configured.',
    },
    commercial_stores: {
      label: 'Account Services',
      category: 'Platform',
      detail: check.status === 'pass'
        ? 'Core account services are available.'
        : 'One or more account services still need attention.',
    },
    billing_account: {
      label: 'Billing Setup',
      category: 'Billing',
      detail: check.status === 'pass'
        ? 'Billing is active for this workspace.'
        : 'Billing setup is still being completed for this workspace.',
    },
    direct_billing_provider: {
      label: 'Direct Billing',
      category: 'Billing',
      detail: check.status === 'pass'
        ? 'Direct billing is ready.'
        : 'Direct billing setup is still in progress.',
    },
    shopify_billing_provider: {
      label: 'Shopify Billing',
      category: 'Billing',
      detail: check.status === 'pass'
        ? 'Shopify billing is ready.'
        : 'Shopify billing setup is still in progress.',
    },
    integrations: {
      label: 'Integrations',
      category: 'Connections',
      detail: check.status === 'pass'
        ? 'Connected data sources are reporting normally.'
        : 'One or more integrations still need attention or setup.',
    },
    data_retention: {
      label: 'Data Retention',
      category: 'Data',
      detail: check.status === 'pass'
        ? 'A post-closure data retention policy is configured.'
        : 'The post-closure data retention policy is still being finalized.',
    },
    live_provider_qa: {
      label: 'Final Service Checks',
      category: 'Launch',
      detail: 'Final provider and billing checks are completed by Growth OS before go-live.',
    },
  };

  return copy[check.id] || {
    label: check.label,
    category: check.category,
    detail: check.detail,
  };
}


export default function CommercialReadinessSettings() {

  const [
    response,
    setResponse,
  ] =
    useState<ReadinessResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');


  async function load() {

    try {

      setLoading(true);
      setError('');

      const result =
        await fetch(
          '/api/workspace/commercial-readiness',
          {
            cache:
              'no-store',
            credentials:
              'same-origin',
          }
        );

      const json =
        await result.json();

      if (
        !result.ok
        ||
        !json?.ok
      ) {

        throw new Error(
          json?.message
          ||
          json?.error
          ||
          'Unable to evaluate launch readiness'
        );

      }

      setResponse(
        json
      );

    } catch (
      error:
        any
    ) {

      setError(
        String(
          error?.message
          ||
          'Unable to evaluate launch readiness'
        )
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(
    () => {
      load();
    },
    []
  );


  const readiness =
    response?.readiness;


  if (loading) {

    return (
      <div className="gos-panel p-5 text-sm text-slate-500">
        Checking launch readiness...
      </div>
    );

  }


  if (
    error
    ||
    !readiness
  ) {

    return (
      <div className="gos-panel p-5">
        <p className="text-sm font-semibold text-red-700">
          {error || 'Launch readiness is unavailable.'}
        </p>

        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );

  }


  const headline =
    readiness.status ===
      'ready'
      ? 'Ready'
      : readiness.status ===
          'blocked'
        ? 'Blocked'
        : 'Needs Final Checks';


  return (

    <div className="space-y-3">

      <section className="gos-panel !p-4">

        <div className="flex items-start justify-between gap-3">

          <div className="flex items-start gap-3">

            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
              <ClipboardCheck size={16} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-slate-950">
                  Launch Readiness
                </h2>              </div>
              <p className="mt-0.5 text-[9px] text-slate-500">
                Preview the key checks that help prepare this workspace for launch.
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            title="Run checks again"
          >
            <RefreshCw size={14} />
          </button>

        </div>

      </section>


      <section className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-[9px] font-semibold text-amber-800">This readiness view is still under development.</p>
        <p className="mt-1 text-[8px] leading-4 text-amber-700">
          It is a preview of the checks Growth OS uses to prepare a workspace for go-live. Final readiness is confirmed by the Growth OS team.
        </p>
      </section>


      <section className="gos-panel !p-4">

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <div>
            <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
              Go-Live Status
            </p>
            <h3 className="mt-1 text-[20px] font-bold tracking-tight text-slate-950">
              {headline}
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-2">

            <Metric label="Pass" value={readiness.summary.pass} />
            <Metric label="Warning" value={readiness.summary.warning} />
            <Metric label="Pending" value={readiness.summary.pending} />
            <Metric label="Blocker" value={readiness.summary.blocker} />

          </div>

        </div>

        <p className="mt-3 text-[9px] leading-4 text-slate-500">
          Some final provider and billing checks are completed by Growth OS before the workspace goes live.
        </p>

      </section>


      <section className="gos-panel !p-4">

        <h3 className="gos-section-title">
          Readiness Checks
        </h3>

        <div className="mt-3 space-y-2">

          {readiness.checks.map(
            check => {

              const clientCheck =
                clientCheckCopy(check);

              return (

              <div
                key={check.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
              >

                <div
                  className={`mt-0.5 rounded-lg border p-1.5 ${statusClasses(check.status)}`}
                >
                  {check.status === 'pass'
                    ? <CheckCircle2 size={13} />
                    : <AlertCircle size={13} />}
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex flex-wrap items-center gap-2">

                    <p className="text-[10px] font-semibold text-slate-900">
                      {clientCheck.label}
                    </p>

                    <span className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold uppercase ${statusClasses(check.status)}`}>
                      {check.status}
                    </span>

                    <span className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">
                      {clientCheck.category}
                    </span>

                  </div>

                  <p className="mt-1 text-[8px] leading-4 text-slate-500">
                    {clientCheck.detail}
                  </p>

                </div>

              </div>

              );

            }
          )}

        </div>

      </section>

    </div>

  );

}


function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {

  return (
    <div className="min-w-[64px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
      <p className="text-[14px] font-bold text-slate-950">
        {value}
      </p>
      <p className="text-[7px] font-semibold uppercase text-slate-400">
        {label}
      </p>
    </div>
  );

}
