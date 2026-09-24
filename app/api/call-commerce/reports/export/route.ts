import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  Workbook,
} from 'exceljs';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  getSummary,
} from '@/lib/call-commerce/repository';

import {
  getCallCommerceReportRaw,
  type CallCommerceReportType,
} from '@/lib/call-commerce/reporting';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


const SUPPORTED_TYPES =
  new Set<CallCommerceReportType>([
    'executive-summary',
    'commercial',
    'active-leads',
    'archived-leads',
    'all-leads',
    'follow-up-leads',
    'purchased-leads',
    'unqualified-leads',
    'closed-lost-leads',
    'call-attempts',
    'repeat-callers',
    'call-outcomes',
    'disconnect-analysis',
    'agent-performance',
    'business-numbers',
    'daily-trend',
    'hourly-performance',
    'lead-statuses',
    'events',
    'meta-events',
    'activity-log',
    'full',
  ]);


const SUPPORTED_FORMATS =
  new Set([
    'csv',
    'xlsx',
  ]);


export async function GET(
  request: NextRequest
) {

  try {

    const access =
      await requireGrowthOSApiAccess(
        request
      );

    const url =
      new URL(
        request.url
      );


    const requestedType =
      String(
        url.searchParams.get(
          'type'
        ) ||
          'full'
      ).toLowerCase();


    const type =
      (
        requestedType ===
        'meta-events'
          ? 'events'
          : requestedType
      ) as CallCommerceReportType;


    const format =
      String(
        url.searchParams.get(
          'format'
        ) ||
          'xlsx'
      ).toLowerCase();


    const start =
      url.searchParams.get(
        'start'
      ) || '';

    const end =
      url.searchParams.get(
        'end'
      ) || '';


    if (
      !SUPPORTED_TYPES.has(
        type
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'CALL_COMMERCE_EXPORT_TYPE_INVALID',
        },
        {
          status:
            400,
        }
      );
    }


    if (
      !SUPPORTED_FORMATS.has(
        format
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'CALL_COMMERCE_EXPORT_FORMAT_INVALID',
        },
        {
          status:
            400,
        }
      );
    }


    if (
      type === 'full' &&
      format !== 'xlsx'
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'FULL_EXPORT_REQUIRES_XLSX',
        },
        {
          status:
            400,
        }
      );
    }


    const [
      summary,
      raw,
    ] =
      await Promise.all([

        getSummary(
          access.workspaceId,
          access.brandId,
          start || undefined,
          end || undefined
        ),

        getCallCommerceReportRaw({
          workspaceId:
            access.workspaceId,

          brandId:
            access.brandId,

          start:
            start || undefined,

          end:
            end || undefined,

          type,

          search:
            url.searchParams.get(
              'search'
            ) || '',

          status:
            url.searchParams.get(
              'status'
            ) || '',

          callStatus:
            url.searchParams.get(
              'callStatus'
            ) || '',

          agent:
            url.searchParams.get(
              'agent'
            ) || '',

          businessNumber:
            url.searchParams.get(
              'businessNumber'
            ) || '',
        }),

      ]);


    const datasets =
      buildDatasets(
        type,
        summary,
        raw
      );


    const stamp =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );


    const baseName =
      `call-commerce-${type}-${stamp}`;


    if (
      format === 'csv'
    ) {

      const first =
        datasets[0] || {
          rows:
            [],
        };


      const csv =
        toCsv(
          first.rows
        );


      const body =
        new TextEncoder().encode(
          `\uFEFF${csv}`
        );


      return new NextResponse(
        body,
        {
          status:
            200,

          headers: {
            'content-type':
              'text/csv; charset=utf-8',

            'content-disposition':
              `attachment; filename="${baseName}.csv"`,

            'cache-control':
              'no-store',
          },
        }
      );
    }


    const workbook =
      new Workbook();


    workbook.creator =
      'Growth OS';

    workbook.created =
      new Date();


    for (
      const dataset
      of datasets
    ) {

      addSheet(
        workbook,
        dataset.name,
        dataset.rows
      );
    }


    const buffer =
      await workbook.xlsx.writeBuffer();


    return new NextResponse(
      buffer as any,
      {
        status:
          200,

        headers: {
          'content-type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          'content-disposition':
            `attachment; filename="${baseName}.xlsx"`,

          'cache-control':
            'no-store',
        },
      }
    );

  } catch (
    error: unknown
  ) {

    const accessResponse =
      runtimeAccessErrorResponse(
        error
      );


    if (
      accessResponse
    ) {
      return accessResponse;
    }


    console.error(
      'CALL_COMMERCE_EXPORT_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_EXPORT_ERROR',
      },
      {
        status:
          500,
      }
    );
  }
}


