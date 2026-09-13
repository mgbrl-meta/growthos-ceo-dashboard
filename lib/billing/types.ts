export type GrowthOSBillingChannel =
  | 'shopify'
  | 'direct'
  | 'manual'
  | 'unconfigured';


export type GrowthOSBillingProvider =
  | 'shopify_app_pricing'
  | 'razorpay'
  | 'manual'
  | 'none';


export type GrowthOSBillingStatus =
  | 'setup_required'
  | 'pending'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'migration_pending'
  | 'error';


export type GrowthOSBillingCycle =
  | 'monthly'
  | 'yearly'
  | 'custom'
  | null;


export type GrowthOSBillingAccount = {

  billingAccountId:
    string;

  workspaceId:
    string;

  brandId:
    string;

  channel:
    GrowthOSBillingChannel;

  provider:
    GrowthOSBillingProvider;

  internalPlanId:
    string | null;

  externalCustomerId:
    string | null;

  externalSubscriptionId:
    string | null;

  externalPlanId:
    string | null;

  status:
    GrowthOSBillingStatus;

  currency:
    string | null;

  billingCycle:
    GrowthOSBillingCycle;

  currentPeriodStart:
    string | null;

  currentPeriodEnd:
    string | null;

  cancelAtPeriodEnd:
    boolean;

  migrationLock:
    boolean;

  metadata:
    Record<string, unknown> | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

};


export type GrowthOSBillingProfile = {

  profileId:
    string;

  workspaceId:
    string;

  brandId:
    string;

  legalBusinessName:
    string | null;

  gstin:
    string | null;

  addressLine1:
    string | null;

  addressLine2:
    string | null;

  city:
    string | null;

  state:
    string | null;

  postalCode:
    string | null;

  country:
    string | null;

  invoiceEmail:
    string | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

};


export type GrowthOSBillingPlanMapping = {

  mappingId:
    string;

  planId:
    string;

  channel:
    GrowthOSBillingChannel;

  provider:
    GrowthOSBillingProvider;

  externalPlanId:
    string;

  currency:
    string | null;

  billingCycle:
    GrowthOSBillingCycle;

  status:
    string;

  createdAt:
    string | null;

  updatedAt:
    string | null;

};


export type GrowthOSBillingMigrationStatus =
  | 'pending'
  | 'awaiting_customer_confirmation'
  | 'verifying_target'
  | 'cancelling_source'
  | 'completed'
  | 'failed'
  | 'cancelled';


export type GrowthOSBillingMigration = {

  migrationId:
    string;

  workspaceId:
    string;

  brandId:
    string;

  fromChannel:
    GrowthOSBillingChannel;

  fromProvider:
    GrowthOSBillingProvider;

  fromExternalSubscriptionId:
    string | null;

  toChannel:
    GrowthOSBillingChannel;

  toProvider:
    GrowthOSBillingProvider;

  targetPlanId:
    string;

  targetExternalPlanId:
    string | null;

  targetExternalSubscriptionId:
    string | null;

  status:
    GrowthOSBillingMigrationStatus;

  startedBy:
    string;

  failureReason:
    string | null;

  metadata:
    Record<string, unknown> | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

  completedAt:
    string | null;

};


export type GrowthOSBillingInvoice = {

  invoiceId:
    string;

  workspaceId:
    string;

  brandId:
    string;

  provider:
    GrowthOSBillingProvider;

  externalInvoiceId:
    string;

  externalSubscriptionId:
    string | null;

  amountMinor:
    number | null;

  currency:
    string | null;

  status:
    string | null;

  invoiceUrl:
    string | null;

  invoiceDate:
    string | null;

  dueDate:
    string | null;

  paidAt:
    string | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

};