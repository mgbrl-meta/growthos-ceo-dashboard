import 'server-only';

import {
  ensureGrowthOSAccountStore,
} from '@/lib/account/store';

import {
  ensureGrowthOSAuditStore,
} from '@/lib/audit';

import {
  getGrowthOSWorkspaceSubscriptionSnapshot,
} from '@/lib/admin/control-plane';

import {
  getBillingAccount,
} from '@/lib/billing/store';

import {
  resolveGrowthOSEffectiveAccess,
} from '@/lib/auth/effective-access';

import type {
  AuthIdentity,
} from '@/lib/auth/request-auth';

import {
  listGrowthOSWorkspaceUsersFast,
} from '@/lib/auth/user-store';

import {
  listIntegrationConnections,
} from '@/lib/integrations/store';

import {
  ensureGrowthOSNotificationStore,
} from '@/lib/notifications/store';


// ============================================================
// TYPES
// ============================================================

export type GrowthOSReadinessStatus =
  | 'pass'
  | 'warning'
  | 'pending'
  | 'blocker';


export type GrowthOSReadinessCheck = {

  id:
    string;

  category:
    string;

  label:
    string;

  status:
    GrowthOSReadinessStatus;

  detail:
    string;

};


export type GrowthOSCommercialReadiness = {

  status:
    'ready'
    | 'needs_live_qa'
    | 'blocked';

  checks:
    GrowthOSReadinessCheck[];

  summary: {
    pass: number;
    warning: number;
    pending: number;
    blocker: number;
  };

};


// ============================================================
// HELPERS
// ============================================================

function envReady(
  keys:
    string[]
) {

  return keys.every(
    key =>
      Boolean(
        String(
          process.env[
            key
          ]
          ||
          ''
        ).trim()
      )
  );

}


// ============================================================
// COMMERCIAL READINESS
//
// Automated checks are deliberately conservative.
// Real provider approval/payment callbacks and Shopify embedded
// launch still require live QA after deployment.
// ============================================================

