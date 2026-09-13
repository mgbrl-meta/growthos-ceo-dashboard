import 'server-only';

import crypto from 'crypto';

import { bigquery } from '@/lib/bigquery';

import type {
  GrowthOSBillingAccount,
  GrowthOSBillingChannel,
  GrowthOSBillingCycle,
  GrowthOSBillingInvoice,
  GrowthOSBillingMigration,
  GrowthOSBillingMigrationStatus,
  GrowthOSBillingPlanMapping,
  GrowthOSBillingProfile,
  GrowthOSBillingProvider,
  GrowthOSBillingStatus,
} from './types';

const PROJECT_ID =
  process.env.GCP_PROJECT_ID ||
  process.env.BQ_PROJECT_ID ||
  '';

const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET ||
  'growthos_control';

const LOCATION =
  process.env.GCP_BQ_LOCATION ||
  'asia-south1';

let ensurePromise: Promise<void> | null = null;

function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error('Billing requires GCP_PROJECT_ID or BQ_PROJECT_ID');
  }
  return PROJECT_ID;
}

function deterministicId(prefix: string, parts: string[]) {
  return `${prefix}_${crypto
    .createHash('sha256')
    .update(parts.join(':'))
    .digest('hex')
    .slice(0, 24)}`;
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export async function ensureGrowthOSBillingStore() {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const projectId = requireProjectId();

    await Promise.all([
      bigquery.query({
        location: LOCATION,
        query: `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET_ID}.billing_accounts\` (
            billing_account_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            billing_channel STRING NOT NULL,
            billing_provider STRING NOT NULL,
            internal_plan_id STRING,
            external_customer_id STRING,
            external_subscription_id STRING,
            external_plan_id STRING,
            status STRING NOT NULL,
            currency STRING,
            billing_cycle STRING,
            current_period_start TIMESTAMP,
            current_period_end TIMESTAMP,
            cancel_at_period_end BOOL,
            migration_lock BOOL,
            metadata JSON,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY workspace_id, brand_id, billing_channel, status
        `,
      }),
      bigquery.query({
        location: LOCATION,
        query: `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET_ID}.billing_profiles\` (
            profile_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            legal_business_name STRING,
            gstin STRING,
            address_line_1 STRING,
            address_line_2 STRING,
            city STRING,
            state STRING,
            postal_code STRING,
            country STRING,
            invoice_email STRING,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY workspace_id, brand_id
        `,
      }),
      bigquery.query({
        location: LOCATION,
        query: `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET_ID}.billing_plan_mappings\` (
            mapping_id STRING NOT NULL,
            plan_id STRING NOT NULL,
            billing_channel STRING NOT NULL,
            billing_provider STRING NOT NULL,
            external_plan_id STRING NOT NULL,
            currency STRING,
            billing_cycle STRING,
            status STRING NOT NULL,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY plan_id, billing_channel, billing_provider, status
        `,
      }),
      bigquery.query({
        location: LOCATION,
        query: `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET_ID}.billing_migrations\` (
            migration_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            from_channel STRING NOT NULL,
            from_provider STRING NOT NULL,
            from_external_subscription_id STRING,
            to_channel STRING NOT NULL,
            to_provider STRING NOT NULL,
            target_plan_id STRING NOT NULL,
            target_external_plan_id STRING,
            target_external_subscription_id STRING,
            status STRING NOT NULL,
            started_by STRING NOT NULL,
            failure_reason STRING,
            metadata JSON,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            completed_at TIMESTAMP
          )
          CLUSTER BY workspace_id, brand_id, status
        `,
      }),
      bigquery.query({
        location: LOCATION,
        query: `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET_ID}.billing_events\` (
            event_id STRING NOT NULL,
            provider STRING NOT NULL,
            provider_event_id STRING NOT NULL,
            event_type STRING NOT NULL,
            workspace_id STRING,
            brand_id STRING,
            external_subscription_id STRING,
            status STRING NOT NULL,
            payload JSON,
            created_at TIMESTAMP,
            processed_at TIMESTAMP
          )
          CLUSTER BY provider, provider_event_id, event_type
        `,
      }),
      bigquery.query({
        location: LOCATION,
        query: `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET_ID}.billing_invoices\` (
            invoice_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            provider STRING NOT NULL,
            external_invoice_id STRING NOT NULL,
            external_subscription_id STRING,
            amount_minor INT64,
            currency STRING,
            status STRING,
            invoice_url STRING,
            invoice_date TIMESTAMP,
            due_date TIMESTAMP,
            paid_at TIMESTAMP,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY workspace_id, brand_id, provider, status
        `,
      }),
    ]);
  })().catch(error => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}