type Dataset = {
  name: string;
  rows: Record<string, any>[];
};


function buildDatasets(
  type: CallCommerceReportType,
  summary: any,
  raw: any
): Dataset[] {

  const attempts =
    normalizeRows(
      raw?.attempts ||
        []
    );


  const leads =
    normalizeRows(
      raw?.leads ||
        []
    );


  const archivedLeads =
    normalizeRows(
      raw?.archivedLeads ||
        []
    );


  const events =
    normalizeRows(
      raw?.events ||
        []
    );


  const activity =
    normalizeRows(
      raw?.activity ||
        []
    );


  const activeLeads =
    leads.filter(
      row =>
        !asBoolean(
          row.is_archived
        )
    );


  const followUpLeads =
    leads.filter(
      row =>
        upper(
          row.status
        ) ===
        'FOLLOW_UP'
    );


  const purchasedLeads =
    leads.filter(
      row =>
        upper(
          row.status
        ) ===
        'PURCHASED'
    );


  const unqualifiedLeads =
    leads.filter(
      row =>
        upper(
          row.status
        ) ===
        'UNQUALIFIED'
    );


  const closedLostLeads =
    leads.filter(
      row =>
        upper(
          row.status
        ) ===
        'CLOSED_LOST'
    );


  const executive =
    normalizeRows([
      {
        total_calls:
          summary?.total_calls || 0,

        unique_leads:
          summary?.unique_leads || 0,

        repeat_leads:
          summary?.repeat_leads || 0,

        answered:
          summary?.answered || 0,

        no_answer:
          summary?.no_answer || 0,

        caller_dropped:
          summary?.caller_dropped || 0,

        answer_rate:
          summary?.answer_rate || 0,

        avg_talk_time_seconds:
          summary?.avg_talk_time_seconds || 0,

        total_talk_time_seconds:
          summary?.total_talk_time_seconds || 0,

        qualified:
          summary?.qualified || 0,

        follow_up:
          summary?.follow_up || 0,

        purchased:
          summary?.purchased || 0,

        unqualified:
          summary?.unqualified || 0,

        closed_lost:
          summary?.closed_lost || 0,

        revenue:
          summary?.revenue || 0,

        avg_order_value:
          summary?.avg_order_value || 0,

        qualification_rate:
          summary?.qualification_rate || 0,

        qualified_purchase_rate:
          summary?.qualified_purchase_rate || 0,

        call_purchase_rate:
          summary?.call_purchase_rate || 0,

        quality_connected:
          summary?.quality_connected || 0,

        short_connected:
          summary?.short_connected || 0,

        last_call_at:
          summary?.last_call_at || '',
      },
    ]);


  const commercial =
    normalizeRows([
      {
        leads:
          summary?.calls || 0,

        connected:
          summary?.connected || 0,

        qualified:
          summary?.qualified || 0,

        follow_up:
          summary?.follow_up || 0,

        purchased:
          summary?.purchased || 0,

        unqualified:
          summary?.unqualified || 0,

        closed_lost:
          summary?.closed_lost || 0,

        revenue:
          summary?.revenue || 0,

        avg_order_value:
          summary?.avg_order_value || 0,

        qualification_rate:
          summary?.qualification_rate || 0,

        qualified_purchase_rate:
          summary?.qualified_purchase_rate || 0,

        call_purchase_rate:
          summary?.call_purchase_rate || 0,
      },
    ]);


  const repeatCallers =
    buildRepeatCallers(
      attempts
    );


  const callOutcomes =
    buildCallOutcomes(
      attempts
    );


  const disconnectAnalysis =
    buildDisconnectAnalysis(
      attempts
    );


  const agentPerformance =
    normalizeRows(
      summary?.agent_performance ||
        []
    );


  const businessNumbers =
    normalizeRows(
      summary?.business_numbers ||
        []
    );


  const dailyTrend =
    normalizeRows(
      summary?.trend ||
        []
    );


  const hourlyPerformance =
    normalizeRows(
      summary?.hourly ||
        []
    );


  const leadStatuses =
    normalizeRows(
      summary?.lead_statuses ||
        []
    );


  switch (
    type
  ) {

    case 'executive-summary':
      return [
        {
          name:
            'Executive Summary',
          rows:
            executive,
        },
      ];


    case 'commercial':
      return [
        {
          name:
            'Commercial Funnel',
          rows:
            commercial,
        },
      ];


    case 'active-leads':
      return [
        {
          name:
            'Active Leads',
          rows:
            activeLeads,
        },
      ];


    case 'archived-leads':
      return [
        {
          name:
            'Archived Leads',
          rows:
            archivedLeads,
        },
      ];


    case 'all-leads':
      return [
        {
          name:
            'All Leads',
          rows:
            leads,
        },
      ];


    case 'follow-up-leads':
      return [
        {
          name:
            'Follow Up Leads',
          rows:
            followUpLeads,
        },
      ];


    case 'purchased-leads':
      return [
        {
          name:
            'Purchased Leads',
          rows:
            purchasedLeads,
        },
      ];


    case 'unqualified-leads':
      return [
        {
          name:
            'Unqualified Leads',
          rows:
            unqualifiedLeads,
        },
      ];


    case 'closed-lost-leads':
      return [
        {
          name:
            'Closed Lost Leads',
          rows:
            closedLostLeads,
        },
      ];


    case 'call-attempts':
      return [
        {
          name:
            'Call Attempts',
          rows:
            attempts,
        },
      ];


    case 'repeat-callers':
      return [
        {
          name:
            'Repeat Callers',
          rows:
            repeatCallers,
        },
      ];


    case 'call-outcomes':
      return [
        {
          name:
            'Call Outcomes',
          rows:
            callOutcomes,
        },
      ];


    case 'disconnect-analysis':
      return [
        {
          name:
            'Disconnect Analysis',
          rows:
            disconnectAnalysis,
        },
      ];


    case 'agent-performance':
      return [
        {
          name:
            'Agent Performance',
          rows:
            agentPerformance,
        },
      ];


    case 'business-numbers':
      return [
        {
          name:
            'Business Numbers',
          rows:
            businessNumbers,
        },
      ];


    case 'daily-trend':
      return [
        {
          name:
            'Daily Trend',
          rows:
            dailyTrend,
        },
      ];


    case 'hourly-performance':
      return [
        {
          name:
            'Hourly Performance',
          rows:
            hourlyPerformance,
        },
      ];


    case 'lead-statuses':
      return [
        {
          name:
            'Lead Statuses',
          rows:
            leadStatuses,
        },
      ];


    case 'events':
    case 'meta-events':
      return [
        {
          name:
            'Events',
          rows:
            events,
        },
      ];


    case 'activity-log':
      return [
        {
          name:
            'Activity Log',
          rows:
            activity,
        },
      ];


    default:
      return [
        {
          name:
            'Executive Summary',
          rows:
            executive,
        },

        {
          name:
            'Commercial Funnel',
          rows:
            commercial,
        },

        {
          name:
            'Active Leads',
          rows:
            activeLeads,
        },

        {
          name:
            'Archived Leads',
          rows:
            archivedLeads,
        },

        {
          name:
            'All Leads',
          rows:
            leads,
        },

        {
          name:
            'Follow Up Leads',
          rows:
            followUpLeads,
        },

        {
          name:
            'Purchased Leads',
          rows:
            purchasedLeads,
        },

        {
          name:
            'Unqualified Leads',
          rows:
            unqualifiedLeads,
        },

        {
          name:
            'Closed Lost Leads',
          rows:
            closedLostLeads,
        },

        {
          name:
            'Call Attempts',
          rows:
            attempts,
        },

        {
          name:
            'Repeat Callers',
          rows:
            repeatCallers,
        },

        {
          name:
            'Call Outcomes',
          rows:
            callOutcomes,
        },

        {
          name:
            'Disconnect Analysis',
          rows:
            disconnectAnalysis,
        },

        {
          name:
            'Agent Performance',
          rows:
            agentPerformance,
        },

        {
          name:
            'Business Numbers',
          rows:
            businessNumbers,
        },

        {
          name:
            'Daily Trend',
          rows:
            dailyTrend,
        },

        {
          name:
            'Hourly Performance',
          rows:
            hourlyPerformance,
        },

        {
          name:
            'Lead Statuses',
          rows:
            leadStatuses,
        },

        {
          name:
            'Events',
          rows:
            events,
        },

        {
          name:
            'Activity Log',
          rows:
            activity,
        },
      ];
  }
}


