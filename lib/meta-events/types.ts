export type MetaEventsSource =
  | 'call_commerce'
  | 'shopify'
  | 'lead_commerce'
  | 'web'
  | 'commerce'
  | 'customer'
  | 'retention'
  | 'system'
  | string;

export type MetaEventsIdentity = {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;

  fbc?: string | null;
  fbp?: string | null;

  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

export type MetaEventsContext = {
  eventSourceUrl?: string | null;
  referrerUrl?: string | null;

  pageTitle?: string | null;
  pageType?: string | null;

  sessionId?: string | null;
  clientId?: string | null;

  locale?: string | null;
  currency?: string | null;

  platform?: string | null;
  deviceType?: string | null;
};

export type MetaEventsAttribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;

  fbclid?: string | null;
  gclid?: string | null;

  campaignId?: string | null;
  adSetId?: string | null;
  adId?: string | null;

  sourcePlatform?: string | null;
  sourceChannel?: string | null;
};

export type MetaEventsCommerceItem = {
  itemId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  sku?: string | null;

  name?: string | null;
  variantTitle?: string | null;

  quantity?: number | null;
  itemPrice?: number | null;
  lineValue?: number | null;
};

export type MetaEventsCommerce = {
  currency?: string | null;
  value?: number | null;

  orderId?: string | null;
  orderName?: string | null;

  cartId?: string | null;
  checkoutId?: string | null;

  customerId?: string | null;

  contentType?: string | null;
  contentIds?: string[] | null;
  contents?: MetaEventsCommerceItem[] | null;

  numItems?: number | null;

  subtotal?: number | null;
  discountTotal?: number | null;
  taxTotal?: number | null;
  shippingTotal?: number | null;
  refundTotal?: number | null;
};

export type MetaEventsMetadata = {
  producer?: string | null;
  producerVersion?: string | null;

  sourceSystem?: string | null;
  sourceRecordId?: string | null;

  correlationId?: string | null;
  dedupeGroup?: string | null;

  observedAt?: string | null;

  [key: string]: unknown;
};

export type MetaEventsSourceJob = {
  version: 1;
  jobType: 'source_event';

  eventVersion: number;

  sourceEventId: string;

  workspaceId: string;
  brandId: string;

  source: MetaEventsSource;
  sourceEvent: string;

  sourceEntityId?: string | null;

  occurredAt: string;

  identity?: MetaEventsIdentity | null;
  context?: MetaEventsContext | null;
  attribution?: MetaEventsAttribution | null;
  commerce?: MetaEventsCommerce | null;
  data?: Record<string, unknown> | null;
  metadata?: MetaEventsMetadata | null;
};

export type MetaEventsRuleInput = {
  ruleId?: string;

  name: string;

  source: string;
  sourceEvent: string;

  metaEventName: string;

  destinationId?: string | null;

  actionSource?: string;

  condition?: Record<string, unknown> | null;

  enabled?: boolean;
  priority?: number;
};

export type MetaEventsSettings = {
  maxAttempts: number;
  retryDelaySeconds: number;
  batchSize: number;
  defaultActionSource: string;
};
