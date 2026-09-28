'use client';

import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Database,
  FlaskConical,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';


// ============================================================
// SHARED HELPERS
// ============================================================

async function apiJson(
  url: string,
  options?: RequestInit
) {
  const response =
    await fetch(
      url,
      {
        cache:
          'no-store',
        ...options,
      }
    );

  const raw =
    await response.text();

  let json:
    any;

  try {
    json =
      JSON.parse(
        raw
      );
  } catch {
    throw new Error(
      `${url} returned ${response.status} instead of JSON`
    );
  }

  if (
    !response.ok
    ||
    !json?.ok
  ) {
    throw new Error(
      json?.error
      ||
      `Request failed (${response.status})`
    );
  }

  return json.data;
}

function numberValue(
  value: unknown
) {
  const numeric =
    Number(
      value
      ??
      0
    );

  return Number.isFinite(
    numeric
  )
    ? numeric
    : 0;
}

function dateTime(
  value: unknown
) {
  if (
    value === null
    ||
    value === undefined
    ||
    value === ''
  ) {
    return '\u2014';
  }

  let normalized: unknown =
    value;

  if (
    typeof value ===
      'object'
    &&
    value !== null
    &&
    'value' in value
  ) {
    normalized =
      (
        value as {
          value?: unknown;
        }
      ).value;
  }

  if (
    normalized === null
    ||
    normalized === undefined
    ||
    normalized === ''
  ) {
    return '\u2014';
  }

  const parsed =
    new Date(
      String(
        normalized
      )
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(
      normalized
    );
  }

  return parsed.toLocaleString();
}

function StatusPill({
  value,
}: {
  value: unknown;
}) {
  const status =
    String(
      value
      ||
      'UNKNOWN'
    )
      .trim()
      .toUpperCase();

  const classes =
    status === 'SUCCESS'
    ||
    status === 'ACTIVE'
    ||
    status === 'CONNECTED'
      ?
        'border-emerald-200 bg-emerald-50 text-emerald-700'
      :
    status === 'PENDING'
      ?
        'border-blue-200 bg-blue-50 text-blue-700'
      :
    status === 'RETRY'
      ?
        'border-amber-200 bg-amber-50 text-amber-700'
      :
        'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-semibold ${classes}`}>
      {status}
    </span>
  );
}

function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: unknown;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold text-slate-950">
        {String(value ?? 0)}
      </div>
      {note && (
        <div className="mt-1 text-[8px] leading-4 text-slate-400">
          {note}
        </div>
      )}
    </div>
  );
}

function PageError({
  error,
}: {
  error: string;
}) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-medium text-rose-700">
      {error}
    </div>
  );
}


// ============================================================
// OVERVIEW
// ============================================================

