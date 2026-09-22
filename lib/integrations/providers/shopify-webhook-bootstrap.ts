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
  ensureShopifyProductsWebhookSubscriptions,
  removeShopifyProductsWebhookSubscriptions,
} from '@/lib/integrations/providers/shopify-webhooks';

import {
  isShopifyProductsRealtimeEnabled,
} from '@/lib/integrations/providers/shopify-features';


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
// BOOTSTRAP SHOPIFY WEBHOOKS FOR ONE TENANT
//
// Security:
//
// workspace + brand come from authenticated Growth OS context.
//
// No arbitrary cross-tenant identity is accepted.
//
// Orders:
// realtime enabled
//
// Customers:
// realtime enabled
//
// Products:
// realtime controlled by
// SHOPIFY_PRODUCTS_REALTIME_ENABLED
//
// If Product realtime is disabled:
//
// - Product subscriptions are NOT created
// - existing Growth OS Product subscriptions are removed
// - Product webhook implementation remains available for
//   future activation
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


  const productsWebhookUri =
    new URL(

      '/api/integrations/shopify/webhooks/products',

      input.origin

    )
      .toString();


  // ==========================================================
  // PRODUCT REALTIME FEATURE STATE
  //
  // Resolve once for the entire bootstrap execution.
  // ==========================================================

  const productsRealtimeEnabled =
    isShopifyProductsRealtimeEnabled();


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
  // RESULTS
  // ==========================================================

  let ordersResult;

  let customersResult;

  let productsResult =
    null;

  let productsCleanupResult =
    null;


  // ==========================================================
  // ENSURE / REMOVE SUBSCRIPTIONS
  //
  // If Shopify unexpectedly returns 401 despite our expiry
  // check, refresh once and retry the complete desired-state
  // reconciliation.
  //
  // All operations are idempotent.
  // ==========================================================

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


    // ========================================================
    // PRODUCTS
    //
    // Desired state:
    //
    // enabled:
    //   ensure Product subscriptions
    //
    // disabled:
    //   remove Growth OS Product subscriptions
    // ========================================================

    if (
      productsRealtimeEnabled
    ) {

      productsResult =
        await ensureShopifyProductsWebhookSubscriptions({

          shopDomain,

          accessToken:
            credential.accessToken,

          webhookUri:
            productsWebhookUri,

        });

    } else {

      productsCleanupResult =
        await removeShopifyProductsWebhookSubscriptions({

          shopDomain,

          accessToken:
            credential.accessToken,

        });

    }


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
    // Any Orders / Customers / Products operation may receive
    // an unexpected Shopify 401.
    //
    // Refresh the stored credential once and reconcile the
    // complete desired webhook state again.
    //
    // The ensure/remove operations are idempotent.
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


    // ========================================================
    // ORDERS — RETRY
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
    // CUSTOMERS — RETRY
    // ========================================================

    customersResult =
      await ensureShopifyCustomersWebhookSubscriptions({

        shopDomain,

        accessToken:
          credential.accessToken,

        webhookUri:
          customersWebhookUri,

      });


    // ========================================================
    // PRODUCTS — RETRY
    // ========================================================

    if (
      productsRealtimeEnabled
    ) {

      productsResult =
        await ensureShopifyProductsWebhookSubscriptions({

          shopDomain,

          accessToken:
            credential.accessToken,

          webhookUri:
            productsWebhookUri,

        });

    } else {

      productsCleanupResult =
        await removeShopifyProductsWebhookSubscriptions({

          shopDomain,

          accessToken:
            credential.accessToken,

        });

    }

  }


  // ==========================================================
  // SAFE RESPONSE ONLY
  //
  // Preserve webhookUri as the Orders URI for backward
  // compatibility with the previous response contract.
  //
  // No access token / refresh token / secret payload is
  // returned.
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

    productsWebhookUri,


    // ========================================================
    // TOKEN
    // ========================================================

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


    // ========================================================
    // PRODUCTS
    //
    // enabled:
    //   productsCreate/productsUpdate describe active
    //   subscriptions.
    //
    // disabled:
    //   cleanup describes Growth OS Product subscriptions
    //   removed from Shopify.
    // ========================================================

    productsRealtime: {

      enabled:
        productsRealtimeEnabled,


      productsCreate:
        productsResult
          ?
            {

              action:
                productsResult
                  .subscriptions
                  .productsCreate
                  .action,

              id:
                productsResult
                  .subscriptions
                  .productsCreate
                  .id,

            }
          :
            null,


      productsUpdate:
        productsResult
          ?
            {

              action:
                productsResult
                  .subscriptions
                  .productsUpdate
                  .action,

              id:
                productsResult
                  .subscriptions
                  .productsUpdate
                  .id,

            }
          :
            null,


      cleanup:
        productsCleanupResult
          ?
            {

              matchedCount:
                productsCleanupResult
                  .matchedCount,

              deletedCount:
                productsCleanupResult
                  .deletedCount,

              deleted:
                productsCleanupResult
                  .deleted,

            }
          :
            null,

    },

  };

}