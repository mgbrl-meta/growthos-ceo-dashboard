import 'server-only';

import { pgQuery } from '@/lib/operational-postgres/client';

export type CallCommerceReportType =
  | 'executive-summary'
  | 'commercial'
  | 'active-leads'
  | 'archived-leads'
  | 'all-leads'
  | 'follow-up-leads'
  | 'purchased-leads'
  | 'unqualified-leads'
  | 'closed-lost-leads'
  | 'call-attempts'
  | 'repeat-callers'
  | 'call-outcomes'
  | 'disconnect-analysis'
  | 'agent-performance'
  | 'business-numbers'
  | 'daily-trend'
  | 'hourly-performance'
  | 'lead-statuses'
  | 'events'
  | 'meta-events'
  | 'activity-log'
  | 'full';

export type CallCommerceReportInput = {
  workspaceId: string;
  brandId: string;
  start?: string;
  end?: string;
  type: CallCommerceReportType;
  search?: string;
  status?: string;
  callStatus?: string;
  agent?: string;
  businessNumber?: string;
};

const LEAD_COLUMNS = `
  lead_id,
  phone,
  customer_name,
  email,
  product,
  status,
  notes,
  currency,
  status_changed_at,
  first_call_at,
  latest_call_at,
  latest_call_status,
  latest_agent_name,
  latest_attempt_id,
  latest_provider_call_id,
  latest_business_number,
  latest_duration_seconds,
  latest_disconnect_party,
  latest_end_reason,
  call_attempt_count,
  answered_attempt_count,
  unanswered_attempt_count,
  next_follow_up_at,
  order_id,
  order_amount,
  purchased_at,
  unqualified_reason,
  closed_lost_reason,
  is_archived,
  archived_at,
  created_at,
  updated_at
`;

const ATTEMPT_COLUMNS = `
  attempt_id,
  lead_id,
  provider_call_id,
  phone,
  business_number,
  event_type,
  call_status,
  direction,
  agent_id,
  agent_name,
  agent_phone,
  call_started_at,
  call_answered_at,
  call_ended_at,
  provider_updated_at,
  duration_seconds,
  disconnected_by,
  disconnect_party,
  end_reason,
  outcome_source,
  recording_url,
  reason,
  ivr_inputs,
  raw_event_type,
  raw_status,
  created_at,
  updated_at
`;

function buildDatePredicate(
  expression: string,
  startIndex: number,
  endIndex: number
) {
  return `
    AND ($${startIndex}='' OR ${expression} >= (($${startIndex})::date::timestamp AT TIME ZONE 'Asia/Kolkata'))
    AND ($${endIndex}='' OR ${expression} < ((($${endIndex})::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Kolkata'))
  `;
}

function leadFilterSql(mode: 'created' | 'archived' | 'none') {
  const timeFilter =
    mode === 'created'
      ? buildDatePredicate('created_at', 3, 4)
      : mode === 'archived'
        ? buildDatePredicate('archived_at', 3, 4)
        : '';

  return `
    workspace_id=$1
    AND brand_id=$2
    ${timeFilter}
    AND (
      $5=''
      OR LOWER(CONCAT(
        COALESCE(phone,''),' ',
        COALESCE(customer_name,''),' ',
        COALESCE(email,''),' ',
        COALESCE(product,''),' ',
        COALESCE(order_id,'')
      )) LIKE CONCAT('%',LOWER($5),'%')
    )
    AND ($6='' OR status=$6)
    AND ($8='' OR LOWER(COALESCE(latest_agent_name,''))=LOWER($8))
    AND ($9='' OR COALESCE(latest_business_number,'')=$9)
    AND (
      $7=''
      OR ($7='CALLER_DROPPED' AND latest_end_reason='CALLER_DROPPED_BEFORE_ANSWER')
      OR ($7='NO_ANSWER' AND latest_call_status='NO_ANSWER' AND COALESCE(latest_end_reason,'')!='CALLER_DROPPED_BEFORE_ANSWER')
      OR ($7 NOT IN ('CALLER_DROPPED','NO_ANSWER') AND latest_call_status=$7)
    )
  `;
}

