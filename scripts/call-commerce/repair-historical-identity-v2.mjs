import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGrowthOsPgPool,
  ensureAdcCredentialFile,
  loadGrowthOsEnv,
} from '../operational-postgres/pg-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
loadGrowthOsEnv(repoRoot);
ensureAdcCredentialFile();

const APPLY = process.argv.includes('--apply');
const ACTOR = 'system:identity-repair-v2';

const OPEN = new Set(['NEW', 'QUALIFIED', 'FOLLOW_UP']);
const TERMINAL = new Set(['PURCHASED', 'UNQUALIFIED', 'CLOSED_LOST']);

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function epoch(value) {
  return asDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;
}

function deterministicId(prefix, parts, length = 24) {
  return `${prefix}_${crypto
    .createHash('sha256')
    .update(parts.map(v => String(v ?? '')).join(':'))
    .digest('hex')
    .slice(0, length)}`;
}

function businessFieldsPresent(row) {
  return Boolean(
    String(row.customer_name || '').trim()
    || String(row.email || '').trim()
    || String(row.product || '').trim()
    || String(row.notes || '').trim()
    || String(row.unqualified_reason || '').trim()
    || String(row.closed_lost_reason || '').trim()
    || row.next_follow_up_at
    || String(row.order_id || '').trim()
    || row.order_amount != null
    || row.purchased_at
  );
}

async function getDuplicateGroups(client) {
  const r = await client.query(`
    SELECT
      workspace_id,
      brand_id,
      regexp_replace(COALESCE(phone,''),'[^0-9]','','g') AS phone_identity,
      COUNT(*)::int AS open_lead_count
    FROM call_commerce.call_leads
    WHERE is_archived=FALSE
      AND status IN ('NEW','QUALIFIED','FOLLOW_UP')
      AND regexp_replace(COALESCE(phone,''),'[^0-9]','','g') <> ''
    GROUP BY workspace_id,brand_id,regexp_replace(COALESCE(phone,''),'[^0-9]','','g')
    HAVING COUNT(*) > 1
    ORDER BY workspace_id,brand_id,phone_identity
  `);
  return r.rows;
}

async function inspectDuplicateGroup(client, group) {
  const leads = await client.query(`
    SELECT
      l.*,
      (
        SELECT MIN(COALESCE(a.call_started_at,a.created_at))
        FROM call_commerce.call_attempts a
        WHERE a.workspace_id=l.workspace_id
          AND a.brand_id=l.brand_id
          AND a.lead_id=l.lead_id
      ) AS earliest_attempt_at,
      (
        SELECT COUNT(*)::int
        FROM call_commerce.call_attempts a
        WHERE a.workspace_id=l.workspace_id
          AND a.brand_id=l.brand_id
          AND a.lead_id=l.lead_id
      ) AS attempt_count,
      (
        SELECT COUNT(*)::int
        FROM call_commerce.activity_log x
        WHERE x.workspace_id=l.workspace_id
          AND x.brand_id=l.brand_id
          AND x.lead_id=l.lead_id
      ) AS activity_count,
      (
        SELECT COUNT(*)::int
        FROM call_commerce.meta_event_queue x
        WHERE x.workspace_id=l.workspace_id
          AND x.brand_id=l.brand_id
          AND x.lead_id=l.lead_id
      ) AS meta_queue_count,
      (
        SELECT COUNT(*)::int
        FROM call_commerce.meta_event_log x
        WHERE x.workspace_id=l.workspace_id
          AND x.brand_id=l.brand_id
          AND x.lead_id=l.lead_id
      ) AS meta_log_count
    FROM call_commerce.call_leads l
    WHERE l.workspace_id=$1
      AND l.brand_id=$2
      AND regexp_replace(COALESCE(l.phone,''),'[^0-9]','','g')=$3
      AND l.is_archived=FALSE
      AND l.status IN ('NEW','QUALIFIED','FOLLOW_UP')
  `, [group.workspace_id, group.brand_id, group.phone_identity]);

  const rows = leads.rows.sort((a, b) => {
    const aa = epoch(a.earliest_attempt_at ?? a.first_call_at ?? a.created_at);
    const bb = epoch(b.earliest_attempt_at ?? b.first_call_at ?? b.created_at);
    if (aa !== bb) return aa - bb;
    return String(a.lead_id).localeCompare(String(b.lead_id));
  });

  const canonical = rows[0];
  const extras = rows.slice(1);

  const blockers = [];
  for (const lead of extras) {
    if (String(lead.status).toUpperCase() !== 'NEW') {
      blockers.push(`${lead.lead_id}: status=${lead.status}, not pristine NEW`);
    }
    if (Number(lead.activity_count || 0) > 0) {
      blockers.push(`${lead.lead_id}: activity_log=${lead.activity_count}`);
    }
    if (Number(lead.meta_queue_count || 0) > 0) {
      blockers.push(`${lead.lead_id}: meta_event_queue=${lead.meta_queue_count}`);
    }
    if (Number(lead.meta_log_count || 0) > 0) {
      blockers.push(`${lead.lead_id}: meta_event_log=${lead.meta_log_count}`);
    }
    if (businessFieldsPresent(lead)) {
      blockers.push(`${lead.lead_id}: contains business/workflow fields`);
    }
  }

  return { group, rows, canonical, extras, blockers };
}

