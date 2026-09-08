import {
  getValidShopifyAccessToken,
} from './shopify-auth.js';


const API_VERSION =
  String(
    process.env.SHOPIFY_API_VERSION
    ||
    '2026-01'
  ).trim();


// ============================================================
// ORDERS QUERY
//
// Supports:
//
// - latest/manual reads
// - UPDATED_AT bounded incremental reads
// - cursor pagination
//
// Incremental contract:
//
// [from, to)
//
// updated_at >= from
// updated_at <  to
//
// For incremental:
// sortKey = UPDATED_AT
// reverse = false
//
// This gives deterministic forward pagination through the
// requested recovery window.
// ============================================================

const ORDERS_QUERY = `

  query GrowthOsOrdersPage(
    $first: Int!
    $after: String
    $searchQuery: String
    $reverse: Boolean!
  ) {

    orders(
      first: $first
      after: $after
      query: $searchQuery
      sortKey: UPDATED_AT
      reverse: $reverse
    ) {

      pageInfo {

        hasNextPage
        endCursor

      }


      nodes {

        id

        legacyResourceId

        name

        createdAt

        updatedAt

        cancelledAt

        closedAt

        currencyCode

        displayFinancialStatus

        displayFulfillmentStatus

        email

        sourceName

        tags


        currentSubtotalPriceSet {

          shopMoney {
            amount
            currencyCode
          }

          presentmentMoney {
            amount
            currencyCode
          }

        }


        currentTotalDiscountsSet {

          shopMoney {
            amount
            currencyCode
          }

          presentmentMoney {
            amount
            currencyCode
          }

        }


        currentTotalTaxSet {

          shopMoney {
            amount
            currencyCode
          }

          presentmentMoney {
            amount
            currencyCode
          }

        }


        currentShippingPriceSet {

          shopMoney {
            amount
            currencyCode
          }

          presentmentMoney {
            amount
            currencyCode
          }

        }


        currentTotalPriceSet {

          shopMoney {
            amount
            currencyCode
          }

          presentmentMoney {
            amount
            currencyCode
          }

        }


        customer {

          id

        }

      }

    }

  }

`;

// ============================================================
// ONE ORDER QUERY
//
// Realtime webhook path.
//
// IMPORTANT:
//
// This field set intentionally matches ORDERS_QUERY exactly.
//
// Webhook payload
//      ↓
// Order GID
//      ↓
// this canonical GraphQL representation
//      ↓
// same warehouse writer used by incremental.
// ============================================================

const ORDER_BY_ID_QUERY = `

  query GrowthOsOrderById(
    $id: ID!
  ) {

    order(
      id: $id
    ) {

      id

      legacyResourceId

      name

      createdAt

      updatedAt

      cancelledAt

      closedAt

      currencyCode

      displayFinancialStatus

      displayFulfillmentStatus

      email

      sourceName

      tags


      currentSubtotalPriceSet {

        shopMoney {
          amount
          currencyCode
        }

        presentmentMoney {
          amount
          currencyCode
        }

      }


      currentTotalDiscountsSet {

        shopMoney {
          amount
          currencyCode
        }

        presentmentMoney {
          amount
          currencyCode
        }

      }


      currentTotalTaxSet {

        shopMoney {
          amount
          currencyCode
        }

        presentmentMoney {
          amount
          currencyCode
        }

      }


      currentShippingPriceSet {

        shopMoney {
          amount
          currencyCode
        }

        presentmentMoney {
          amount
          currencyCode
        }

      }


      currentTotalPriceSet {

        shopMoney {
          amount
          currencyCode
        }

        presentmentMoney {
          amount
          currencyCode
        }

      }


      customer {

        id

      }

    }

  }

`;


// ============================================================
// EARLIEST ORDER QUERY
//
// Read-only coverage probe.
//
// Used during Shopify onboarding/reconnection to discover the
// actual beginning of accessible Shopify order history.
// ============================================================

const EARLIEST_ORDER_QUERY = `

  query GrowthOsEarliestOrder {

    orders(
      first: 1
      sortKey: CREATED_AT
      reverse: false
    ) {

      nodes {

        id
        legacyResourceId
        name
        createdAt
        updatedAt

      }

    }

  }

`;


// ============================================================
// ISO TIMESTAMP
// ============================================================

function normalizeTimestamp(
  value,
  errorCode
) {

  const raw =
    String(
      value
      ??
      ''
    ).trim();


  if (!raw) {

    throw new Error(
      errorCode
    );

  }


  const timestamp =
    Date.parse(
      raw
    );


  if (
    Number.isNaN(
      timestamp
    )
  ) {

    throw new Error(
      errorCode
    );

  }


  return new Date(
    timestamp
  ).toISOString();

}


// ============================================================
// UPDATED_AT SEARCH QUERY
//
// Shopify Admin search syntax:
//
// updated_at:>='...'
// updated_at:<'...'
//
// Canonical range:
//
// [from, to)
//
// This deliberately overlaps safely across future recovery
// runs. Warehouse hashing/state logic handles duplicates.
// ============================================================