export async function getBillingAccount(workspaceId: string, brandId: string): Promise<GrowthOSBillingAccount | null> {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `
      SELECT
        billing_account_id, workspace_id, brand_id, billing_channel,
        billing_provider, internal_plan_id, external_customer_id,
        external_subscription_id, external_plan_id, status, currency,
        billing_cycle,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', current_period_start) AS current_period_start,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', current_period_end) AS current_period_end,
        COALESCE(cancel_at_period_end, FALSE) AS cancel_at_period_end,
        COALESCE(migration_lock, FALSE) AS migration_lock,
        metadata,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at) AS updated_at
      FROM \`${projectId}.${DATASET_ID}.billing_accounts\`
      WHERE workspace_id = @workspace_id AND brand_id = @brand_id
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY workspace_id, brand_id
        ORDER BY updated_at DESC, created_at DESC, billing_account_id DESC
      ) = 1
    `,
    params: { workspace_id: workspaceId, brand_id: brandId },
    types: { workspace_id: 'STRING', brand_id: 'STRING' },
  });
  const row: any = rows?.[0];
  if (!row) return null;
  return {
    billingAccountId: String(row.billing_account_id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    channel: String(row.billing_channel) as GrowthOSBillingChannel,
    provider: String(row.billing_provider) as GrowthOSBillingProvider,
    internalPlanId: row.internal_plan_id ?? null,
    externalCustomerId: row.external_customer_id ?? null,
    externalSubscriptionId: row.external_subscription_id ?? null,
    externalPlanId: row.external_plan_id ?? null,
    status: String(row.status) as GrowthOSBillingStatus,
    currency: row.currency ?? null,
    billingCycle: (row.billing_cycle ?? null) as GrowthOSBillingCycle,
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    migrationLock: Boolean(row.migration_lock),
    metadata: parseJson(row.metadata),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function upsertBillingAccount(input: {
  workspaceId: string;
  brandId: string;
  channel: GrowthOSBillingChannel;
  provider: GrowthOSBillingProvider;
  internalPlanId?: string | null;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalPlanId?: string | null;
  status: GrowthOSBillingStatus;
  currency?: string | null;
  billingCycle?: GrowthOSBillingCycle;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  migrationLock?: boolean;
  metadata?: Record<string, unknown> | null;
}) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const billingAccountId = deterministicId('billacct', [input.workspaceId, input.brandId]);

  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.billing_accounts\` target
      USING (
        SELECT
          @billing_account_id AS billing_account_id,
          @workspace_id AS workspace_id,
          @brand_id AS brand_id,
          @billing_channel AS billing_channel,
          @billing_provider AS billing_provider,
          NULLIF(@internal_plan_id, '') AS internal_plan_id,
          NULLIF(@external_customer_id, '') AS external_customer_id,
          NULLIF(@external_subscription_id, '') AS external_subscription_id,
          NULLIF(@external_plan_id, '') AS external_plan_id,
          @status AS status,
          NULLIF(@currency, '') AS currency,
          NULLIF(@billing_cycle, '') AS billing_cycle,
          TIMESTAMP(NULLIF(@current_period_start, '')) AS current_period_start,
          TIMESTAMP(NULLIF(@current_period_end, '')) AS current_period_end,
          @cancel_at_period_end AS cancel_at_period_end,
          @migration_lock AS migration_lock,
          PARSE_JSON(@metadata_json) AS metadata
      ) source
      ON target.workspace_id = source.workspace_id AND target.brand_id = source.brand_id
      WHEN MATCHED THEN UPDATE SET
        billing_account_id = source.billing_account_id,
        billing_channel = source.billing_channel,
        billing_provider = source.billing_provider,
        internal_plan_id = source.internal_plan_id,
        external_customer_id = source.external_customer_id,
        external_subscription_id = source.external_subscription_id,
        external_plan_id = source.external_plan_id,
        status = source.status,
        currency = source.currency,
        billing_cycle = source.billing_cycle,
        current_period_start = source.current_period_start,
        current_period_end = source.current_period_end,
        cancel_at_period_end = source.cancel_at_period_end,
        migration_lock = source.migration_lock,
        metadata = source.metadata,
        updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        billing_account_id, workspace_id, brand_id, billing_channel,
        billing_provider, internal_plan_id, external_customer_id,
        external_subscription_id, external_plan_id, status, currency,
        billing_cycle, current_period_start, current_period_end,
        cancel_at_period_end, migration_lock, metadata, created_at, updated_at
      ) VALUES (
        source.billing_account_id, source.workspace_id, source.brand_id,
        source.billing_channel, source.billing_provider, source.internal_plan_id,
        source.external_customer_id, source.external_subscription_id,
        source.external_plan_id, source.status, source.currency,
        source.billing_cycle, source.current_period_start, source.current_period_end,
        source.cancel_at_period_end, source.migration_lock, source.metadata,
        CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
      )
    `,
    params: {
      billing_account_id: billingAccountId,
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      billing_channel: input.channel,
      billing_provider: input.provider,
      internal_plan_id: input.internalPlanId ?? '',
      external_customer_id: input.externalCustomerId ?? '',
      external_subscription_id: input.externalSubscriptionId ?? '',
      external_plan_id: input.externalPlanId ?? '',
      status: input.status,
      currency: input.currency ?? '',
      billing_cycle: input.billingCycle ?? '',
      current_period_start: input.currentPeriodStart ?? '',
      current_period_end: input.currentPeriodEnd ?? '',
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      migration_lock: input.migrationLock ?? false,
      metadata_json: JSON.stringify(input.metadata ?? {}),
    },
  });

  return getBillingAccount(input.workspaceId, input.brandId);
}