export async function getGrowthOSCommercialReadiness(
  identity:
    AuthIdentity
):

  Promise<
    GrowthOSCommercialReadiness
  > {

  const workspaceId =
    String(
      identity.workspaceId
      ||
      ''
    ).trim();

  const brandId =
    String(
      identity.brandId
      ||
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'Active workspace and brand are required'
    );

  }


  const checks:
    GrowthOSReadinessCheck[] = [];


  // ==========================================================
  // CONTROL PLANE / ACCESS
  // ==========================================================

  const access =
    await resolveGrowthOSEffectiveAccess(
      identity
    );


  const enabledModules =
    Object.values(
      access.modules
    ).filter(
      module =>
        module.effectivePermission
        !==
        'disabled'
    ).length;


  checks.push({

    id:
      'runtime_access',

    category:
      'Security',

    label:
      'Runtime authorization',

    status:
      enabledModules > 0
        ? 'pass'
        : 'blocker',

    detail:
      enabledModules > 0
        ? `${enabledModules} module(s) are available through effective-access enforcement.`
        : 'No module is available through effective-access enforcement.',

  });


  // ==========================================================
  // SUBSCRIPTION
  // ==========================================================

  const subscription =
    await getGrowthOSWorkspaceSubscriptionSnapshot(
      workspaceId,
      brandId
    );


  const subscriptionStatus =
    String(
      subscription.subscription?.status
      ||
      ''
    );


  const subscriptionHealthy =
    subscription.configured
    &&
    (
      subscriptionStatus ===
        'active'
      ||
      subscriptionStatus ===
        'trial'
    );


  checks.push({

    id:
      'subscription',

    category:
      'Billing',

    label:
      'Growth OS subscription',

    status:
      subscriptionHealthy
        ? 'pass'
        : 'blocker',

    detail:
      subscriptionHealthy
        ? `Subscription is ${subscriptionStatus}.`
        : subscription.configured
          ? `Subscription status is ${subscriptionStatus || 'unknown'}.`
          : 'No Growth OS subscription is configured.',

  });


  // ==========================================================
  // OWNER / ADMIN
  // ==========================================================

  const users =
    await listGrowthOSWorkspaceUsersFast(
      workspaceId,
      brandId
    );


  const activeOwners =
    users.filter(
      user =>
        user.user_status ===
          'active'
        &&
        user.membership_status ===
          'active'
        &&
        user.role ===
          'owner'
    ).length;


  checks.push({

    id:
      'workspace_owner',

    category:
      'Security',

    label:
      'Active workspace owner',

    status:
      activeOwners > 0
        ? 'pass'
        : 'blocker',

    detail:
      activeOwners > 0
        ? `${activeOwners} active owner(s) configured.`
        : 'At least one active Owner is required.',

  });


  // ==========================================================
  // CORE COMMERCIAL STORES
  // ==========================================================

  try {

    await Promise.all([

      ensureGrowthOSAuditStore(),

      ensureGrowthOSAccountStore(),

      ensureGrowthOSNotificationStore(),

    ]);


    checks.push({

      id:
        'commercial_stores',

      category:
        'Platform',

      label:
        'Commercial control-plane stores',

      status:
        'pass',

      detail:
        'Audit, account-request and notification-preference stores are available.',

    });

  } catch (
    error:
      any
  ) {

    checks.push({

      id:
        'commercial_stores',

      category:
        'Platform',

      label:
        'Commercial control-plane stores',

      status:
        'blocker',

      detail:
        String(
          error?.message
          ||
          'One or more commercial control-plane stores are unavailable.'
        ),

    });

  }


  // ==========================================================
  // BILLING OWNER / PROVIDER CONFIG
  // ==========================================================

  const billingAccount =
    await getBillingAccount(
      workspaceId,
      brandId
    );


  if (!billingAccount) {

    checks.push({

      id:
        'billing_account',

      category:
        'Billing',

      label:
        'Billing owner',

      status:
        'pending',

      detail:
        'Canonical billing account has not been activated with Shopify or Direct billing yet.',

    });

  } else {

    checks.push({

      id:
        'billing_account',

      category:
        'Billing',

      label:
        'Billing owner',

      status:
        billingAccount.status ===
          'active'
          ? 'pass'
          : 'pending',

      detail:
        `${billingAccount.channel} / ${billingAccount.provider} — ${billingAccount.status}.`,

    });


    if (
      billingAccount.channel ===
        'direct'
    ) {

      const razorpayReady =
        envReady([
          'RAZORPAY_KEY_ID',
          'RAZORPAY_KEY_SECRET',
          'RAZORPAY_WEBHOOK_SECRET',
        ]);


      checks.push({

        id:
          'direct_billing_provider',

        category:
          'Billing',

        label:
          'Razorpay configuration',

        status:
          razorpayReady
            ? 'pass'
            : 'pending',

        detail:
          razorpayReady
            ? 'Razorpay credentials and webhook secret are configured.'
            : 'Razorpay credentials/webhook configuration is incomplete.',

      });

    }


    if (
      billingAccount.channel ===
        'shopify'
    ) {

      const shopifyBillingReady =
        envReady([
          'SHOPIFY_PARTNER_ORG_ID',
          'SHOPIFY_PARTNER_API_ACCESS_TOKEN',
          'SHOPIFY_PARTNER_APP_ID',
          'SHOPIFY_APP_HANDLE',
        ]);


      checks.push({

        id:
          'shopify_billing_provider',

        category:
          'Billing',

        label:
          'Shopify App Pricing configuration',

        status:
          shopifyBillingReady
            ? 'pass'
            : 'pending',

        detail:
          shopifyBillingReady
            ? 'Shopify Partner billing configuration is present.'
            : 'Shopify Partner billing configuration is incomplete.',

      });

    }

  }


  // ==========================================================
  // INTEGRATIONS
  // ==========================================================

  const integrations =
    await listIntegrationConnections(
      workspaceId,
      brandId
    );


  const integrationErrors =
    integrations.filter(
      connection =>
        Boolean(
          connection.error
        )
        ||
        connection.status ===
          'error'
    );


  checks.push({

    id:
      'integrations',

    category:
      'Integrations',

    label:
      'Integration state',

    status:
      integrations.length ===
        0
        ? 'warning'
        : integrationErrors.length > 0
          ? 'warning'
          : 'pass',

    detail:
      integrations.length ===
        0
        ? 'No provider connection is currently registered. Provider OAuth productionization is intentionally deferred.'
        : integrationErrors.length > 0
          ? `${integrationErrors.length} integration(s) currently report an error.`
          : `${integrations.length} integration connection(s) are registered without a current error.`,

  });


  // ==========================================================
  // DATA RETENTION POLICY
  // ==========================================================

  const retentionDays =
    String(
      process.env.GROWTHOS_DATA_RETENTION_DAYS
      ||
      ''
    ).trim();


  checks.push({

    id:
      'data_retention',

    category:
      'Data',

    label:
      'Data-retention policy',

    status:
      retentionDays
        ? 'pass'
        : 'warning',

    detail:
      retentionDays
        ? `${retentionDays} day(s) configured for post-closure retention.`
        : 'GROWTHOS_DATA_RETENTION_DAYS is not configured. Define the commercial retention policy before public launch.',

  });


  // ==========================================================
  // LIVE QA
  // ==========================================================

  checks.push({

    id:
      'live_provider_qa',

    category:
      'Launch',

    label:
      'Live provider QA',

    status:
      'pending',

    detail:
      'After deployment, verify Shopify embedded launch and the active billing provider with a real sandbox/test transaction before go-live.',

  });


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary = {

    pass:
      checks.filter(
        check =>
          check.status ===
            'pass'
      ).length,

    warning:
      checks.filter(
        check =>
          check.status ===
            'warning'
      ).length,

    pending:
      checks.filter(
        check =>
          check.status ===
            'pending'
      ).length,

    blocker:
      checks.filter(
        check =>
          check.status ===
            'blocker'
      ).length,

  };


  const status:
    GrowthOSCommercialReadiness['status'] =
      summary.blocker > 0

        ? 'blocked'

        : summary.pending > 0

          ? 'needs_live_qa'

          : 'ready';


  return {

    status,

    checks,

    summary,

  };

}
