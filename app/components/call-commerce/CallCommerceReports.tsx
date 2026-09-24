'use client';

import {
  Activity,
  BarChart3,
  Download,
  FileSpreadsheet,
  IndianRupee,
  PhoneCall,
  RefreshCw,
  ShoppingCart,
  UserCheck,
  Users,
} from 'lucide-react';

import type {
  ReactNode,
} from 'react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  currency,
  duration,
  integer,
  percent,
} from './utils';


type ExportItem = {
  type: string;
  label: string;
  helper: string;
};


const EXPORT_GROUPS: {
  title: string;
  items: ExportItem[];
}[] = [

  {
    title:
      'Overview',

    items: [
      {
        type:
          'executive-summary',

        label:
          'Executive Summary',

        helper:
          'Top operational, funnel and revenue metrics',
      },

      {
        type:
          'commercial',

        label:
          'Commercial Funnel',

        helper:
          'Lead progression, purchases and revenue',
      },
    ],
  },


  {
    title:
      'Lead Reports',

    items: [
      {
        type:
          'active-leads',

        label:
          'Active Leads',

        helper:
          'All non-archived leads in the selected period',
      },

      {
        type:
          'archived-leads',

        label:
          'Archived Leads',

        helper:
          'Leads archived during the selected period',
      },

      {
        type:
          'all-leads',

        label:
          'All Leads',

        helper:
          'Complete lead-level dataset created in the period',
      },

      {
        type:
          'follow-up-leads',

        label:
          'Follow-up Leads',

        helper:
          'Current follow-up pipeline',
      },

      {
        type:
          'purchased-leads',

        label:
          'Purchased Leads',

        helper:
          'Orders, values and converted call leads',
      },

      {
        type:
          'unqualified-leads',

        label:
          'Unqualified Leads',

        helper:
          'Unqualified outcomes and reasons',
      },

      {
        type:
          'closed-lost-leads',

        label:
          'Closed Lost Leads',

        helper:
          'Closed-lost outcomes and reasons',
      },
    ],
  },


  {
    title:
      'Call Reports',

    items: [
      {
        type:
          'call-attempts',

        label:
          'Call Attempts',

        helper:
          'One row per CA_* call attempt with outcome evidence',
      },

      {
        type:
          'repeat-callers',

        label:
          'Repeat Callers',

        helper:
          'Leads with more than one call attempt',
      },

      {
        type:
          'call-outcomes',

        label:
          'Call Outcomes',

        helper:
          'Answered, no-answer, caller-dropped and other outcomes',
      },

      {
        type:
          'disconnect-analysis',

        label:
          'Disconnect Analysis',

        helper:
          'Disconnect party, end reason and outcome source',
      },
    ],
  },


  {
    title:
      'Team & Routing',

    items: [
      {
        type:
          'agent-performance',

        label:
          'Agent Performance',

        helper:
          'Calls, answer rate and talk-time performance by agent',
      },

      {
        type:
          'business-numbers',

        label:
          'Business Number Performance',

        helper:
          'Call volume by connected business number',
      },
    ],
  },


  {
    title:
      'Time Analysis',

    items: [
      {
        type:
          'daily-trend',

        label:
          'Daily Trend',

        helper:
          'Daily call volume, outcomes and talk-time',
      },

      {
        type:
          'hourly-performance',

        label:
          'Hourly Performance',

        helper:
          'Hour-of-day call and answer-rate performance',
      },

      {
        type:
          'lead-statuses',

        label:
          'Lead Status Breakdown',

        helper:
          'Current lead distribution by workflow status',
      },
    ],
  },


  {
    title:
      'Events & Audit',

    items: [
      {
        type:
          'events',

        label:
          'Events',

        helper:
          'Current Call Commerce outbound event queue and delivery state',
      },

      {
        type:
          'activity-log',

        label:
          'Activity Log',

        helper:
          'Lead workflow and user-action audit history',
      },
    ],
  },

];


