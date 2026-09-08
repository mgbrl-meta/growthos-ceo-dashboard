import 'server-only';

import {
  getIntegrationConnection,
  getSelectedIntegrationAccount,
} from '@/lib/integrations/store';

import {
  getValidStoredShopifyAccessToken,
  refreshStoredShopifyCredential,
} from '@/lib/integrations/providers/shopify-credentials';

import {
  ensureShopifyOrdersWebhookSubscriptions,
} from '@/lib/integrations/providers/shopify-webhooks';


// ============================================================
// METADATA HELPERS
// ============================================================

function readMetadataValue(
  metadata: unknown,
  keys: string[]
) {

  let value:
    any =
      metadata;


  if (
    typeof value ===
      'string'
  ) {

    try {

      value =
        JSON.parse(
          value
        );

    } catch {

      value =
        null;

    }

  }


  if (
    !value
    ||
    typeof value !==
      'object'
  ) {

    return '';

  }


  for (
    const key
    of keys
  ) {

    const candidate =
      String(
        value?.[key]
        ??
        ''
      ).trim();


    if (candidate) {

      return candidate;

    }

  }


  return '';

}


// ============================================================
// BOOTSTRAP ORDERS WEBHOOKS FOR ONE TENANT
//
// Security:
//
// workspace + brand come from authenticated Growth OS context.
//
// No arbitrary cross-tenant identity is accepted.
// ============================================================

export async function bootstrapShopifyOrdersWebhooks(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    origin:
      string;

  }
) {

  const workspaceId =
    String(
      input.workspaceId
      ??
      ''
    ).trim();


  const brandId =
    String(
      input.brandId
      ??
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_TENANT_MISSING'
    );

  }


  // ==========================================================
  // CONNECTION
  // ==========================================================

  const connection =
    await getIntegrationConnection(

      workspaceId,

      brandId,

      'shopify'

    );


  if (!connection) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_CONNECTION_NOT_FOUND'
    );

  }


  if (
    connection.status !==
      'connected'
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_CONNECTION_NOT_CONNECTED'
    );

  }


  const secretName =
    String(
      connection.secret_name
      ??
      ''
    ).trim();


  if (!secretName) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_SECRET_MISSING'
    );

  }


  // ==========================================================
  // SELECTED STORE
  // ==========================================================

  const account =
    await getSelectedIntegrationAccount(

      workspaceId,

      brandId,

      'shopify'

    );


  if (!account) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_ACCOUNT_NOT_FOUND'
    );

  }


  if (
    account.connection_id !==
      connection.connection_id
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_CONNECTION_MISMATCH'
    );

  }


  const shopId =
    String(
      account.provider_account_id
      ??
      ''
    ).trim();


  if (!shopId) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_SHOP_ID_MISSING'
    );

  }


  const shopDomain =
    readMetadataValue(

      account.metadata,

      [
        'shop_domain',
        'shopDomain',
      ]

    )
      .toLowerCase();


  if (
    !shopDomain
    ||
    !shopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_BOOTSTRAP_SHOP_DOMAIN_MISSING'
    );

  }


  // ==========================================================
  // WEBHOOK URI
  // ==========================================================

  const webhookUri =
    new URL(

      '/api/integrations/shopify/webhooks/orders',

      input.origin

    )
      .toString();


  // ==========================================================
  // VALID STORED TOKEN
  // ==========================================================

  let credential =
    await getValidStoredShopifyAccessToken({

      workspaceId,

      brandId,

      secretName,

      expectedShopId:
        shopId,

      expectedShopDomain:
        shopDomain,

    });


  let forcedRefresh =
    false;


  // ==========================================================
  // ENSURE SUBSCRIPTIONS
  //
  // If Shopify unexpectedly returns 401 despite our expiry
  // check, refresh once and retry.
  // ==========================================================

  let result;


  try {

    result =
      await ensureShopifyOrdersWebhookSubscriptions({

        shopDomain,

        accessToken:
          credential.accessToken,

        webhookUri,

      });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ??
        ''
      );


    if (
      message !==
        'SHOPIFY_WEBHOOK_GRAPHQL_HTTP_401'
    ) {

      throw error;

    }


    await refreshStoredShopifyCredential({

      workspaceId,

      brandId,

      secretName,

    });


    forcedRefresh =
      true;


    credential =
      await getValidStoredShopifyAccessToken({

        workspaceId,

        brandId,

        secretName,

        expectedShopId:
          shopId,

        expectedShopDomain:
          shopDomain,

      });


    result =
      await ensureShopifyOrdersWebhookSubscriptions({

        shopDomain,

        accessToken:
          credential.accessToken,

        webhookUri,

      });

  }


  // ==========================================================
  // SAFE RESPONSE ONLY
  // ==========================================================

  return {

    workspaceId,

    brandId,

    connectionId:
      connection.connection_id,

    integrationAccountId:
      account.integration_account_id,

    shopDomain,

    webhookUri,

    tokenRefreshed:
      credential.tokenRefreshed
      ||
      forcedRefresh,

    ordersCreate: {

      action:
        result
          .subscriptions
          .ordersCreate
          .action,

      id:
        result
          .subscriptions
          .ordersCreate
          .id,

    },

    ordersUpdated: {

      action:
        result
          .subscriptions
          .ordersUpdated
          .action,

      id:
        result
          .subscriptions
          .ordersUpdated
          .id,

    },

  };

}