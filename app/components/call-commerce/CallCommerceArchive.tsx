'use client';

import {
  Archive,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import LeadListWorkspace
  from './LeadListWorkspace';

import {
  formatDateTime,
  integer,
} from './utils';


export default function CallCommerceArchive() {

  const [
    facets,
    setFacets,
  ] =
    useState<any>({});

  const load =
    useCallback(
      async () => {

        try {

          const response =
            await fetch(
              '/api/call-commerce/archive?page=1&limit=1',
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
            setFacets(
              body.data?.facets ||
                {}
            );
          }

        } catch {
          // The archived lead table below owns the primary error state.
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


  function exportArchive(
    format:
      | 'csv'
      | 'xlsx'
  ) {

    const query =
      new URLSearchParams({
        type:
          'archived-leads',

        format,
      });

    window.location.href =
      `/api/call-commerce/reports/export?${query.toString()}`;
  }


  const metrics = [
    [
      'Archived Leads',
      integer(
        facets?.total || 0
      ),
    ],

    [
      'Unqualified',
      integer(
        facets?.unqualified || 0
      ),
    ],

    [
      'Closed Lost',
      integer(
        facets?.closed_lost || 0
      ),
    ],

    [
      'Last Archived',
      facets?.last_archived_at
        ? formatDateTime(
            facets.last_archived_at
          )
        : '—',
    ],
  ];


  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">

        <div>

          <div className="flex items-center gap-2">

            <Archive
              size={15}
              className="text-slate-500"
            />

            <h3 className="text-[12px] font-semibold text-slate-950">
              Archived leads
            </h3>

          </div>

          <p className="mt-1 text-[9px] leading-4 text-slate-400">
            Historical Call Commerce leads retained for reporting and audit.
            This view is not limited by the global date filter.
          </p>

        </div>


        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={
              () =>
                exportArchive(
                  'csv'
                )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
          >

            <Download size={12} />

            CSV

          </button>


          <button
            type="button"
            onClick={
              () =>
                exportArchive(
                  'xlsx'
                )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white"
          >

            <FileSpreadsheet size={12} />

            Export XLSX

          </button>

        </div>

      </div>


      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        {metrics.map(
          ([
            label,
            value,
          ]) => (

            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
            >

              <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </div>

              <div className="mt-1.5 text-[17px] font-semibold text-slate-950">
                {value}
              </div>

            </div>

          )
        )}

      </div>


      <LeadListWorkspace
        endpoint="/api/call-commerce/archive"
        archived
      />

    </div>
  );
}