export function MetaEventsOverview() {
  const [
    data,
    setData,
  ] =
    useState<any>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const load =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ''
          );

          setData(
            await apiJson(
              '/api/meta-events/overview'
            )
          );
        } catch (
          error: any
        ) {
          setError(
            error?.message
            ||
            'Unable to load Meta Events overview'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  const metrics =
    data?.metrics
    ||
    {};

  const total =
    numberValue(
      metrics.total
    );

  const success =
    numberValue(
      metrics.success
    );

  const successRate =
    total
      ?
        (
          success
          /
          total
          *
          100
        ).toFixed(1)
      :
        '0.0';

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-semibold text-slate-950">
            Shared outbound event engine
          </div>
          <div className="mt-1 max-w-2xl text-[9px] leading-5 text-slate-500">
            Call Commerce, Shopify and future Growth OS sources publish canonical signals here. Rules decide what Meta receives; the worker handles deduplication, delivery and retries.
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600"
        >
          <RefreshCw
            size={12}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      <PageError
        error={error}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card
          label="Events"
          value={total}
        />
        <Card
          label="Success"
          value={success}
        />
        <Card
          label="Pending"
          value={numberValue(metrics.pending)}
        />
        <Card
          label="Retry"
          value={numberValue(metrics.retry)}
        />
        <Card
          label="Failed"
          value={numberValue(metrics.failed)}
        />
        <Card
          label="Success rate"
          value={`${successRate}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-950">
            Source activity
          </div>
          <div className="mt-1 text-[8px] text-slate-400">
            Latest canonical signals accepted by Meta Events.
          </div>

          <div className="mt-4 space-y-2">
            {(data?.sources || []).map(
              (row: any) => (
                <div
                  key={String(row.source)}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[9px] font-semibold text-slate-800">
                      {row.label || row.source}
                    </div>
                    <div className="mt-0.5 text-[8px] text-slate-400">
                      Last event: {dateTime(row.last_event_at)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-slate-900">
                      {numberValue(row.event_count)}
                    </div>
                    <div className="text-[7px] uppercase tracking-wide text-slate-400">
                      signals
                    </div>
                  </div>
                </div>
              )
            )}

            {!loading
              &&
              !(data?.sources || []).length
              &&
              (
                <div className="py-8 text-center text-[9px] text-slate-400">
                  No source activity yet.
                </div>
              )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-950">
            Delivery readiness
          </div>
          <div className="mt-1 text-[8px] text-slate-400">
            Rules and active Meta destinations currently available to the router.
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Card
              label="Enabled rules"
              value={numberValue(data?.rules?.enabled)}
              note={`${numberValue(data?.rules?.total)} total`}
            />
            <Card
              label="Active destinations"
              value={numberValue(data?.destinations?.active)}
              note={`${numberValue(data?.destinations?.total)} total`}
            />
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[9px] leading-5 text-slate-500">
            Latest event: <span className="font-medium text-slate-700">{dateTime(metrics.last_event_at)}</span>
            <br />
            Latest successful delivery: <span className="font-medium text-slate-700">{dateTime(metrics.last_sent_at)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}


// ============================================================
// EVENT RULES
// ============================================================

export function MetaEventsRules() {
  const [
    rows,
    setRows,
  ] =
    useState<any[]>(
      []
    );

  const [
    destinations,
    setDestinations,
  ] =
    useState<any[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const [
    updatingRuleId,
    setUpdatingRuleId,
  ] =
    useState<string>(
      ''
    );

  const [
    savingRule,
    setSavingRule,
  ] =
    useState(
      false
    );

  const [
    modalError,
    setModalError,
  ] =
    useState(
      ''
    );

  const [
    open,
    setOpen,
  ] =
    useState(
      false
    );

  const emptyForm = {
    name:
      '',
    source:
      'call_commerce',
    sourceEvent:
      'call_commerce.qualified',
    metaEventName:
      'QualifiedCallLead',
    destinationId:
      '',
    actionSource:
      'phone_call',
    priority:
      100,
  };

  const [
    form,
    setForm,
  ] =
    useState(
      emptyForm
    );

  const load =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ''
          );

          const [
            rulesResult,
            destinationsResult,
          ] =
            await Promise.allSettled([
              apiJson(
                '/api/meta-events/event-rules'
              ),
              apiJson(
                '/api/meta-events/destinations'
              ),
            ]);

          if (
            rulesResult.status ===
            'rejected'
          ) {
            throw rulesResult.reason;
          }

          const rules =
            rulesResult.value;

          setRows(
            Array.isArray(
              rules
            )
              ?
                rules
              :
                []
          );

          if (
            destinationsResult.status ===
            'fulfilled'
          ) {
            const destinationRows =
              destinationsResult.value;

            setDestinations(
              Array.isArray(
                destinationRows
              )
                ?
                  destinationRows
                :
                  []
            );
          } else {
            setDestinations(
              []
            );

            setError(
              `Event rules loaded, but destinations could not be loaded: ${
                destinationsResult.reason?.message
                ||
                'Unknown destination error'
              }`
            );
          }
        } catch (
          error: any
        ) {
          setError(
            error?.message
            ||
            'Unable to load event rules'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  const refreshRulesOnly =
    useCallback(
      async () => {
        const rules =
          await apiJson(
            `/api/meta-events/event-rules?ts=${Date.now()}`
          );

        setRows(
          Array.isArray(
            rules
          )
            ?
              rules
            :
              []
        );
      },
      []
    );

  async function post(
    body: any
  ) {
    const data =
      await apiJson(
        '/api/meta-events/event-rules',
        {
          method:
            'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body:
            JSON.stringify(
              body
            ),
        }
      );

    await refreshRulesOnly();

    return data;
  }

  function openCreateRule() {
    setModalError(
      ''
    );

    setError(
      ''
    );

    setForm(
      emptyForm
    );

    setOpen(
      true
    );
  }

  function closeCreateRule() {
    if (
      savingRule
    ) {
      return;
    }

    setOpen(
      false
    );

    setModalError(
      ''
    );

    setForm(
      emptyForm
    );
  }

  async function saveRule() {
    if (
      savingRule
    ) {
      return;
    }

    const name =
      String(
        form.name
        ||
        ''
      ).trim();

    const source =
      String(
        form.source
        ||
        ''
      ).trim();

    const sourceEvent =
      String(
        form.sourceEvent
        ||
        ''
      ).trim();

    const metaEventName =
      String(
        form.metaEventName
        ||
        ''
      ).trim();

    if (
      !name
      ||
      !source
      ||
      !sourceEvent
      ||
      !metaEventName
    ) {
      setModalError(
        'Rule name, source, source event and Meta event name are required.'
      );
      return;
    }

    try {
      setSavingRule(
        true
      );

      setModalError(
        ''
      );

      setError(
        ''
      );

      await post({
        action:
          'upsert',
        ...form,
        name,
        source,
        sourceEvent,
        metaEventName,
      });

      setOpen(
        false
      );

      setForm(
        emptyForm
      );
    } catch (
      error: any
    ) {
      setModalError(
        error?.message
        ||
        'Unable to create rule'
      );
    } finally {
      setSavingRule(
        false
      );
    }
  }

  async function toggleRule(
    row: any
  ) {
    const ruleId =
      String(
        row?.rule_id
        ||
        ''
      ).trim();

    if (
      !ruleId
      ||
      updatingRuleId
    ) {
      return;
    }

    const previousEnabled =
      Boolean(
        row?.enabled
      );

    const nextEnabled =
      !previousEnabled;

    setError(
      ''
    );

    setUpdatingRuleId(
      ruleId
    );

    setRows(
      previous =>
        previous.map(
          item =>
            item.rule_id ===
            ruleId
              ?
                {
                  ...item,
                  enabled:
                    nextEnabled,
                }
              :
                item
        )
    );

    try {
      await apiJson(
        '/api/meta-events/event-rules',
        {
          method:
            'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body:
            JSON.stringify({
              action:
                'toggle',
              ruleId,
              enabled:
                nextEnabled,
            }),
        }
      );

      try {
        await refreshRulesOnly();
      } catch (
        refreshError: any
      ) {
        setError(
          `Rule was updated, but the page could not refresh: ${
            refreshError?.message
            ||
            'Unknown refresh error'
          }`
        );
      }
    } catch (
      error: any
    ) {
      setRows(
        previous =>
          previous.map(
            item =>
              item.rule_id ===
              ruleId
                ?
                  {
                    ...item,
                    enabled:
                      previousEnabled,
                  }
                :
                  item
          )
      );

      setError(
        error?.message
        ||
        'Unable to update event rule'
      );
    } finally {
      setUpdatingRuleId(
        ''
      );
    }
  }

  async function deleteRule(
    row: any
  ) {
    const ruleId =
      String(
        row?.rule_id
        ||
        ''
      ).trim();

    if (
      !ruleId
      ||
      row?.seeded
      ||
      updatingRuleId
    ) {
      return;
    }

    if (
      !window.confirm(
        `Delete rule "${row.name}"?`
      )
    ) {
      return;
    }

    try {
      setUpdatingRuleId(
        ruleId
      );

      setError(
        ''
      );

      await post({
        action:
          'delete',
        ruleId,
      });
    } catch (
      error: any
    ) {
      setError(
        error?.message
        ||
        'Unable to delete rule'
      );
    } finally {
      setUpdatingRuleId(
        ''
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-semibold text-slate-950">
            Event routing rules
          </div>
          <div className="mt-1 text-[9px] text-slate-400">
            Source trigger {'\\u2192'} Meta event {'\\u2192'} destination.
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateRule}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
        >
          <Plus size={12} />
          New rule
        </button>
      </div>

      <PageError
        error={error}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {[
                  'Rule',
                  'Source',
                  'Trigger',
                  'Meta event',
                  'Destination',
                  'Action source',
                  'Status',
                  'Action',
                ].map(
                  label => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-[8px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map(
                row => (
                  <tr
                    key={row.rule_id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[9px] font-semibold text-slate-800">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-[9px] text-slate-500">
                      {row.source}
                    </td>
                    <td className="px-4 py-3 text-[9px] text-slate-500">
                      {row.source_event}
                    </td>
                    <td className="px-4 py-3 text-[9px] font-medium text-slate-700">
                      {row.meta_event_name}
                    </td>
                    <td className="px-4 py-3 text-[9px] text-slate-500">
                      {row.destination_name
                        ||
                        'Default destination'}
                    </td>
                    <td className="px-4 py-3 text-[9px] text-slate-500">
                      {row.action_source}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        value={
                          row.enabled
                            ?
                              'ACTIVE'
                            :
                              'DISABLED'
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            Boolean(
                              updatingRuleId
                            )
                          }
                          onClick={() => {
                            void toggleRule(
                              row
                            );
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingRuleId ===
                          row.rule_id
                            ?
                              'Updating...'
                            :
                            row.enabled
                              ?
                                'Disable'
                              :
                                'Enable'}
                        </button>

                        {row.seeded
                          ? (
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[8px] font-semibold text-slate-500">
                              Seeded
                            </span>
                          )
                          : (
                            <button
                              type="button"
                              disabled={
                                Boolean(
                                  updatingRuleId
                                )
                              }
                              onClick={() => {
                                void deleteRule(
                                  row
                                );
                              }}
                              className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[8px] font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                )
              )}

              {!rows.length
                &&
                !loading
                &&
                (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-[9px] text-slate-400"
                    >
                      No event rules configured.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/25 p-4">
          <div className="w-full max-w-[620px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-slate-950">
                  Create event rule
                </div>
                <div className="mt-1 text-[8px] text-slate-400">
                  Map one canonical Growth OS source event to a Meta event.
                </div>
              </div>
              <button
                type="button"
                disabled={savingRule}
                onClick={closeCreateRule}
                className="rounded-lg p-2 text-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[9px] font-medium text-rose-700">
                {modalError}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field
                label="Rule name"
                value={form.name}
                onChange={value => setForm(previous => ({ ...previous, name: value }))}
              />
              <SelectField
                label="Source"
                value={form.source}
                onChange={value => setForm(previous => ({ ...previous, source: value }))}
                options={[
                  ['call_commerce', 'Call Commerce'],
                  ['shopify', 'Shopify'],
                ]}
              />
              <Field
                label="Source event"
                value={form.sourceEvent}
                onChange={value => setForm(previous => ({ ...previous, sourceEvent: value }))}
              />
              <Field
                label="Meta event name"
                value={form.metaEventName}
                onChange={value => setForm(previous => ({ ...previous, metaEventName: value }))}
              />
              <SelectField
                label="Destination"
                value={form.destinationId}
                onChange={value => setForm(previous => ({ ...previous, destinationId: value }))}
                options={[
                  ['', 'Default destination'],
                  ...destinations.map(
                    row => [
                      String(row.destination_id),
                      String(row.name),
                    ] as [
                      string,
                      string,
                    ]
                  ),
                ]}
              />
              <SelectField
                label="Action source"
                value={form.actionSource}
                onChange={value => setForm(previous => ({ ...previous, actionSource: value }))}
                options={[
                  ['website', 'website'],
                  ['phone_call', 'phone_call'],
                  ['chat', 'chat'],
                  ['business_messaging', 'business_messaging'],
                  ['system_generated', 'system_generated'],
                  ['other', 'other'],
                ]}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={savingRule}
                onClick={closeCreateRule}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingRule}
                onClick={() => {
                  void saveRule();
                }}
                className="rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingRule
                  ?
                    'Saving...'
                  :
                    'Save rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// EVENT LOG
// ============================================================

export function MetaEventsEventLog() {
  const [
    rows,
    setRows,
  ] =
    useState<any[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const [
    selected,
    setSelected,
  ] =
    useState<any>(
      null
    );

  const [
    source,
    setSource,
  ] =
    useState(
      ''
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      ''
    );

  const load =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ''
          );

          const params =
            new URLSearchParams({
              limit:
                '300',
            });

          if (
            source
          ) {
            params.set(
              'source',
              source
            );
          }

          if (
            status
          ) {
            params.set(
              'status',
              status
            );
          }

          const data =
            await apiJson(
              `/api/meta-events/event-log?${params.toString()}`
            );

          setRows(
            Array.isArray(data)
              ?
                data
              :
                []
          );
        } catch (
          error: any
        ) {
          setError(
            error?.message
            ||
            'Unable to load Meta event log'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        source,
        status,
      ]
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-semibold text-slate-950">
            Event delivery log
          </div>
          <div className="mt-1 text-[8px] text-slate-400">
            One deduplicated outbox row per rule + destination delivery.
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label="Source"
            value={source}
            onChange={setSource}
            compact
            options={[
              ['', 'All sources'],
              ['call_commerce', 'Call Commerce'],
              ['shopify', 'Shopify'],
            ]}
          />

          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            compact
            options={[
              ['', 'All status'],
              ['SUCCESS', 'Success'],
              ['PENDING', 'Pending'],
              ['RETRY', 'Retry'],
              ['FAILED', 'Failed'],
            ]}
          />

          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[9px] font-semibold text-slate-600"
          >
            <RefreshCw
              size={12}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      <PageError
        error={error}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {[
                  'Created',
                  'Source',
                  'Trigger',
                  'Meta event',
                  'Status',
                  'Attempts',
                  'Event ID',
                  'Action',
                ].map(
                  label => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-[8px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map(
                row => (
                  <tr
                    key={row.outbox_id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[9px] text-slate-500">
                      {dateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-[9px] font-medium text-slate-700">
                      {row.source}
                    </td>
                    <td className="px-4 py-3 text-[9px] text-slate-500">
                      {row.source_event}
                    </td>
                    <td className="px-4 py-3 text-[9px] font-semibold text-slate-800">
                      {row.meta_event_name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        value={row.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-[9px] text-slate-500">
                      {numberValue(row.attempts)}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-[8px] text-slate-400">
                      {row.event_id}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(
                            row
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600"
                      >
                        View
                        <ChevronRight size={10} />
                      </button>
                    </td>
                  </tr>
                )
              )}

              {!rows.length
                &&
                !loading
                &&
                (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-[9px] text-slate-400"
                    >
                      No Meta events yet.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/20">
          <div className="h-full w-full max-w-[520px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <div className="text-[12px] font-semibold text-slate-950">
                  Event detail
                </div>
                <div className="mt-1 text-[8px] text-slate-400">
                  {selected.event_id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-400"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Source" value={selected.source} />
                <Detail label="Trigger" value={selected.source_event} />
                <Detail label="Meta event" value={selected.meta_event_name} />
                <Detail label="Status" value={selected.status} />
                <Detail label="Attempts" value={selected.attempts} />
                <Detail label="HTTP" value={selected.last_http_status} />
                <Detail label="Occurred" value={dateTime(selected.occurred_at)} />
                <Detail label="Sent" value={dateTime(selected.sent_at)} />
              </div>

              {selected.last_error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[9px] text-rose-700">
                  {selected.last_error}
                </div>
              )}

              <JsonBlock
                label="Hashed user data"
                value={selected.user_data}
              />

              <JsonBlock
                label="Custom data"
                value={selected.custom_data}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// DESTINATIONS
// ============================================================

export function MetaEventsDestinations() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const emptyForm = {
    name: '',
    datasetId: '',
    accessToken: '',
    testEventCode: '',
  };

  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const data = await apiJson(
        '/api/meta-events/destinations'
      );

      setRows(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error: any) {
      setError(
        error?.message
        || 'Unable to load Meta destinations'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: any) {
    return apiJson(
      '/api/meta-events/destinations',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
  }

  function openCreate() {
    setEditing(null);
    setModalError('');
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setModalError('');

    setForm({
      name: String(row?.name || ''),
      datasetId: String(row?.dataset_id || ''),
      accessToken: '',
      testEventCode: String(
        row?.test_event_code
        || ''
      ),
    });

    setOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setOpen(false);
    setEditing(null);
    setModalError('');
    setForm(emptyForm);
  }

  async function saveDestination() {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setModalError('');
      setError('');

      if (editing) {
        await post({
          action: 'update',
          destinationId:
            editing.destination_id,
          name:
            form.name,
          testEventCode:
            form.testEventCode,
        });
      } else {
        await post({
          action: 'create',
          ...form,
          isDefault: true,
        });
      }

      await load();

      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (error: any) {
      setModalError(
        error?.message
        || (
          editing
            ? 'Unable to update destination'
            : 'Unable to create destination'
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateDestination(
    body: any
  ) {
    try {
      setError('');

      await post(body);
      await load();
    } catch (error: any) {
      setError(
        error?.message
        || 'Unable to update destination'
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-semibold text-slate-950">
            Meta destinations
          </div>
          <div className="mt-1 text-[8px] text-slate-400">
            Dataset / Pixel destinations are separate from Meta Ads ad-account connections.
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
        >
          <Plus size={12} />
          Add destination
        </button>
      </div>

      <PageError error={error} />

      <div className="grid gap-3 xl:grid-cols-2">
        {rows.map(
          row => (
            <div
              key={row.destination_id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Database
                      size={14}
                      className="text-blue-600"
                    />
                    <div className="truncate text-[10px] font-semibold text-slate-900">
                      {row.name}
                    </div>
                  </div>

                  <div className="mt-2 text-[9px] text-slate-500">
                    Dataset / Pixel ID: {row.dataset_id}
                  </div>

                  <div className="mt-1 text-[8px] text-slate-400">
                    Credential: {row.has_credential ? 'stored securely' : 'missing'}
                  </div>

                  <div className="mt-1 text-[8px] text-slate-400">
                    Test mode: {row.test_event_code ? 'configured' : 'not configured'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {row.is_default && (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-semibold text-blue-700">
                      Default
                    </span>
                  )}

                  <StatusPill value={row.status} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    openEdit(row);
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600"
                >
                  Edit
                </button>

                {!row.is_default && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void updateDestination({
                          action: 'update',
                          destinationId:
                            row.destination_id,
                          isDefault: true,
                        });
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600"
                    >
                      Make default
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void updateDestination({
                          action: 'update',
                          destinationId:
                            row.destination_id,
                          enabled:
                            row.status !== 'active',
                        });
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600"
                    >
                      {row.status === 'active'
                        ? 'Disable'
                        : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete destination "${row.name}"?`
                          )
                        ) {
                          void updateDestination({
                            action: 'delete',
                            destinationId:
                              row.destination_id,
                          });
                        }
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[8px] font-semibold text-rose-600"
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  </>
                )}

                {row.is_default && (
                  <div className="ml-auto text-[8px] text-slate-400">
                    Dataset and credential are managed in Settings {'\\u2192'} Integrations
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {!rows.length
        &&
        !loading
        &&
        (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Database
              size={20}
              className="mx-auto text-slate-300"
            />
            <div className="mt-3 text-[10px] font-semibold text-slate-700">
              No Meta event destination connected
            </div>
            <div className="mt-1 text-[9px] text-slate-400">
              Connect one under Settings {'\\u2192'} Integrations {'\\u2192'} Meta Events or add a destination here.
            </div>
          </div>
        )}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/25 p-4">
          <div className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-slate-950">
                  {editing
                    ? 'Edit Meta destination'
                    : 'Add Meta destination'}
                </div>

                <div className="mt-1 text-[8px] leading-4 text-slate-400">
                  {editing?.is_default
                    ? 'The primary Dataset / Pixel ID and CAPI credential are managed by Settings -> Integrations -> Meta Events. Test mode can be controlled here.'
                    : editing
                      ? 'Update the destination label and Meta Test Event Code.'
                      : 'Add another Meta Dataset / Pixel destination and store its CAPI credential securely.'}
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[9px] font-medium text-rose-700">
                {modalError}
              </div>
            )}

            <div className="mt-5 space-y-3">
              <Field
                label="Destination name"
                value={form.name}
                onChange={
                  value =>
                    setForm(
                      previous => ({
                        ...previous,
                        name: value,
                      })
                    )
                }
              />

              {editing
                ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                        Meta Dataset / Pixel ID
                      </div>
                      <div className="mt-1 text-[9px] font-medium text-slate-700">
                        {form.datasetId || '\\u2014'}
                      </div>
                    </div>
                  )
                : (
                    <>
                      <Field
                        label="Meta Dataset / Pixel ID"
                        value={form.datasetId}
                        onChange={
                          value =>
                            setForm(
                              previous => ({
                                ...previous,
                                datasetId: value,
                              })
                            )
                        }
                      />

                      <Field
                        label="Conversions API access token"
                        value={form.accessToken}
                        onChange={
                          value =>
                            setForm(
                              previous => ({
                                ...previous,
                                accessToken: value,
                              })
                            )
                        }
                        type="password"
                      />
                    </>
                  )}

              <Field
                label="Test event code (optional)"
                value={form.testEventCode}
                onChange={
                  value =>
                    setForm(
                      previous => ({
                        ...previous,
                        testEventCode: value,
                      })
                    )
                }
              />

              {editing && (
                <div className="rounded-lg bg-blue-50 p-3 text-[8px] leading-4 text-blue-700">
                  Leave the Test Event Code blank and save to return this destination to normal production delivery.
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void saveDestination();
                }}
                className="rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save changes'
                    : 'Add destination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// SOURCES
