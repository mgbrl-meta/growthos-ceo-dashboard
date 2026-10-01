import 'server-only';

import { pgQuery } from '@/lib/operational-postgres/client';
import { CALL_COMMERCE_DEFAULTS } from './config';

export type CallCommerceSettings = {
  contactMinDurationSeconds: number;
  reopenGraceMinutes: number;
  autoArchiveTerminalLeads: boolean;
  terminalArchiveDays: number;
  requireUnqualifiedReason: boolean;
  requireClosedLostReason: boolean;
  requirePurchaseOrderId: boolean;
  requirePurchaseAmount: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const CALL_COMMERCE_SETTINGS_DEFAULTS: CallCommerceSettings = {
  contactMinDurationSeconds: Number(CALL_COMMERCE_DEFAULTS.contactMinDurationSeconds),
  reopenGraceMinutes: Number(CALL_COMMERCE_DEFAULTS.reopenGraceMinutes),
  autoArchiveTerminalLeads: true,
  terminalArchiveDays: Number(CALL_COMMERCE_DEFAULTS.terminalArchiveDays),
  requireUnqualifiedReason: false,
  requireClosedLostReason: false,
  requirePurchaseOrderId: false,
  requirePurchaseAmount: false,
  updatedAt: null,
  updatedBy: null,
};

type CacheEntry = { expiresAt: number; value: CallCommerceSettings };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function cacheKey(workspaceId: string, brandId: string) {
  return `${workspaceId}:${brandId}`;
}

function normalize(row: any): CallCommerceSettings {
  return {
    contactMinDurationSeconds: Number(row?.contact_min_duration_seconds ?? CALL_COMMERCE_SETTINGS_DEFAULTS.contactMinDurationSeconds),
    reopenGraceMinutes: Number(row?.reopen_grace_minutes ?? CALL_COMMERCE_SETTINGS_DEFAULTS.reopenGraceMinutes),
    autoArchiveTerminalLeads: row?.auto_archive_terminal_leads ?? CALL_COMMERCE_SETTINGS_DEFAULTS.autoArchiveTerminalLeads,
    terminalArchiveDays: Number(row?.terminal_archive_days ?? CALL_COMMERCE_SETTINGS_DEFAULTS.terminalArchiveDays),
    requireUnqualifiedReason: row?.require_unqualified_reason ?? CALL_COMMERCE_SETTINGS_DEFAULTS.requireUnqualifiedReason,
    requireClosedLostReason: row?.require_closed_lost_reason ?? CALL_COMMERCE_SETTINGS_DEFAULTS.requireClosedLostReason,
    requirePurchaseOrderId: row?.require_purchase_order_id ?? CALL_COMMERCE_SETTINGS_DEFAULTS.requirePurchaseOrderId,
    requirePurchaseAmount: row?.require_purchase_amount ?? CALL_COMMERCE_SETTINGS_DEFAULTS.requirePurchaseAmount,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedBy: row?.updated_by ?? null,
  };
}

function clampInteger(value: unknown, min: number, max: number, code: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < min || number > max) {
    throw new Error(code);
  }
  return number;
}

function validateSettings(settings: CallCommerceSettings): CallCommerceSettings {
  return {
    contactMinDurationSeconds: clampInteger(settings.contactMinDurationSeconds, 1, 600, 'CALL_COMMERCE_CONTACT_DURATION_INVALID'),
    reopenGraceMinutes: clampInteger(settings.reopenGraceMinutes, 0, 10080, 'CALL_COMMERCE_REOPEN_GRACE_INVALID'),
    autoArchiveTerminalLeads: Boolean(settings.autoArchiveTerminalLeads),
    terminalArchiveDays: clampInteger(settings.terminalArchiveDays, 1, 365, 'CALL_COMMERCE_ARCHIVE_DAYS_INVALID'),
    requireUnqualifiedReason: Boolean(settings.requireUnqualifiedReason),
    requireClosedLostReason: Boolean(settings.requireClosedLostReason),
    requirePurchaseOrderId: Boolean(settings.requirePurchaseOrderId),
    requirePurchaseAmount: Boolean(settings.requirePurchaseAmount),
    updatedAt: settings.updatedAt || null,
    updatedBy: settings.updatedBy || null,
  };
}

export async function getCallCommerceSettings(
  workspaceId: string,
  brandId: string
): Promise<CallCommerceSettings> {
  const result = await pgQuery(
    `SELECT * FROM call_commerce.settings WHERE workspace_id=$1 AND brand_id=$2 LIMIT 1`,
    [workspaceId, brandId]
  );
  return result.rows[0] ? normalize(result.rows[0]) : { ...CALL_COMMERCE_SETTINGS_DEFAULTS };
}

export async function getCallCommerceSettingsCached(
  workspaceId: string,
  brandId: string
): Promise<CallCommerceSettings> {
  const key = cacheKey(workspaceId, brandId);
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.value;
  const value = await getCallCommerceSettings(workspaceId, brandId);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function updateCallCommerceSettings(input: {
  workspaceId: string;
  brandId: string;
  actorUserId: string;
  settings: Partial<CallCommerceSettings>;
}): Promise<CallCommerceSettings> {
  const current = await getCallCommerceSettings(input.workspaceId, input.brandId);
  const next = validateSettings({ ...current, ...input.settings });

  await pgQuery(
    `INSERT INTO call_commerce.settings (
       workspace_id,brand_id,contact_min_duration_seconds,reopen_grace_minutes,
       auto_archive_terminal_leads,terminal_archive_days,require_unqualified_reason,
       require_closed_lost_reason,require_purchase_order_id,require_purchase_amount,
       updated_by,created_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
     ON CONFLICT (workspace_id,brand_id) DO UPDATE SET
       contact_min_duration_seconds=EXCLUDED.contact_min_duration_seconds,
       reopen_grace_minutes=EXCLUDED.reopen_grace_minutes,
       auto_archive_terminal_leads=EXCLUDED.auto_archive_terminal_leads,
       terminal_archive_days=EXCLUDED.terminal_archive_days,
       require_unqualified_reason=EXCLUDED.require_unqualified_reason,
       require_closed_lost_reason=EXCLUDED.require_closed_lost_reason,
       require_purchase_order_id=EXCLUDED.require_purchase_order_id,
       require_purchase_amount=EXCLUDED.require_purchase_amount,
       updated_by=EXCLUDED.updated_by,
       updated_at=NOW()`,
    [
      input.workspaceId,
      input.brandId,
      next.contactMinDurationSeconds,
      next.reopenGraceMinutes,
      next.autoArchiveTerminalLeads,
      next.terminalArchiveDays,
      next.requireUnqualifiedReason,
      next.requireClosedLostReason,
      next.requirePurchaseOrderId,
      next.requirePurchaseAmount,
      input.actorUserId,
    ]
  );

  cache.delete(cacheKey(input.workspaceId, input.brandId));
  return getCallCommerceSettings(input.workspaceId, input.brandId);
}