export async function getArchiveFacets(workspaceId: string, brandId: string) {
  const [totals, agents, businessNumbers] = await Promise.all([
    pgQuery(
      `SELECT
         COUNT(*)::bigint total,
         COUNT(*) FILTER (WHERE status='UNQUALIFIED')::bigint unqualified,
         COUNT(*) FILTER (WHERE status='CLOSED_LOST')::bigint closed_lost,
         COUNT(*) FILTER (WHERE status='PURCHASED')::bigint purchased_legacy,
         MAX(archived_at) last_archived_at
       FROM call_commerce.call_leads
       WHERE workspace_id=$1 AND brand_id=$2 AND is_archived=TRUE`,
      [workspaceId, brandId]
    ),
    pgQuery(
      `SELECT
         COALESCE(NULLIF(TRIM(latest_agent_name),''),'Unassigned') agent,
         COUNT(*)::bigint leads
       FROM call_commerce.call_leads
       WHERE workspace_id=$1 AND brand_id=$2 AND is_archived=TRUE
       GROUP BY 1
       ORDER BY COUNT(*) DESC,1
       LIMIT 100`,
      [workspaceId, brandId]
    ),
    pgQuery(
      `SELECT
         latest_business_number business_number,
         COUNT(*)::bigint leads
       FROM call_commerce.call_leads
       WHERE workspace_id=$1 AND brand_id=$2 AND is_archived=TRUE
         AND latest_business_number IS NOT NULL
         AND TRIM(latest_business_number)!=''
       GROUP BY 1
       ORDER BY COUNT(*) DESC,1
       LIMIT 100`,
      [workspaceId, brandId]
    ),
  ]);

  return {
    ...(totals.rows[0] || {}),
    agents: agents.rows,
    business_numbers: businessNumbers.rows,
  };
}

export async function getCallCommerceReportRaw(input: CallCommerceReportInput) {
  const normalizedType = input.type === 'meta-events' ? 'events' : input.type;
  const params = [
    input.workspaceId,
    input.brandId,
    input.start || '',
    input.end || '',
    input.search || '',
    input.status || '',
    String(input.callStatus || '').toUpperCase(),
    input.agent || '',
    input.businessNumber || '',
  ];

  const full = normalizedType === 'full';
  const leadTypes = new Set([
    'active-leads',
    'all-leads',
    'follow-up-leads',
    'purchased-leads',
    'unqualified-leads',
    'closed-lost-leads',
  ]);
  const attemptTypes = new Set([
    'call-attempts',
    'repeat-callers',
    'call-outcomes',
    'disconnect-analysis',
  ]);

  const needsCreatedLeads = full || leadTypes.has(normalizedType);
  const needsArchivedLeads = full || normalizedType === 'archived-leads';
  const needsAttempts = full || attemptTypes.has(normalizedType);
  const needsEvents = full || normalizedType === 'events';
  const needsActivity = full || normalizedType === 'activity-log';

  const createdLeadsPromise = needsCreatedLeads
    ? pgQuery(
        `SELECT ${LEAD_COLUMNS}
         FROM call_commerce.call_leads
         WHERE ${leadFilterSql('created')}
         ORDER BY COALESCE(latest_call_at,created_at) DESC,lead_id DESC`,
        params
      )
    : Promise.resolve({ rows: [] as any[] } as any);

  const archivedLeadsPromise = needsArchivedLeads
    ? pgQuery(
        `SELECT ${LEAD_COLUMNS}
         FROM call_commerce.call_leads
         WHERE ${leadFilterSql('archived')} AND is_archived=TRUE
         ORDER BY archived_at DESC,lead_id DESC`,
        params
      )
    : Promise.resolve({ rows: [] as any[] } as any);

  const attemptsPromise = needsAttempts
    ? pgQuery(
        `SELECT ${ATTEMPT_COLUMNS}
         FROM call_commerce.call_attempts
         WHERE workspace_id=$1 AND brand_id=$2
           ${buildDatePredicate('COALESCE(call_started_at,created_at)', 3, 4)}
         ORDER BY COALESCE(call_started_at,created_at) DESC,attempt_id DESC`,
        params.slice(0, 4)
      )
    : Promise.resolve({ rows: [] as any[] } as any);

  const eventsPromise = needsEvents
    ? pgQuery(
        `SELECT *
         FROM call_commerce.meta_event_queue
         WHERE workspace_id=$1 AND brand_id=$2
           ${buildDatePredicate('created_at', 3, 4)}
         ORDER BY created_at DESC`,
        params.slice(0, 4)
      )
    : Promise.resolve({ rows: [] as any[] } as any);

  const activityPromise = needsActivity
    ? pgQuery(
        `SELECT *
         FROM call_commerce.activity_log
         WHERE workspace_id=$1 AND brand_id=$2
           ${buildDatePredicate('created_at', 3, 4)}
         ORDER BY created_at DESC`,
        params.slice(0, 4)
      )
    : Promise.resolve({ rows: [] as any[] } as any);

  const [leads, archivedLeads, attempts, events, activity] = await Promise.all([
    createdLeadsPromise,
    archivedLeadsPromise,
    attemptsPromise,
    eventsPromise,
    activityPromise,
  ]);

  return {
    leads: leads.rows || [],
    archivedLeads: archivedLeads.rows || [],
    attempts: attempts.rows || [],
    events: events.rows || [],
    activity: activity.rows || [],
  };
}