function buildRepeatCallers(
  attempts: Record<string, any>[]
) {

  const groups =
    new Map<
      string,
      {
        lead_id: string;
        phone: string;
        calls: number;
        answered: number;
        unanswered: number;
        caller_dropped: number;
        total_talk_seconds: number;
        latest_call_at: string;
        latest_agent: string;
      }
    >();


  for (
    const row
    of attempts
  ) {

    const leadId =
      String(
        row.lead_id ||
          ''
      );


    const phone =
      String(
        row.phone ||
          ''
      );


    const key =
      leadId ||
      phone;


    if (
      !key
    ) {
      continue;
    }


    const current =
      groups.get(
        key
      ) || {
        lead_id:
          leadId,

        phone,

        calls:
          0,

        answered:
          0,

        unanswered:
          0,

        caller_dropped:
          0,

        total_talk_seconds:
          0,

        latest_call_at:
          '',

        latest_agent:
          '',
      };


    current.calls +=
      1;


    const callStatus =
      upper(
        row.call_status
      );


    const endReason =
      upper(
        row.end_reason
      );


    if (
      callStatus ===
      'ANSWERED'
    ) {

      current.answered +=
        1;

      current.total_talk_seconds +=
        Number(
          row.duration_seconds ||
            0
        );

    } else if (
      [
        'NO_ANSWER',
        'MISSED',
        'BUSY',
        'REJECTED',
        'FAILED',
      ].includes(
        callStatus
      )
    ) {

      current.unanswered +=
        1;
    }


    if (
      endReason ===
      'CALLER_DROPPED_BEFORE_ANSWER'
    ) {
      current.caller_dropped +=
        1;
    }


    const activityAt =
      String(
        row.call_started_at ||
          row.created_at ||
          ''
      );


    if (
      !current.latest_call_at ||
      activityAt >
        current.latest_call_at
    ) {

      current.latest_call_at =
        activityAt;

      current.latest_agent =
        String(
          row.agent_name ||
            ''
        );
    }


    groups.set(
      key,
      current
    );
  }


  return Array.from(
    groups.values()
  )
    .filter(
      row =>
        row.calls >
        1
    )
    .sort(
      (
        a,
        b
      ) =>
        b.calls -
        a.calls
    );
}


