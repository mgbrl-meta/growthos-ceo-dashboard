import {
  getValidShopifyAccessToken,
} from './shopify-auth.js';

import {
  SHOPIFY_COMMERCE_CONTRACT_VERSION,
  SHOPIFY_ORDER_CONTRACT_VERSION,
  SHOPIFY_ORDER_LINE_ITEM_CONTRACT_VERSION,
  SHOPIFY_ORDER_CORE_SELECTION,
  SHOPIFY_ORDER_LINE_ITEM_SELECTION,
} from './shopify-commerce-contract.js';


// ============================================================
// CONFIG
// ============================================================

const API_VERSION =
  String(
    process.env.SHOPIFY_API_VERSION
    ||
    '2026-01'
  ).trim();


// ============================================================
// ORDER CORE CONTRACT PROBE
//
// READ ONLY.
//
// Purpose:
//
// 1. Validate the V2 Order contract against the real Shopify
//    schema/account.
//
// 2. Measure Shopify requested query cost.
//
// 3. Determine a safe incremental page size before replacing
//    the existing production Orders query.
//
// NO BigQuery writes.
// NO Shopify mutations.
// NO state changes.
// ============================================================

const ORDER_CORE_PROBE_QUERY = `

  query GrowthOsOrderCoreContractProbe(
    $first: Int!
  ) {

    orders(
      first: $first
      sortKey: UPDATED_AT
      reverse: true
    ) {

      nodes {

        ${SHOPIFY_ORDER_CORE_SELECTION}

      }

    }

  }

`;

// ============================================================
// ORDER LINE ITEM CONTRACT PROBE
//
// READ ONLY.
//
// Tests one known Shopify Order and its LineItem connection.
//
// NO BigQuery writes.
// NO Shopify mutations.
// NO state changes.
// ============================================================

const ORDER_LINE_ITEM_PROBE_QUERY = `

  query GrowthOsOrderLineItemContractProbe(
    $orderId: ID!
    $first: Int!
  ) {

    order(
      id: $orderId
    ) {

      id

      lineItems(
        first: $first
      ) {

        pageInfo {
          hasNextPage
          endCursor
        }

        nodes {

          ${SHOPIFY_ORDER_LINE_ITEM_SELECTION}

        }

      }

    }

  }

`;

// ============================================================
// ORDERS + LINE ITEMS COMBINED COST PROBE
//
// READ ONLY.
//
// Simulates the shape Growth OS could use for incremental
// Orders + first-class Line Items ingestion.
//
// NO BigQuery writes.
// NO Shopify mutations.
// NO state changes.
// ============================================================

const ORDERS_WITH_LINE_ITEMS_PROBE_QUERY = `

  query GrowthOsOrdersWithLineItemsProbe(
    $ordersFirst: Int!
    $lineItemsFirst: Int!
  ) {

    orders(
      first: $ordersFirst
      sortKey: UPDATED_AT
      reverse: true
    ) {

      nodes {

        ${SHOPIFY_ORDER_CORE_SELECTION}

        lineItems(
          first: $lineItemsFirst
        ) {

          pageInfo {
            hasNextPage
            endCursor
          }

          nodes {

            ${SHOPIFY_ORDER_LINE_ITEM_SELECTION}

          }

        }

      }

    }

  }

`;


// ============================================================
// PAGE SIZE
//
// Keep diagnostic probes deliberately small.
//
// We are measuring query cost, not doing ingestion.
// ============================================================

function normalizeProbeSize(
  value
) {

  const parsed =
    Number(
      value
      ??
      1
    );

  if (
    !Number.isFinite(parsed)
  ) {

    return 1;

  }

  return Math.min(
    Math.max(
      Math.trunc(parsed),
      1
    ),
    250
  );

}


// ============================================================
// GRAPHQL REQUEST
// ============================================================