function buildUpdatedAtSearchQuery(
  from,
  to
) {

  if (
    !from
    &&
    !to
  ) {

    return null;

  }


  if (
    !from
    ||
    !to
  ) {

    throw new Error(
      'SHOPIFY_ORDERS_UPDATED_WINDOW_INCOMPLETE'
    );

  }


  const normalizedFrom =
    normalizeTimestamp(
      from,
      'SHOPIFY_ORDERS_UPDATED_FROM_INVALID'
    );


  const normalizedTo =
    normalizeTimestamp(
      to,
      'SHOPIFY_ORDERS_UPDATED_TO_INVALID'
    );


  if (
    Date.parse(
      normalizedFrom
    )
    >=
    Date.parse(
      normalizedTo
    )
  ) {

    throw new Error(
      'SHOPIFY_ORDERS_UPDATED_WINDOW_INVALID'
    );

  }


  return [
    `updated_at:>='${normalizedFrom}'`,
    `updated_at:<'${normalizedTo}'`,
  ].join(
    ' '
  );

}


// ============================================================
// SHOPIFY GRAPHQL REQUEST
// ============================================================

async function executeGraphQL(
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
      'SHOPIFY_ADMIN_RESPONSE_INVALID'
    );

  }


  return {

    response,

    json,

  };

}


// ============================================================
// FETCH ORDERS PAGE
//
// Options:
//
// first
// after
// from
// to
// reverse
//
// Manual/latest:
//
// {
//   first: 25,
//   reverse: true
// }
//
// Incremental:
//
// {
//   first: 250,
//   after: cursor,
//   from,
//   to,
//   reverse: false
// }
// ============================================================