function buildCallOutcomes(
  attempts: Record<string, any>[]
) {

  const groups =
    new Map<
      string,
      {
        outcome: string;
        calls: number;
        total_duration_seconds: number;
      }
    >();


  for (
    const row
    of attempts
  ) {

    const outcome =
      finalOutcome(
        row
      );


    const current =
      groups.get(
        outcome
      ) || {
        outcome,
        calls:
          0,
        total_duration_seconds:
          0,
      };


    current.calls +=
      1;

    current.total_duration_seconds +=
      Number(
        row.duration_seconds ||
          0
      );


    groups.set(
      outcome,
      current
    );
  }


  const total =
    attempts.length;


  return Array.from(
    groups.values()
  )
    .map(
      row => ({
        ...row,

        share_percent:
          total
            ? (
                row.calls /
                total
              ) *
              100
            : 0,

        avg_duration_seconds:
          row.calls
            ? row.total_duration_seconds /
              row.calls
            : 0,
      })
    )
    .sort(
      (
        a,
        b
      ) =>
        b.calls -
        a.calls
    );
}


function buildDisconnectAnalysis(
  attempts: Record<string, any>[]
) {

  const groups =
    new Map<
      string,
      {
        disconnect_party: string;
        end_reason: string;
        outcome_source: string;
        calls: number;
      }
    >();


  for (
    const row
    of attempts
  ) {

    const disconnectParty =
      String(
        row.disconnect_party ||
          'UNKNOWN'
      );


    const endReason =
      String(
        row.end_reason ||
          'UNKNOWN'
      );


    const outcomeSource =
      String(
        row.outcome_source ||
          'UNKNOWN'
      );


    const key =
      [
        disconnectParty,
        endReason,
        outcomeSource,
      ].join(
        '||'
      );


    const current =
      groups.get(
        key
      ) || {
        disconnect_party:
          disconnectParty,

        end_reason:
          endReason,

        outcome_source:
          outcomeSource,

        calls:
          0,
      };


    current.calls +=
      1;


    groups.set(
      key,
      current
    );
  }


  return Array.from(
    groups.values()
  )
    .sort(
      (
        a,
        b
      ) =>
        b.calls -
        a.calls
    );
}


