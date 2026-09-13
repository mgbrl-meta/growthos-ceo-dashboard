'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  AlertTriangle,
  Database,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react';


type AccountRequest = {
  requestId: string;
  requestType: 'data_export' | 'workspace_deletion';
  status: string;
  requestedByEmail: string | null;
  reason: string | null;
  requestedAt: string | null;
  updatedAt: string | null;
};


type DataAccountResponse = {
  ok: boolean;
  error?: string;
  workspace?: {
    workspaceId: string;
    brandId: string;
    dataRegion: string;
    retentionDays: number | null;
  };
  permissions?: {
    canRequestExport: boolean;
    canRequestDeletion: boolean;
  };
  security?: {
    deletionReauth: 'password' | 'verified_session';
  };
  subscription?: {
    configured: boolean;
    status: string | null;
    planName: string | null;
  };
  billing?: {
    channel: string;
    provider: string;
    status: string;
  } | null;
  requests?: AccountRequest[];
};


function formatDate(
  value:
    string | null
) {

  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();

}


function requestLabel(
  value:
    AccountRequest['requestType']
) {

  return value ===
    'data_export'
    ? 'Data Export'
    : 'Workspace Deletion';

}


function prettyValue(value: string | null | undefined) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}


function dataRegionLabel(value: string | null | undefined) {
  const region = String(value || '').trim();
  if (!region) return '—';
  if (region === 'asia-south1') return 'Mumbai, India';
  return region;
}


