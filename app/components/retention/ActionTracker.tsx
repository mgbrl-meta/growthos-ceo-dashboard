'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  ReactNode,
} from 'react';


// ============================================================
// TYPES
// ============================================================

type Execution = {
  execution_id: string;

  source_execution_group_id: string;
  source_execution_group_rank: number;

  week_start_date: string;
  week_end_date: string;

  scheduled_execution_date: string;

  campaign_slot_for_day: number;

  campaign_family: string;
  lifecycle_band: string;
  communication_treatment: string;

  execution_template_key: string;
  execution_group_name: string;

  planned_audience_size: number;
  unique_dynamic_targets: number;

  avg_target_probability_90d: number;
  avg_repeat_probability_90d: number;

  avg_expected_value_90d: number;
  total_expected_value_90d: number;

  avg_reliability_score: number;
  avg_priority_score: number;

  channel: string;

  campaign_name: string;

  template_name:
    | string
    | null;

  template_version:
    | string
    | null;

  message_variant:
    | string
    | null;

  offer_variant:
    | string
    | null;

  offer_code:
    | string
    | null;

  content_variant:
    | string
    | null;

  execution_status: string;

  sent_audience_size:
    | number
    | null;

  delivered_count:
    | number
    | null;

  clicked_count:
    | number
    | null;

  converted_customers:
    | number
    | null;

  converted_orders:
    | number
    | null;

  conversion_revenue:
    | number
    | null;

  operator_notes:
    | string
    | null;
};


type AudienceMember = {
  execution_member_id: string;

  customer_key: string;

  customer_phone:
    | string
    | null;

  customer_email:
    | string
    | null;

  action_family: string;

  target_type: string;

  target_value: string;

  dynamic_target_type:
    string;

  dynamic_target_value:
    string;

  dynamic_current_basket:
    string;

  dynamic_recommended_date:
    string;

  current_order_number:
    number;

  latest_order_date:
    string;

  days_since_latest_order:
    number;

  recommended_contact_date:
    string;

  timing_source:
    string;

  weekly_timing_status:
    string;

  predicted_target_probability_90d:
    number;

  predicted_repeat_rate_90d:
    number;

  predicted_target_order_value:
    number;

  expected_target_value_90d:
    number;

  planner_priority_score:
    number;

  reliability_score:
    number;

  send_status:
    string;
};


// ============================================================
// FORMATTERS
// ============================================================

const money = (
  value: number
) =>
  `INR ${Math.round(
    Number(value || 0)
  ).toLocaleString(
    'en-IN'
  )}`;


const pct = (
  value: number
) =>
  `${(
    Number(value || 0) *
    100
  ).toFixed(2)}%`;


const humanize = (
  value:
    | string
    | null
    | undefined
) =>
  String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );


const prettyDate = (
  value:
    | string
    | null
    | undefined
) => {

  if (!value) {
    return '—';
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date
    .toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
};


// ============================================================
// COMPONENT
// ============================================================

export default function ActionTracker() {

  const [
    rows,
    setRows,
  ] =
    useState<
      Execution[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState('');


  const [
    search,
    setSearch,
  ] =
    useState('');


  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState('ALL');


  const [
    expandedExecutionId,
    setExpandedExecutionId,
  ] =
    useState<
      string | null
    >(null);


  const [
    savingExecutionId,
    setSavingExecutionId,
  ] =
    useState<
      string | null
    >(null);


  // ==========================================================
  // AUDIENCE PREVIEW
  // ==========================================================

  const [
    previewExecutionId,
    setPreviewExecutionId,
  ] =
    useState<
      string | null
    >(null);


  const [
    previewRows,
    setPreviewRows,
  ] =
    useState<
      AudienceMember[]
    >([]);


  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(false);


  const [
    previewError,
    setPreviewError,
  ] =
    useState('');


  const [
    previewTotal,
    setPreviewTotal,
  ] =
    useState(0);


  const [
    previewOffset,
    setPreviewOffset,
  ] =
    useState(0);


  const PREVIEW_LIMIT =
    50;


  // ==========================================================
  // LOAD EXECUTIONS
  // ==========================================================

  const loadExecutions =
    async () => {

      setLoading(true);

      setError('');

      try {

        const response =
          await fetch(
            '/api/retention-os/action-tracker',
            {
              cache:
                'no-store',
            }
          );


        const text =
          await response.text();


        let json: any;


        try {

          json =
            JSON.parse(
              text
            );

        } catch {

          throw new Error(
            `Action Tracker API returned invalid response: ${text.slice(
              0,
              120
            )}`
          );
        }


        if (
          !response.ok ||
          !json.ok
        ) {

          throw new Error(
            json?.error ||
              'Failed to load Action Tracker'
          );
        }


        setRows(
          Array.isArray(
            json.executions
          )
            ? json.executions
            : []
        );

      } catch (error) {

        console.error(
          'Action Tracker load error:',
          error
        );


        setRows([]);


        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load Action Tracker'
        );

      } finally {

        setLoading(false);
      }
    };


  useEffect(() => {

    loadExecutions();

  }, []);


  // ==========================================================
  // LOAD AUDIENCE
  // ==========================================================

  const loadAudience =
    async (
      executionId:
        string,

      offset = 0
    ) => {

      setPreviewExecutionId(
        executionId
      );

      setPreviewOffset(
        offset
      );

      setPreviewLoading(
        true
      );

      setPreviewError('');


      try {

        const url =
          `/api/retention-os/action-tracker/audience?executionId=${encodeURIComponent(
            executionId
          )}&limit=${PREVIEW_LIMIT}&offset=${offset}`;


        const response =
          await fetch(
            url,
            {
              cache:
                'no-store',
            }
          );


        const text =
          await response.text();


        let json:
          any;


        try {

          json =
            JSON.parse(
              text
            );

        } catch {

          throw new Error(
            `Audience API returned invalid response: ${text.slice(
              0,
              120
            )}`
          );
        }


        if (
          !response.ok ||
          !json.ok
        ) {

          throw new Error(
            json?.error ||
              'Failed to load audience'
          );
        }


        setPreviewRows(
          Array.isArray(
            json.members
          )
            ? json.members
            : []
        );


        setPreviewTotal(
          Number(
            json.pagination
              ?.totalRows || 0
          )
        );

      } catch (error) {

        console.error(
          'Audience preview error:',
          error
        );


        setPreviewRows([]);


        setPreviewError(
          error instanceof Error
            ? error.message
            : 'Failed to load audience'
        );

      } finally {

        setPreviewLoading(
          false
        );
      }
    };


  // ==========================================================
  // EDIT
  // ==========================================================

  const updateLocalField =
    (
      executionId:
        string,

      field:
        keyof Execution,

      value:
        any
    ) => {

      setRows(
        previous =>
          previous.map(
            row =>
              row.execution_id ===
              executionId

                ? {
                    ...row,

                    [field]:
                      value,
                  }

                : row
          )
      );
    };


  // ==========================================================
  // SAVE
  // ==========================================================

  const saveExecution =
    async (
      row:
        Execution,

      forcedStatus?:
        string
    ) => {

      setSavingExecutionId(
        row.execution_id
      );


      try {

        const executionStatus =
          forcedStatus ||
          row.execution_status;


        const response =
          await fetch(
            '/api/retention-os/action-tracker',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({

                  executionId:
                    row.execution_id,

                  channel:
                    row.channel ||
                    'WHATSAPP',

                  campaignName:
                    row.campaign_name ||
                    '',

                  templateName:
                    row.template_name ||
                    '',

                  templateVersion:
                    row.template_version ||
                    '',

                  messageVariant:
                    row.message_variant ||
                    '',

                  offerVariant:
                    row.offer_variant ||
                    '',

                  offerCode:
                    row.offer_code ||
                    '',

                  contentVariant:
                    row.content_variant ||
                    '',

                  operatorNotes:
                    row.operator_notes ||
                    '',

                  executionStatus,
                }),
            }
          );


        const text =
          await response.text();


        let json:
          any;


        try {

          json =
            JSON.parse(
              text
            );

        } catch {

          throw new Error(
            `Action Tracker update returned invalid response: ${text.slice(
              0,
              120
            )}`
          );
        }


        if (
          !response.ok ||
          !json.ok
        ) {

          throw new Error(
            json?.error ||
              'Failed to save execution'
          );
        }


        await loadExecutions();

      } catch (error) {

        console.error(
          'Save execution error:',
          error
        );


        alert(
          error instanceof Error
            ? error.message
            : 'Failed to save execution'
        );

      } finally {

        setSavingExecutionId(
          null
        );
      }
    };


  // ==========================================================
  // FILTER
  // ==========================================================

  const filtered =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();


      return rows.filter(
        row => {

          if (
            statusFilter !==
              'ALL' &&
            row.execution_status !==
              statusFilter
          ) {
            return false;
          }


          if (query) {

            const haystack =
              [
                row.campaign_family,

                row.lifecycle_band,

                row.communication_treatment,

                row.campaign_name,

                row.template_name,

                row.execution_status,

                row.scheduled_execution_date,
              ]
                .join(' ')
                .toLowerCase();


            if (
              !haystack.includes(
                query
              )
            ) {
              return false;
            }
          }


          return true;
        }
      );

    }, [
      rows,
      search,
      statusFilter,
    ]);


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    useMemo(() => {

      const customers =
        filtered.reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.planned_audience_size ||
                0
            ),
          0
        );


      const expectedValue =
        filtered.reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.total_expected_value_90d ||
                0
            ),
          0
        );


      return {

        executions:
          filtered.length,

        customers,

        prepared:
          filtered.filter(
            row =>
              row.execution_status ===
              'PREPARED'
          ).length,

        ready:
          filtered.filter(
            row =>
              row.execution_status ===
              'READY_TO_SEND'
          ).length,

        sent:
          filtered.filter(
            row =>
              [
                'SENT',
                'MEASURING',
                'COMPLETED',
              ].includes(
                row.execution_status
              )
          ).length,

        expectedValue,
      };

    }, [filtered]);


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">


      {/* HEADER */}

      <div className="flex items-end justify-between gap-2.5">


        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600">
            Action Tracker
          </p>


          <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.04em] text-slate-950">
            Retention Execution Queue
          </h2>


          <p className="mt-1 text-[10px] text-slate-500">
            Configure, validate, export, send and measure frozen campaign audiences.
          </p>

        </div>


        <button
          type="button"
          onClick={
            loadExecutions
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold"
        >
          Refresh
        </button>


      </div>


      {loading && (

        <p className="mt-3 text-[10px] font-bold text-blue-600">
          Loading Action Tracker...
        </p>

      )}


      {error && (

        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">
          {error}
        </div>

      )}


      {/* KPI */}

      <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">


        <Card
          label="Executions"
          value={
            summary.executions.toLocaleString(
              'en-IN'
            )
          }
        />


        <Card
          label="Customers"
          value={
            summary.customers.toLocaleString(
              'en-IN'
            )
          }
        />


        <Card
          label="Prepared"
          value={
            summary.prepared.toString()
          }
        />


        <Card
          label="Ready"
          value={
            summary.ready.toString()
          }
        />


        <Card
          label="Sent"
          value={
            summary.sent.toString()
          }
        />


        <Card
          label="Expected Value"
          value={
            money(
              summary.expectedValue
            )
          }
        />


      </div>


      {/* FILTER */}

      <div className="mt-3 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">


        <input
          value={
            search
          }
          onChange={
            event =>
              setSearch(
                event.target.value
              )
          }
          placeholder="Search campaign, lifecycle, treatment or template..."
          className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[10px] outline-none"
        />


        <select
          value={
            statusFilter
          }
          onChange={
            event =>
              setStatusFilter(
                event.target.value
              )
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold"
        >

          <option value="ALL">
            All Status
          </option>

          <option value="PREPARED">
            Prepared
          </option>

          <option value="READY_TO_SEND">
            Ready To Send
          </option>

          <option value="SENT">
            Sent
          </option>

          <option value="MEASURING">
            Measuring
          </option>

          <option value="COMPLETED">
            Completed
          </option>

        </select>


      </div>


      {/* EXECUTIONS */}

      <div className="mt-2.5 space-y-3">


        {filtered.map(
          row => {

            const expanded =
              expandedExecutionId ===
              row.execution_id;


            const saving =
              savingExecutionId ===
              row.execution_id;


            const previewOpen =
              previewExecutionId ===
              row.execution_id;


            return (

              <div
                key={
                  row.execution_id
                }
                className="overflow-hidden rounded-lg border border-slate-200"
              >


                {/* SUMMARY */}

                <div className="grid gap-3 p-4 xl:grid-cols-[60px_1.5fr_1fr_1fr_100px_120px_110px_100px] xl:items-center">


                  <div>

                    <p className="text-[8px] font-semibold uppercase text-slate-400">
                      Slot
                    </p>

                    <p className="mt-1 text-[11px] font-semibold">
                      #
                      {
                        row.campaign_slot_for_day
                      }
                    </p>

                  </div>


                  <div>

                    <p className="text-[10px] font-semibold">
                      {
                        humanize(
                          row.campaign_family
                        )
                      }
                    </p>

                    <p className="mt-1 text-[9px] text-slate-400">
                      {
                        humanize(
                          row.lifecycle_band
                        )
                      }
                      {' · '}
                      {
                        humanize(
                          row.communication_treatment
                        )
                      }
                    </p>

                  </div>


                  <div>

                    <p className="text-[8px] font-semibold uppercase text-slate-400">
                      Planned
                    </p>

                    <p className="mt-1 text-[10px] font-semibold">
                      {
                        prettyDate(
                          row.scheduled_execution_date
                        )
                      }
                    </p>

                  </div>


                  <div>

                    <p className="text-[8px] font-semibold uppercase text-slate-400">
                      Customers
                    </p>

                    <p className="mt-1 text-[11px] font-semibold">
                      {Number(
                        row.planned_audience_size ||
                          0
                      ).toLocaleString(
                        'en-IN'
                      )}
                    </p>

                    <p className="text-[8px] text-slate-400">
                      {
                        row.unique_dynamic_targets
                      }{' '}
                      targets
                    </p>

                  </div>


                  <div>

                    <p className="text-[8px] font-semibold uppercase text-slate-400">
                      Probability
                    </p>

                    <p className="mt-1 text-[10px] font-semibold">
                      {
                        pct(
                          row.avg_target_probability_90d
                        )
                      }
                    </p>

                  </div>


                  <div>

                    <p className="text-[8px] font-semibold uppercase text-slate-400">
                      Expected Value
                    </p>

                    <p className="mt-1 text-[10px] font-semibold text-blue-700">
                      {
                        money(
                          row.total_expected_value_90d
                        )
                      }
                    </p>

                  </div>


                  <div>

                    <p className="text-[8px] font-semibold uppercase text-slate-400">
                      Status
                    </p>

                    <StatusBadge
                      status={
                        row.execution_status
                      }
                    />

                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      setExpandedExecutionId(
                        expanded
                          ? null
                          : row.execution_id
                      )
                    }
                    className="rounded-xl bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
                  >
                    {
                      expanded
                        ? 'Close'
                        : 'Open'
                    }
                  </button>


                </div>


                {/* OPEN */}

                {expanded && (

                  <div className="border-t border-slate-200 bg-slate-50 p-4">


                    {/* SETUP */}

                    <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-4">


                      <Field label="Channel">

                        <select
                          value={
                            row.channel ||
                            'WHATSAPP'
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'channel',
                                event.target.value
                              )
                          }
                          className="field"
                        >

                          <option value="WHATSAPP">
                            WhatsApp
                          </option>

                          <option value="EMAIL">
                            Email
                          </option>

                          <option value="SMS">
                            SMS
                          </option>

                        </select>

                      </Field>


                      <Field label="Campaign Name">

                        <input
                          value={
                            row.campaign_name ||
                            ''
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'campaign_name',
                                event.target.value
                              )
                          }
                          className="field"
                        />

                      </Field>


                      <Field label="Template Name">

                        <input
                          value={
                            row.template_name ||
                            ''
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'template_name',
                                event.target.value
                              )
                          }
                          placeholder="Meta approved template"
                          className="field"
                        />

                      </Field>


                      <Field label="Template Version">

                        <input
                          value={
                            row.template_version ||
                            ''
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'template_version',
                                event.target.value
                              )
                          }
                          placeholder="V1"
                          className="field"
                        />

                      </Field>


                      <Field label="Message Variant">

                        <input
                          value={
                            row.message_variant ||
                            ''
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'message_variant',
                                event.target.value
                              )
                          }
                          placeholder="V1"
                          className="field"
                        />

                      </Field>


                      <Field label="Offer Variant">

                        <input
                          value={
                            row.offer_variant ||
                            ''
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'offer_variant',
                                event.target.value
                              )
                          }
                          placeholder="NO_OFFER"
                          className="field"
                        />

                      </Field>


                      <Field label="Offer Code">

                        <input
                          value={
                            row.offer_code ||
                            ''
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'offer_code',
                                event.target.value
                              )
                          }
                          placeholder="Optional"
                          className="field"
                        />

                      </Field>


                    </div>


                    <div className="mt-2.5">


                      <Field label="Operator Notes">

                        <textarea
                          value={
                            row.operator_notes ||
                            ''
                          }
                          onChange={
                            event =>
                              updateLocalField(
                                row.execution_id,
                                'operator_notes',
                                event.target.value
                              )
                          }
                          rows={3}
                          className="field textarea"
                        />

                      </Field>


                    </div>


                    {/* ACTIONS */}

                    <div className="mt-3 flex flex-wrap gap-2">


                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          saveExecution(
                            row
                          )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[10px] font-semibold"
                      >
                        Save Setup
                      </button>


                      <button
                        type="button"
                        onClick={() => {

                          if (
                            previewOpen
                          ) {

                            setPreviewExecutionId(
                              null
                            );

                            setPreviewRows([]);

                          } else {

                            loadAudience(
                              row.execution_id,
                              0
                            );
                          }
                        }}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700"
                      >
                        {
                          previewOpen
                            ? 'Hide Audience'
                            : 'Preview Audience'
                        }
                      </button>


                      <a
                        href={`/api/retention-os/action-tracker/export?executionId=${encodeURIComponent(
                          row.execution_id
                        )}`}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700"
                      >
                        Export Customers
                      </a>


                      {row.execution_status ===
                        'PREPARED' && (

                        <button
                          type="button"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            saveExecution(
                              row,
                              'READY_TO_SEND'
                            )
                          }
                          className="rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white"
                        >
                          Mark Ready
                        </button>

                      )}


                      {row.execution_status ===
                        'READY_TO_SEND' && (

                        <button
                          type="button"
                          disabled={
                            saving
                          }
                          onClick={() => {

                            if (
                              window.confirm(
                                'Mark this campaign as sent?'
                              )
                            ) {

                              saveExecution(
                                row,
                                'SENT'
                              );
                            }
                          }}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-semibold text-white"
                        >
                          Mark Sent
                        </button>

                      )}


                      {saving && (

                        <span className="px-3 py-2 text-[10px] font-semibold text-blue-600">
                          Saving...
                        </span>

                      )}


                    </div>


                    {/* AUDIENCE PREVIEW */}

                    {previewOpen && (

                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">


                        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">


                          <div>

                            <p className="text-[10px] font-semibold">
                              Frozen Audience Preview
                            </p>

                            <p className="mt-1 text-[9px] text-slate-400">
                              {
                                previewTotal.toLocaleString(
                                  'en-IN'
                                )
                              }{' '}
                              customers
                            </p>

                          </div>


                          <p className="text-[9px] font-bold text-slate-400">
                            Showing{' '}
                            {
                              Math.min(
                                previewOffset +
                                  1,
                                previewTotal
                              )
                            }
                            {' – '}
                            {
                              Math.min(
                                previewOffset +
                                  PREVIEW_LIMIT,
                                previewTotal
                              )
                            }
                          </p>


                        </div>


                        {previewLoading && (

                          <p className="p-4 text-[10px] font-bold text-blue-600">
                            Loading audience...
                          </p>

                        )}


                        {previewError && (

                          <p className="p-4 text-[10px] font-bold text-red-600">
                            {
                              previewError
                            }
                          </p>

                        )}


                        {!previewLoading &&
                          previewRows.length >
                            0 && (

                          <div className="overflow-x-auto">


                            <table className="w-full min-w-[1250px] text-left">


                              <thead className="bg-slate-50 text-[8px] font-semibold uppercase tracking-wider text-slate-400">


                                <tr>

                                  <th className="p-3">
                                    Customer
                                  </th>

                                  <th className="p-3">
                                    Phone
                                  </th>

                                  <th className="p-3">
                                    Action
                                  </th>

                                  <th className="p-3">
                                    Target Type
                                  </th>

                                  <th className="p-3">
                                    Dynamic Target
                                  </th>

                                  <th className="p-3">
                                    Order
                                  </th>

                                  <th className="p-3">
                                    Timing
                                  </th>

                                  <th className="p-3">
                                    Probability
                                  </th>

                                  <th className="p-3">
                                    EV
                                  </th>

                                  <th className="p-3">
                                    Reliability
                                  </th>

                                </tr>


                              </thead>


                              <tbody>


                                {previewRows.map(
                                  member => (

                                    <tr
                                      key={
                                        member.execution_member_id
                                      }
                                      className="border-t border-slate-100"
                                    >


                                      <td className="p-3">

                                        <p className="max-w-[180px] truncate text-[9px] font-bold">
                                          {
                                            member.customer_key
                                          }
                                        </p>

                                      </td>


                                      <td className="p-3 text-[9px] font-bold">
                                        {
                                          member.customer_phone ||
                                          '—'
                                        }
                                      </td>


                                      <td className="p-3 text-[9px] font-bold">
                                        {
                                          humanize(
                                            member.action_family
                                          )
                                        }
                                      </td>


                                      <td className="p-3">

                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold">
                                          {
                                            member.target_type
                                          }
                                        </span>

                                      </td>


                                      <td className="p-3">

                                        <p className="max-w-[240px] text-[9px] font-semibold text-blue-700">
                                          {
                                            member.dynamic_target_value ||
                                            member.target_value ||
                                            '—'
                                          }
                                        </p>

                                      </td>


                                      <td className="p-3 text-[9px] font-semibold">
                                        #
                                        {
                                          member.current_order_number
                                        }
                                      </td>


                                      <td className="p-3">

                                        <p className="text-[9px] font-semibold">
                                          {
                                            humanize(
                                              member.weekly_timing_status
                                            )
                                          }
                                        </p>

                                        <p className="mt-1 text-[8px] text-slate-400">
                                          {
                                            member.timing_source
                                          }
                                        </p>

                                      </td>


                                      <td className="p-3 text-[9px] font-semibold">
                                        {
                                          pct(
                                            member.predicted_target_probability_90d
                                          )
                                        }
                                      </td>


                                      <td className="p-3 text-[9px] font-semibold">
                                        {
                                          money(
                                            member.expected_target_value_90d
                                          )
                                        }
                                      </td>


                                      <td className="p-3 text-[9px] font-bold">
                                        {
                                          pct(
                                            member.reliability_score
                                          )
                                        }
                                      </td>


                                    </tr>

                                  )
                                )}


                              </tbody>


                            </table>


                          </div>

                        )}


                        {/* PAGINATION */}

                        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">


                          <button
                            type="button"
                            disabled={
                              previewOffset ===
                                0 ||
                              previewLoading
                            }
                            onClick={() =>
                              loadAudience(
                                row.execution_id,
                                Math.max(
                                  0,
                                  previewOffset -
                                    PREVIEW_LIMIT
                                )
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold disabled:opacity-30"
                          >
                            Previous
                          </button>


                          <span className="text-[9px] font-bold text-slate-400">

                            Page{' '}

                            {
                              Math.floor(
                                previewOffset /
                                  PREVIEW_LIMIT
                              ) + 1
                            }

                            {' of '}

                            {
                              Math.max(
                                1,
                                Math.ceil(
                                  previewTotal /
                                    PREVIEW_LIMIT
                                )
                              )
                            }

                          </span>


                          <button
                            type="button"
                            disabled={
                              previewOffset +
                                PREVIEW_LIMIT >=
                                previewTotal ||
                              previewLoading
                            }
                            onClick={() =>
                              loadAudience(
                                row.execution_id,
                                previewOffset +
                                  PREVIEW_LIMIT
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold disabled:opacity-30"
                          >
                            Next
                          </button>


                        </div>


                      </div>

                    )}


                  </div>

                )}


              </div>

            );
          }
        )}


        {filtered.length ===
          0 &&
          !loading && (

          <div className="rounded-lg border border-slate-200 p-3 text-center">

            <p className="text-[10px] font-bold text-slate-500">
              No prepared campaigns found.
            </p>

          </div>

        )}


      </div>


      <style jsx>{`
        .field {
          width: 100%;
          height: 38px;
          border: 1px solid rgb(226 232 240);
          border-radius: 10px;
          background: white;
          padding: 0 12px;
          font-size: 12px;
          outline: none;
        }

        .textarea {
          height: auto;
          padding-top: 10px;
          padding-bottom: 10px;
          resize: none;
        }
      `}</style>


    </section>

  );
}


// ============================================================
// HELPERS
// ============================================================

function Card({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (

    <div className="min-h-[82px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">

      <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-[14px] font-semibold text-slate-950">
        {value}
      </p>

    </div>

  );
}


function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {

  return (

    <label className="block">

      <span className="mb-1 block text-[8px] font-semibold uppercase text-slate-400">
        {label}
      </span>

      {children}

    </label>

  );
}


function StatusBadge({
  status,
}: {
  status: string;
}) {

  const styles:
    Record<
      string,
      string
    > = {

      PREPARED:
        'bg-blue-50 text-blue-700',

      READY_TO_SEND:
        'bg-indigo-50 text-indigo-700',

      SENT:
        'bg-emerald-50 text-emerald-700',

      MEASURING:
        'bg-amber-50 text-amber-700',

      COMPLETED:
        'bg-slate-950 text-white',

      CANCELLED:
        'bg-red-50 text-red-700',
    };


  return (

    <span
      className={`mt-1 inline-flex rounded-full px-2 py-1 text-[7px] font-semibold uppercase ${
        styles[status] ||
        'bg-slate-100 text-slate-600'
      }`}
    >
      {
        humanize(
          status
        )
      }
    </span>

  );
}