// ============================================================

export function MetaEventsSources() {
  const [
    rows,
    setRows,
  ] =
    useState<any[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const load =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ''
          );

          const data =
            await apiJson(
              '/api/meta-events/sources'
            );

          setRows(
            Array.isArray(data)
              ?
                data
              :
                []
          );
        } catch (
          error: any
        ) {
          setError(
            error?.message
            ||
            'Unable to load Meta Events sources'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold text-slate-950">
          Event sources
        </div>
        <div className="mt-1 text-[9px] leading-5 text-slate-500">
          Source systems publish canonical business signals. They do not own Meta delivery logic.
        </div>
      </div>

      <PageError
        error={error}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        {rows.map(
          row => (
            <div
              key={row.source}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Activity size={15} />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-900">
                      {row.label}
                    </div>
                    <div className="mt-0.5 text-[8px] text-slate-400">
                      {row.source}
                    </div>
                  </div>
                </div>

                <StatusPill
                  value={
                    row.enabled
                      ?
                        'ACTIVE'
                      :
                        'DISABLED'
                  }
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Detail
                  label="Signals"
                  value={numberValue(row.event_count)}
                />
                <Detail
                  label="Last event"
                  value={dateTime(row.last_event_at)}
                />
              </div>
            </div>
          )
        )}
      </div>

      {!rows.length
        &&
        !loading
        &&
        (
          <div className="py-10 text-center text-[9px] text-slate-400">
            No sources registered.
          </div>
        )}
    </div>
  );
}