export default function DataAccountSettings() {

  const [
    data,
    setData,
  ] =
    useState<DataAccountResponse | null>(
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

  const [
    saving,
    setSaving,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    showDeletion,
    setShowDeletion,
  ] =
    useState(false);

  const [
    deletionConfirmation,
    setDeletionConfirmation,
  ] =
    useState('');

  const [
    currentPassword,
    setCurrentPassword,
  ] =
    useState('');

  const [
    reason,
    setReason,
  ] =
    useState('');


  async function load() {

    try {

      setLoading(true);
      setError('');

      const response =
        await fetch(
          '/api/workspace/data-account',
          {
            cache:
              'no-store',
            credentials:
              'same-origin',
          }
        );

      const json =
        await response.json();

      if (
        !response.ok
        ||
        !json?.ok
      ) {

        throw new Error(
          json?.error
          ||
          'Unable to load Data & Account'
        );

      }

      setData(
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
          'Unable to load Data & Account'
        )
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


  async function submitAction(
    action:
      'request_export'
      |
      'request_deletion'
  ) {

    if (saving) {
      return;
    }


    try {

      setSaving(
        action
      );

      setError('');
      setMessage('');


      const response =
        await fetch(
          '/api/workspace/data-account',
          {
            method:
              'POST',
            credentials:
              'same-origin',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({

                action,

                reason:
                  reason.trim()
                  ||
                  null,

                confirmation:
                  action ===
                    'request_deletion'
                    ? deletionConfirmation
                    : undefined,

                currentPassword:
                  action ===
                    'request_deletion'
                    ? currentPassword
                    : undefined,

              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok
        ||
        !json?.ok
      ) {

        const friendly:
          Record<
            string,
            string
          > = {

          OWNER_ACCESS_REQUIRED:
            'Only the workspace Owner can request deletion.',

          ACCOUNT_MANAGER_ACCESS_REQUIRED:
            'Owner or Admin access is required.',

          DELETION_CONFIRMATION_REQUIRED:
            `Type DELETE ${data?.workspace?.brandId || 'BRAND_ID'} exactly to confirm.`,

          CURRENT_PASSWORD_REQUIRED:
            'Enter your current password to confirm this request.',

          CURRENT_PASSWORD_INVALID:
            'Current password is incorrect.',

        };


        throw new Error(
          friendly[
            String(
              json?.error
              ||
              ''
            )
          ]
          ||
          json?.error
          ||
          'Unable to submit request'
        );

      }


      setMessage(
        action ===
          'request_export'
          ? 'Data export request recorded.'
          : 'Workspace deletion request recorded for controlled review.'
      );


      if (
        action ===
          'request_deletion'
      ) {

        setShowDeletion(
          false
        );

        setDeletionConfirmation(
          ''
        );

        setCurrentPassword(
          ''
        );

      }


      setReason(
        ''
      );


      await load();

    } catch (
      error:
        any
    ) {

      setError(
        String(
          error?.message
          ||
          'Unable to submit request'
        )
      );

    } finally {

      setSaving(
        ''
      );

    }

  }


  if (loading) {

    return (
      <div className="gos-panel p-5 text-sm text-slate-500">
        Loading Data & Account...
      </div>
    );

  }


  if (
    error
    &&
    !data
  ) {

    return (
      <div className="gos-panel p-5">
        <p className="text-sm font-semibold text-red-700">
          {error}
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


  const workspace =
    data?.workspace;

  const expectedConfirmation =
    `DELETE ${workspace?.brandId || ''}`;

  const requests =
    data?.requests
    ||
    [];


  return (

    <div className="space-y-3">

      <section className="gos-panel !p-4">

        <div className="flex items-start justify-between gap-3">

          <div className="flex items-start gap-3">

            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
              <Database size={16} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-slate-950">
                  Data & Account
                </h2>              </div>
              <p className="mt-0.5 text-[9px] text-slate-500">
                Review where your workspace data is hosted, request an export, or submit an account request.
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>

        </div>

      </section>


      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-semibold text-emerald-800">
          {message}
        </div>
      )}


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-800">
          {error}
        </div>
      )}


      <section className="gos-panel !p-4">

        <h3 className="gos-section-title">
          Data & Retention
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">

          <ValueCard
            label="Data Region"
            value={dataRegionLabel(workspace?.dataRegion)}
          />

          <ValueCard
            label="Retention After Workspace Closure"
            value={
              workspace?.retentionDays
                ? `${workspace.retentionDays} days`
                : 'Policy Being Finalized'
            }
          />

        </div>

        {!workspace?.retentionDays && (
          <p className="mt-3 text-[9px] text-amber-700">
            The post-closure retention policy is still being finalized and will appear here once confirmed.
          </p>
        )}

      </section>


      <section className="gos-panel !p-4">

        <div className="flex items-center justify-between gap-3">

          <div>
            <h3 className="gos-section-title">
              Data Export
            </h3>
            <p className="mt-1 text-[9px] text-slate-500">
              Request a copy of the data associated with this workspace.
            </p>
          </div>

          <button
            type="button"
            disabled={
              !data?.permissions?.canRequestExport
              ||
              Boolean(saving)
            }
            onClick={() =>
              submitAction(
                'request_export'
              )
            }
            className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            <Download size={13} />
            {saving === 'request_export'
              ? 'Requesting...'
              : 'Request Export'}
          </button>

        </div>

      </section>


      <section className="gos-panel !border-red-100 !p-4">

        <div className="flex items-start gap-3">

          <div className="rounded-xl bg-red-50 p-2.5 text-red-700">
            <AlertTriangle size={16} />
          </div>

          <div className="min-w-0 flex-1">

            <h3 className="text-[12px] font-semibold text-slate-950">
              Danger Zone
            </h3>

            <p className="mt-1 text-[9px] leading-4 text-slate-500">
              Workspace deletion is handled as a controlled request. Your workspace is not deleted immediately when you submit it.
            </p>

            {!showDeletion ? (

              <button
                type="button"
                disabled={
                  !data?.permissions?.canRequestDeletion
                }
                onClick={() =>
                  setShowDeletion(
                    true
                  )
                }
                className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 size={13} />
                Request Workspace Deletion
              </button>

            ) : (

              <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-3">

                <p className="text-[9px] font-semibold text-red-800">
                  Type <span className="font-mono">{expectedConfirmation}</span> to confirm.
                </p>

                <input
                  value={deletionConfirmation}
                  onChange={
                    event =>
                      setDeletionConfirmation(
                        event.target.value
                      )
                  }
                  className="gos-input mt-2 w-full"
                  placeholder={expectedConfirmation}
                />

                {data?.security?.deletionReauth === 'password' && (
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={
                      event =>
                        setCurrentPassword(
                          event.target.value
                        )
                    }
                    className="gos-input mt-2 w-full"
                    placeholder="Current password"
                    autoComplete="current-password"
                  />
                )}

                <textarea
                  value={reason}
                  onChange={
                    event =>
                      setReason(
                        event.target.value
                      )
                  }
                  className="gos-input mt-2 min-h-[78px] w-full"
                  placeholder="Optional reason"
                />

                <div className="mt-3 flex justify-end gap-2">

                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() =>
                      setShowDeletion(
                        false
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      Boolean(saving)
                      ||
                      deletionConfirmation !==
                        expectedConfirmation
                    }
                    onClick={() =>
                      submitAction(
                        'request_deletion'
                      )
                    }
                    className="rounded-lg bg-red-700 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40"
                  >
                    {saving === 'request_deletion'
                      ? 'Submitting...'
                      : 'Submit Deletion Request'}
                  </button>

                </div>

              </div>

            )}

          </div>

        </div>

      </section>


      <section className="gos-panel !p-4">

        <h3 className="gos-section-title">
          Recent Account Requests
        </h3>

        {requests.length === 0 ? (

          <p className="mt-3 text-[9px] text-slate-500">
            No export or deletion requests have been recorded.
          </p>

        ) : (

          <div className="mt-3 overflow-x-auto">

            <table className="w-full min-w-[680px] text-left">

              <thead>
                <tr className="border-b border-slate-100 text-[8px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">Request</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Requested By</th>
                  <th className="px-2 py-2">Requested</th>
                </tr>
              </thead>

              <tbody>

                {requests.map(
                  item => (

                    <tr
                      key={item.requestId}
                      className="border-b border-slate-100 text-[9px] text-slate-600 last:border-0"
                    >
                      <td className="px-2 py-2.5 font-semibold text-slate-900">
                        {requestLabel(item.requestType)}
                      </td>
                      <td className="px-2 py-2.5">
                        {prettyValue(item.status)}
                      </td>
                      <td className="px-2 py-2.5">
                        {item.requestedByEmail || '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        {formatDate(item.requestedAt)}
                      </td>
                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>

  );

}


function ValueCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 break-all text-[10px] font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );

}
