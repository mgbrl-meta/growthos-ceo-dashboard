import 'server-only';

import { bigquery } from '@/lib/bigquery';
import {
  CALL_COMMERCE_DATASET,
  CALL_COMMERCE_LOCATION,
} from './config';

const PROJECT_ID =
  process.env.GCP_PROJECT_ID ||
  process.env.BQ_PROJECT_ID ||
  '';

const table = (name: string) =>
  `\`${PROJECT_ID}.${CALL_COMMERCE_DATASET}.${name}\``;

function requireProject() {
  if (!PROJECT_ID) {
    throw new Error(
      'Call Commerce reporting requires GCP project configuration'
    );
  }
}

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

function rangeFilter(
  expression: string
) {
  return `
    AND (
      @start=''
      OR ${expression} >= TIMESTAMP(
        SAFE_CAST(@start AS DATE),
        'Asia/Kolkata'
      )
    )

    AND (
      @end=''
      OR ${expression} < TIMESTAMP(
        DATE_ADD(
          SAFE_CAST(@end AS DATE),
          INTERVAL 1 DAY
        ),
        'Asia/Kolkata'
      )
    )
  `;
}

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

function leadFilterSql(
  mode: 'created' | 'archived' | 'none'
) {
  const timeFilter =
    mode === 'created'
      ? rangeFilter('created_at')
      : mode === 'archived'
        ? rangeFilter('archived_at')
        : '';

  return `
    workspace_id=@workspace_id
    AND brand_id=@brand_id
    ${timeFilter}

    AND (
      @search=''
      OR LOWER(
        CONCAT(
          COALESCE(phone,''),
          ' ',
          COALESCE(customer_name,''),
          ' ',
          COALESCE(email,''),
          ' ',
          COALESCE(product,''),
          ' ',
          COALESCE(order_id,'')
        )
      ) LIKE CONCAT('%',LOWER(@search),'%')
    )

    AND (
      @status=''
      OR status=@status
    )

    AND (
      @agent=''
      OR LOWER(
        COALESCE(latest_agent_name,'')
      )=LOWER(@agent)
    )

    AND (
      @business_number=''
      OR COALESCE(
        latest_business_number,
        ''
      )=@business_number
    )

    AND (
      @call_status=''

      OR (
        @call_status='CALLER_DROPPED'
        AND latest_end_reason=
          'CALLER_DROPPED_BEFORE_ANSWER'
      )

      OR (
        @call_status='NO_ANSWER'
        AND latest_call_status='NO_ANSWER'
        AND COALESCE(
          latest_end_reason,
          ''
        )!='CALLER_DROPPED_BEFORE_ANSWER'
      )

      OR (
        @call_status NOT IN (
          'CALLER_DROPPED',
          'NO_ANSWER'
        )
        AND latest_call_status=@call_status
      )
    )
  `;
}

export async function getArchiveFacets(
  workspaceId: string,
  brandId: string
) {
  requireProject();

  const [rows] = await bigquery.query({
    location: CALL_COMMERCE_LOCATION,

    query: `
      SELECT
        COUNT(*) total,

        COUNTIF(
          status='UNQUALIFIED'
        ) unqualified,

        COUNTIF(
          status='CLOSED_LOST'
        ) closed_lost,

        COUNTIF(
          status='PURCHASED'
        ) purchased_legacy,

        MAX(archived_at)
          last_archived_at,

        ARRAY(
          SELECT AS STRUCT
            agent,
            leads

          FROM (
            SELECT
              COALESCE(
                NULLIF(
                  TRIM(latest_agent_name),
                  ''
                ),
                'Unassigned'
              ) agent,

              COUNT(*) leads

            FROM ${table('call_leads')}

            WHERE workspace_id=@workspace_id
              AND brand_id=@brand_id
              AND is_archived=TRUE

            GROUP BY agent
          )

          ORDER BY leads DESC,agent
          LIMIT 100
        ) agents,

        ARRAY(
          SELECT AS STRUCT
            business_number,
            leads

          FROM (
            SELECT
              latest_business_number
                AS business_number,

              COUNT(*) leads

            FROM ${table('call_leads')}

            WHERE workspace_id=@workspace_id
              AND brand_id=@brand_id
              AND is_archived=TRUE
              AND latest_business_number IS NOT NULL
              AND TRIM(latest_business_number)!=''

            GROUP BY business_number
          )

          ORDER BY leads DESC,business_number
          LIMIT 100
        ) business_numbers

      FROM ${table('call_leads')}

      WHERE workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND is_archived=TRUE
    `,

    params: {
      workspace_id: workspaceId,
      brand_id: brandId,
    },
  });

  return (rows as any[])?.[0] || {};
}