// ============================================================
// DIAGNOSTICS
// ============================================================

export function MetaEventsDiagnostics() {
  const [
    data,
    setData,
  ] =
    useState<any>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const [
    testing,
    setTesting,
  ] =
    useState(
      false
    );

  const load =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ''
          );

          setData(
            await apiJson(
              '/api/meta-events/diagnostics'
            )
          );
        } catch (
          error: any
        ) {
          setError(
            error?.message
            ||
            'Unable to load Meta Events diagnostics'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  async function sendTest() {
    try {
      setTesting(
        true
      );

      setError(
        ''
      );

      await apiJson(
        '/api/meta-events/test',
        {
          method:
            'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body:
            JSON.stringify({
              source:
                'call_commerce',
              sourceEvent:
                'call_commerce.__queue_test',
            }),
        }
      );

      window.setTimeout(
        () => {
          void load();
        },
        1500
      );
    } catch (
      error: any
    ) {
      setError(
        error?.message
        ||
        'Unable to publish Meta Events test'
      );
    } finally {
      setTesting(
        false
      );
    }
  }

  const connection =
    data?.connection
    ||
    {};

  const status =
    data?.status
    ||
    {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-semibold text-slate-950">
            Delivery diagnostics
          </div>
          <div className="mt-1 text-[8px] text-slate-400">
            Validate the connector, queue and latest worker outcomes.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={
              testing
            }
            onClick={() => {
              void sendTest();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FlaskConical size={12} />
            {testing
              ?
                'Publishing...'
              :
                'Publish queue test'}
          </button>

          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600"
          >
            <RefreshCw
              size={12}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      <PageError
        error={error}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card
          label="Connector"
          value={
            connection.connected
              ?
                'Connected'
              :
                'Not connected'
          }
        />
        <Card
          label="Success"
          value={numberValue(status.success)}
        />
        <Card
          label="Pending"
          value={numberValue(status.pending)}
        />
        <Card
          label="Retry"
          value={numberValue(status.retry)}
        />
        <Card
          label="Failed"
          value={numberValue(status.failed)}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          {connection.connected
            ?
              (
                <Check
                  size={14}
                  className="text-emerald-600"
                />
              )
            :
              (
                <Unplug
                  size={14}
                  className="text-rose-600"
                />
              )}
          <div className="text-[10px] font-semibold text-slate-900">
            Meta Events connector
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Detail
            label="Status"
            value={connection.status}
          />
          <Detail
            label="Dataset / Pixel"
            value={connection.datasetId}
          />
          <Detail
            label="Credential"
            value={
              connection.hasCredential
                ?
                  'Stored'
                :
                  'Missing'
            }
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={13}
              className="text-amber-500"
            />
            <div className="text-[10px] font-semibold text-slate-900">
              Recent delivery problems
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {(data?.errors || []).map(
            (row: any) => (
              <div
                key={row.outbox_id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_1fr_100px]"
              >
                <div>
                  <div className="text-[9px] font-semibold text-slate-700">
                    {row.meta_event_name}
                  </div>
                  <div className="mt-0.5 text-[8px] text-slate-400">
                    {row.source}
                  </div>
                </div>
                <div className="text-[8px] leading-4 text-rose-600">
                  {row.last_error || 'Delivery requires attention'}
                </div>
                <div className="text-right">
                  <StatusPill
                    value={row.status}
                  />
                </div>
              </div>
            )
          )}

          {!(data?.errors || []).length && (
            <div className="px-4 py-10 text-center text-[9px] text-slate-400">
              No retrying or failed deliveries.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// SETTINGS
// ============================================================

export function MetaEventsSettings() {
  const [
    form,
    setForm,
  ] =
    useState({
      maxAttempts:
        5,
      retryDelaySeconds:
        60,
      batchSize:
        100,
      defaultActionSource:
        'website',
    });

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const load =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ''
          );

          const data =
            await apiJson(
              '/api/meta-events/settings'
            );

          setForm({
            maxAttempts:
              numberValue(
                data.maxAttempts
              )
              ||
              5,
            retryDelaySeconds:
              numberValue(
                data.retryDelaySeconds
              )
              ||
              60,
            batchSize:
              numberValue(
                data.batchSize
              )
              ||
              100,
            defaultActionSource:
              String(
                data.defaultActionSource
                ||
                'website'
              ),
          });
        } catch (
          error: any
        ) {
          setError(
            error?.message
            ||
            'Unable to load Meta Events settings'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  async function save() {
    try {
      setSaving(
        true
      );

      setError(
        ''
      );

      const data =
        await apiJson(
          '/api/meta-events/settings',
          {
            method:
              'POST',
            headers: {
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify(
                form
              ),
          }
        );

      setForm(
        data
      );
    } catch (
      error: any
    ) {
      setError(
        error?.message
        ||
        'Unable to save Meta Events settings'
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Settings2
            size={14}
            className="text-slate-500"
          />
          <div className="text-[11px] font-semibold text-slate-950">
            Event engine settings
          </div>
        </div>
        <div className="mt-1 text-[9px] leading-5 text-slate-500">
          These are brand-level delivery defaults. Credentials remain under Settings {'\\u2192'} Integrations {'\\u2192'} Meta Events.
        </div>
      </div>

      <PageError
        error={error}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-900">
            Retry & worker
          </div>

          <div className="mt-4 grid gap-3">
            <NumberField
              label="Maximum attempts"
              value={form.maxAttempts}
              onChange={value => setForm(previous => ({ ...previous, maxAttempts: value }))}
            />
            <NumberField
              label="Retry delay (seconds)"
              value={form.retryDelaySeconds}
              onChange={value => setForm(previous => ({ ...previous, retryDelaySeconds: value }))}
            />
            <NumberField
              label="Worker batch size"
              value={form.batchSize}
              onChange={value => setForm(previous => ({ ...previous, batchSize: value }))}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-900">
            Defaults
          </div>

          <div className="mt-4">
            <SelectField
              label="Default action source"
              value={form.defaultActionSource}
              onChange={value => setForm(previous => ({ ...previous, defaultActionSource: value }))}
              options={[
                ['website', 'website'],
                ['phone_call', 'phone_call'],
                ['chat', 'chat'],
                ['business_messaging', 'business_messaging'],
                ['system_generated', 'system_generated'],
                ['other', 'other'],
              ]}
            />
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[8px] leading-4 text-slate-500">
            Standard Purchase is not automatically generated by this engine. This avoids duplicate Purchase delivery when Shopify / Meta native tracking is already active. The seeded Shopify rules use custom NewCustomerPurchase and ExistingCustomerPurchase events.
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={
            loading
            ||
            saving
          }
          onClick={() => {
            void save();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-40"
        >
          <Save size={12} />
          {saving
            ?
              'Saving...'
            :
              'Save settings'}
        </button>
      </div>
    </div>
  );
}


// ============================================================
// FIELD COMPONENTS
// ============================================================

function Field({
  label,
  value,
  onChange,
  type =
    'text',
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={
          event =>
            onChange(
              event.target.value
            )
        }
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] text-slate-800 outline-none focus:border-slate-400"
      />
    </label>
  );
}

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
    <label className="block">
      <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={
          event =>
            onChange(
              Number(
                event.target.value
              )
            )
        }
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] text-slate-800 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  compact =
    false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  options: Array<
    [
      string,
      string,
    ]
  >;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={
          event =>
            onChange(
              event.target.value
            )
        }
        className={`${compact ? 'min-w-[150px]' : 'w-full'} mt-1 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] text-slate-700 outline-none focus:border-slate-400`}
      >
        {options.map(
          option => (
            <option
              key={option[0]}
              value={option[0]}
            >
              {option[1]}
            </option>
          )
        )}
      </select>
    </label>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-[9px] font-medium text-slate-700">
        {value === null
        ||
        value === undefined
        ||
        value === ''
          ?
            '\\u2014'
          :
            String(
              value
            )}
      </div>
    </div>
  );
}

function JsonBlock({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  let display =
    value;

  if (
    typeof value ===
    'string'
  ) {
    try {
      display =
        JSON.parse(
          value
        );
    } catch {
      display =
        value;
    }
  }

  return (
    <details className="rounded-xl border border-slate-200">
      <summary className="cursor-pointer px-4 py-3 text-[9px] font-semibold text-slate-700">
        {label}
      </summary>
      <pre className="max-h-[420px] overflow-auto border-t border-slate-100 bg-slate-50 p-4 text-[8px] leading-4 text-slate-600">
        {JSON.stringify(
          display
          ??
          {},
          null,
          2
        )}
      </pre>
    </details>
  );
}
