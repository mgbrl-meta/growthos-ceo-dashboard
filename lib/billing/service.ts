import 'server-only';

import {
  authenticateRequest,
  type AuthIdentity,
} from '@/lib/auth/request-auth';

import type {
  NextRequest,
} from 'next/server';

import {
  getGrowthOSWorkspaceSubscriptionSnapshot,
  upsertGrowthOSBrandSubscription,
} from '@/lib/admin/control-plane';

import {
  createBillingMigration,
  findOpenMigrationByTargetSubscription,
  getBillingAccount,
  getBillingAccountByExternalSubscription,
  getBillingProfile,
  getLatestBillingMigration,
  getPlanMapping,
  getShopifyBillingContext,
  listBillingInvoices,
  recordBillingEvent,
  updateBillingMigration,
  upsertBillingAccount,
  upsertBillingInvoice,
  upsertPlanMapping,
} from './store';

import type {
  GrowthOSBillingChannel,
  GrowthOSBillingProvider,
} from './types';

import {
  cancelRazorpaySubscription,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  fetchRazorpaySubscriptionInvoices,
} from './providers/razorpay';

import {
  buildShopifyPricingPlanUrl,
  cancelShopifyActiveSubscription,
  fetchShopifyActiveSubscription,
  shopifyBillingSetupStatus,
} from './providers/shopify-app-pricing';

export class GrowthOSBillingError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'GrowthOSBillingError';
    this.code = code;
    this.status = status;
  }
}

