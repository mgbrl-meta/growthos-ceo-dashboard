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
  ensureShopifyCustomersWebhookSubscriptions,
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

    // ==========================================================
  // WEBHOOK URIS
  // ==========================================================

  const ordersWebhookUri =
    new URL(

      '/api/integrations/shopify/webhooks/orders',

      input.origin

    )
      .toString();


  const customersWebhookUri =
    new URL(

      '/api/integrations/shopify/webhooks/customers',

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

    let ordersResult;
  let customersResult;


  try {

    // ========================================================
    // ORDERS
    // ========================================================

    ordersResult =
      await ensureShopifyOrdersWebhookSubscriptions({

        shopDomain,

        accessToken:
          credential.accessToken,

        webhookUri:
          ordersWebhookUri,

      });


    // ========================================================
    // CUSTOMERS
    // ========================================================

    customersResult =
      await ensureShopifyCustomersWebhookSubscriptions({

        shopDomain,

        accessToken:
          credential.accessToken,

        webhookUri:
          customersWebhookUri,

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


    // ========================================================
    // TOKEN RECOVERY
    //
    // If either Orders or Customers receives an unexpected
    // 401, refresh the credential once and rerun both ensure
    // operations.
    //
    // Both ensure functions are idempotent, so an Orders
    // subscription successfully repaired before the 401 will
    // simply be reused on the retry.
    // ========================================================

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


    ordersResult =
      await ensureShopifyOrdersWebhookSubscriptions({

        shopDomain,

        accessToken:
          credential.accessToken,

        webhookUri:
          ordersWebhookUri,

      });


    customersResult =
      await ensureShopifyCustomersWebhookSubscriptions({

        shopDomain,

        accessToken:
          credential.accessToken,

        webhookUri:
          customersWebhookUri,

      });

  }


    // ==========================================================
  // SAFE RESPONSE ONLY
  //
  // Preserve webhookUri as the Orders URI for backward
  // compatibility with the previous response contract.
  // ==========================================================

  return {

    workspaceId,

    brandId,

    connectionId:
      connection.connection_id,

    integrationAccountId:
      account.integration_account_id,

    shopDomain,


    // ========================================================
    // BACKWARD-COMPATIBLE FIELD
    // ========================================================

    webhookUri:
      ordersWebhookUri,


    // ========================================================
    // EXPLICIT RECEIVERS
    // ========================================================

    ordersWebhookUri,

    customersWebhookUri,


    tokenRefreshed:
      credential.tokenRefreshed
      ||
      forcedRefresh,


    // ========================================================
    // ORDERS
    // ========================================================

    ordersCreate: {

      action:
        ordersResult
          .subscriptions
          .ordersCreate
          .action,

      id:
        ordersResult
          .subscriptions
          .ordersCreate
          .id,

    },

    ordersUpdated: {

      action:
        ordersResult
          .subscriptions
          .ordersUpdated
          .action,

      id:
        ordersResult
          .subscriptions
          .ordersUpdated
          .id,

    },


    // ========================================================
    // CUSTOMERS
    // ========================================================

    customersCreate: {

      action:
        customersResult
          .subscriptions
          .customersCreate
          .action,

      id:
        customersResult
          .subscriptions
          .customersCreate
          .id,

    },

    customersUpdate: {

      action:
        customersResult
          .subscriptions
          .customersUpdate
          .action,

      id:
        customersResult
          .subscriptions
          .customersUpdate
          .id,

    },

  };

}