export default function CallCommerceReports({
  start = '',
  end = '',
}: {
  start?: string;
  end?: string;
}) {

  const [
    data,
    setData,
  ] =
    useState<any>({});

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const load =
    useCallback(
      async () => {

        setLoading(
          true
        );

        try {

          const query =
            new URLSearchParams({
              start,
              end,
            });


          const response =
            await fetch(
              `/api/call-commerce/summary?${query.toString()}`,
              {
                cache:
                  'no-store',
              }
            );


          const body =
            await response.json();


          if (
            response.ok &&
            body?.ok
          ) {
            setData(
              body.data ||
                {}
            );
          }

        } finally {

          setLoading(
            false
          );
        }
      },
      [
        start,
        end,
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


  function exportUrl(
    type: string,
    format:
      | 'csv'
      | 'xlsx'
  ) {

    const query =
      new URLSearchParams({
        type,
        format,
        start,
        end,
      });


    return `/api/call-commerce/reports/export?${query.toString()}`;
  }


  function triggerExport(
    type: string,
    format:
      | 'csv'
      | 'xlsx'
  ) {

    window.location.href =
      exportUrl(
        type,
        format
      );
  }


  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">

        <div>

          <h3 className="text-[12px] font-semibold text-slate-950">
            Call Commerce reports
          </h3>

          <p className="mt-1 text-[9px] text-slate-400">
            Operational, commercial, lead, call, event and audit reporting for the selected date range
          </p>

        </div>


        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={
              () =>
                void load()
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
          >

            <RefreshCw
              size={12}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh

          </button>


          <button
            type="button"
            onClick={
              () =>
                triggerExport(
                  'full',
                  'xlsx'
                )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
          >

            <FileSpreadsheet
              size={12}
            />

            Full Workbook

          </button>

        </div>

      </div>


      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <Metric
          label="Qualified Leads"
          value={
            integer(
              data.qualified
            )
          }
          helper={
            percent(
              data.qualification_rate
            )
          }
          icon={
            <UserCheck
              size={15}
            />
          }
        />


        <Metric
          label="Purchases"
          value={
            integer(
              data.purchased
            )
          }
          helper={
            percent(
              data.call_purchase_rate
            )
          }
          icon={
            <ShoppingCart
              size={15}
            />
          }
        />


        <Metric
          label="Revenue"
          value={
            currency(
              data.revenue
            )
          }
          helper={`${currency(
            data.avg_order_value
          )} avg order`}
          icon={
            <IndianRupee
              size={15}
            />
          }
        />


        <Metric
          label="Total Talk Time"
          value={
            duration(
              data.total_talk_time_seconds
            )
          }
          helper={`${duration(
            data.avg_talk_time_seconds
          )} avg answered`}
          icon={
            <BarChart3
              size={15}
            />
          }
        />

      </div>


      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">

          <div>

            <h3 className="text-[11px] font-semibold text-slate-950">
              Agent performance report
            </h3>

            <p className="mt-0.5 text-[8px] text-slate-400">
              Performance inside the current date range
            </p>

          </div>


          <button
            type="button"
            onClick={
              () =>
                triggerExport(
                  'agent-performance',
                  'xlsx'
                )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600 hover:bg-slate-50"
          >

            <Download
              size={11}
            />

            Export

          </button>

        </div>


        <div className="overflow-x-auto">

          <table className="min-w-[850px] w-full">

            <thead>

              <tr className="bg-slate-50/70">

                {[
                  'Agent',
                  'Calls',
                  'Answered',
                  'No Answer',
                  'Caller Dropped',
                  'Answer Rate',
                  'Avg Talk',
                  'Total Talk',
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

              {(
                Array.isArray(
                  data.agent_performance
                )
                  ? data.agent_performance
                  : []
              ).map(
                (
                  row: any
                ) => (

                  <tr
                    key={
                      row.agent_name
                    }
                    className="border-t border-slate-100"
                  >

                    <td className="px-4 py-3 text-[9px] font-semibold text-slate-800">
                      {row.agent_name}
                    </td>

                    <td className="px-4 py-3 text-[9px] text-slate-600">
                      {integer(
                        row.calls
                      )}
                    </td>

                    <td className="px-4 py-3 text-[9px] text-slate-600">
                      {integer(
                        row.answered
                      )}
                    </td>

                    <td className="px-4 py-3 text-[9px] text-slate-600">
                      {integer(
                        row.no_answer
                      )}
                    </td>

                    <td className="px-4 py-3 text-[9px] text-slate-600">
                      {integer(
                        row.caller_dropped
                      )}
                    </td>

                    <td className="px-4 py-3 text-[9px] text-slate-600">
                      {percent(
                        row.answer_rate
                      )}
                    </td>

                    <td className="px-4 py-3 text-[9px] text-slate-600">
                      {duration(
                        row.avg_talk_time_seconds
                      )}
                    </td>

                    <td className="px-4 py-3 text-[9px] text-slate-600">
                      {duration(
                        row.total_talk_time_seconds
                      )}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </div>


      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-100 px-4 py-3">

          <div className="flex items-center gap-2">

            <Download
              size={14}
              className="text-slate-500"
            />

            <div>

              <h3 className="text-[11px] font-semibold text-slate-950">
                Export center
              </h3>

              <p className="mt-0.5 text-[8px] text-slate-400">
                Every export is scoped to the authenticated workspace, brand and selected date range
              </p>

            </div>

          </div>

        </div>


        <div className="grid gap-4 p-4 xl:grid-cols-2">

          {EXPORT_GROUPS.map(
            group => (

              <section
                key={
                  group.title
                }
                className="overflow-hidden rounded-xl border border-slate-100"
              >

                <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-2.5">

                  <GroupIcon
                    title={
                      group.title
                    }
                  />

                  <h4 className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    {group.title}
                  </h4>

                </div>


                <div className="divide-y divide-slate-100">

                  {group.items.map(
                    item => (

                      <ExportRow
                        key={
                          item.type
                        }
                        item={
                          item
                        }
                        onExport={
                          triggerExport
                        }
                      />

                    )
                  )}

                </div>

              </section>

            )
          )}

        </div>


        <div className="border-t border-slate-100 p-4">

          <button
            type="button"
            onClick={
              () =>
                triggerExport(
                  'full',
                  'xlsx'
                )
            }
            className="flex w-full items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-left text-white"
          >

            <div>

              <div className="text-[10px] font-semibold">
                Full Call Commerce Workbook
              </div>

              <div className="mt-0.5 text-[8px] text-slate-300">
                Executive + commercial + leads + archive + calls + agents + trends + events + audit in one XLSX
              </div>

            </div>


            <FileSpreadsheet
              size={17}
            />

          </button>

        </div>

      </div>

    </div>
  );
}


function ExportRow({
  item,
  onExport,
}: {
  item: ExportItem;
  onExport: (
    type: string,
    format:
      | 'csv'
      | 'xlsx'
  ) => void;
}) {

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">

      <div className="min-w-0">

        <div className="text-[9px] font-semibold text-slate-700">
          {item.label}
        </div>

        <div className="mt-0.5 text-[7px] leading-3 text-slate-400">
          {item.helper}
        </div>

      </div>


      <div className="flex shrink-0 gap-1">

        <button
          type="button"
          onClick={
            () =>
              onExport(
                item.type,
                'csv'
              )
          }
          className="rounded-md border border-slate-200 px-2 py-1 text-[7px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          CSV
        </button>


        <button
          type="button"
          onClick={
            () =>
              onExport(
                item.type,
                'xlsx'
              )
          }
          className="rounded-md border border-slate-200 px-2 py-1 text-[7px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          XLSX
        </button>

      </div>

    </div>
  );
}


function GroupIcon({
  title,
}: {
  title: string;
}) {

  if (
    title ===
    'Lead Reports'
  ) {
    return (
      <Users
        size={12}
        className="text-slate-400"
      />
    );
  }


  if (
    title ===
    'Call Reports'
  ) {
    return (
      <PhoneCall
        size={12}
        className="text-slate-400"
      />
    );
  }


  if (
    title ===
    'Events & Audit'
  ) {
    return (
      <Activity
        size={12}
        className="text-slate-400"
      />
    );
  }


  return (
    <BarChart3
      size={12}
      className="text-slate-400"
    />
  );
}


function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

      <div className="flex items-start justify-between">

        <div>

          <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </div>

          <div className="mt-2 text-[20px] font-semibold text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-[8px] text-slate-400">
            {helper}
          </div>

        </div>


        <div className="text-slate-400">
          {icon}
        </div>

      </div>

    </div>
  );
}