export async function getBillingProfile(workspaceId: string, brandId: string): Promise<GrowthOSBillingProfile | null> {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `
      SELECT profile_id, workspace_id, brand_id, legal_business_name, gstin,
        address_line_1, address_line_2, city, state, postal_code, country,
        invoice_email,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at) AS updated_at
      FROM \`${projectId}.${DATASET_ID}.billing_profiles\`
      WHERE workspace_id = @workspace_id AND brand_id = @brand_id
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY workspace_id, brand_id
        ORDER BY updated_at DESC, created_at DESC, profile_id DESC
      ) = 1
    `,
    params: { workspace_id: workspaceId, brand_id: brandId },
  });
  const row: any = rows?.[0];
  if (!row) return null;
  return {
    profileId: String(row.profile_id), workspaceId: String(row.workspace_id), brandId: String(row.brand_id),
    legalBusinessName: row.legal_business_name ?? null, gstin: row.gstin ?? null,
    addressLine1: row.address_line_1 ?? null, addressLine2: row.address_line_2 ?? null,
    city: row.city ?? null, state: row.state ?? null, postalCode: row.postal_code ?? null,
    country: row.country ?? null, invoiceEmail: row.invoice_email ?? null,
    createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null,
  };
}

export async function upsertBillingProfile(input: {
  workspaceId: string; brandId: string; legalBusinessName?: string | null; gstin?: string | null;
  addressLine1?: string | null; addressLine2?: string | null; city?: string | null;
  state?: string | null; postalCode?: string | null; country?: string | null; invoiceEmail?: string | null;
}) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const profileId = deterministicId('billprof', [input.workspaceId, input.brandId]);
  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.billing_profiles\` target
      USING (SELECT @profile_id profile_id, @workspace_id workspace_id, @brand_id brand_id,
        NULLIF(@legal_business_name, '') legal_business_name, NULLIF(@gstin, '') gstin, NULLIF(@address_line_1, '') address_line_1,
        NULLIF(@address_line_2, '') address_line_2, NULLIF(@city, '') city, NULLIF(@state, '') state, NULLIF(@postal_code, '') postal_code,
        NULLIF(@country, '') country, NULLIF(@invoice_email, '') invoice_email) source
      ON target.workspace_id = source.workspace_id AND target.brand_id = source.brand_id
      WHEN MATCHED THEN UPDATE SET legal_business_name = source.legal_business_name,
        gstin = source.gstin, address_line_1 = source.address_line_1, address_line_2 = source.address_line_2,
        city = source.city, state = source.state, postal_code = source.postal_code,
        country = source.country, invoice_email = source.invoice_email, updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (profile_id, workspace_id, brand_id, legal_business_name, gstin,
        address_line_1, address_line_2, city, state, postal_code, country, invoice_email, created_at, updated_at)
      VALUES (source.profile_id, source.workspace_id, source.brand_id, source.legal_business_name, source.gstin,
        source.address_line_1, source.address_line_2, source.city, source.state, source.postal_code,
        source.country, source.invoice_email, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `,
    params: {
      profile_id: profileId, workspace_id: input.workspaceId, brand_id: input.brandId,
      legal_business_name: input.legalBusinessName ?? '', gstin: input.gstin ?? '',
      address_line_1: input.addressLine1 ?? '', address_line_2: input.addressLine2 ?? '',
      city: input.city ?? '', state: input.state ?? '', postal_code: input.postalCode ?? '',
      country: input.country ?? 'IN', invoice_email: input.invoiceEmail ?? '',
    },
  });
  return getBillingProfile(input.workspaceId, input.brandId);
}