function finalOutcome(
  row: Record<string, any>
) {

  if (
    upper(
      row.end_reason
    ) ===
    'CALLER_DROPPED_BEFORE_ANSWER'
  ) {
    return 'CALLER_DROPPED';
  }


  const status =
    upper(
      row.call_status
    );


  return status ||
    'UNKNOWN';
}


function upper(
  value: any
) {
  return String(
    value ||
      ''
  ).toUpperCase();
}


function asBoolean(
  value: any
) {

  if (
    typeof value ===
    'boolean'
  ) {
    return value;
  }


  return [
    'true',
    '1',
    'yes',
  ].includes(
    String(
      value ||
        ''
    ).toLowerCase()
  );
}


function addSheet(
  workbook: Workbook,
  name: string,
  rows: Record<string, any>[]
) {

  const safeName =
    name.slice(
      0,
      31
    );


  const sheet =
    workbook.addWorksheet(
      safeName
    );


  if (
    !rows.length
  ) {

    sheet.addRow([
      'No data for the selected period',
    ]);

    return;
  }


  const columns =
    collectColumns(
      rows
    );


  sheet.columns =
    columns.map(
      key => ({
        header:
          humanize(
            key
          ),

        key,

        width:
          Math.min(
            40,
            Math.max(
              12,
              humanize(
                key
              ).length +
                4
            )
          ),
      })
    );


  for (
    const row
    of rows
  ) {
    sheet.addRow(
      row
    );
  }


  sheet.views = [
    {
      state:
        'frozen',

      ySplit:
        1,
    },
  ];


  sheet.autoFilter = {
    from: {
      row:
        1,

      column:
        1,
    },

    to: {
      row:
        1,

      column:
        columns.length,
    },
  };


  sheet.getRow(
    1
  ).font = {
    bold:
      true,
  };
}


function collectColumns(
  rows: Record<string, any>[]
): string[] {

  const columns =
    new Set<string>();


  for (
    const row
    of rows
  ) {

    for (
      const key
      of Object.keys(
        row
      )
    ) {
      columns.add(
        key
      );
    }
  }


  return [
    ...columns,
  ];
}


function normalizeRows(
  rows: any[]
): Record<string, any>[] {

  return rows.map(
    row =>
      Object.fromEntries(
        Object.entries(
          row || {}
        ).map(
          (
            [
              key,
              value,
            ]
          ) => [
            key,
            normalizeCell(
              value
            ),
          ]
        )
      )
  );
}


function normalizeCell(
  value: any
): any {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }


  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }


  if (
    typeof value ===
    'object'
  ) {

    if (
      typeof value.value ===
        'string' &&
      Object.keys(
        value
      ).length <=
        2
    ) {
      return value.value;
    }


    return JSON.stringify(
      value
    );
  }


  return value;
}


function toCsv(
  rows: Record<string, any>[]
) {

  if (
    !rows.length
  ) {
    return 'No data for the selected period';
  }


  const columns =
    collectColumns(
      rows
    );


  const lines = [
    columns
      .map(
        humanize
      )
      .map(
        csvCell
      )
      .join(
        ','
      ),
  ];


  for (
    const row
    of rows
  ) {

    lines.push(
      columns
        .map(
          column =>
            csvCell(
              row[
                column
              ]
            )
        )
        .join(
          ','
        )
    );
  }


  return lines.join(
    '\r\n'
  );
}


function csvCell(
  value: any
) {

  const text =
    value === null ||
    value === undefined
      ? ''
      : typeof value ===
          'object'
        ? JSON.stringify(
            value
          )
        : String(
            value
          );


  return `"${text.replaceAll(
    '"',
    '""'
  )}"`;
}


function humanize(
  value: string
) {

  return value
    .replaceAll(
      '_',
      ' '
    )
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    );
}
