'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';


type AuditEvent = {
  eventId: string;
  category: string;
  action: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | null;
};


type AuditResponse = {
  ok: boolean;
  error?: string;
  events?: AuditEvent[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    actors?: Array<{
      userId: string;
      email: string | null;
    }>;
    categories?: string[];
    actions?: string[];
  };
};


function dateInputValue(
  date:
    Date
) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;

}


function formatDateTime(
  value:
    string | null
) {

  if (!value) {
    return '—';
  }


  const parsed =
    new Date(value);


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }


  return parsed.toLocaleString();

}


function humanize(
  value:
    string
) {

  return value
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());

}


function prettyJson(
  value:
    unknown
) {

  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {
    return '—';
  }


  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch {
    return String(value);
  }

}


export default function AuditLogSettings() {

  const today =
    useMemo(
      () =>
        new Date(),
      []
    );


  const thirtyDaysAgo =
    useMemo(
      () => {
        const date =
          new Date(today);
        date.setDate(
          date.getDate() - 29
        );
        return date;
      },
      [today]
    );


  const [
    startDate,
    setStartDate,
  ] =
    useState(
      dateInputValue(
        thirtyDaysAgo
      )
    );


  const [
    endDate,
    setEndDate,
  ] =
    useState(
      dateInputValue(
        today
      )
    );


  const [
    actorUserId,
    setActorUserId,
  ] =
    useState('');


  const [
    category,
    setCategory,
  ] =
    useState('');


  const [
    action,
    setAction,
  ] =
    useState('');


  const [
    page,
    setPage,
  ] =
    useState(1);


  const [
    response,
    setResponse,
  ] =
    useState<AuditResponse | null>(
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
    refreshKey,
    setRefreshKey,
  ] =
    useState(0);


  useEffect(
    () => {

      let cancelled =
        false;


      async function loadAuditLog() {

        try {

          setLoading(true);
          setError('');


          const params =
            new URLSearchParams({
              start:
                startDate,
              end:
                endDate,
              page:
                String(page),
              pageSize:
                '50',
            });


          if (actorUserId) {
            params.set(
              'actorUserId',
              actorUserId
            );
          }


          if (category) {
            params.set(
              'category',
              category
            );
          }


          if (action) {
            params.set(
              'action',
              action
            );
          }


          const result =
            await fetch(
              `/api/workspace/audit-log?${params.toString()}`,
              {
                cache:
                  'no-store',
                credentials:
                  'same-origin',
              }
            );


          const json:
            AuditResponse =
              await result.json();


          if (
            !result.ok
            ||
            !json.ok
          ) {

            throw new Error(
              json.error
              ||
              'Unable to load audit log'
            );

          }


          if (!cancelled) {
            setResponse(json);
          }

        } catch (
          loadError:
            any
        ) {

          if (!cancelled) {
            setError(
              String(
                loadError?.message
                ||
                'Unable to load audit log'
              )
            );
          }

        } finally {

          if (!cancelled) {
            setLoading(false);
          }

        }

      }


      loadAuditLog();


      return () => {
        cancelled =
          true;
      };

    },
    [
      startDate,
      endDate,
      actorUserId,
      category,
      action,
      page,
      refreshKey,
    ]
  );


  const events =
    response?.events
    ||
    [];


  const pagination =
    response?.pagination;


  const filters =
    response?.filters;


  return (

    <div className="space-y-3">

      <section className="gos-panel">

        <div className="flex flex-wrap items-start justify-between gap-3">

          <div>
            <h2 className="gos-section-title">
              Audit Log
            </h2>
            <p className="gos-section-subtitle">
              Review important changes to users, access, billing and workspace settings.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setRefreshKey(
                value => value + 1
              )
            }
            disabled={loading}
            className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {loading
              ? 'Refreshing...'
              : 'Refresh'}
          </button>

        </div>


        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">

          <label className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              From
            </span>
            <input
              type="date"
              value={startDate}
              onChange={event => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              className="gos-input w-full"
            />
          </label>


          <label className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              To
            </span>
            <input
              type="date"
              value={endDate}
              onChange={event => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              className="gos-input w-full"
            />
          </label>


          <label className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              User
            </span>
            <select
              value={actorUserId}
              onChange={event => {
                setActorUserId(event.target.value);
                setPage(1);
              }}
              className="gos-input w-full"
            >
              <option value="">
                All users
              </option>
              {(filters?.actors || []).map(actor => (
                <option
                  key={actor.userId}
                  value={actor.userId}
                >
                  {actor.email || actor.userId}
                </option>
              ))}
            </select>
          </label>


          <label className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              Category
            </span>
            <select
              value={category}
              onChange={event => {
                setCategory(event.target.value);
                setPage(1);
              }}
              className="gos-input w-full"
            >
              <option value="">
                All categories
              </option>
              {(filters?.categories || []).map(value => (
                <option
                  key={value}
                  value={value}
                >
                  {humanize(value)}
                </option>
              ))}
            </select>
          </label>


          <label className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              Action
            </span>
            <select
              value={action}
              onChange={event => {
                setAction(event.target.value);
                setPage(1);
              }}
              className="gos-input w-full"
            >
              <option value="">
                All actions
              </option>
              {(filters?.actions || []).map(value => (
                <option
                  key={value}
                  value={value}
                >
                  {humanize(value)}
                </option>
              ))}
            </select>
          </label>

        </div>

      </section>


      <section className="gos-panel overflow-hidden !p-0">

        {error ? (

          <div className="p-4 text-[10px] font-semibold text-red-700">
            {error}
          </div>

        ) : loading && !response ? (

          <div className="p-4 text-[10px] text-slate-500">
            Loading audit log...
          </div>

        ) : events.length === 0 ? (

          <div className="p-4 text-[10px] text-slate-500">
            No audit events match the selected filters.
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-[980px] w-full border-collapse">

              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {[
                    'Time',
                    'Actor',
                    'Category',
                    'Action',
                    'Target',
                    'Details',
                  ].map(label => (
                    <th
                      key={label}
                      className="px-3 py-2 text-left text-[8px] font-bold uppercase tracking-wide text-slate-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>

                {events.map(event => (

                  <tr
                    key={event.eventId}
                    className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50"
                  >

                    <td className="whitespace-nowrap px-3 py-2.5 text-[9px] text-slate-600">
                      {formatDateTime(event.createdAt)}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="text-[9px] font-semibold text-slate-900">
                        {event.actorEmail || event.actorUserId || 'System'}
                      </div>
                      {event.actorRole && (
                        <div className="mt-0.5 text-[8px] text-slate-400">
                          {humanize(event.actorRole)}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-semibold text-slate-600">
                        {humanize(event.category)}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-[9px] font-semibold text-slate-800">
                      {humanize(event.action)}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="text-[9px] font-semibold text-slate-800">
                        {event.targetLabel || event.targetId || '—'}
                      </div>
                      {event.targetType && (
                        <div className="mt-0.5 text-[8px] text-slate-400">
                          {humanize(event.targetType)}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <details className="max-w-[360px]">
                        <summary className="cursor-pointer text-[9px] font-semibold text-violet-700">
                          View changes
                        </summary>
                        <div className="mt-2 space-y-2">

                          {event.before !== null && (
                            <div>
                              <div className="text-[8px] font-bold uppercase text-slate-400">
                                Before
                              </div>
                              <pre className="mt-1 max-h-40 overflow-auto rounded-[6px] bg-slate-950 p-2 text-[8px] text-slate-100">
                                {prettyJson(event.before)}
                              </pre>
                            </div>
                          )}

                          {event.after !== null && (
                            <div>
                              <div className="text-[8px] font-bold uppercase text-slate-400">
                                After
                              </div>
                              <pre className="mt-1 max-h-40 overflow-auto rounded-[6px] bg-slate-950 p-2 text-[8px] text-slate-100">
                                {prettyJson(event.after)}
                              </pre>
                            </div>
                          )}

                        </div>
                      </details>
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}


        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">

          <div className="text-[9px] text-slate-400">
            {pagination
              ? `${pagination.total} events · Page ${pagination.page} of ${pagination.totalPages}`
              : 'Audit events'}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!pagination || pagination.page <= 1 || loading}
              onClick={() =>
                setPage(value => Math.max(value - 1, 1))
              }
              className="rounded-[7px] border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-semibold text-slate-600 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!pagination || pagination.page >= pagination.totalPages || loading}
              onClick={() =>
                setPage(value => value + 1)
              }
              className="rounded-[7px] border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-semibold text-slate-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>

        </div>

      </section>

    </div>

  );

}