export async function upsertPlanMapping(input: {
  planId: string; channel: GrowthOSBillingChannel; provider: GrowthOSBillingProvider;
  externalPlanId: string; currency?: string | null; billingCycle?: GrowthOSBillingCycle; status?: string;
}) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const mappingId = deterministicId('billmap', [input.planId, input.channel, input.provider]);
  await bigquery.query({
    location: LOCATION,
    query: `
      MERGE \`${projectId}.${DATASET_ID}.billing_plan_mappings\` target
      USING (SELECT @mapping_id mapping_id, @plan_id plan_id, @billing_channel billing_channel,
        @billing_provider billing_provider, @external_plan_id external_plan_id, NULLIF(@currency, '') currency,
        @billing_cycle billing_cycle, NULLIF(@status, '') status) source
      ON target.plan_id = source.plan_id AND target.billing_channel = source.billing_channel
        AND target.billing_provider = source.billing_provider
      WHEN MATCHED THEN UPDATE SET external_plan_id = source.external_plan_id, currency = source.currency,
        billing_cycle = source.billing_cycle, status = source.status, updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (mapping_id, plan_id, billing_channel, billing_provider, external_plan_id,
        currency, billing_cycle, status, created_at, updated_at)
      VALUES (source.mapping_id, source.plan_id, source.billing_channel, source.billing_provider,
        source.external_plan_id, source.currency, source.billing_cycle, source.status,
        CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `,
    params: {
      mapping_id: mappingId, plan_id: input.planId, billing_channel: input.channel,
      billing_provider: input.provider, external_plan_id: input.externalPlanId,
      currency: input.currency ?? '', billing_cycle: input.billingCycle ?? 'monthly', status: input.status ?? 'active',
    },
  });
  return getPlanMapping(input.planId, input.channel, input.provider);
}

