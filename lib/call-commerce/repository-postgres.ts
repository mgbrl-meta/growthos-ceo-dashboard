import 'server-only';

import crypto from 'crypto';
import { pgQuery, withPgTransaction } from '@/lib/operational-postgres/client';
import { enqueueMetaFlush, enqueueAnalyticsFlush } from './queue';
import { getCallCommerceSettingsCached } from './settings-store';
import type { CallingFieldMapping, CallingValueMapping } from './types';

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
const deterministic = (prefix: string, parts: Array<string | number | null | undefined>) =>
  `${prefix}_${crypto.createHash('sha256').update(parts.map(v => String(v ?? '')).join(':')).digest('hex').slice(0, 24)}`;

const OPEN_LEAD_STATUSES = new Set(['NEW', 'QUALIFIED', 'FOLLOW_UP']);
const TERMINAL_LEAD_STATUSES = new Set(['PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST']);

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/[^0-9+]/g, '').trim();
}

function toDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function n(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function dateFilterSql(column: string, startIndex: number, endIndex: number) {
  return `
    AND ($${startIndex}::text='' OR ${column} >= (($${startIndex}::date)::timestamp AT TIME ZONE 'Asia/Kolkata'))
    AND ($${endIndex}::text='' OR ${column} < ((($${endIndex}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Asia/Kolkata'))
  `;
}

export async function listCallingConnections(workspaceId: string, brandId: string) {
  const result = await pgQuery(
    `SELECT * FROM call_commerce.calling_connections
     WHERE workspace_id=$1 AND brand_id=$2 AND status!='deleted'
     ORDER BY created_at DESC`,
    [workspaceId, brandId]
  );
  return result.rows;
}

export async function getCallingConnectionById(connectionId: string) {
  const result = await pgQuery(
    `SELECT * FROM call_commerce.calling_connections WHERE connection_id=$1 LIMIT 1`,
    [connectionId]
  );
  return result.rows[0] || null;
}

export const getCallingConnectionByIdFast = getCallingConnectionById;

export async function createCallingConnection(input: {
  workspaceId: string;
  brandId: string;
  connectionName: string;
  providerKey: string;
}) {
  const connectionId = id('ccn');
  const webhookSecret = crypto.randomBytes(24).toString('hex');

  await withPgTransaction(async client => {
    await client.query(
      `INSERT INTO growthos_core.tenants (workspace_id,brand_id)
       VALUES ($1,$2)
       ON CONFLICT (workspace_id,brand_id) DO NOTHING`,
      [input.workspaceId, input.brandId]
    );

    await client.query(
      `INSERT INTO call_commerce.calling_connections (
         connection_id,workspace_id,brand_id,connection_name,provider_key,status,
         webhook_secret,created_at,updated_at
       ) VALUES ($1,$2,$3,$4,$5,'testing',$6,NOW(),NOW())`,
      [
        connectionId,
        input.workspaceId,
        input.brandId,
        input.connectionName,
        input.providerKey,
        webhookSecret,
      ]
    );
  });

  return { connectionId, webhookSecret };
}

export async function deleteCallingConnection(input: {
  workspaceId: string;
  brandId: string;
  connectionId: string;
}) {
  const result = await pgQuery(
    `UPDATE call_commerce.calling_connections
     SET status='deleted',active_mapping_version_id=NULL,updated_at=NOW()
     WHERE connection_id=$1 AND workspace_id=$2 AND brand_id=$3 AND status!='deleted'
     RETURNING connection_id`,
    [input.connectionId, input.workspaceId, input.brandId]
  );
  if (!result.rows.length) throw new Error('CALLING_CONNECTION_NOT_FOUND');
  return { connectionId: input.connectionId, deleted: true };
}

export async function saveMappingVersion(input: {
  workspaceId: string;
  brandId: string;
  connectionId: string;
  fieldMappings: CallingFieldMapping[];
  valueMappings: CallingValueMapping[];
  activate?: boolean;
}) {
  return withPgTransaction(async client => {
    const connection = await client.query(
      `SELECT connection_id FROM call_commerce.calling_connections
       WHERE connection_id=$1 AND workspace_id=$2 AND brand_id=$3 AND status!='deleted'
       FOR UPDATE`,
      [input.connectionId, input.workspaceId, input.brandId]
    );
    if (!connection.rows.length) throw new Error('CALLING_CONNECTION_NOT_FOUND');

    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version),0)+1 AS next_version
       FROM call_commerce.calling_mapping_versions
       WHERE connection_id=$1`,
      [input.connectionId]
    );
    const version = Number(versionResult.rows[0]?.next_version || 1);
    const mappingVersionId = id('map');

    if (input.activate) {
      await client.query(
        `UPDATE call_commerce.calling_mapping_versions
         SET status='superseded'
         WHERE connection_id=$1 AND status='active'`,
        [input.connectionId]
      );
    }

    await client.query(
      `INSERT INTO call_commerce.calling_mapping_versions (
         mapping_version_id,connection_id,workspace_id,brand_id,version,status,
         field_mappings,value_mappings,created_at,activated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW(),CASE WHEN $9 THEN NOW() ELSE NULL END)`,
      [
        mappingVersionId,
        input.connectionId,
        input.workspaceId,
        input.brandId,
        version,
        input.activate ? 'active' : 'draft',
        JSON.stringify(input.fieldMappings || []),
        JSON.stringify(input.valueMappings || []),
        Boolean(input.activate),
      ]
    );

    if (input.activate) {
      await client.query(
        `UPDATE call_commerce.calling_connections
         SET active_mapping_version_id=$1,status='active',updated_at=NOW(),last_error=NULL
         WHERE connection_id=$2 AND workspace_id=$3 AND brand_id=$4`,
        [mappingVersionId, input.connectionId, input.workspaceId, input.brandId]
      );
    }

    return { mappingVersionId, version };
  });
}

export async function storeTestEvent(input: {
  connection: any;
  payload: unknown;
  discoveredFields: unknown;
}) {
  const testEventId = id('tst');
  await withPgTransaction(async client => {
    await client.query(
      `INSERT INTO call_commerce.calling_test_events (
         test_event_id,connection_id,workspace_id,brand_id,provider_key,payload,discovered_fields,received_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NOW())`,
      [
        testEventId,
        input.connection.connection_id,
        input.connection.workspace_id,
        input.connection.brand_id,
        input.connection.provider_key,
        JSON.stringify(input.payload ?? {}),
        JSON.stringify(input.discoveredFields ?? []),
      ]
    );
    await client.query(
      `UPDATE call_commerce.calling_connections
       SET last_event_at=NOW(),updated_at=NOW()
       WHERE connection_id=$1`,
      [input.connection.connection_id]
    );
  });
  return testEventId;
}

export async function getLatestTestEvent(connectionId: string) {
  const result = await pgQuery(
    `SELECT * FROM call_commerce.calling_test_events
     WHERE connection_id=$1 ORDER BY received_at DESC LIMIT 1`,
    [connectionId]
  );
  return result.rows[0] || null;
}

export async function listLeads(input: {
  workspaceId: string;
  brandId: string;
  archived?: boolean;
  status?: string;
  search?: string;
  callStatus?: string;
  agent?: string;
  businessNumber?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 500);
  const offset = Math.max(Number(input.offset || 0), 0);
  const callStatus = String(input.callStatus || '').toUpperCase();

  const values = [
    input.workspaceId,
    input.brandId,
    Boolean(input.archived),
    input.status || '',
    input.search || '',
    input.agent || '',
    input.businessNumber || '',
    callStatus,
    limit,
    offset,
  ];

  const where = `
    workspace_id=$1
    AND brand_id=$2
    AND is_archived=$3
    AND ($4='' OR status=$4)
    AND (
      $5=''
      OR LOWER(CONCAT_WS(' ',COALESCE(phone,''),COALESCE(customer_name,''),COALESCE(email,''),COALESCE(product,''),COALESCE(order_id,'')))
         LIKE '%' || LOWER($5) || '%'
    )
    AND ($6='' OR LOWER(COALESCE(latest_agent_name,''))=LOWER($6))
    AND ($7='' OR COALESCE(latest_business_number,'')=$7)
    AND (
      $8=''
      OR ($8='CALLER_DROPPED' AND latest_end_reason='CALLER_DROPPED_BEFORE_ANSWER')
      OR ($8!='CALLER_DROPPED' AND latest_call_status=$8)
    )
  `;

  const [rowsResult, countResult] = await Promise.all([
    pgQuery(
      `SELECT
         lead_id,phone,customer_name,email,product,status,notes,currency,status_changed_at,
         first_call_at,latest_call_at,latest_call_status,latest_agent_name,latest_attempt_id,
         latest_provider_call_id,latest_business_number,latest_duration_seconds,
         latest_disconnect_party,latest_end_reason,call_attempt_count,answered_attempt_count,
         unanswered_attempt_count,next_follow_up_at,order_id,order_amount,purchased_at,
         unqualified_reason,closed_lost_reason,created_at,updated_at
       FROM call_commerce.call_leads
       WHERE ${where}
       ORDER BY latest_call_at DESC NULLS LAST,updated_at DESC,lead_id DESC
       LIMIT $9 OFFSET $10`,
      values
    ),
    pgQuery(
      `SELECT COUNT(*)::bigint AS total
       FROM call_commerce.call_leads
       WHERE ${where}`,
      values.slice(0, 8)
    ),
  ]);

  return {
    rows: rowsResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
  };
}

export async function getLeadHistory(workspaceId: string, brandId: string, leadId: string) {
  const [attemptsResult, activityResult] = await Promise.allSettled([
    pgQuery(
      `SELECT * FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
       ORDER BY COALESCE(call_started_at,created_at) DESC
       LIMIT 50`,
      [workspaceId, brandId, leadId]
    ),
    pgQuery(
      `SELECT * FROM call_commerce.activity_log
       WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
       ORDER BY created_at DESC
       LIMIT 100`,
      [workspaceId, brandId, leadId]
    ),
  ]);

  const errors: string[] = [];
  const attempts = attemptsResult.status === 'fulfilled' ? attemptsResult.value.rows : [];
  const activity = activityResult.status === 'fulfilled' ? activityResult.value.rows : [];

  if (attemptsResult.status === 'rejected') errors.push(`Call attempts: ${String(attemptsResult.reason)}`);
  if (activityResult.status === 'rejected') errors.push(`Lead activity: ${String(activityResult.reason)}`);
  if (attemptsResult.status === 'rejected' && activityResult.status === 'rejected') {
    throw new Error(errors.join(' | ') || 'CALL_COMMERCE_LEAD_HISTORY_ERROR');
  }

  return { attempts, activity, errors };
}

const transitions: Record<string, string[]> = {
  NEW: ['QUALIFIED', 'UNQUALIFIED'],
  QUALIFIED: ['FOLLOW_UP', 'PURCHASED'],
  FOLLOW_UP: ['FOLLOW_UP', 'PURCHASED', 'CLOSED_LOST'],
};

async function appendAnalyticsEvent(
  client: { query: (text: string, values?: any[]) => Promise<any> },
  input: {
    workspaceId: string;
    brandId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    occurredAt?: string | Date | null;
    payload?: unknown;
  }
) {
  const occurredAt = input.occurredAt
    ? new Date(input.occurredAt).toISOString()
    : new Date().toISOString();
  const analyticsEventId = deterministic('cca', [
    input.workspaceId,
    input.brandId,
    input.eventType,
    input.entityType,
    input.entityId,
    occurredAt,
  ]);

  await client.query(
    `INSERT INTO call_commerce.analytics_outbox (
       analytics_event_id,workspace_id,brand_id,event_type,entity_type,entity_id,
       occurred_at,payload,status,attempts,created_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::jsonb,'PENDING',0,NOW(),NOW())
     ON CONFLICT (analytics_event_id) DO NOTHING`,
    [
      analyticsEventId,
      input.workspaceId,
      input.brandId,
      input.eventType,
      input.entityType,
      input.entityId,
      occurredAt,
      JSON.stringify(input.payload ?? {}),
    ]
  );
}

async function queueMetaEvent(input: {
  workspaceId: string;
  brandId: string;
  leadId: string;
  callId: string | null;
  eventKey: string;
  eventName: string;
  payload: unknown;
}) {
  const payload = input.payload && typeof input.payload === 'object'
    ? input.payload as Record<string, unknown>
    : {};
  const eventCallIdentity = input.eventKey === 'CALL_LEAD_CONNECTED' ? '' : (input.callId || '');
  const eventId = deterministic('cc_meta', [
    input.workspaceId,
    input.brandId,
    input.eventKey,
    input.leadId,
    eventCallIdentity,
    input.eventKey === 'CALL_LEAD_CONVERTED' ? String(payload.order_id || '') : '',
  ]);
  const queueId = deterministic('queue', [input.workspaceId, input.brandId, eventId]);

  await pgQuery(
    `INSERT INTO call_commerce.meta_event_queue (
       queue_id,workspace_id,brand_id,lead_id,call_id,event_key,event_name,event_id,payload,
       status,attempts,next_attempt_at,created_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'PENDING',0,NOW(),NOW(),NOW())
     ON CONFLICT (workspace_id,brand_id,event_id) DO NOTHING`,
    [
      queueId,
      input.workspaceId,
      input.brandId,
      input.leadId,
      input.callId,
      input.eventKey,
      input.eventName,
      eventId,
      JSON.stringify(payload),
    ]
  );

  try {
    await enqueueMetaFlush(input.workspaceId, input.brandId);
  } catch (error) {
    console.error('CALL_COMMERCE_META_FLUSH_ENQUEUE_FAILED', error);
  }

  return eventId;
}

export async function updateLeadWorkflow(input: {
  workspaceId: string;
  brandId: string;
  leadId: string;
  actorUserId: string;
  action: string;
  data?: Record<string, unknown>;
}) {
  const workflowSettings = await getCallCommerceSettingsCached(input.workspaceId, input.brandId);
  let eventToQueue: null | Parameters<typeof queueMetaEvent>[0] = null;

  const result = await withPgTransaction(async client => {
    const leadResult = await client.query(
      `SELECT * FROM call_commerce.call_leads
       WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
       FOR UPDATE`,
      [input.workspaceId, input.brandId, input.leadId]
    );
    const lead = leadResult.rows[0];
    if (!lead) throw new Error('CALL_LEAD_NOT_FOUND');
    if (['PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST'].includes(String(lead.status)) && input.action !== 'update_details') {
      throw new Error('CALL_LEAD_FINALIZED');
    }

    if (input.action === 'update_details') {
      await client.query(
        `UPDATE call_commerce.call_leads
         SET customer_name=$4,email=$5,product=$6,notes=$7,next_follow_up_at=$8::timestamptz,
             updated_at=NOW(),updated_by=$9
         WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3`,
        [
          input.workspaceId,
          input.brandId,
          input.leadId,
          input.data?.customerName || null,
          input.data?.email || null,
          input.data?.product || null,
          input.data?.notes || null,
          input.data?.nextFollowUpAt || null,
          input.actorUserId,
        ]
      );
      return { status: String(lead.status) };
    }

    const targetByAction: Record<string, string> = {
      qualify: 'QUALIFIED',
      unqualify: 'UNQUALIFIED',
      follow_up: 'FOLLOW_UP',
      purchase: 'PURCHASED',
      close_lost: 'CLOSED_LOST',
    };
    const target = targetByAction[input.action];
    if (!target || !(transitions[String(lead.status)] || []).includes(target)) {
      throw new Error('INVALID_CALL_LEAD_TRANSITION');
    }

    const reason = String(input.data?.reason || '').trim();
    const orderId = String(input.data?.orderId || '').trim();
    const orderAmountRaw = input.data?.orderAmount;
    const orderAmount = orderAmountRaw === undefined || orderAmountRaw === null || orderAmountRaw === ''
      ? null
      : Number(orderAmountRaw);

    if (target === 'UNQUALIFIED' && workflowSettings.requireUnqualifiedReason && !reason) {
      throw new Error('CALL_UNQUALIFIED_REASON_REQUIRED');
    }
    if (target === 'CLOSED_LOST' && workflowSettings.requireClosedLostReason && !reason) {
      throw new Error('CALL_CLOSED_LOST_REASON_REQUIRED');
    }
    if (target === 'PURCHASED' && workflowSettings.requirePurchaseOrderId && !orderId) {
      throw new Error('CALL_PURCHASE_ORDER_ID_REQUIRED');
    }
    if (
      target === 'PURCHASED' &&
      workflowSettings.requirePurchaseAmount &&
      (orderAmount === null || !Number.isFinite(orderAmount) || orderAmount <= 0)
    ) {
      throw new Error('CALL_PURCHASE_AMOUNT_REQUIRED');
    }

    await client.query(
      `UPDATE call_commerce.call_leads
       SET
         status=$4,
         status_changed_at=NOW(),
         unqualified_reason=CASE WHEN $4='UNQUALIFIED' THEN $5 ELSE unqualified_reason END,
         closed_lost_reason=CASE WHEN $4='CLOSED_LOST' THEN $5 ELSE closed_lost_reason END,
         next_follow_up_at=CASE WHEN $4='FOLLOW_UP' THEN $6::timestamptz ELSE next_follow_up_at END,
         order_id=CASE WHEN $4='PURCHASED' THEN $7 ELSE order_id END,
         order_amount=CASE WHEN $4='PURCHASED' THEN $8::numeric ELSE order_amount END,
         purchased_at=CASE WHEN $4='PURCHASED' THEN NOW() ELSE purchased_at END,
         updated_at=NOW(),
         updated_by=$9
       WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3`,
      [
        input.workspaceId,
        input.brandId,
        input.leadId,
        target,
        reason || null,
        input.data?.nextFollowUpAt || null,
        orderId || null,
        orderAmount,
        input.actorUserId,
      ]
    );

    await client.query(
      `INSERT INTO call_commerce.activity_log (
         activity_id,workspace_id,brand_id,lead_id,activity_type,from_status,to_status,
         details,actor_user_id,created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,NOW())`,
      [
        id('act'),
        input.workspaceId,
        input.brandId,
        input.leadId,
        input.action,
        String(lead.status),
        target,
        JSON.stringify(input.data || {}),
        input.actorUserId,
      ]
    );

    await appendAnalyticsEvent(client, {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      eventType: 'lead.status_changed',
      entityType: 'call_lead',
      entityId: input.leadId,
      payload: {
        from_status: String(lead.status),
        to_status: target,
        actor_user_id: input.actorUserId,
        order_id: target === 'PURCHASED' ? orderId || null : null,
        order_amount: target === 'PURCHASED' ? orderAmount : null,
      },
    });

    const eventMap: Record<string, [string, string]> = {
      QUALIFIED: ['CALL_LEAD_QUALIFIED', 'QualifiedCallLead'],
      UNQUALIFIED: ['CALL_LEAD_UNQUALIFIED', 'UnqualifiedCallLead'],
      PURCHASED: ['CALL_LEAD_CONVERTED', 'ConvertedCallLead'],
    };

    if (eventMap[target]) {
      const [eventKey, eventName] = eventMap[target];
      eventToQueue = {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        leadId: input.leadId,
        callId: null,
        eventKey,
        eventName,
        payload: {
          lead_type: 'call',
          source_module: 'call_commerce',
          lead_id: input.leadId,
          phone: lead.phone,
          email: lead.email || null,
          lead_status: target,
          order_id: target === 'PURCHASED' ? orderId || null : null,
          value: target === 'PURCHASED' ? Number(orderAmount || 0) : null,
          currency: lead.currency || 'INR',
        },
      };
    }

    return { status: target };
  });

  if (eventToQueue) await queueMetaEvent(eventToQueue);
  try {
    await enqueueAnalyticsFlush(input.workspaceId, input.brandId);
  } catch (error) {
    console.error('CALL_COMMERCE_ANALYTICS_FLUSH_ENQUEUE_FAILED', error);
  }
  return result;
}

async function findAttachableLead(input: {
  workspaceId: string;
  brandId: string;
  phone: string;
  callAt: Date;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;
  const settings = await getCallCommerceSettingsCached(input.workspaceId, input.brandId);
  const result = await pgQuery(
    `SELECT lead_id,status,status_changed_at,latest_call_at,updated_at,created_at
     FROM call_commerce.call_leads
     WHERE workspace_id=$1 AND brand_id=$2 AND phone=$3 AND is_archived=FALSE
       AND status IN ('NEW','QUALIFIED','FOLLOW_UP','PURCHASED','UNQUALIFIED','CLOSED_LOST')
     ORDER BY COALESCE(latest_call_at,updated_at,created_at) DESC
     LIMIT 50`,
    [input.workspaceId, input.brandId, phone]
  );

  const open = result.rows.find(row => OPEN_LEAD_STATUSES.has(String(row.status || '').toUpperCase()));
  if (open) return open;

  const graceMs = settings.reopenGraceMinutes * 60_000;
  let best: any = null;
  let bestAt = -1;
  for (const row of result.rows) {
    if (!TERMINAL_LEAD_STATUSES.has(String(row.status || '').toUpperCase())) continue;
    const terminalAt = toDate(row.status_changed_at) || toDate(row.updated_at);
    if (!terminalAt) continue;
    const delta = input.callAt.getTime() - terminalAt.getTime();
    if (delta >= 0 && delta <= graceMs && terminalAt.getTime() > bestAt) {
      best = row;
      bestAt = terminalAt.getTime();
    }
  }
  return best;
}

async function refreshLeadSummary(workspaceId: string, brandId: string, leadId: string, actor: string) {
  const [summary, latest] = await Promise.all([
    pgQuery(
      `SELECT
         COUNT(*)::int total,
         COUNT(*) FILTER (WHERE call_status='ANSWERED')::int answered,
         COUNT(*) FILTER (WHERE call_status IN ('MISSED','NO_ANSWER','BUSY','REJECTED','FAILED'))::int unanswered,
         MIN(COALESCE(call_started_at,created_at)) first_call_at
       FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3`,
      [workspaceId, brandId, leadId]
    ),
    pgQuery(
      `SELECT *,COALESCE(call_started_at,created_at) activity_at
       FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
       ORDER BY COALESCE(call_started_at,created_at) DESC,COALESCE(provider_updated_at,updated_at) DESC
       LIMIT 1`,
      [workspaceId, brandId, leadId]
    ),
  ]);

  const s = summary.rows[0] || {};
  const l = latest.rows[0] || {};
  await pgQuery(
    `UPDATE call_commerce.call_leads
     SET
       first_call_at=COALESCE($4::timestamptz,first_call_at),
       latest_call_at=$5::timestamptz,
       latest_call_status=$6,
       latest_agent_name=$7,
       latest_attempt_id=$8,
       latest_provider_call_id=$9,
       latest_business_number=$10,
       latest_duration_seconds=$11,
       latest_disconnect_party=$12,
       latest_end_reason=$13,
       call_attempt_count=$14,
       answered_attempt_count=$15,
       unanswered_attempt_count=$16,
       updated_at=NOW(),updated_by=$17
     WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3`,
    [
      workspaceId,
      brandId,
      leadId,
      s.first_call_at || null,
      l.activity_at || null,
      l.call_status || null,
      l.agent_name || null,
      l.attempt_id || null,
      l.provider_call_id || null,
      l.business_number || null,
      l.duration_seconds == null ? null : Number(l.duration_seconds),
      l.disconnect_party || null,
      l.end_reason || null,
      Number(s.total || 0),
      Number(s.answered || 0),
      Number(s.unanswered || 0),
      actor,
    ]
  );
}

export async function createManualLead(input: {
  workspaceId: string;
  brandId: string;
  actorUserId: string;
  phone: string;
  customerName?: string;
  email?: string;
  product?: string;
  notes?: string;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error('CALL_PHONE_REQUIRED');
  const now = new Date();
  const lead = await findAttachableLead({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    phone,
    callAt: now,
  });
  const createdLead = !lead;
  const leadId = lead?.lead_id || id('CL');
  const attemptId = id('CA');
  const providerCallId = `MANUAL_${crypto.randomUUID().replace(/-/g, '')}`;

  await withPgTransaction(async client => {
    if (!lead) {
      await client.query(
        `INSERT INTO call_commerce.call_leads (
           lead_id,workspace_id,brand_id,phone,customer_name,email,product,status,notes,currency,
           status_changed_at,first_call_at,latest_call_at,call_attempt_count,answered_attempt_count,
           unanswered_attempt_count,is_archived,created_at,updated_at,created_by,updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'NEW',$8,'INR',NOW(),$9,$9,0,0,0,FALSE,NOW(),NOW(),$10,$10)`,
        [
          leadId,
          input.workspaceId,
          input.brandId,
          phone,
          input.customerName || null,
          input.email || null,
          input.product || null,
          input.notes || null,
          now,
          input.actorUserId,
        ]
      );
    }

    await client.query(
      `INSERT INTO call_commerce.call_attempts (
         attempt_id,workspace_id,brand_id,connection_id,provider_key,provider_call_id,lead_id,phone,
         event_type,call_status,direction,call_started_at,provider_updated_at,duration_seconds,created_at,updated_at
       ) VALUES ($1,$2,$3,'manual','MANUAL',$4,$5,$6,'manual.incoming_call','MANUAL_CREATED','INBOUND',$7,$7,0,NOW(),NOW())`,
      [attemptId, input.workspaceId, input.brandId, providerCallId, leadId, phone, now]
    );

    await appendAnalyticsEvent(client, {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      eventType: 'manual_call.created',
      entityType: 'call_attempt',
      entityId: attemptId,
      occurredAt: now,
      payload: { lead_id: leadId, provider_call_id: providerCallId, phone },
    });
  });

  await refreshLeadSummary(input.workspaceId, input.brandId, leadId, input.actorUserId);
  try {
    await enqueueAnalyticsFlush(input.workspaceId, input.brandId);
  } catch (error) {
    console.error('CALL_COMMERCE_ANALYTICS_FLUSH_ENQUEUE_FAILED', error);
  }
  return { leadId, attemptId, providerCallId, createdLead, attachedToExistingLead: !createdLead };
}

export async function getSummary(workspaceId: string, brandId: string, start?: string, end?: string) {
  const settings = await getCallCommerceSettingsCached(workspaceId, brandId);
  const startValue = start || '';
  const endValue = end || '';
  const attemptFilter = dateFilterSql('created_at', 3, 4);
  const leadFilter = dateFilterSql('created_at', 3, 4);
  const base = [workspaceId, brandId, startValue, endValue];

  const [callTotalsR, repeatR, leadTotalsR, trendR, hourlyR, agentR, statusesR, numbersR] = await Promise.all([
    pgQuery(
      `SELECT
         COUNT(*)::bigint total_calls,
         COUNT(DISTINCT lead_id)::bigint unique_leads,
         COUNT(*) FILTER (WHERE call_status='ANSWERED')::bigint answered,
         COUNT(*) FILTER (WHERE call_status IN ('NO_ANSWER','MISSED','BUSY','REJECTED','FAILED') AND COALESCE(end_reason,'')!='CALLER_DROPPED_BEFORE_ANSWER')::bigint no_answer,
         COUNT(*) FILTER (WHERE end_reason='CALLER_DROPPED_BEFORE_ANSWER')::bigint caller_dropped,
         COUNT(*) FILTER (WHERE call_status='UNKNOWN')::bigint unknown,
         COUNT(*) FILTER (WHERE call_status='RINGING')::bigint ringing,
         COUNT(*) FILTER (WHERE call_status='FAILED')::bigint failed,
         COUNT(*) FILTER (WHERE end_reason='CUSTOMER_DISCONNECTED')::bigint customer_disconnected,
         COUNT(*) FILTER (WHERE end_reason='AGENT_DISCONNECTED')::bigint agent_disconnected,
         COUNT(*) FILTER (WHERE disconnect_party='BUSINESS_ROUTING' AND end_reason='UNANSWERED')::bigint business_routing_unanswered,
         COUNT(*) FILTER (WHERE end_reason='USER_UNREACHABLE')::bigint user_unreachable,
         COUNT(*) FILTER (WHERE end_reason='NETWORK_FAILURE')::bigint network_failure,
         COUNT(*) FILTER (WHERE call_status='ANSWERED' AND COALESCE(duration_seconds,0)>=$5)::bigint quality_connected,
         COUNT(*) FILTER (WHERE call_status='ANSWERED' AND COALESCE(duration_seconds,0)<$5)::bigint short_connected,
         COALESCE(AVG(duration_seconds) FILTER (WHERE call_status='ANSWERED'),0)::float8 avg_talk_time_seconds,
         COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE call_status='ANSWERED'),0)::float8 median_talk_time_seconds,
         COALESCE(SUM(duration_seconds) FILTER (WHERE call_status='ANSWERED'),0)::bigint total_talk_time_seconds,
         COALESCE(MAX(duration_seconds) FILTER (WHERE call_status='ANSWERED'),0)::bigint longest_answered_seconds,
         MAX(COALESCE(call_started_at,created_at)) last_call_at
       FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 ${attemptFilter}`,
      [...base, settings.contactMinDurationSeconds]
    ),
    pgQuery(
      `SELECT COUNT(*)::bigint repeat_leads FROM (
         SELECT lead_id FROM call_commerce.call_attempts
         WHERE workspace_id=$1 AND brand_id=$2 ${attemptFilter} AND lead_id IS NOT NULL
         GROUP BY lead_id HAVING COUNT(*)>1
       ) x`,
      base
    ),
    pgQuery(
      `SELECT
         COUNT(*)::bigint leads,
         COUNT(*) FILTER (WHERE answered_attempt_count>0)::bigint connected,
         COUNT(*) FILTER (WHERE status IN ('QUALIFIED','FOLLOW_UP','PURCHASED','CLOSED_LOST'))::bigint qualified,
         COUNT(*) FILTER (WHERE status='FOLLOW_UP')::bigint follow_up,
         COUNT(*) FILTER (WHERE status='PURCHASED')::bigint purchased,
         COUNT(*) FILTER (WHERE status='UNQUALIFIED')::bigint unqualified,
         COUNT(*) FILTER (WHERE status='CLOSED_LOST')::bigint closed_lost,
         COALESCE(SUM(order_amount) FILTER (WHERE status='PURCHASED'),0)::float8 revenue,
         COALESCE(AVG(order_amount) FILTER (WHERE status='PURCHASED'),0)::float8 avg_order_value
       FROM call_commerce.call_leads
       WHERE workspace_id=$1 AND brand_id=$2 AND is_archived=FALSE ${leadFilter}`,
      base
    ),
    pgQuery(
      `SELECT
         TO_CHAR((COALESCE(call_started_at,created_at) AT TIME ZONE 'Asia/Kolkata')::date,'YYYY-MM-DD') date,
         COUNT(*)::bigint total_calls,
         COUNT(*) FILTER (WHERE call_status='ANSWERED')::bigint answered,
         COUNT(*) FILTER (WHERE call_status IN ('NO_ANSWER','MISSED','BUSY','REJECTED','FAILED') AND COALESCE(end_reason,'')!='CALLER_DROPPED_BEFORE_ANSWER')::bigint no_answer,
         COUNT(*) FILTER (WHERE end_reason='CALLER_DROPPED_BEFORE_ANSWER')::bigint caller_dropped,
         COUNT(*) FILTER (WHERE call_status='UNKNOWN')::bigint unknown,
         COALESCE(AVG(duration_seconds) FILTER (WHERE call_status='ANSWERED'),0)::float8 avg_talk_time_seconds
       FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 ${attemptFilter}
       GROUP BY 1 ORDER BY 1`,
      base
    ),
    pgQuery(
      `SELECT
         EXTRACT(HOUR FROM (COALESCE(call_started_at,created_at) AT TIME ZONE 'Asia/Kolkata'))::int AS "hour",
         COUNT(*)::bigint calls,
         COUNT(*) FILTER (WHERE call_status='ANSWERED')::bigint answered
       FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 ${attemptFilter}
       GROUP BY 1 ORDER BY 1`,
      base
    ),
    pgQuery(
      `SELECT
         COALESCE(NULLIF(TRIM(agent_name),''),'Unassigned') agent_name,
         COUNT(*)::bigint calls,
         COUNT(*) FILTER (WHERE call_status='ANSWERED')::bigint answered,
         COUNT(*) FILTER (WHERE call_status IN ('NO_ANSWER','MISSED','BUSY','REJECTED','FAILED') AND COALESCE(end_reason,'')!='CALLER_DROPPED_BEFORE_ANSWER')::bigint no_answer,
         COUNT(*) FILTER (WHERE end_reason='CALLER_DROPPED_BEFORE_ANSWER')::bigint caller_dropped,
         COALESCE(AVG(duration_seconds) FILTER (WHERE call_status='ANSWERED'),0)::float8 avg_talk_time_seconds,
         COALESCE(SUM(duration_seconds) FILTER (WHERE call_status='ANSWERED'),0)::bigint total_talk_time_seconds
       FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 ${attemptFilter}
       GROUP BY 1 ORDER BY COUNT(*) DESC,1 LIMIT 20`,
      base
    ),
    pgQuery(
      `SELECT status,COUNT(*)::bigint leads
       FROM call_commerce.call_leads
       WHERE workspace_id=$1 AND brand_id=$2 AND is_archived=FALSE ${leadFilter}
       GROUP BY status ORDER BY COUNT(*) DESC,status`,
      base
    ),
    pgQuery(
      `SELECT business_number,COUNT(*)::bigint calls
       FROM call_commerce.call_attempts
       WHERE workspace_id=$1 AND brand_id=$2 ${attemptFilter}
         AND business_number IS NOT NULL AND TRIM(business_number)!=''
       GROUP BY business_number ORDER BY COUNT(*) DESC,business_number LIMIT 20`,
      base
    ),
  ]);

  const ct = callTotalsR.rows[0] || {};
  const lt = leadTotalsR.rows[0] || {};
  const totalCalls = n(ct.total_calls);
  const answered = n(ct.answered);
  const noAnswer = n(ct.no_answer);
  const dropped = n(ct.caller_dropped);
  const leads = n(lt.leads);
  const qualified = n(lt.qualified);
  const purchased = n(lt.purchased);

  const hourly = hourlyR.rows.map(row => ({
    ...row,
    hour: n(row.hour),
    calls: n(row.calls),
    answered: n(row.answered),
    answer_rate: pct(n(row.answered), n(row.calls)),
  }));
  const agentPerformance = agentR.rows.map(row => ({
    ...row,
    calls: n(row.calls),
    answered: n(row.answered),
    no_answer: n(row.no_answer),
    caller_dropped: n(row.caller_dropped),
    answer_rate: pct(n(row.answered), n(row.calls)),
    avg_talk_time_seconds: n(row.avg_talk_time_seconds),
    total_talk_time_seconds: n(row.total_talk_time_seconds),
  }));

  return {
    total_calls: totalCalls,
    unique_leads: n(ct.unique_leads),
    repeat_leads: n(repeatR.rows[0]?.repeat_leads),
    answered,
    no_answer: noAnswer,
    caller_dropped: dropped,
    unknown: n(ct.unknown),
    ringing: n(ct.ringing),
    failed: n(ct.failed),
    customer_disconnected: n(ct.customer_disconnected),
    agent_disconnected: n(ct.agent_disconnected),
    business_routing_unanswered: n(ct.business_routing_unanswered),
    user_unreachable: n(ct.user_unreachable),
    network_failure: n(ct.network_failure),
    quality_connected: n(ct.quality_connected),
    short_connected: n(ct.short_connected),
    avg_talk_time_seconds: n(ct.avg_talk_time_seconds),
    median_talk_time_seconds: n(ct.median_talk_time_seconds),
    total_talk_time_seconds: n(ct.total_talk_time_seconds),
    longest_answered_seconds: n(ct.longest_answered_seconds),
    last_call_at: ct.last_call_at ? new Date(ct.last_call_at).toISOString() : null,
    answer_rate: pct(answered, totalCalls),
    no_answer_rate: pct(noAnswer, totalCalls),
    caller_drop_rate: pct(dropped, totalCalls),
    calls: leads,
    connected: n(lt.connected),
    qualified,
    follow_up: n(lt.follow_up),
    purchased,
    unqualified: n(lt.unqualified),
    closed_lost: n(lt.closed_lost),
    revenue: n(lt.revenue),
    avg_order_value: n(lt.avg_order_value),
    qualification_rate: pct(qualified, leads),
    qualified_purchase_rate: pct(purchased, qualified),
    call_purchase_rate: pct(purchased, leads),
    trend: trendR.rows.map(row => ({
      ...row,
      total_calls: n(row.total_calls),
      answered: n(row.answered),
      no_answer: n(row.no_answer),
      caller_dropped: n(row.caller_dropped),
      unknown: n(row.unknown),
      avg_talk_time_seconds: n(row.avg_talk_time_seconds),
    })),
    hourly,
    agent_performance: agentPerformance,
    lead_statuses: statusesR.rows.map(row => ({ status: row.status, leads: n(row.leads) })),
    business_numbers: numbersR.rows.map(row => ({ business_number: row.business_number, calls: n(row.calls) })),
  };
}

export async function getSystemStatus(workspaceId: string, brandId: string) {
  const [connections, meta, leads] = await Promise.all([
    pgQuery(
      `SELECT COUNT(*)::bigint total,
              COUNT(*) FILTER (WHERE status='active')::bigint active,
              MAX(last_event_at) last_event_at,
              MAX(last_success_at) last_success_at
       FROM call_commerce.calling_connections
       WHERE workspace_id=$1 AND brand_id=$2 AND status!='deleted'`,
      [workspaceId, brandId]
    ),
    pgQuery(
      `SELECT
         COUNT(*) FILTER (WHERE status='PENDING')::bigint pending,
         COUNT(*) FILTER (WHERE status='RETRY')::bigint retry,
         COUNT(*) FILTER (WHERE status='NEEDS_ATTENTION')::bigint needs_attention
       FROM call_commerce.meta_event_queue
       WHERE workspace_id=$1 AND brand_id=$2`,
      [workspaceId, brandId]
    ),
    pgQuery(
      `SELECT MAX(latest_call_at) last_call_at,COUNT(*)::bigint active_leads
       FROM call_commerce.call_leads
       WHERE workspace_id=$1 AND brand_id=$2 AND is_archived=FALSE`,
      [workspaceId, brandId]
    ),
  ]);

  const normalizeCounts = (row: any) => Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key, /^(total|active|pending|retry|needs_attention|active_leads)$/.test(key) ? n(value) : value])
  );

  return {
    calling: normalizeCounts(connections.rows[0]),
    meta: normalizeCounts(meta.rows[0]),
    leads: normalizeCounts(leads.rows[0]),
    store: 'postgres',
  };
}

export async function archiveEligibleLeads(workspaceId: string, brandId: string) {
  const settings = await getCallCommerceSettingsCached(workspaceId, brandId);
  if (!settings.autoArchiveTerminalLeads) {
    return { enabled: false, archiveDays: settings.terminalArchiveDays, archived: 0 };
  }

  const result = await pgQuery(
    `UPDATE call_commerce.call_leads l
     SET is_archived=TRUE,archived_at=NOW(),updated_at=NOW()
     WHERE l.workspace_id=$1
       AND l.brand_id=$2
       AND l.is_archived=FALSE
       AND l.status IN ('UNQUALIFIED','CLOSED_LOST')
       AND COALESCE(l.status_changed_at,l.updated_at) < NOW() - ($3::text || ' days')::interval
       AND NOT EXISTS (
         SELECT 1 FROM call_commerce.meta_event_queue q
         WHERE q.workspace_id=l.workspace_id
           AND q.brand_id=l.brand_id
           AND q.lead_id=l.lead_id
           AND q.status IN ('PENDING','PROCESSING','RETRY')
       )
     RETURNING lead_id`,
    [workspaceId, brandId, settings.terminalArchiveDays]
  );

  return {
    enabled: true,
    archiveDays: settings.terminalArchiveDays,
    archived: result.rowCount || 0,
  };
}