async function getPostTerminalRows(client) {
  const r = await client.query(`
    SELECT
      l.workspace_id,
      l.brand_id,
      l.lead_id AS source_lead_id,
      l.phone AS lead_phone,
      l.customer_name,
      l.email,
      l.currency,
      l.status AS source_lead_status,
      l.status_changed_at,
      a.attempt_id,
      a.connection_id,
      a.provider_call_id,
      a.business_number,
      a.phone AS attempt_phone,
      a.direction,
      a.call_status,
      a.call_started_at,
      a.created_at AS attempt_created_at,
      COALESCE(a.call_started_at,a.created_at) AS attempt_at,
      (
        SELECT COUNT(*)::int
        FROM call_commerce.meta_event_queue q
        WHERE q.workspace_id=a.workspace_id
          AND q.brand_id=a.brand_id
          AND q.call_id=a.attempt_id
      ) AS call_meta_queue_count,
      (
        SELECT COUNT(*)::int
        FROM call_commerce.meta_event_log m
        WHERE m.workspace_id=a.workspace_id
          AND m.brand_id=a.brand_id
          AND m.call_id=a.attempt_id
      ) AS call_meta_log_count
    FROM call_commerce.call_attempts a
    JOIN call_commerce.call_leads l
      ON l.lead_id=a.lead_id
     AND l.workspace_id=a.workspace_id
     AND l.brand_id=a.brand_id
    WHERE l.status IN ('PURCHASED','UNQUALIFIED','CLOSED_LOST')
      AND l.status_changed_at IS NOT NULL
      AND COALESCE(a.call_started_at,a.created_at) > l.status_changed_at
    ORDER BY
      l.workspace_id,
      l.brand_id,
      regexp_replace(COALESCE(a.phone,l.phone,''),'[^0-9]','','g'),
      COALESCE(a.call_started_at,a.created_at),
      a.attempt_id
  `);
  return r.rows;
}

async function findExistingOpenLead(client, workspaceId, brandId, phone, excludeIds = []) {
  const r = await client.query(`
    SELECT *
    FROM call_commerce.call_leads
    WHERE workspace_id=$1
      AND brand_id=$2
      AND regexp_replace(COALESCE(phone,''),'[^0-9]','','g')=$3
      AND is_archived=FALSE
      AND status IN ('NEW','QUALIFIED','FOLLOW_UP')
      AND NOT (lead_id = ANY($4::text[]))
    ORDER BY COALESCE(first_call_at,created_at) ASC,created_at ASC,lead_id ASC
  `, [workspaceId, brandId, phone, excludeIds]);
  return r.rows;
}