export async function getPlanMapping(planId: string, channel: GrowthOSBillingChannel, provider: GrowthOSBillingProvider): Promise<GrowthOSBillingPlanMapping | null> {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `
      SELECT mapping_id, plan_id, billing_channel, billing_provider, external_plan_id, currency,
        billing_cycle, status,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) created_at,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at) updated_at
      FROM \`${projectId}.${DATASET_ID}.billing_plan_mappings\`
      WHERE plan_id = @plan_id AND billing_channel = @billing_channel
        AND billing_provider = @billing_provider AND status = 'active'
      ORDER BY updated_at DESC LIMIT 1
    `,
    params: { plan_id: planId, billing_channel: channel, billing_provider: provider },
  });
  const row: any = rows?.[0];
  if (!row) return null;
  return {
    mappingId: String(row.mapping_id), planId: String(row.plan_id), channel: String(row.billing_channel) as GrowthOSBillingChannel,
    provider: String(row.billing_provider) as GrowthOSBillingProvider, externalPlanId: String(row.external_plan_id),
    currency: row.currency ?? null, billingCycle: (row.billing_cycle ?? null) as GrowthOSBillingCycle,
    status: String(row.status), createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null,
  };
}

export async function listPlanMappings() {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `SELECT mapping_id, plan_id, billing_channel, billing_provider, external_plan_id, currency,
      billing_cycle, status,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) created_at,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at) updated_at
      FROM \`${projectId}.${DATASET_ID}.billing_plan_mappings\`
      ORDER BY plan_id, billing_channel`,
  });
  return (rows || []).map((row: any) => ({
    mappingId: String(row.mapping_id), planId: String(row.plan_id), channel: String(row.billing_channel),
    provider: String(row.billing_provider), externalPlanId: String(row.external_plan_id), currency: row.currency ?? null,
    billingCycle: row.billing_cycle ?? null, status: String(row.status), createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null,
  })) as GrowthOSBillingPlanMapping[];
}

export async function createBillingMigration(input: {
  workspaceId: string; brandId: string; fromChannel: GrowthOSBillingChannel; fromProvider: GrowthOSBillingProvider;
  fromExternalSubscriptionId?: string | null; toChannel: GrowthOSBillingChannel; toProvider: GrowthOSBillingProvider;
  targetPlanId: string; targetExternalPlanId?: string | null; targetExternalSubscriptionId?: string | null;
  startedBy: string; status?: GrowthOSBillingMigrationStatus; metadata?: Record<string, unknown> | null;
}) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();

  const [openRows] = await bigquery.query({
    location: LOCATION,
    query: `SELECT migration_id FROM \`${projectId}.${DATASET_ID}.billing_migrations\`
      WHERE workspace_id = @workspace_id AND brand_id = @brand_id
      AND status IN ('pending','awaiting_customer_confirmation','verifying_target','cancelling_source') LIMIT 1`,
    params: { workspace_id: input.workspaceId, brand_id: input.brandId },
  });
  if (openRows?.length) throw new Error('BILLING_MIGRATION_ALREADY_IN_PROGRESS');

  const migrationId = `billmig_${crypto.randomUUID().replace(/-/g, '')}`;
  await bigquery.query({
    location: LOCATION,
    query: `INSERT INTO \`${projectId}.${DATASET_ID}.billing_migrations\` (
      migration_id, workspace_id, brand_id, from_channel, from_provider,
      from_external_subscription_id, to_channel, to_provider, target_plan_id,
      target_external_plan_id, target_external_subscription_id, status, started_by,
      failure_reason, metadata, created_at, updated_at, completed_at
    ) VALUES (
      @migration_id, NULLIF(@workspace_id, ''), NULLIF(@brand_id, ''), @from_channel, @from_provider,
      NULLIF(@from_external_subscription_id, ''), @to_channel, @to_provider, @target_plan_id,
      NULLIF(@target_external_plan_id, ''), NULLIF(@target_external_subscription_id, ''), @status, @started_by,
      NULL, PARSE_JSON(@metadata_json), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), NULL
    )`,
    params: {
      migration_id: migrationId, workspace_id: input.workspaceId, brand_id: input.brandId,
      from_channel: input.fromChannel, from_provider: input.fromProvider,
      from_external_subscription_id: input.fromExternalSubscriptionId ?? '',
      to_channel: input.toChannel, to_provider: input.toProvider, target_plan_id: input.targetPlanId,
      target_external_plan_id: input.targetExternalPlanId ?? '',
      target_external_subscription_id: input.targetExternalSubscriptionId ?? '',
      status: input.status ?? 'pending', started_by: input.startedBy,
      metadata_json: JSON.stringify(input.metadata ?? {}),
    },
  });
  return getBillingMigration(migrationId);
}