export async function requireBillingManager(request: NextRequest | Request) {
  const identity = await authenticateRequest(request as NextRequest);
  if (!identity) {
    throw new GrowthOSBillingError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  const workspaceId = String(identity.workspaceId || '').trim();
  const brandId = String(identity.brandId || '').trim();
  const role = String(identity.role || '').trim().toLowerCase();

  if (!workspaceId || !brandId) {
    throw new GrowthOSBillingError('ACTIVE_BRAND_REQUIRED', 'Active brand required', 400);
  }

  if (role !== 'owner' && role !== 'admin') {
    throw new GrowthOSBillingError('BILLING_ACCESS_REQUIRED', 'Owner or Admin access required', 403);
  }

  return { identity, workspaceId, brandId };
}

export async function requireBillingRead(request: NextRequest | Request) {
  const identity = await authenticateRequest(request as NextRequest);
  if (!identity) {
    throw new GrowthOSBillingError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  const workspaceId = String(identity.workspaceId || '').trim();
  const brandId = String(identity.brandId || '').trim();

  if (!workspaceId || !brandId) {
    throw new GrowthOSBillingError('ACTIVE_BRAND_REQUIRED', 'Active brand required', 400);
  }

  return { identity, workspaceId, brandId };
}

export async function getBillingSnapshot(workspaceId: string, brandId: string) {
  const [subscription, billingAccount, billingProfile, invoices, latestMigration] = await Promise.all([
    getGrowthOSWorkspaceSubscriptionSnapshot(workspaceId, brandId),
    getBillingAccount(workspaceId, brandId),
    getBillingProfile(workspaceId, brandId),
    listBillingInvoices(workspaceId, brandId),
    getLatestBillingMigration(workspaceId, brandId),
  ]);

  const shopifyContext = await getShopifyBillingContext(workspaceId, brandId);

  return {
    subscription,
    billingAccount,
    billingProfile,
    invoices,
    latestMigration,
    providerSetup: {
      razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      shopify: shopifyBillingSetupStatus().configured,
    },
    shopify: shopifyContext
      ? {
          installed: true,
          shopDomain: shopifyContext.shopDomain,
          shopId: shopifyContext.shopId,
        }
      : {
          installed: false,
          shopDomain: null,
          shopId: null,
        },
  };
}

function channelProvider(channel: GrowthOSBillingChannel): GrowthOSBillingProvider {
  if (channel === 'shopify') return 'shopify_app_pricing';
  if (channel === 'direct') return 'razorpay';
  if (channel === 'manual') return 'manual';
  return 'none';
}

export async function startDirectCheckout(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  planId?: string | null;
}) {
  const subscription = await getGrowthOSWorkspaceSubscriptionSnapshot(input.workspaceId, input.brandId);
  const planId = String(input.planId || subscription.plan?.planId || '').trim();
  if (!planId) {
    throw new GrowthOSBillingError('PLAN_REQUIRED', 'A Growth OS plan is required');
  }

  const current = await getBillingAccount(input.workspaceId, input.brandId);
  if (current?.channel === 'shopify') {
    throw new GrowthOSBillingError('ADMIN_MIGRATION_REQUIRED', 'Shopify to Direct requires a platform-admin migration', 409);
  }

  const mapping = await getPlanMapping(planId, 'direct', 'razorpay');
  if (!mapping) {
    throw new GrowthOSBillingError('BILLING_PLAN_MAPPING_REQUIRED', 'Direct Razorpay plan mapping is missing', 409);
  }

  const created = await createRazorpaySubscription({
    planId: mapping.externalPlanId,
    notes: {
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      growthos_plan_id: planId,
      initiated_by: input.userId,
    },
  });

  if (!created.id || !created.shortUrl) {
    throw new GrowthOSBillingError('RAZORPAY_CHECKOUT_UNAVAILABLE', 'Razorpay did not return a checkout URL', 502);
  }

  await upsertBillingAccount({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    channel: 'direct',
    provider: 'razorpay',
    internalPlanId: planId,
    externalSubscriptionId: created.id,
    externalPlanId: mapping.externalPlanId,
    status: 'pending',
    currency: mapping.currency || 'INR',
    billingCycle: mapping.billingCycle || 'monthly',
    currentPeriodStart: created.currentStart,
    currentPeriodEnd: created.currentEnd,
    migrationLock: false,
    metadata: {
      checkout_url: created.shortUrl,
      source: 'workspace_direct_checkout',
    },
  });

  return {
    checkoutUrl: created.shortUrl,
    externalSubscriptionId: created.id,
  };
}

export async function getShopifyManageUrl(workspaceId: string, brandId: string) {
  const context = await getShopifyBillingContext(workspaceId, brandId);
  if (!context) {
    throw new GrowthOSBillingError('SHOPIFY_INSTALLATION_REQUIRED', 'A Shopify installation is required', 409);
  }

  return {
    url: buildShopifyPricingPlanUrl(context.shopDomain),
    shopDomain: context.shopDomain,
  };
}

export async function cancelCurrentBilling(input: {
  workspaceId: string;
  brandId: string;
  defer?: boolean;
}) {
  const account = await getBillingAccount(input.workspaceId, input.brandId);
  if (!account || !account.externalSubscriptionId) {
    throw new GrowthOSBillingError('ACTIVE_BILLING_SUBSCRIPTION_REQUIRED', 'No active provider subscription exists', 409);
  }

  if (account.provider === 'razorpay') {
    await cancelRazorpaySubscription(account.externalSubscriptionId, input.defer ?? true);
    await upsertBillingAccount({
      ...account,
      status: account.status,
      cancelAtPeriodEnd: input.defer ?? true,
    });
    return { ok: true, provider: 'razorpay' };
  }

  if (account.provider === 'shopify_app_pricing') {
    const context = await getShopifyBillingContext(input.workspaceId, input.brandId);
    if (!context) throw new GrowthOSBillingError('SHOPIFY_INSTALLATION_REQUIRED', 'Shopify installation required', 409);
    await cancelShopifyActiveSubscription(context.shopId, {
      deferCancellation: input.defer ?? true,
      prorate: false,
      skipFinalUsageCharge: true,
    });
    await upsertBillingAccount({
      ...account,
      status: account.status,
      cancelAtPeriodEnd: input.defer ?? true,
    });
    return { ok: true, provider: 'shopify_app_pricing' };
  }

  throw new GrowthOSBillingError('UNSUPPORTED_BILLING_PROVIDER', 'Current billing provider cannot be cancelled automatically', 409);
}

export async function refreshDirectInvoices(workspaceId: string, brandId: string) {
  const account = await getBillingAccount(workspaceId, brandId);
  if (!account || account.provider !== 'razorpay' || !account.externalSubscriptionId) {
    throw new GrowthOSBillingError('DIRECT_SUBSCRIPTION_REQUIRED', 'Active direct billing is required', 409);
  }

  const invoices = await fetchRazorpaySubscriptionInvoices(account.externalSubscriptionId);
  for (const invoice of invoices) {
    const createdAt = invoice.date || invoice.issued_at || invoice.created_at;
    const dueAt = invoice.expire_by || invoice.due_at;
    const paidAt = invoice.paid_at;
    await upsertBillingInvoice({
      workspaceId,
      brandId,
      provider: 'razorpay',
      externalInvoiceId: String(invoice.id || ''),
      externalSubscriptionId: account.externalSubscriptionId,
      amountMinor: Number.isFinite(Number(invoice.amount)) ? Number(invoice.amount) : null,
      currency: invoice.currency ? String(invoice.currency) : null,
      status: invoice.status ? String(invoice.status) : null,
      invoiceUrl: invoice.short_url ? String(invoice.short_url) : null,
      invoiceDate: createdAt ? new Date(Number(createdAt) * 1000).toISOString() : null,
      dueDate: dueAt ? new Date(Number(dueAt) * 1000).toISOString() : null,
      paidAt: paidAt ? new Date(Number(paidAt) * 1000).toISOString() : null,
    });
  }

  return listBillingInvoices(workspaceId, brandId);
}

export async function startAdminBillingMigration(input: {
  workspaceId: string;
  brandId: string;
  startedBy: string;
  targetChannel: 'shopify' | 'direct';
  targetPlanId: string;
  targetExternalPlanId?: string | null;
}) {
  const current = await getBillingAccount(input.workspaceId, input.brandId);
  const fromChannel = current?.channel || 'unconfigured';
  const fromProvider = current?.provider || 'none';
  const toProvider = channelProvider(input.targetChannel);

  if (fromChannel === input.targetChannel) {
    throw new GrowthOSBillingError('BILLING_CHANNEL_ALREADY_ACTIVE', 'Target billing channel is already active', 409);
  }

  if (
    fromChannel === 'shopify' &&
    input.targetChannel === 'direct' &&
    String(process.env.GROWTHOS_ALLOW_SHOPIFY_TO_DIRECT_MIGRATION || '').toLowerCase() !== 'true'
  ) {
    throw new GrowthOSBillingError(
      'SHOPIFY_TO_DIRECT_MIGRATION_DISABLED',
      'Shopify-to-Direct migration is disabled by default. Enable only after confirming Shopify commercial eligibility.',
      403
    );
  }

  let mapping = await getPlanMapping(input.targetPlanId, input.targetChannel, toProvider);
  if (!mapping && input.targetExternalPlanId) {
    mapping = await upsertPlanMapping({
      planId: input.targetPlanId,
      channel: input.targetChannel,
      provider: toProvider,
      externalPlanId: input.targetExternalPlanId,
      currency: input.targetChannel === 'direct' ? 'INR' : null,
      billingCycle: 'monthly',
    });
  }

  if (!mapping) {
    throw new GrowthOSBillingError('BILLING_PLAN_MAPPING_REQUIRED', 'Target provider plan ID/handle is required', 409);
  }

  if (input.targetChannel === 'direct') {
    const target = await createRazorpaySubscription({
      planId: mapping.externalPlanId,
      notes: {
        workspace_id: input.workspaceId,
        brand_id: input.brandId,
        growthos_plan_id: input.targetPlanId,
        migration: 'shopify_to_direct',
      },
    });

    const migration = await createBillingMigration({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      fromChannel,
      fromProvider,
      fromExternalSubscriptionId: current?.externalSubscriptionId ?? null,
      toChannel: 'direct',
      toProvider: 'razorpay',
      targetPlanId: input.targetPlanId,
      targetExternalPlanId: mapping.externalPlanId,
      targetExternalSubscriptionId: target.id,
      startedBy: input.startedBy,
      status: 'awaiting_customer_confirmation',
      metadata: { checkout_url: target.shortUrl },
    });

    if (current) {
      await upsertBillingAccount({ ...current, status: 'migration_pending', migrationLock: true });
    }

    return {
      migration,
      checkoutUrl: target.shortUrl,
      requiresCustomerAction: true,
    };
  }

  const shopify = await getShopifyBillingContext(input.workspaceId, input.brandId);
  if (!shopify) {
    throw new GrowthOSBillingError('SHOPIFY_INSTALLATION_REQUIRED', 'Shopify installation required before migration', 409);
  }

  const migration = await createBillingMigration({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    fromChannel,
    fromProvider,
    fromExternalSubscriptionId: current?.externalSubscriptionId ?? null,
    toChannel: 'shopify',
    toProvider: 'shopify_app_pricing',
    targetPlanId: input.targetPlanId,
    targetExternalPlanId: mapping.externalPlanId,
    startedBy: input.startedBy,
    status: 'awaiting_customer_confirmation',
    metadata: { shop_domain: shopify.shopDomain, shop_id: shopify.shopId },
  });

  if (current) {
    await upsertBillingAccount({ ...current, status: 'migration_pending', migrationLock: true });
  }

  return {
    migration,
    checkoutUrl: buildShopifyPricingPlanUrl(shopify.shopDomain),
    requiresCustomerAction: true,
  };
}

async function cancelSourceProviderAfterMigration(migration: Awaited<ReturnType<typeof findOpenMigrationByTargetSubscription>>, workspaceId: string, brandId: string) {
  if (!migration || !migration.fromExternalSubscriptionId) return;

  if (migration.fromProvider === 'razorpay') {
    await cancelRazorpaySubscription(migration.fromExternalSubscriptionId, false);
    return;
  }

  if (migration.fromProvider === 'shopify_app_pricing') {
    const context = await getShopifyBillingContext(workspaceId, brandId);
    if (!context) throw new Error('SHOPIFY_INSTALLATION_REQUIRED');
    await cancelShopifyActiveSubscription(context.shopId, {
      deferCancellation: false,
      prorate: false,
      skipFinalUsageCharge: true,
    });
  }
}

export async function finalizeBillingMigration(input: {
  migrationId: string;
  externalSubscriptionId: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  currency?: string | null;
  billingCycle?: 'monthly' | 'yearly' | 'custom' | null;
  metadata?: Record<string, unknown> | null;
}) {
  const migration = await updateBillingMigration(input.migrationId, {
    status: 'cancelling_source',
    targetExternalSubscriptionId: input.externalSubscriptionId,
    metadata: input.metadata ?? null,
  });

  if (!migration) throw new GrowthOSBillingError('BILLING_MIGRATION_NOT_FOUND', 'Billing migration not found', 404);

  try {
    await cancelSourceProviderAfterMigration(migration, migration.workspaceId, migration.brandId);
  } catch (error: any) {
    await updateBillingMigration(migration.migrationId, {
      status: 'failed',
      failureReason: `SOURCE_CANCELLATION_FAILED:${String(error?.message || error)}`,
      completed: true,
    });
    throw new GrowthOSBillingError(
      'SOURCE_BILLING_CANCELLATION_FAILED',
      'Target billing was confirmed, but the old provider could not be cancelled. Manual intervention is required immediately.',
      502
    );
  }

  await upsertBillingAccount({
    workspaceId: migration.workspaceId,
    brandId: migration.brandId,
    channel: migration.toChannel,
    provider: migration.toProvider,
    internalPlanId: migration.targetPlanId,
    externalSubscriptionId: input.externalSubscriptionId,
    externalPlanId: migration.targetExternalPlanId,
    status: 'active',
    currency: input.currency ?? null,
    billingCycle: input.billingCycle ?? 'monthly',
    currentPeriodStart: input.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: false,
    migrationLock: false,
    metadata: input.metadata ?? {},
  });

  await upsertGrowthOSBrandSubscription({
    workspaceId: migration.workspaceId,
    brandId: migration.brandId,
    planId: migration.targetPlanId,
    status: 'active',
    orderLimitOverrideMode: 'inherit',
  });

  await updateBillingMigration(migration.migrationId, {
    status: 'completed',
    completed: true,
    targetExternalSubscriptionId: input.externalSubscriptionId,
    metadata: input.metadata ?? null,
  });

  return getBillingSnapshot(migration.workspaceId, migration.brandId);
}

export async function syncDirectSubscriptionFromWebhook(input: {
  eventId: string;
  eventType: string;
  subscription: any;
  payload: any;
}) {
  const externalSubscriptionId = String(input.subscription?.id || '').trim();
  if (!externalSubscriptionId) throw new Error('RAZORPAY_SUBSCRIPTION_ID_REQUIRED');

  const duplicate = await recordBillingEvent({
    provider: 'razorpay',
    providerEventId: input.eventId,
    eventType: input.eventType,
    externalSubscriptionId,
    payload: input.payload,
  });
  if (duplicate.duplicate) return { duplicate: true };

  const migration = await findOpenMigrationByTargetSubscription('razorpay', externalSubscriptionId);
  const account = await getBillingAccountByExternalSubscription('razorpay', externalSubscriptionId);

  const status = String(input.subscription?.status || '').toLowerCase();
  const active = status === 'active' || input.eventType === 'subscription.activated';

  if (migration && active) {
    return finalizeBillingMigration({
      migrationId: migration.migrationId,
      externalSubscriptionId,
      currentPeriodStart: input.subscription?.current_start ? new Date(Number(input.subscription.current_start) * 1000).toISOString() : null,
      currentPeriodEnd: input.subscription?.current_end ? new Date(Number(input.subscription.current_end) * 1000).toISOString() : null,
      currency: 'INR',
      billingCycle: 'monthly',
      metadata: { razorpay_status: status },
    });
  }

  if (!account) return { ignored: true };

  const mappedStatus =
    active ? 'active' :
    status === 'halted' ? 'past_due' :
    status === 'paused' ? 'paused' :
    status === 'cancelled' || status === 'completed' ? 'cancelled' :
    'pending';

  await upsertBillingAccount({
    ...account,
    status: mappedStatus,
    currentPeriodStart: input.subscription?.current_start ? new Date(Number(input.subscription.current_start) * 1000).toISOString() : account.currentPeriodStart,
    currentPeriodEnd: input.subscription?.current_end ? new Date(Number(input.subscription.current_end) * 1000).toISOString() : account.currentPeriodEnd,
    metadata: { ...(account.metadata || {}), razorpay_status: status },
  });

  if (active && account.internalPlanId) {
    await upsertGrowthOSBrandSubscription({
      workspaceId: account.workspaceId,
      brandId: account.brandId,
      planId: account.internalPlanId,
      status: 'active',
      orderLimitOverrideMode: 'inherit',
    });
  }

  return { ok: true };
}

export async function confirmShopifyBilling(input: {
  identity: AuthIdentity;
  planHandle: string;
  shopDomain?: string | null;
}) {
  const workspaceId = String(input.identity.workspaceId || '').trim();
  const brandId = String(input.identity.brandId || '').trim();
  if (!workspaceId || !brandId) throw new GrowthOSBillingError('ACTIVE_BRAND_REQUIRED', 'Active brand required', 400);

  const context = await getShopifyBillingContext(workspaceId, brandId);
  if (!context) throw new GrowthOSBillingError('SHOPIFY_INSTALLATION_REQUIRED', 'Shopify installation required', 409);

  if (input.shopDomain && String(input.shopDomain).toLowerCase() !== context.shopDomain.toLowerCase()) {
    throw new GrowthOSBillingError('SHOPIFY_TENANT_MISMATCH', 'Shopify shop does not match the authenticated brand', 403);
  }

  const active = await fetchShopifyActiveSubscription(context.shopId);
  if (!active?.primaryHandle) {
    throw new GrowthOSBillingError('SHOPIFY_ACTIVE_SUBSCRIPTION_REQUIRED', 'No active Shopify App Pricing subscription was found', 409);
  }

  if (active.primaryHandle !== input.planHandle) {
    throw new GrowthOSBillingError('SHOPIFY_PLAN_MISMATCH', 'Confirmed Shopify plan does not match the redirect plan handle', 409);
  }

  const projectMapping = await getPlanMappingByExternalHandle('shopify', 'shopify_app_pricing', input.planHandle);
  if (!projectMapping) {
    throw new GrowthOSBillingError('BILLING_PLAN_MAPPING_REQUIRED', 'Shopify plan handle is not mapped to a Growth OS plan', 409);
  }

  const latestMigration = await getLatestBillingMigration(workspaceId, brandId);
  if (
    latestMigration &&
    latestMigration.toChannel === 'shopify' &&
    latestMigration.status === 'awaiting_customer_confirmation'
  ) {
    return finalizeBillingMigration({
      migrationId: latestMigration.migrationId,
      externalSubscriptionId: `${context.shopId}:${active.primaryHandle}`,
      currentPeriodStart: active.currentPeriodStart,
      currentPeriodEnd: active.currentPeriodEnd,
      currency: active.currency,
      billingCycle: active.billingPeriod === 'annual' || active.billingPeriod === 'yearly' ? 'yearly' : 'monthly',
      metadata: { shop_domain: context.shopDomain, shop_id: context.shopId, plan_handle: active.primaryHandle },
    });
  }

  await upsertBillingAccount({
    workspaceId,
    brandId,
    channel: 'shopify',
    provider: 'shopify_app_pricing',
    internalPlanId: projectMapping.planId,
    externalSubscriptionId: `${context.shopId}:${active.primaryHandle}`,
    externalPlanId: active.primaryHandle,
    status: 'active',
    currency: active.currency,
    billingCycle: active.billingPeriod === 'annual' || active.billingPeriod === 'yearly' ? 'yearly' : 'monthly',
    currentPeriodStart: active.currentPeriodStart,
    currentPeriodEnd: active.currentPeriodEnd,
    cancelAtPeriodEnd: active.cancelAtEndOfCycle,
    migrationLock: false,
    metadata: { shop_domain: context.shopDomain, shop_id: context.shopId, plan_handle: active.primaryHandle },
  });

  await upsertGrowthOSBrandSubscription({
    workspaceId,
    brandId,
    planId: projectMapping.planId,
    status: 'active',
    orderLimitOverrideMode: 'inherit',
  });

  return getBillingSnapshot(workspaceId, brandId);
}

async function getPlanMappingByExternalHandle(
  channel: GrowthOSBillingChannel,
  provider: GrowthOSBillingProvider,
  externalPlanId: string
) {
  const { listPlanMappings } = await import('./store');
  const mappings = await listPlanMappings();
  return mappings.find(mapping =>
    mapping.channel === channel &&
    mapping.provider === provider &&
    mapping.externalPlanId === externalPlanId &&
    mapping.status === 'active'
  ) || null;
}

export async function verifyDirectSubscriptionAndMaybeActivate(workspaceId: string, brandId: string) {
  const account = await getBillingAccount(workspaceId, brandId);
  if (!account || account.provider !== 'razorpay' || !account.externalSubscriptionId) return account;
  const remote = await fetchRazorpaySubscription(account.externalSubscriptionId);
  if (remote.status === 'active') {
    await upsertBillingAccount({
      ...account,
      status: 'active',
      currentPeriodStart: remote.currentStart,
      currentPeriodEnd: remote.currentEnd,
    });
    if (account.internalPlanId) {
      await upsertGrowthOSBrandSubscription({
        workspaceId,
        brandId,
        planId: account.internalPlanId,
        status: 'active',
        orderLimitOverrideMode: 'inherit',
      });
    }
  }
  return getBillingAccount(workspaceId, brandId);
}