async function executeProbe(
  input
) {

  const response =
    await fetch(

      `https://${input.shopDomain}/admin/api/${API_VERSION}/graphql.json`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'X-Shopify-Access-Token':
            input.accessToken,

          // --------------------------------------------------
          // Ask Shopify to return the field-level cost
          // breakdown inside extensions.cost.fields.
          // --------------------------------------------------

          'Shopify-GraphQL-Cost-Debug':
            '1',

        },

        body:
          JSON.stringify({

            query:
              ORDER_CORE_PROBE_QUERY,

            variables: {

              first:
                input.first,

            },

          }),

      }

    );

  const raw =
    await response.text();

  let json;

  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_COMMERCE_PROBE_RESPONSE_INVALID'
    );

  }

  return {

    response,
    json,

  };

}


// ============================================================
// COST SUMMARY
// ============================================================

function summarizeCost(
  cost
) {

  const fields =
    Array.isArray(
      cost?.fields
    )
      ?
        cost.fields
      :
        [];

  const expensiveFields =
    fields

      .map(
        field => ({

          path:
            Array.isArray(
              field?.path
            )
              ?
                field.path.join('.')
              :
                String(
                  field?.path
                  ??
                  ''
                ),

          definedCost:
            field?.definedCost
            ??
            null,

          requestedTotalCost:
            field?.requestedTotalCost
            ??
            null,

          requestedChildrenCost:
            field?.requestedChildrenCost
            ??
            null,

        })
      )

      .sort(
        (
          a,
          b
        ) =>

          Number(
            b.requestedTotalCost
            ??
            0
          )
          -
          Number(
            a.requestedTotalCost
            ??
            0
          )

      )

      .slice(
        0,
        25
      );

  return {

    requestedQueryCost:
      cost?.requestedQueryCost
      ??
      null,

    actualQueryCost:
      cost?.actualQueryCost
      ??
      null,

    throttleStatus:
      cost?.throttleStatus
      ??
      null,

    expensiveFields,

  };

}

// ============================================================
// EXECUTE LINE ITEM PROBE
// ============================================================

async function executeLineItemProbe(
  input
) {

  const response =
    await fetch(

      `https://${input.shopDomain}/admin/api/${API_VERSION}/graphql.json`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
    'application/json',

  'Accept':
    'application/json',

  'X-Shopify-Access-Token':
    input.accessToken,

  'Shopify-GraphQL-Cost-Debug':
    '1',


        },

        body:
          JSON.stringify({

            query:
              ORDER_LINE_ITEM_PROBE_QUERY,

            variables: {

              orderId:
                input.orderId,

              first:
                input.first,

            },

          }),

      }

    );


  const raw =
    await response.text();


  let json;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_LINE_ITEM_PROBE_RESPONSE_INVALID'
    );

  }


  return {

    response,

    json,

  };

}

// ============================================================
// EXECUTE ORDERS + LINE ITEMS COMBINED PROBE
// ============================================================

async function executeOrdersWithLineItemsProbe(
  input
) {

  const response =
    await fetch(

      `https://${input.shopDomain}/admin/api/${API_VERSION}/graphql.json`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'X-Shopify-Access-Token':
            input.accessToken,

          'Shopify-GraphQL-Cost-Debug':
            '1',

        },

        body:
          JSON.stringify({

            query:
              ORDERS_WITH_LINE_ITEMS_PROBE_QUERY,

            variables: {

              ordersFirst:
                input.ordersFirst,

              lineItemsFirst:
                input.lineItemsFirst,

            },

          }),

      }

    );


  const raw =
    await response.text();


  let json;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_ORDERS_LINE_ITEMS_PROBE_RESPONSE_INVALID'
    );

  }


  return {

    response,

    json,

  };

}


// ============================================================
// LINE ITEM PROBE COST
// ============================================================