export async function getBillingMigration(migrationId: string): Promise<GrowthOSBillingMigration | null> {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `SELECT *,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) created_at_fmt,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at) updated_at_fmt,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', completed_at) completed_at_fmt
      FROM \`${projectId}.${DATASET_ID}.billing_migrations\`
      WHERE migration_id = @migration_id LIMIT 1`,
    params: { migration_id: migrationId },
  });
  const row: any = rows?.[0];
  if (!row) return null;
  return {
    migrationId: String(row.migration_id), workspaceId: String(row.workspace_id), brandId: String(row.brand_id),
    fromChannel: String(row.from_channel) as GrowthOSBillingChannel, fromProvider: String(row.from_provider) as GrowthOSBillingProvider,
    fromExternalSubscriptionId: row.from_external_subscription_id ?? null,
    toChannel: String(row.to_channel) as GrowthOSBillingChannel, toProvider: String(row.to_provider) as GrowthOSBillingProvider,
    targetPlanId: String(row.target_plan_id), targetExternalPlanId: row.target_external_plan_id ?? null,
    targetExternalSubscriptionId: row.target_external_subscription_id ?? null,
    status: String(row.status) as GrowthOSBillingMigrationStatus, startedBy: String(row.started_by),
    failureReason: row.failure_reason ?? null, metadata: parseJson(row.metadata),
    createdAt: row.created_at_fmt ?? null, updatedAt: row.updated_at_fmt ?? null, completedAt: row.completed_at_fmt ?? null,
  };
}

export async function findOpenMigrationByTargetSubscription(provider: GrowthOSBillingProvider, externalSubscriptionId: string) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `SELECT migration_id FROM \`${projectId}.${DATASET_ID}.billing_migrations\`
      WHERE to_provider = @provider AND target_external_subscription_id = @external_subscription_id
      AND status IN ('pending','awaiting_customer_confirmation','verifying_target','cancelling_source')
      ORDER BY updated_at DESC LIMIT 1`,
    params: { provider, external_subscription_id: externalSubscriptionId },
  });
  return rows?.[0]?.migration_id ? getBillingMigration(String(rows[0].migration_id)) : null;
}

export async function updateBillingMigration(migrationId: string, input: {
  status?: GrowthOSBillingMigrationStatus; targetExternalSubscriptionId?: string | null;
  failureReason?: string | null; metadata?: Record<string, unknown> | null; completed?: boolean;
}) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const existing = await getBillingMigration(migrationId);
  if (!existing) throw new Error('BILLING_MIGRATION_NOT_FOUND');
  await bigquery.query({
    location: LOCATION,
    query: `UPDATE \`${projectId}.${DATASET_ID}.billing_migrations\` SET
      status = @status,
      target_external_subscription_id = NULLIF(@target_external_subscription_id, ''),
      failure_reason = NULLIF(@failure_reason, ''),
      metadata = PARSE_JSON(@metadata_json),
      updated_at = CURRENT_TIMESTAMP(),
      completed_at = IF(@completed, CURRENT_TIMESTAMP(), completed_at)
      WHERE migration_id = @migration_id`,
    params: {
      migration_id: migrationId,
      status: input.status ?? existing.status,
      target_external_subscription_id: input.targetExternalSubscriptionId ?? existing.targetExternalSubscriptionId ?? '',
      failure_reason: input.failureReason ?? '',
      metadata_json: JSON.stringify(input.metadata ?? existing.metadata ?? {}),
      completed: input.completed ?? false,
    },
  });
  return getBillingMigration(migrationId);
}

