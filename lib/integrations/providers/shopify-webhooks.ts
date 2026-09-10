import 'server-only';

import {
  getShopifyApiVersion,
  normalizeShopDomain,
} from '@/lib/auth/config';


// ============================================================
// TYPES
// ============================================================

type ShopifyWebhookTopic =
  | 'ORDERS_CREATE'
  | 'ORDERS_UPDATED'
  | 'CUSTOMERS_CREATE'
  | 'CUSTOMERS_UPDATE';


type ShopifyWebhookSubscription = {

  id:
    string;

  topic:
    string;

  uri:
    string;

  includeFields:
    string[];

};


// ============================================================
// CANONICAL ORDERS WEBHOOK
//
// We intentionally request ONLY identity/timestamp fields.
//
// The webhook body itself does NOT become canonical warehouse
// data.
//
// The worker receives the Order GID and fetches the exact
// canonical GraphQL Order representation before writing.
//
// This prevents:
//
// REST/webhook payload
//          ≠
// Admin GraphQL payload
//
// from generating incompatible source hashes.
// ============================================================

const ORDER_WEBHOOK_FIELDS = [

  'id',
  'admin_graphql_api_id',
  'updated_at',

];


// ============================================================
// GRAPHQL
// ============================================================

const LIST_WEBHOOKS_QUERY = `

  query GrowthOsWebhookSubscriptions {

    webhookSubscriptions(
      first: 250
    ) {

      nodes {

        id
        topic
        uri
        includeFields

      }

    }

  }

`;


const CREATE_WEBHOOK_MUTATION = `

  mutation GrowthOsWebhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {

    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: $webhookSubscription
    ) {

      webhookSubscription {

        id
        topic
        uri
        includeFields

      }

      userErrors {

        field
        message

      }

    }

  }

`;


const UPDATE_WEBHOOK_MUTATION = `

  mutation GrowthOsWebhookSubscriptionUpdate(
    $id: ID!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {

    webhookSubscriptionUpdate(
      id: $id
      webhookSubscription: $webhookSubscription
    ) {

      webhookSubscription {

        id
        topic
        uri
        includeFields

      }

      userErrors {

        field
        message

      }

    }

  }

`;


// ============================================================
// REQUIRED VALUE
// ============================================================

function requireValue(
  value: unknown,
  errorCode: string
) {

  const normalized =
    String(
      value
      ??
      ''
    ).trim();


  if (!normalized) {

    throw new Error(
      errorCode
    );

  }


  return normalized;

}


// ============================================================
// NORMALIZE URI
// ============================================================

function normalizeWebhookUri(
  value: string
) {

  const uri =
    requireValue(
      value,
      'SHOPIFY_WEBHOOK_URI_MISSING'
    );


  let parsed:
    URL;


  try {

    parsed =
      new URL(
        uri
      );

  } catch {

    throw new Error(
      'SHOPIFY_WEBHOOK_URI_INVALID'
    );

  }


  if (
    parsed.protocol !==
      'https:'
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_URI_HTTPS_REQUIRED'
    );

  }


  return parsed
    .toString();

}


// ============================================================
// SAME GROWTH OS ORDERS WEBHOOK PATH
//
// Allows an old deployment hostname to be updated rather than
// creating another subscription.
//
// Example:
//
// old:
// https://old-domain/.../webhooks/orders
//
// new:
// https://new-domain/.../webhooks/orders
// ============================================================

function isGrowthOsOrdersWebhookUri(
  value: string
) {

  try {

    const parsed =
      new URL(
        value
      );


    return (
      parsed.pathname ===
        '/api/integrations/shopify/webhooks/orders'
    );

  } catch {

    return false;

  }

}


// ============================================================
// FIELDS MATCH
// ============================================================

function fieldsMatch(
  left: string[],
  right: string[]
) {

  const a =
    [
      ...left,
    ].sort();


  const b =
    [
      ...right,
    ].sort();


  if (
    a.length !==
      b.length
  ) {

    return false;

  }


  return a.every(
    (
      value,
      index
    ) =>
      value ===
        b[index]
  );

}


// ============================================================
// EXECUTE SHOPIFY GRAPHQL
// ============================================================