function summarizeLineItemProbeCost(
  json
) {

  const cost =
    json
      ?.extensions
      ?.cost
    ??
    null;


  const fields =
    Array.isArray(
      cost?.fields
    )
      ?
        cost.fields
      :
        [];


  const expensiveFields =
    fields

      .map(
        field => ({

          path:
            Array.isArray(
              field?.path
            )
              ?
                field.path.join('.')
              :
                String(
                  field?.path
                  ??
                  ''
                ),

          definedCost:
            field?.definedCost
            ??
            null,

          requestedTotalCost:
            field?.requestedTotalCost
            ??
            null,

          requestedChildrenCost:
            field?.requestedChildrenCost
            ??
            null,

        })
      )

      .sort(
        (
          a,
          b
        ) =>

          Number(
            b.requestedTotalCost
            ??
            0
          )
          -
          Number(
            a.requestedTotalCost
            ??
            0
          )
      )

      .slice(
        0,
        30
      );


  return {

    requestedQueryCost:
      cost?.requestedQueryCost
      ??
      null,

    actualQueryCost:
      cost?.actualQueryCost
      ??
      null,

    throttleStatus:
      cost?.throttleStatus
      ??
      null,

    expensiveFields,

  };

}


// ============================================================
// PUBLIC PROBE
// ============================================================

export async function probeShopifyOrderCoreContract(
  runtime,
  options = {}
) {

  const first =
    normalizeProbeSize(
      options.first
    );

  let token =
    await getValidShopifyAccessToken(
      runtime
    );

  let result =
    await executeProbe({

      shopDomain:
        runtime
          .credential
          .shopDomain,

      accessToken:
        token.accessToken,

      first,

    });


  // ==========================================================
  // 401 RECOVERY
  // ==========================================================

  if (
    result
      .response
      .status === 401
  ) {

    token =
      await getValidShopifyAccessToken(

        runtime,

        {

          forceRefresh:
            true,

        }

      );

    result =
      await executeProbe({

        shopDomain:
          runtime
            .credential
            .shopDomain,

        accessToken:
          token.accessToken,

        first,

      });

  }


  // ==========================================================
  // HTTP ERROR
  // ==========================================================

  if (
    !result
      .response
      .ok
  ) {

    throw new Error(
      `SHOPIFY_COMMERCE_PROBE_HTTP_${result.response.status}`
    );

  }


  // ==========================================================
  // GRAPHQL ERROR
  //
  // Keep the Shopify messages because this endpoint is an
  // internal schema diagnostic.
  // ==========================================================

  const graphqlErrors =
    Array.isArray(
      result
        .json
        ?.errors
    )
      ?
        result
          .json
          .errors
      :
        [];

  if (
    graphqlErrors.length > 0
  ) {

    const messages =
      graphqlErrors

        .map(
          error =>
            String(
              error?.message
              ??
              'Unknown Shopify GraphQL error'
            )
        )

        .join(
          ' | '
        );

    throw new Error(
      `SHOPIFY_COMMERCE_PROBE_GRAPHQL_FAILED: ${messages}`
    );

  }


  // ==========================================================
  // RESULT
  // ==========================================================

  const nodes =
    Array.isArray(
      result
        .json
        ?.data
        ?.orders
        ?.nodes
    )
      ?
        result
          .json
          .data
          .orders
          .nodes
      :
        [];

  const order =
    nodes[0]
    ??
    null;

  // ----------------------------------------------------------
  // IMPORTANT:
  //
  // Do NOT return the actual order payload from this diagnostic
  // endpoint because it can contain customer PII.
  //
  // We only return field names + GraphQL cost metadata.
  // ----------------------------------------------------------

  const topLevelFields =
    order
      ?
        Object
          .keys(
            order
          )
          .sort()
      :
        [];

  return {

    commerceContractVersion:
      SHOPIFY_COMMERCE_CONTRACT_VERSION,

    orderContractVersion:
      SHOPIFY_ORDER_CONTRACT_VERSION,

    apiVersion:
      API_VERSION,

    requestedPageSize:
      first,

    schemaValid:
      true,

    orderFound:
      Boolean(
        order
      ),

    returnedTopLevelFieldCount:
      topLevelFields.length,

    returnedTopLevelFields:
      topLevelFields,

    cost:
      summarizeCost(
        result
          .json
          ?.extensions
          ?.cost
      ),

    tokenRefreshed:
      Boolean(
        token.refreshed
      ),

  };

}