export async function getLatestBillingMigration(workspaceId: string, brandId: string) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `SELECT migration_id FROM \`${projectId}.${DATASET_ID}.billing_migrations\`
      WHERE workspace_id = @workspace_id AND brand_id = @brand_id
      ORDER BY updated_at DESC LIMIT 1`,
    params: { workspace_id: workspaceId, brand_id: brandId },
  });
  return rows?.[0]?.migration_id ? getBillingMigration(String(rows[0].migration_id)) : null;
}

export async function listBillingInvoices(workspaceId: string, brandId: string): Promise<GrowthOSBillingInvoice[]> {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `SELECT invoice_id, workspace_id, brand_id, provider, external_invoice_id,
      external_subscription_id, amount_minor, currency, status, invoice_url,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', invoice_date) invoice_date,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', due_date) due_date,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', paid_at) paid_at,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) created_at,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at) updated_at
      FROM \`${projectId}.${DATASET_ID}.billing_invoices\`
      WHERE workspace_id = @workspace_id AND brand_id = @brand_id
      ORDER BY invoice_date DESC, updated_at DESC LIMIT 24`,
    params: { workspace_id: workspaceId, brand_id: brandId },
  });
  return (rows || []).map((row: any) => ({
    invoiceId: String(row.invoice_id), workspaceId: String(row.workspace_id), brandId: String(row.brand_id),
    provider: String(row.provider) as GrowthOSBillingProvider, externalInvoiceId: String(row.external_invoice_id),
    externalSubscriptionId: row.external_subscription_id ?? null, amountMinor: row.amount_minor ?? null,
    currency: row.currency ?? null, status: row.status ?? null, invoiceUrl: row.invoice_url ?? null,
    invoiceDate: row.invoice_date ?? null, dueDate: row.due_date ?? null, paidAt: row.paid_at ?? null,
    createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null,
  }));
}

export async function upsertBillingInvoice(input: {
  workspaceId: string; brandId: string; provider: GrowthOSBillingProvider; externalInvoiceId: string;
  externalSubscriptionId?: string | null; amountMinor?: number | null; currency?: string | null;
  status?: string | null; invoiceUrl?: string | null; invoiceDate?: string | null; dueDate?: string | null; paidAt?: string | null;
}) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const invoiceId = deterministicId('billinv', [input.provider, input.externalInvoiceId]);
  await bigquery.query({
    location: LOCATION,
    query: `MERGE \`${projectId}.${DATASET_ID}.billing_invoices\` target
      USING (SELECT @invoice_id invoice_id, @workspace_id workspace_id, @brand_id brand_id, @provider provider,
        @external_invoice_id external_invoice_id, NULLIF(@external_subscription_id, '') external_subscription_id,
        IF(@amount_minor < 0, NULL, @amount_minor) amount_minor, NULLIF(@currency, '') currency, NULLIF(@status, '') status, NULLIF(@invoice_url, '') invoice_url,
        TIMESTAMP(NULLIF(@invoice_date, '')) invoice_date, TIMESTAMP(NULLIF(@due_date, '')) due_date, TIMESTAMP(NULLIF(@paid_at, '')) paid_at) source
      ON target.provider = source.provider AND target.external_invoice_id = source.external_invoice_id
      WHEN MATCHED THEN UPDATE SET status=source.status, amount_minor=source.amount_minor, currency=source.currency,
        invoice_url=source.invoice_url, invoice_date=source.invoice_date, due_date=source.due_date,
        paid_at=source.paid_at, updated_at=CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (invoice_id, workspace_id, brand_id, provider, external_invoice_id,
        external_subscription_id, amount_minor, currency, status, invoice_url, invoice_date, due_date,
        paid_at, created_at, updated_at)
      VALUES (source.invoice_id, source.workspace_id, source.brand_id, source.provider, source.external_invoice_id,
        source.external_subscription_id, source.amount_minor, source.currency, source.status, source.invoice_url,
        source.invoice_date, source.due_date, source.paid_at, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())`,
    params: {
      invoice_id: invoiceId, workspace_id: input.workspaceId, brand_id: input.brandId,
      provider: input.provider, external_invoice_id: input.externalInvoiceId,
      external_subscription_id: input.externalSubscriptionId ?? '', amount_minor: input.amountMinor ?? -1,
      currency: input.currency ?? '', status: input.status ?? '', invoice_url: input.invoiceUrl ?? '',
      invoice_date: input.invoiceDate ?? '', due_date: input.dueDate ?? '', paid_at: input.paidAt ?? '',
    },
  });
}