export async function getCallCommerceReportRaw(
  input: CallCommerceReportInput
) {
  requireProject();

  const normalizedType =
    input.type === 'meta-events'
      ? 'events'
      : input.type;

  const params = {
    workspace_id: input.workspaceId,
    brand_id: input.brandId,
    start: input.start || '',
    end: input.end || '',
    search: input.search || '',
    status: input.status || '',
    call_status: String(
      input.callStatus || ''
    ).toUpperCase(),
    agent: input.agent || '',
    business_number:
      input.businessNumber || '',
  };

  const full =
    normalizedType === 'full';

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

  const needsCreatedLeads =
    full ||
    leadTypes.has(
      normalizedType
    );

  const needsArchivedLeads =
    full ||
    normalizedType ===
      'archived-leads';

  const needsAttempts =
    full ||
    attemptTypes.has(
      normalizedType
    );

  const needsEvents =
    full ||
    normalizedType ===
      'events';

  const needsActivity =
    full ||
    normalizedType ===
      'activity-log';

  const createdLeadsPromise =
    needsCreatedLeads
      ? bigquery.query({
          location:
            CALL_COMMERCE_LOCATION,

          query: `
            SELECT
              ${LEAD_COLUMNS}

            FROM ${table('call_leads')}

            WHERE
              ${leadFilterSql('created')}

            ORDER BY
              COALESCE(
                latest_call_at,
                created_at
              ) DESC,
              lead_id DESC
          `,

          params,
        })
      : Promise.resolve(
          [[]] as any
        );

  const archivedLeadsPromise =
    needsArchivedLeads
      ? bigquery.query({
          location:
            CALL_COMMERCE_LOCATION,

          query: `
            SELECT
              ${LEAD_COLUMNS}

            FROM ${table('call_leads')}

            WHERE
              ${leadFilterSql('archived')}
              AND is_archived=TRUE

            ORDER BY
              archived_at DESC,
              lead_id DESC
          `,

          params,
        })
      : Promise.resolve(
          [[]] as any
        );

  const attemptsPromise =
    needsAttempts
      ? bigquery.query({
          location:
            CALL_COMMERCE_LOCATION,

          query: `
            SELECT
              ${ATTEMPT_COLUMNS}

            FROM ${table('call_attempts')}

            WHERE workspace_id=@workspace_id
              AND brand_id=@brand_id

              ${rangeFilter(
                'COALESCE(call_started_at,created_at)'
              )}

            ORDER BY
              COALESCE(
                call_started_at,
                created_at
              ) DESC,
              attempt_id DESC
          `,

          params,
        })
      : Promise.resolve(
          [[]] as any
        );

  const eventsPromise =
    needsEvents
      ? bigquery.query({
          location:
            CALL_COMMERCE_LOCATION,

          query: `
            SELECT *

            FROM ${table('meta_event_queue')}

            WHERE workspace_id=@workspace_id
              AND brand_id=@brand_id

              ${rangeFilter('created_at')}

            ORDER BY
              created_at DESC
          `,

          params,
        })
      : Promise.resolve(
          [[]] as any
        );

  const activityPromise =
    needsActivity
      ? bigquery.query({
          location:
            CALL_COMMERCE_LOCATION,

          query: `
            SELECT *

            FROM ${table('activity_log')}

            WHERE workspace_id=@workspace_id
              AND brand_id=@brand_id

              ${rangeFilter('created_at')}

            ORDER BY
              created_at DESC
          `,

          params,
        })
      : Promise.resolve(
          [[]] as any
        );

  const [
    createdLeadsResult,
    archivedLeadsResult,
    attemptsResult,
    eventsResult,
    activityResult,
  ] = await Promise.all([
    createdLeadsPromise,
    archivedLeadsPromise,
    attemptsPromise,
    eventsPromise,
    activityPromise,
  ]);

  return {
    leads:
      (createdLeadsResult[0] as any[]) || [],

    archivedLeads:
      (archivedLeadsResult[0] as any[]) || [],

    attempts:
      (attemptsResult[0] as any[]) || [],

    events:
      (eventsResult[0] as any[]) || [],

    activity:
      (activityResult[0] as any[]) || [],
  };
}
