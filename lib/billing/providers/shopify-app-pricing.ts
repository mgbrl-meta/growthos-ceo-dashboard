import 'server-only';

function requireShopifyPartnerConfig() {
  const orgId = String(process.env.SHOPIFY_PARTNER_ORG_ID || '').trim();
  const token = String(process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN || '').trim();
  const appId = String(process.env.SHOPIFY_PARTNER_APP_ID || '').trim();
  const appHandle = String(process.env.SHOPIFY_APP_HANDLE || '').trim();
  const apiVersion = String(process.env.SHOPIFY_PARTNER_API_VERSION || '2026-07').trim();

  if (!orgId || !token || !appId || !appHandle) {
    throw new Error('SHOPIFY_BILLING_SETUP_REQUIRED');
  }

  return { orgId, token, appId, appHandle, apiVersion };
}

async function partnerGraphql(query: string, variables: Record<string, unknown>) {
  const { orgId, token, apiVersion } = requireShopifyPartnerConfig();
  const response = await fetch(`https://partners.shopify.com/${encodeURIComponent(orgId)}/api/${encodeURIComponent(apiVersion)}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  const json: any = await response.json();
  if (!response.ok || json?.errors?.length) {
    throw new Error(`SHOPIFY_PARTNER_API_ERROR:${JSON.stringify(json?.errors || response.status)}`);
  }
  return json?.data;
}

export function buildShopifyPricingPlanUrl(shopDomain: string) {
  const { appHandle } = requireShopifyPartnerConfig();
  const storeHandle = String(shopDomain || '').trim().toLowerCase().replace(/\.myshopify\.com$/, '');
  if (!storeHandle) throw new Error('SHOPIFY_SHOP_REQUIRED');
  return `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`;
}

export async function fetchShopifyActiveSubscription(shopId: string) {
  const { appId } = requireShopifyPartnerConfig();
  const data = await partnerGraphql(`
    query ActiveSubscription($appId: ID!, $shopId: ID!) {
      activeSubscription(appId: $appId, shopId: $shopId) {
        billingPeriod
        cancelAtEndOfCycle
        currentBillingCycle { startTime endTime }
        items {
          handle
          description
          price {
            __typename
            active
            currency
            ... on FlatRatePrice { amount }
          }
        }
        pendingUpdate { billingPeriod items { handle } }
      }
    }
  `, { appId, shopId });

  const subscription = data?.activeSubscription ?? null;
  if (!subscription) return null;

  const handles = (subscription.items || []).map((item: any) => String(item.handle || '')).filter(Boolean);
  const currency = subscription.items?.find((item: any) => item?.price?.currency)?.price?.currency ?? null;

  return {
    billingPeriod: subscription.billingPeriod ? String(subscription.billingPeriod).toLowerCase() : null,
    cancelAtEndOfCycle: Boolean(subscription.cancelAtEndOfCycle),
    currentPeriodStart: subscription.currentBillingCycle?.startTime ?? null,
    currentPeriodEnd: subscription.currentBillingCycle?.endTime ?? null,
    handles,
    primaryHandle: handles[0] ?? null,
    currency: currency ? String(currency) : null,
    raw: subscription,
  };
}

export async function cancelShopifyActiveSubscription(shopId: string, options?: {
  deferCancellation?: boolean;
  prorate?: boolean;
  skipFinalUsageCharge?: boolean;
}) {
  const { appId } = requireShopifyPartnerConfig();
  const data = await partnerGraphql(`
    mutation Cancel($appId: ID!, $shopId: ID!, $deferCancellation: Boolean!, $prorate: Boolean!, $skipFinalUsageCharge: Boolean!) {
      appSubscriptionCancel(
        appId: $appId,
        shopId: $shopId,
        deferCancellation: $deferCancellation,
        prorate: $prorate,
        skipFinalUsageCharge: $skipFinalUsageCharge
      ) {
        userErrors { field message }
      }
    }
  `, {
    appId,
    shopId,
    deferCancellation: options?.deferCancellation ?? false,
    prorate: options?.prorate ?? false,
    skipFinalUsageCharge: options?.skipFinalUsageCharge ?? true,
  });

  const errors = data?.appSubscriptionCancel?.userErrors || [];
  if (errors.length) {
    throw new Error(`SHOPIFY_CANCEL_FAILED:${JSON.stringify(errors)}`);
  }

  return { ok: true };
}

export function shopifyBillingSetupStatus() {
  try {
    requireShopifyPartnerConfig();
    return { configured: true };
  } catch {
    return { configured: false };
  }
}