export async function recordBillingEvent(input: {
  provider: GrowthOSBillingProvider; providerEventId: string; eventType: string;
  workspaceId?: string | null; brandId?: string | null; externalSubscriptionId?: string | null;
  payload?: unknown; status?: string;
}) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const eventId = deterministicId('billevt', [input.provider, input.providerEventId]);
  const [existing] = await bigquery.query({
    location: LOCATION,
    query: `SELECT event_id FROM \`${projectId}.${DATASET_ID}.billing_events\`
      WHERE provider = @provider AND provider_event_id = @provider_event_id LIMIT 1`,
    params: { provider: input.provider, provider_event_id: input.providerEventId },
  });
  if (existing?.length) return { duplicate: true, eventId: String(existing[0].event_id) };
  await bigquery.query({
    location: LOCATION,
    query: `INSERT INTO \`${projectId}.${DATASET_ID}.billing_events\` (
      event_id, provider, provider_event_id, event_type, workspace_id, brand_id,
      external_subscription_id, status, payload, created_at, processed_at
    ) VALUES (@event_id, @provider, @provider_event_id, @event_type, NULLIF(@workspace_id, ''), NULLIF(@brand_id, ''),
      NULLIF(@external_subscription_id, ''), @status, PARSE_JSON(@payload_json), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())`,
    params: {
      event_id: eventId, provider: input.provider, provider_event_id: input.providerEventId,
      event_type: input.eventType, workspace_id: input.workspaceId ?? '', brand_id: input.brandId ?? '',
      external_subscription_id: input.externalSubscriptionId ?? '', status: input.status ?? 'processed',
      payload_json: JSON.stringify(input.payload ?? {}),
    },
  });
  return { duplicate: false, eventId };
}

export async function getBillingAccountByExternalSubscription(provider: GrowthOSBillingProvider, externalSubscriptionId: string) {
  await ensureGrowthOSBillingStore();
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `SELECT workspace_id, brand_id FROM \`${projectId}.${DATASET_ID}.billing_accounts\`
      WHERE billing_provider = @provider AND external_subscription_id = @external_subscription_id
      ORDER BY updated_at DESC LIMIT 1`,
    params: { provider, external_subscription_id: externalSubscriptionId },
  });
  if (!rows?.length) return null;
  return getBillingAccount(String(rows[0].workspace_id), String(rows[0].brand_id));
}

export async function getShopifyBillingContext(workspaceId: string, brandId: string) {
  const projectId = requireProjectId();
  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `
      SELECT provider_account_id,
        COALESCE(JSON_VALUE(metadata, '$.shop_domain'), JSON_VALUE(metadata, '$.shopDomain')) AS shop_domain
      FROM \`${projectId}.${DATASET_ID}.integration_accounts\`
      WHERE workspace_id = @workspace_id AND brand_id = @brand_id AND provider = 'shopify'
      ORDER BY is_selected DESC, updated_at DESC LIMIT 1
    `,
    params: { workspace_id: workspaceId, brand_id: brandId },
  });
  const row: any = rows?.[0];
  if (!row) return null;
  const shopDomain = String(row.shop_domain || '').trim().toLowerCase();
  const shopId = String(row.provider_account_id || '').trim();
  if (!shopDomain || !shopId) return null;
  return { shopDomain, shopId };
}