async function executeShopifyGraphQL(
  input: {

    shopDomain:
      string;

    accessToken:
      string;

    query:
      string;

    variables?:
      Record<
        string,
        unknown
      >;

  }
) {

  const shopDomain =
    normalizeShopDomain(
      input.shopDomain
    );


  if (
    !shopDomain
    ||
    !shopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_SHOP_INVALID'
    );

  }


  const accessToken =
    requireValue(
      input.accessToken,
      'SHOPIFY_WEBHOOK_ACCESS_TOKEN_MISSING'
    );


  const apiVersion =
    getShopifyApiVersion();


  const response =
    await fetch(

      `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'X-Shopify-Access-Token':
            accessToken,

        },

        body:
          JSON.stringify({

            query:
              input.query,

            variables:
              input.variables
              ??
              {},

          }),

        cache:
          'no-store',

      }

    );


  const raw =
    await response.text();


  let json:
    any;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_WEBHOOK_GRAPHQL_RESPONSE_INVALID'
    );

  }


  if (!response.ok) {

    console.error(
      'SHOPIFY_WEBHOOK_GRAPHQL_HTTP_FAILED',
      {

        status:
          response.status,

      }
    );


    throw new Error(
      `SHOPIFY_WEBHOOK_GRAPHQL_HTTP_${response.status}`
    );

  }


  if (
    Array.isArray(
      json?.errors
    )
    &&
    json.errors.length > 0
  ) {

    console.error(
      'SHOPIFY_WEBHOOK_GRAPHQL_FAILED',
      {

        errors:
          json.errors.map(
            (
              error: any
            ) => ({

              message:
                String(
                  error?.message
                  ??
                  'Unknown GraphQL error'
                ),

            })
          ),

      }
    );


    throw new Error(
      'SHOPIFY_WEBHOOK_GRAPHQL_FAILED'
    );

  }


  return json?.data
    ??
    {};

}


// ============================================================
// USER ERROR CHECK
// ============================================================

function assertNoUserErrors(
  errors: any,
  errorCode: string
) {

  if (
    !Array.isArray(
      errors
    )
    ||
    errors.length ===
      0
  ) {

    return;

  }


  const message =
    errors
      .map(
        error =>
          String(
            error?.message
            ??
            'Unknown Shopify user error'
          )
      )
      .join(
        '; '
      );


  console.error(
    errorCode,
    {
      message,
    }
  );


  throw new Error(
    errorCode
  );

}


// ============================================================
// LIST CURRENT SHOPIFY WEBHOOK SUBSCRIPTIONS
// ============================================================

async function listShopifyWebhookSubscriptions(
  input: {

    shopDomain:
      string;

    accessToken:
      string;

  }
):

  Promise<
    ShopifyWebhookSubscription[]
  > {

  const data =
    await executeShopifyGraphQL({

      shopDomain:
        input.shopDomain,

      accessToken:
        input.accessToken,

      query:
        LIST_WEBHOOKS_QUERY,

    });


  const nodes =
    Array.isArray(
      data
        ?.webhookSubscriptions
        ?.nodes
    )
      ?
        data.webhookSubscriptions.nodes
      :
        [];


  return nodes
    .map(
      (
        node: any
      ) => ({

        id:
          String(
            node?.id
            ??
            ''
          ),

        topic:
          String(
            node?.topic
            ??
            ''
          ),

        uri:
          String(
            node?.uri
            ??
            ''
          ),

        includeFields:
          Array.isArray(
            node?.includeFields
          )
            ?
              node.includeFields.map(
                (
                  value: unknown
                ) =>
                  String(
                    value
                  )
              )
            :
              [],

      })
    )
    .filter(
      (
        node: ShopifyWebhookSubscription
      ) =>
        Boolean(
          node.id
          &&
          node.topic
        )
    );

}


// ============================================================
// CREATE SUBSCRIPTION
// ============================================================

async function createShopifyWebhookSubscription(
  input: {

    shopDomain:
      string;

    accessToken:
      string;

    topic:
      ShopifyWebhookTopic;

    uri:
      string;

  }
) {

  const data =
    await executeShopifyGraphQL({

      shopDomain:
        input.shopDomain,

      accessToken:
        input.accessToken,

      query:
        CREATE_WEBHOOK_MUTATION,

      variables: {

        topic:
          input.topic,

        webhookSubscription: {

          uri:
            input.uri,

          includeFields:
            ORDER_WEBHOOK_FIELDS,

        },

      },

    });


  const result =
    data
      ?.webhookSubscriptionCreate;


  assertNoUserErrors(
    result?.userErrors,
    'SHOPIFY_WEBHOOK_CREATE_FAILED'
  );


  const subscription =
    result
      ?.webhookSubscription;


  if (
    !subscription?.id
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_CREATE_RESPONSE_MISSING'
    );

  }


  return {

    action:
      'created',

    id:
      String(
        subscription.id
      ),

    topic:
      String(
        subscription.topic
      ),

    uri:
      String(
        subscription.uri
      ),

  };

}


// ============================================================
// UPDATE SUBSCRIPTION
// ============================================================

async function updateShopifyWebhookSubscription(
  input: {

    shopDomain:
      string;

    accessToken:
      string;

    id:
      string;

    topic:
      ShopifyWebhookTopic;

    uri:
      string;

  }
) {

  const data =
    await executeShopifyGraphQL({

      shopDomain:
        input.shopDomain,

      accessToken:
        input.accessToken,

      query:
        UPDATE_WEBHOOK_MUTATION,

      variables: {

        id:
          input.id,

        webhookSubscription: {

          uri:
            input.uri,

          includeFields:
            ORDER_WEBHOOK_FIELDS,

        },

      },

    });


  const result =
    data
      ?.webhookSubscriptionUpdate;


  assertNoUserErrors(
    result?.userErrors,
    'SHOPIFY_WEBHOOK_UPDATE_FAILED'
  );


  const subscription =
    result
      ?.webhookSubscription;


  if (
    !subscription?.id
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_UPDATE_RESPONSE_MISSING'
    );

  }


  return {

    action:
      'updated',

    id:
      String(
        subscription.id
      ),

    topic:
      input.topic,

    uri:
      String(
        subscription.uri
      ),

  };

}


// ============================================================
// ENSURE ONE TOPIC
// ============================================================

async function ensureTopic(
  input: {

    shopDomain:
      string;

    accessToken:
      string;

    topic:
      ShopifyWebhookTopic;

    uri:
      string;

    existing:
      ShopifyWebhookSubscription[];

  }
) {

  const sameTopic =
    input.existing.filter(
      subscription =>
        subscription.topic ===
          input.topic
    );


  // ==========================================================
  // EXACT SUBSCRIPTION ALREADY EXISTS
  // ==========================================================

  const exact =
    sameTopic.find(
      subscription =>
        subscription.uri ===
          input.uri
        &&
        fieldsMatch(
          subscription.includeFields,
          ORDER_WEBHOOK_FIELDS
        )
    );


  if (exact) {

    return {

      action:
        'reused',

      id:
        exact.id,

      topic:
        input.topic,

      uri:
        exact.uri,

    };

  }


  // ==========================================================
  // OUR ROUTE EXISTS WITH AN OLD HOST OR OLD FIELD CONFIG
  //
  // Update it instead of creating duplicates.
  // ==========================================================

  const existingGrowthOsRoute =
    sameTopic.find(
      subscription =>
        isGrowthOsOrdersWebhookUri(
          subscription.uri
        )
    );


  if (
    existingGrowthOsRoute
  ) {

    return updateShopifyWebhookSubscription({

      shopDomain:
        input.shopDomain,

      accessToken:
        input.accessToken,

      id:
        existingGrowthOsRoute.id,

      topic:
        input.topic,

      uri:
        input.uri,

    });

  }


  // ==========================================================
  // NO GROWTH OS SUBSCRIPTION
  // ==========================================================

  return createShopifyWebhookSubscription({

    shopDomain:
      input.shopDomain,

    accessToken:
      input.accessToken,

    topic:
      input.topic,

    uri:
      input.uri,

  });

}


// ============================================================
// ENSURE GROWTH OS ORDERS WEBHOOKS
//
// Idempotent.
//
// Required:
//
// ORDERS_CREATE
// ORDERS_UPDATED
//
// Both intentionally use ONE receiver.
//
// x-shopify-topic tells the receiver which event occurred.
// ============================================================

export async function ensureShopifyOrdersWebhookSubscriptions(
  input: {

    shopDomain:
      string;

    accessToken:
      string;

    webhookUri:
      string;

  }
) {

  const shopDomain =
    normalizeShopDomain(
      input.shopDomain
    );


  if (
    !shopDomain
    ||
    !shopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_SHOP_INVALID'
    );

  }


  const accessToken =
    requireValue(
      input.accessToken,
      'SHOPIFY_WEBHOOK_ACCESS_TOKEN_MISSING'
    );


  const webhookUri =
    normalizeWebhookUri(
      input.webhookUri
    );


  const existing =
    await listShopifyWebhookSubscriptions({

      shopDomain,

      accessToken,

    });


  const ordersCreate =
    await ensureTopic({

      shopDomain,

      accessToken,

      topic:
        'ORDERS_CREATE',

      uri:
        webhookUri,

      existing,

    });


  // Refresh list after mutation so the second operation sees
  // the true current Shopify configuration.

  const refreshed =
    ordersCreate.action ===
      'reused'

      ?
        existing

      :
        await listShopifyWebhookSubscriptions({

          shopDomain,

          accessToken,

        });


  const ordersUpdated =
    await ensureTopic({

      shopDomain,

      accessToken,

      topic:
        'ORDERS_UPDATED',

      uri:
        webhookUri,

      existing:
        refreshed,

    });


  return {

    ok:
      true,

    shopDomain,

    webhookUri,

    subscriptions: {

      ordersCreate,

      ordersUpdated,

    },

  };

}

// ============================================================
// ENSURE SHOPIFY CUSTOMER WEBHOOK SUBSCRIPTIONS
//
// customers/create
// customers/update
//
// Both intentionally use ONE Customer receiver.
//
// x-shopify-topic tells the receiver which event occurred.
//
// This follows the exact same idempotent registration contract
// as Orders:
//
// list existing
//      ↓
// reuse / correct / create customers/create
//      ↓
// refresh subscriptions when mutation occurred
//      ↓
// reuse / correct / create customers/update
//
// Calling this repeatedly must not create duplicates.
// ============================================================

export async function ensureShopifyCustomersWebhookSubscriptions(
  input: {

    shopDomain:
      string;

    accessToken:
      string;

    webhookUri:
      string;

  }
) {

  // ==========================================================
  // SHOP
  // ==========================================================

  const shopDomain =
    normalizeShopDomain(
      input.shopDomain
    );


  if (
    !shopDomain
    ||
    !shopDomain.endsWith(
      '.myshopify.com'
    )
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_SHOP_INVALID'
    );

  }


  // ==========================================================
  // ACCESS TOKEN
  // ==========================================================

  const accessToken =
    requireValue(
      input.accessToken,
      'SHOPIFY_WEBHOOK_ACCESS_TOKEN_MISSING'
    );


  // ==========================================================
  // RECEIVER
  // ==========================================================

  const webhookUri =
    normalizeWebhookUri(
      input.webhookUri
    );


  // ==========================================================
  // CURRENT SHOPIFY CONFIGURATION
  // ==========================================================

  const existing =
    await listShopifyWebhookSubscriptions({

      shopDomain,

      accessToken,

    });


  // ==========================================================
  // CUSTOMERS / CREATE
  // ==========================================================

  const customersCreate =
    await ensureTopic({

      shopDomain,

      accessToken,

      topic:
        'CUSTOMERS_CREATE',

      uri:
        webhookUri,

      existing,

    });


  // ==========================================================
  // REFRESH AFTER MUTATION
  //
  // If CUSTOMERS_CREATE was created/updated, fetch the true
  // current configuration before processing CUSTOMERS_UPDATE.
  // ==========================================================

  const refreshed =
    customersCreate.action ===
      'reused'

      ?
        existing

      :
        await listShopifyWebhookSubscriptions({

          shopDomain,

          accessToken,

        });


  // ==========================================================
  // CUSTOMERS / UPDATE
  // ==========================================================

  const customersUpdate =
    await ensureTopic({

      shopDomain,

      accessToken,

      topic:
        'CUSTOMERS_UPDATE',

      uri:
        webhookUri,

      existing:
        refreshed,

    });


  // ==========================================================
  // SAFE RESULT
  // ==========================================================

  return {

    ok:
      true,

    shopDomain,

    webhookUri,

    subscriptions: {

      customersCreate,

      customersUpdate,

    },

  };

}