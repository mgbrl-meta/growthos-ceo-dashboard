import { NextRequest, NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';
import {
  getCallCommerceExportData,
  getSummary,
} from '@/lib/call-commerce/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUPPORTED_TYPES = new Set([
  'call-attempts',
  'leads',
  'agent-performance',
  'commercial',
  'meta-events',
  'full',
]);

const SUPPORTED_FORMATS = new Set(['csv', 'xlsx']);

export async function GET(request: NextRequest) {
  try {
    const access = await requireGrowthOSApiAccess(request);
    const url = new URL(request.url);

    const type = String(url.searchParams.get('type') || 'full').toLowerCase();
    const format = String(url.searchParams.get('format') || 'xlsx').toLowerCase();
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';

    if (!SUPPORTED_TYPES.has(type)) {
      return NextResponse.json(
        { ok: false, error: 'CALL_COMMERCE_EXPORT_TYPE_INVALID' },
        { status: 400 }
      );
    }

    if (!SUPPORTED_FORMATS.has(format)) {
      return NextResponse.json(
        { ok: false, error: 'CALL_COMMERCE_EXPORT_FORMAT_INVALID' },
        { status: 400 }
      );
    }

    if (type === 'full' && format !== 'xlsx') {
      return NextResponse.json(
        { ok: false, error: 'FULL_EXPORT_REQUIRES_XLSX' },
        { status: 400 }
      );
    }

    const [summary, raw] = await Promise.all([
      getSummary(access.workspaceId, access.brandId, start || undefined, end || undefined),
      getCallCommerceExportData({
        workspaceId: access.workspaceId,
        brandId: access.brandId,
        start: start || undefined,
        end: end || undefined,
        type,
      }),
    ]);

    const datasets = buildDatasets(type, summary, raw);
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `call-commerce-${type}-${stamp}`;

    if (format === 'csv') {
      const first = datasets[0] || { rows: [] };
      const csv = toCsv(first.rows);
      const body = new TextEncoder().encode(`\uFEFF${csv}`);

      return new NextResponse(body, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${baseName}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }

    const workbook = new Workbook();
    workbook.creator = 'Growth OS';
    workbook.created = new Date();

    for (const dataset of datasets) {
      addSheet(workbook, dataset.name, dataset.rows);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${baseName}.xlsx"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const accessResponse = runtimeAccessErrorResponse(error);
    if (accessResponse) return accessResponse;

    console.error('CALL_COMMERCE_EXPORT_ERROR', error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_EXPORT_ERROR',
      },
      { status: 500 }
    );
  }
}

function buildDatasets(type: string, summary: any, raw: any) {
  const attempts = normalizeRows(raw?.attempts || []);
  const leads = normalizeRows(raw?.leads || []);
  const meta = normalizeRows(raw?.meta || []);
  const agents = normalizeRows(summary?.agent_performance || []);

  const commercial = normalizeRows([
    {
      call_leads: summary?.calls || 0,
      connected: summary?.connected || 0,
      qualified: summary?.qualified || 0,
      follow_up: summary?.follow_up || 0,
      purchased: summary?.purchased || 0,
      unqualified: summary?.unqualified || 0,
      closed_lost: summary?.closed_lost || 0,
      revenue: summary?.revenue || 0,
      avg_order_value: summary?.avg_order_value || 0,
      qualification_rate: summary?.qualification_rate || 0,
      qualified_purchase_rate: summary?.qualified_purchase_rate || 0,
      call_purchase_rate: summary?.call_purchase_rate || 0,
    },
  ]);

  if (type === 'call-attempts') {
    return [{ name: 'Call Attempts', rows: attempts }];
  }
  if (type === 'leads') {
    return [{ name: 'Leads', rows: leads }];
  }
  if (type === 'agent-performance') {
    return [{ name: 'Agent Performance', rows: agents }];
  }
  if (type === 'commercial') {
    return [{ name: 'Commercial', rows: commercial }];
  }
  if (type === 'meta-events') {
    return [{ name: 'Meta Events', rows: meta }];
  }

  const summaryRow = normalizeRows([
    Object.fromEntries(
      Object.entries(summary || {}).filter(([, value]) => !Array.isArray(value))
    ),
  ]);

  return [
    { name: 'Summary', rows: summaryRow },
    { name: 'Leads', rows: leads },
    { name: 'Call Attempts', rows: attempts },
    { name: 'Agent Performance', rows: agents },
    { name: 'Meta Events', rows: meta },
    { name: 'Daily Trend', rows: normalizeRows(summary?.trend || []) },
    { name: 'Lead Statuses', rows: normalizeRows(summary?.lead_statuses || []) },
    { name: 'Business Numbers', rows: normalizeRows(summary?.business_numbers || []) },
  ];
}

function addSheet(workbook: Workbook, name: string, rows: Record<string, any>[]) {
  const safeName = name.slice(0, 31);
  const sheet = workbook.addWorksheet(safeName);

  if (!rows.length) {
    sheet.addRow(['No data for the selected period']);
    return;
  }

  const columns = collectColumns(rows);

  sheet.columns = columns.map((key) => ({
    header: humanize(key),
    key,
    width: Math.min(40, Math.max(12, humanize(key).length + 4)),
  }));

  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  sheet.getRow(1).font = { bold: true };
}


function collectColumns(rows: Record<string, any>[]): string[] {
  const columns = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }

  return [...columns];
}

function normalizeRows(rows: any[]): Record<string, any>[] {
  return rows.map((row) => normalizeObject(row));
}

function normalizeObject(value: any): any {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => normalizeObject(item)));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    if (typeof value.value === 'string' && Object.keys(value).length <= 2) {
      return value.value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeObject(item)])
    );
  }

  return value;
}

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return 'No data for the selected period';

  const columns = collectColumns(rows);

  const lines = [columns.map(humanize).map(csvCell).join(',')];

  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }

  return lines.join('\r\n');
}

function csvCell(value: any) {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

  return `"${text.replaceAll('"', '""')}"`;
}

function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