export async function fetchOrdersPage(
  runtime,
  options = {}
) {

  // ==========================================================
  // PAGE SIZE
  // ==========================================================

  const first =
    Math.min(
      Math.max(
        Number(
          options.first
          ??
          25
        ),
        1
      ),
      250
    );


  // ==========================================================
  // CURSOR
  // ==========================================================

  const after =
    String(
      options.after
      ??
      ''
    ).trim()
    ||
    null;


  // ==========================================================
  // UPDATED_AT WINDOW
  // ==========================================================

  const searchQuery =
    buildUpdatedAtSearchQuery(

      options.from
      ??
      null,

      options.to
      ??
      null

    );


  // ==========================================================
  // DIRECTION
  //
  // Windowed incremental reads should always move oldest →
  // newest.
  //
  // Non-windowed manual reads preserve latest-first behavior.
  // ==========================================================

  const reverse =
    searchQuery
      ?
        false
      :
        Boolean(
          options.reverse
          ??
          true
        );


  // ==========================================================
  // VALID / REFRESHED CREDENTIAL
  // ==========================================================

  let token =
    await getValidShopifyAccessToken(
      runtime
    );


  const variables = {

    first,

    after,

    searchQuery,

    reverse,

  };


  let result =
    await executeGraphQL({

      shopDomain:
        runtime
          .credential
          .shopDomain,

      accessToken:
        token.accessToken,

      query:
        ORDERS_QUERY,

      variables,

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
      await executeGraphQL({

        shopDomain:
          runtime
            .credential
            .shopDomain,

        accessToken:
          token.accessToken,

        query:
          ORDERS_QUERY,

        variables,

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

    console.error(
      'SHOPIFY_ADMIN_HTTP_ERROR',
      {

        status:
          result
            .response
            .status,

      }
    );


    throw new Error(
      `SHOPIFY_ADMIN_HTTP_${result.response.status}`
    );

  }


  // ==========================================================
  // GRAPHQL ERROR
  // ==========================================================

  if (
    Array.isArray(
      result
        .json
        ?.errors
    )
    &&
    result
      .json
      .errors
      .length > 0
  ) {

    console.error(
      'SHOPIFY_ADMIN_GRAPHQL_ERROR',
      {

        errors:
          result
            .json
            .errors
            .map(
              error => ({

                message:
                  error?.message
                  ??
                  'Unknown GraphQL error',

              })
            ),

      }
    );


    throw new Error(
      'SHOPIFY_ADMIN_GRAPHQL_FAILED'
    );

  }


  const connection =
    result
      .json
      ?.data
      ?.orders;


  if (!connection) {

    throw new Error(
      'SHOPIFY_ORDERS_RESPONSE_MISSING'
    );

  }


    const sourceOrders =
    Array.isArray(
      connection.nodes
    )
      ?
        connection.nodes
      :
        [];


  // ==========================================================
  // STRICT LOCAL WINDOW GUARD
  //
  // Shopify search is the source-side optimisation.
  //
  // Growth OS still independently enforces the canonical:
  //
  // [from, to)
  //
  // contract before anything reaches the warehouse.
  //
  // This protects adjacent incremental windows from boundary
  // ambiguity or provider-side search behaviour.
  // ==========================================================

  let orders =
    sourceOrders;


  if (
    options.from
    &&
    options.to
  ) {

    const fromTime =
      Date.parse(
        options.from
      );


    const toTime =
      Date.parse(
        options.to
      );


    orders =
      sourceOrders.filter(
        order => {

          const updatedTime =
            Date.parse(
              String(
                order?.updatedAt
                ??
                ''
              )
            );


          if (
            Number.isNaN(
              updatedTime
            )
          ) {

            throw new Error(
              'SHOPIFY_ORDER_UPDATED_AT_INVALID'
            );

          }


          return (
            updatedTime >=
              fromTime
            &&
            updatedTime <
              toTime
          );

        }
      );

  }


  return {

    orders,

    pageInfo: {

      hasNextPage:
        Boolean(
          connection
            .pageInfo
            ?.hasNextPage
        ),

      endCursor:
        connection
          .pageInfo
          ?.endCursor
        ??
        null,

    },

    query: {

      from:
        options.from
        ??
        null,

      to:
        options.to
        ??
        null,

      searchQuery,

      reverse,

      cursorPresent:
        Boolean(
          after
        ),

      sourceRecordsFetched:
        sourceOrders.length,

      recordsFilteredOut:
        sourceOrders.length
        -
        orders.length,  

    },

    tokenRefreshed:
      token.refreshed,

  };

}


// ============================================================
// FETCH ONE SHOPIFY ORDER
//
// Used by realtime webhook processing.
//
// Uses the same token lifecycle / 401 recovery as the existing
// Shopify API paths.
// ============================================================

export async function fetchShopifyOrderById(
  runtime,
  orderId
) {

  const id =
    String(
      orderId
      ??
      ''
    ).trim();


  if (
    !id.startsWith(
      'gid://shopify/Order/'
    )
  ) {

    throw new Error(
      'SHOPIFY_ORDER_ID_INVALID'
    );

  }


  let token =
    await getValidShopifyAccessToken(
      runtime
    );


  let result =
    await executeGraphQL({

      shopDomain:
        runtime
          .credential
          .shopDomain,

      accessToken:
        token.accessToken,

      query:
        ORDER_BY_ID_QUERY,

      variables: {

        id,

      },

    });


  // ==========================================================
  // 401 TOKEN RECOVERY
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
      await executeGraphQL({

        shopDomain:
          runtime
            .credential
            .shopDomain,

        accessToken:
          token.accessToken,

        query:
          ORDER_BY_ID_QUERY,

        variables: {

          id,

        },

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
      `SHOPIFY_ORDER_HTTP_${result.response.status}`
    );

  }


  // ==========================================================
  // GRAPHQL ERROR
  // ==========================================================

  if (
    Array.isArray(
      result
        .json
        ?.errors
    )
    &&
    result
      .json
      .errors
      .length >
        0
  ) {

    console.error(
      'SHOPIFY_ORDER_GRAPHQL_ERROR',
      {

        orderId:
          id,

        errors:
          result
            .json
            .errors
            .map(
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
      'SHOPIFY_ORDER_GRAPHQL_ERROR'
    );

  }


  return {

    order:
      result
        .json
        ?.data
        ?.order
      ??
      null,

    tokenRefreshed:
      Boolean(
        token
          ?.refreshed
      ),

  };

}


// ============================================================
// FETCH EARLIEST SHOPIFY ORDER
// ============================================================

export async function fetchEarliestShopifyOrder(
  runtime
) {

  let token =
    await getValidShopifyAccessToken(
      runtime
    );


  let result =
    await executeGraphQL({

      shopDomain:
        runtime
          .credential
          .shopDomain,

      accessToken:
        token.accessToken,

      query:
        EARLIEST_ORDER_QUERY,

      variables:
        {},

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
      await executeGraphQL({

        shopDomain:
          runtime
            .credential
            .shopDomain,

        accessToken:
          token.accessToken,

        query:
          EARLIEST_ORDER_QUERY,

        variables:
          {},

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

    console.error(
      'SHOPIFY_EARLIEST_ORDER_HTTP_ERROR',
      {

        status:
          result
            .response
            .status,

      }
    );


    throw new Error(
      `SHOPIFY_EARLIEST_ORDER_HTTP_${result.response.status}`
    );

  }


  // ==========================================================
  // GRAPHQL ERROR
  // ==========================================================

  if (
    Array.isArray(
      result
        .json
        ?.errors
    )
    &&
    result
      .json
      .errors
      .length > 0
  ) {

    console.error(
      'SHOPIFY_EARLIEST_ORDER_GRAPHQL_ERROR',
      {

        errors:
          result
            .json
            .errors
            .map(
              error => ({

                message:
                  error?.message
                  ??
                  'Unknown GraphQL error',

              })
            ),

      }
    );


    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_GRAPHQL_FAILED'
    );

  }


  const connection =
    result
      .json
      ?.data
      ?.orders;


  if (!connection) {

    throw new Error(
      'SHOPIFY_EARLIEST_ORDER_RESPONSE_MISSING'
    );

  }


  const nodes =
    Array.isArray(
      connection.nodes
    )
      ?
        connection.nodes
      :
        [];


  const order =
    nodes[0]
    ??
    null;


  return {

    order,

    tokenRefreshed:
      token.refreshed,

  };

}