async function refreshLeadSummary(client, workspaceId, brandId, leadId) {
  const summary = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE call_status='ANSWERED')::int AS answered,
      COUNT(*) FILTER (
        WHERE call_status IN ('MISSED','NO_ANSWER','BUSY','REJECTED','FAILED')
      )::int AS unanswered,
      MIN(COALESCE(call_started_at,created_at)) AS first_call_at
    FROM call_commerce.call_attempts
    WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
  `, [workspaceId, brandId, leadId]);

  const latest = await client.query(`
    SELECT
      attempt_id,
      provider_call_id,
      business_number,
      COALESCE(NULLIF(call_status,''),'UNKNOWN') AS call_status,
      agent_name,
      duration_seconds,
      disconnect_party,
      end_reason,
      COALESCE(call_started_at,created_at) AS activity_at
    FROM call_commerce.call_attempts
    WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
    ORDER BY
      COALESCE(call_started_at,created_at) DESC,
      COALESCE(provider_updated_at,updated_at) DESC,
      created_at DESC,
      attempt_id DESC
    LIMIT 1
  `, [workspaceId, brandId, leadId]);

  const s = summary.rows[0] || {};
  const l = latest.rows[0] || null;

  await client.query(`
    UPDATE call_commerce.call_leads
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
      updated_at=NOW(),
      updated_by=$17
    WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
  `, [
    workspaceId,
    brandId,
    leadId,
    s.first_call_at ? new Date(s.first_call_at).toISOString() : null,
    l?.activity_at ? new Date(l.activity_at).toISOString() : null,
    l?.call_status || (Number(s.total || 0) ? 'UNKNOWN' : null),
    l?.agent_name || null,
    l?.attempt_id || null,
    l?.provider_call_id || null,
    l?.business_number || null,
    l?.duration_seconds == null ? null : Number(l.duration_seconds),
    l?.disconnect_party || null,
    l?.end_reason || null,
    Number(s.total || 0),
    Number(s.answered || 0),
    Number(s.unanswered || 0),
    ACTOR,
  ]);
}

async function insertActivity(client, input) {
  const activityId = deterministicId('ACT', [
    input.workspaceId,
    input.brandId,
    input.leadId,
    input.type,
    input.key,
  ], 28);

  await client.query(`
    INSERT INTO call_commerce.activity_log (
      activity_id,workspace_id,brand_id,lead_id,activity_type,
      from_status,to_status,details,actor_user_id,created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,NOW())
    ON CONFLICT (activity_id) DO NOTHING
  `, [
    activityId,
    input.workspaceId,
    input.brandId,
    input.leadId,
    input.type,
    input.fromStatus || null,
    input.toStatus || null,
    JSON.stringify(input.details || {}),
    ACTOR,
  ]);
}

async function insertAnalytics(client, input) {
  const eventId = deterministicId('cca', [
    input.workspaceId,
    input.brandId,
    input.type,
    input.entityId,
    input.key,
  ], 28);

  await client.query(`
    INSERT INTO call_commerce.analytics_outbox (
      analytics_event_id,workspace_id,brand_id,event_type,entity_type,entity_id,
      occurred_at,payload,status,attempts,created_at,updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7::jsonb,'PENDING',0,NOW(),NOW())
    ON CONFLICT (analytics_event_id) DO NOTHING
  `, [
    eventId,
    input.workspaceId,
    input.brandId,
    input.type,
    input.entityType,
    input.entityId,
    JSON.stringify(input.payload || {}),
  ]);
}

async function main() {
  const { pool, close } = await createGrowthOsPgPool();

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('call-commerce-identity-repair-v2'))`);

    const duplicateGroups = await getDuplicateGroups(client);
    const duplicatePlans = [];
    const blockers = [];

    for (const group of duplicateGroups) {
      const plan = await inspectDuplicateGroup(client, group);
      duplicatePlans.push(plan);
      blockers.push(...plan.blockers.map(reason => ({
        type: 'DUPLICATE_OPEN_LEAD_UNSAFE_TO_MERGE',
        phone: group.phone_identity,
        reason,
      })));
    }

    const duplicateExtraLeadIds = duplicatePlans.flatMap(p => p.extras.map(x => x.lead_id));
    const postTerminalRows = await getPostTerminalRows(client);

    const terminalByPhone = new Map();
    for (const row of postTerminalRows) {
      const phone = digits(row.attempt_phone || row.lead_phone);
      const key = `${row.workspace_id}:${row.brand_id}:${phone}`;
      if (!terminalByPhone.has(key)) terminalByPhone.set(key, []);
      terminalByPhone.get(key).push(row);
    }

    const splitPlans = [];

    for (const [key, rows] of terminalByPhone.entries()) {
      const [workspaceId, brandId, phone] = key.split(':');
      const sourceLeadIds = [...new Set(rows.map(r => r.source_lead_id))];

      // Multiple independently terminal source lifecycles for the same phone need
      // a fuller event-history replay. Refuse rather than guess.
      if (sourceLeadIds.length > 1) {
        blockers.push({
          type: 'MULTIPLE_TERMINAL_LIFECYCLES_FOR_PHONE',
          phone,
          sourceLeadIds,
        });
        continue;
      }

      const existingOpen = await findExistingOpenLead(
        client,
        workspaceId,
        brandId,
        phone,
        duplicateExtraLeadIds
      );

      if (existingOpen.length > 1) {
        blockers.push({
          type: 'MULTIPLE_OPEN_TARGETS_AFTER_DUPLICATE_PLAN',
          phone,
          leadIds: existingOpen.map(x => x.lead_id),
        });
        continue;
      }

      const first = rows[0];
      const sourceLeadId = first.source_lead_id;
      const earliestAttemptAt = rows
        .map(r => asDate(r.attempt_at))
        .filter(Boolean)
        .sort((a, b) => a - b)[0];

      const targetLeadId = existingOpen[0]?.lead_id || deterministicId('CL', [
        'identity-repair-v2',
        workspaceId,
        brandId,
        phone,
        sourceLeadId,
        rows[0].attempt_id,
      ], 32);

      splitPlans.push({
        workspaceId,
        brandId,
        phone,
        sourceLeadId,
        sourceLeadStatus: first.source_lead_status,
        sourceStatusChangedAt: first.status_changed_at,
        targetLeadId,
        targetExisting: Boolean(existingOpen[0]),
        earliestAttemptAt,
        attemptIds: rows.map(r => r.attempt_id),
        rows,
        customerName: first.customer_name || null,
        email: first.email || null,
        currency: first.currency || 'INR',
      });
    }

    console.log('\n===== IDENTITY REPAIR PLAN =====');
    console.log({
      mode: APPLY ? 'APPLY' : 'DRY_RUN',
      duplicateOpenGroups: duplicatePlans.length,
      duplicateLeadRowsToRemove: duplicatePlans.reduce((n, p) => n + p.extras.length, 0),
      postTerminalAttemptCount: postTerminalRows.length,
      postTerminalLeadSplits: splitPlans.length,
      blockers: blockers.length,
    });

    for (const plan of duplicatePlans) {
      console.log('\nDUPLICATE_OPEN_LEAD_PLAN', {
        workspaceId: plan.group.workspace_id,
        brandId: plan.group.brand_id,
        phone: plan.group.phone_identity,
        canonicalLeadId: plan.canonical?.lead_id,
        canonicalEarliestAttemptAt: plan.canonical?.earliest_attempt_at,
        mergeLeadIds: plan.extras.map(x => x.lead_id),
        attemptsMoved: plan.extras.reduce((n, x) => n + Number(x.attempt_count || 0), 0),
        blockers: plan.blockers,
      });
    }

    for (const plan of splitPlans) {
      console.log('\nPOST_TERMINAL_SPLIT_PLAN', {
        workspaceId: plan.workspaceId,
        brandId: plan.brandId,
        phone: plan.phone,
        sourceLeadId: plan.sourceLeadId,
        sourceLeadStatus: plan.sourceLeadStatus,
        sourceStatusChangedAt: plan.sourceStatusChangedAt,
        targetLeadId: plan.targetLeadId,
        targetExisting: plan.targetExisting,
        earliestAttemptAt: plan.earliestAttemptAt?.toISOString() || null,
        attemptIds: plan.attemptIds,
        callStatuses: plan.rows.map(r => r.call_status),
        metaQueueRefs: plan.rows.reduce((n, r) => n + Number(r.call_meta_queue_count || 0), 0),
        metaLogRefs: plan.rows.reduce((n, r) => n + Number(r.call_meta_log_count || 0), 0),
      });
    }

    if (blockers.length) {
      console.log('\nBLOCKERS');
      console.table(blockers);
      await client.query('ROLLBACK');
      console.error('IDENTITY_REPAIR_BLOCKED_NO_DATA_CHANGED');
      process.exitCode = 2;
      return;
    }

    if (!APPLY) {
      await client.query('ROLLBACK');
      console.log('\nDRY_RUN_COMPLETE_NO_DATA_CHANGED');
      return;
    }

    // -----------------------------------------------------------------------
    // 1. Merge duplicate concurrent OPEN leads caused by legacy race behavior.
    // -----------------------------------------------------------------------
    for (const plan of duplicatePlans) {
      const canonical = plan.canonical;
      for (const extra of plan.extras) {
        await client.query(`
          UPDATE call_commerce.call_attempts
          SET lead_id=$4,updated_at=NOW()
          WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
        `, [
          plan.group.workspace_id,
          plan.group.brand_id,
          extra.lead_id,
          canonical.lead_id,
        ]);

        await insertActivity(client, {
          workspaceId: plan.group.workspace_id,
          brandId: plan.group.brand_id,
          leadId: canonical.lead_id,
          type: 'system_identity_merge',
          key: extra.lead_id,
          details: {
            merged_lead_id: extra.lead_id,
            reason: 'legacy_concurrent_open_lead_race',
            phone_identity: plan.group.phone_identity,
          },
        });

        await insertAnalytics(client, {
          workspaceId: plan.group.workspace_id,
          brandId: plan.group.brand_id,
          type: 'lead.identity_merged',
          entityType: 'lead',
          entityId: canonical.lead_id,
          key: extra.lead_id,
          payload: {
            canonical_lead_id: canonical.lead_id,
            merged_lead_id: extra.lead_id,
            phone_identity: plan.group.phone_identity,
          },
        });

        await client.query(`
          DELETE FROM call_commerce.call_leads
          WHERE workspace_id=$1 AND brand_id=$2 AND lead_id=$3
        `, [plan.group.workspace_id, plan.group.brand_id, extra.lead_id]);
      }

      await refreshLeadSummary(
        client,
        plan.group.workspace_id,
        plan.group.brand_id,
        canonical.lead_id
      );
    }

    // -----------------------------------------------------------------------
    // 2. Split genuinely new physical calls that occurred after terminalization.
    //    No Meta events are emitted or rewritten by this repair.
    // -----------------------------------------------------------------------
    for (const plan of splitPlans) {
      if (!plan.targetExisting) {
        const createdAt = plan.earliestAttemptAt?.toISOString() || new Date().toISOString();

        await client.query(`
          INSERT INTO call_commerce.call_leads (
            lead_id,workspace_id,brand_id,phone,customer_name,email,product,status,
            status_changed_at,notes,unqualified_reason,closed_lost_reason,
            next_follow_up_at,order_id,order_amount,currency,purchased_at,
            first_call_at,latest_call_at,call_attempt_count,answered_attempt_count,
            unanswered_attempt_count,is_archived,archived_at,
            created_at,updated_at,created_by,updated_by
          ) VALUES (
            $1,$2,$3,$4,$5,$6,NULL,'NEW',
            $7::timestamptz,NULL,NULL,NULL,
            NULL,NULL,NULL,$8,NULL,
            $7::timestamptz,$7::timestamptz,0,0,0,FALSE,NULL,
            $7::timestamptz,NOW(),$9,$9
          )
          ON CONFLICT (lead_id) DO NOTHING
        `, [
          plan.targetLeadId,
          plan.workspaceId,
          plan.brandId,
          plan.phone,
          plan.customerName,
          plan.email,
          createdAt,
          plan.currency,
          ACTOR,
        ]);
      }

      await client.query(`
        UPDATE call_commerce.call_attempts
        SET lead_id=$4,updated_at=NOW()
        WHERE workspace_id=$1
          AND brand_id=$2
          AND attempt_id = ANY($3::text[])
      `, [
        plan.workspaceId,
        plan.brandId,
        plan.attemptIds,
        plan.targetLeadId,
      ]);

      await insertActivity(client, {
        workspaceId: plan.workspaceId,
        brandId: plan.brandId,
        leadId: plan.targetLeadId,
        type: 'system_identity_repair',
        key: `${plan.sourceLeadId}:${plan.attemptIds.join(',')}`,
        fromStatus: null,
        toStatus: 'NEW',
        details: {
          source_terminal_lead_id: plan.sourceLeadId,
          source_terminal_status: plan.sourceLeadStatus,
          source_terminal_at: plan.sourceStatusChangedAt,
          reassigned_attempt_ids: plan.attemptIds,
          reason: 'new_physical_calls_after_terminal_lead',
          meta_history_rewritten: false,
        },
      });

      await insertAnalytics(client, {
        workspaceId: plan.workspaceId,
        brandId: plan.brandId,
        type: 'lead.identity_repaired',
        entityType: 'lead',
        entityId: plan.targetLeadId,
        key: `${plan.sourceLeadId}:${plan.attemptIds.join(',')}`,
        payload: {
          source_terminal_lead_id: plan.sourceLeadId,
          target_lead_id: plan.targetLeadId,
          reassigned_attempt_ids: plan.attemptIds,
          phone_identity: plan.phone,
          meta_history_rewritten: false,
        },
      });

      await refreshLeadSummary(
        client,
        plan.workspaceId,
        plan.brandId,
        plan.sourceLeadId
      );
      await refreshLeadSummary(
        client,
        plan.workspaceId,
        plan.brandId,
        plan.targetLeadId
      );
    }

    await client.query('COMMIT');

    console.log('\nIDENTITY_REPAIR_APPLIED', {
      duplicateOpenGroupsRepaired: duplicatePlans.length,
      postTerminalAttemptsReassigned: postTerminalRows.length,
      newOrExistingLeadSplitsProcessed: splitPlans.length,
      metaEventsEmitted: 0,
      metaHistoryRewritten: false,
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
} finally {
  await close().catch(() => {});
}

}

await main();