// ============================================================
// PUBLIC ORDER LINE ITEM PROBE
// ============================================================

export async function probeShopifyOrderLineItemContract(
  runtime,
  options = {}
) {

  const startedAt =
    Date.now();


  const orderId =
    String(
      options.orderId
      ??
      ''
    ).trim();


  if (
    !orderId.startsWith(
      'gid://shopify/Order/'
    )
  ) {

    throw new Error(
      'SHOPIFY_LINE_ITEM_PROBE_ORDER_ID_INVALID'
    );

  }


  const first =
    normalizeProbeSize(
      options.first
    );


  let token =
    await getValidShopifyAccessToken(
      runtime
    );


  let result =
    await executeLineItemProbe({

      shopDomain:
        runtime
          .credential
          .shopDomain,

      accessToken:
        token.accessToken,

      orderId,

      first,

    });


  // ==========================================================
  // 401 RECOVERY
  // ==========================================================

  if (
    result
      .response
      .status ===
        401
  ) {

    token =
      await getValidShopifyAccessToken(

        runtime,

        {
          forceRefresh:
            true,
        }

      );


    result =
      await executeLineItemProbe({

        shopDomain:
          runtime
            .credential
            .shopDomain,

        accessToken:
          token.accessToken,

        orderId,

        first,

      });

  }


  // ==========================================================
  // HTTP
  // ==========================================================

  if (
    !result
      .response
      .ok
  ) {

    throw new Error(
      `SHOPIFY_LINE_ITEM_PROBE_HTTP_${result.response.status}`
    );

  }


  // ==========================================================
  // GRAPHQL
  // ==========================================================

  const graphqlErrors =
    Array.isArray(
      result
        .json
        ?.errors
    )
      ?
        result.json.errors
      :
        [];


  if (
    graphqlErrors.length >
      0
  ) {

    console.error(
      'SHOPIFY_LINE_ITEM_PROBE_GRAPHQL_ERROR',
      {

        errors:
          graphqlErrors.map(
            error => ({

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
      'SHOPIFY_LINE_ITEM_PROBE_GRAPHQL_FAILED'
    );

  }


  const order =
    result
      .json
      ?.data
      ?.order
    ??
    null;


  const connection =
    order
      ?.lineItems
    ??
    null;


  const nodes =
    Array.isArray(
      connection?.nodes
    )
      ?
        connection.nodes
      :
        [];


  const firstLineItem =
    nodes[0]
    ??
    null;


  const returnedTopLevelFields =
    firstLineItem
      ?
        Object
          .keys(
            firstLineItem
          )
          .sort()
      :
        [];


  return {

    commerceContractVersion:
      SHOPIFY_COMMERCE_CONTRACT_VERSION,

    lineItemContractVersion:
      SHOPIFY_ORDER_LINE_ITEM_CONTRACT_VERSION,

    apiVersion:
      API_VERSION,

    orderId,

    requestedPageSize:
      first,

    schemaValid:
      Boolean(
        order
        &&
        connection
      ),

    orderFound:
      Boolean(
        order
      ),

    lineItemFound:
      Boolean(
        firstLineItem
      ),

    returnedLineItemCount:
      nodes.length,

    hasNextPage:
      Boolean(
        connection
          ?.pageInfo
          ?.hasNextPage
      ),

    returnedTopLevelFieldCount:
      returnedTopLevelFields.length,

    returnedTopLevelFields,

    cost:
      summarizeLineItemProbeCost(
        result.json
      ),

    tokenRefreshed:
      Boolean(
        token?.refreshed
      ),

    durationMs:
      Date.now()
      -
      startedAt,

  };

}

// ============================================================
// PUBLIC ORDERS + LINE ITEMS COMBINED PROBE
// ============================================================

export async function probeShopifyOrdersWithLineItemsContract(
  runtime,
  options = {}
) {

  const startedAt =
    Date.now();


  const ordersFirst =
    normalizeProbeSize(
      options.ordersFirst
    );


  const lineItemsFirst =
    normalizeProbeSize(
      options.lineItemsFirst
    );


  let token =
    await getValidShopifyAccessToken(
      runtime
    );


  let result =
    await executeOrdersWithLineItemsProbe({

      shopDomain:
        runtime
          .credential
          .shopDomain,

      accessToken:
        token.accessToken,

      ordersFirst,

      lineItemsFirst,

    });


  // ==========================================================
  // 401 RECOVERY
  // ==========================================================

  if (
    result
      .response
      .status === 401
  ) {

    token =
      await getValidShopifyAccessToken(

        runtime,

        {
          forceRefresh:
            true,
        }

      );


    result =
      await executeOrdersWithLineItemsProbe({

        shopDomain:
          runtime
            .credential
            .shopDomain,

        accessToken:
          token.accessToken,

        ordersFirst,

        lineItemsFirst,

      });

  }


  // ==========================================================
  // HTTP
  // ==========================================================

  if (
    !result
      .response
      .ok
  ) {

    throw new Error(
      `SHOPIFY_ORDERS_LINE_ITEMS_PROBE_HTTP_${result.response.status}`
    );

  }


  // ==========================================================
  // GRAPHQL
  // ==========================================================

  const graphqlErrors =
    Array.isArray(
      result
        .json
        ?.errors
    )
      ?
        result.json.errors
      :
        [];


  if (
    graphqlErrors.length >
      0
  ) {

    console.error(
      'SHOPIFY_ORDERS_LINE_ITEMS_PROBE_GRAPHQL_ERROR',
      {

        errors:
          graphqlErrors.map(
            error => ({

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
      'SHOPIFY_ORDERS_LINE_ITEMS_PROBE_GRAPHQL_FAILED'
    );

  }


  const orders =
    Array.isArray(
      result
        .json
        ?.data
        ?.orders
        ?.nodes
    )
      ?
        result.json.data.orders.nodes
      :
        [];


  let returnedLineItems =
    0;

  let ordersWithMoreLineItems =
    0;

  let maximumReturnedLineItems =
    0;


  for (
    const order
    of orders
  ) {

    const nodes =
      Array.isArray(
        order
          ?.lineItems
          ?.nodes
      )
        ?
          order.lineItems.nodes
        :
          [];


    returnedLineItems +=
      nodes.length;


    maximumReturnedLineItems =
      Math.max(
        maximumReturnedLineItems,
        nodes.length
      );


    if (
      order
        ?.lineItems
        ?.pageInfo
        ?.hasNextPage
    ) {

      ordersWithMoreLineItems +=
        1;

    }

  }


  return {

    commerceContractVersion:
      SHOPIFY_COMMERCE_CONTRACT_VERSION,

    orderContractVersion:
      SHOPIFY_ORDER_CONTRACT_VERSION,

    lineItemContractVersion:
      SHOPIFY_ORDER_LINE_ITEM_CONTRACT_VERSION,

    apiVersion:
      API_VERSION,

    requestedOrdersPageSize:
      ordersFirst,

    requestedLineItemsPageSize:
      lineItemsFirst,

    returnedOrderCount:
      orders.length,

    returnedLineItemCount:
      returnedLineItems,

    maximumReturnedLineItemsPerOrder:
      maximumReturnedLineItems,

    ordersWithMoreLineItems,

    cost:
      summarizeLineItemProbeCost(
        result.json
      ),

    tokenRefreshed:
      Boolean(
        token?.refreshed
      ),

    durationMs:
      Date.now()
      -
      startedAt,

  };

}