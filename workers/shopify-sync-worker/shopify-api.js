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
// FIRST ORDERS QUERY
//
// Q3C:
//
// Only prove that Cloud Run can retrieve real Shopify orders.
//
// We intentionally keep this query small.
//
// Full order payload / line-items / transaction enrichment
// comes after the pipeline itself is proven.
// ============================================================

const ORDERS_QUERY = `

  query GrowthOsOrdersPage(
    $first: Int!
  ) {

    orders(
      first: $first
      sortKey: UPDATED_AT
      reverse: true
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
// EARLIEST ORDER QUERY
//
// Read-only coverage probe.
//
// Used during Shopify onboarding/reconnection to discover the
// actual beginning of accessible Shopify order history.
//
// This does NOT write warehouse data and does NOT start Bulk.
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
// FETCH FIRST ORDERS PAGE
// ============================================================

export async function fetchOrdersPage(
  runtime,
  options = {}
) {

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
      100
    );


  // ==========================================================
  // VALID / REFRESHED CREDENTIAL
  // ==========================================================

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
        ORDERS_QUERY,

      variables: {

        first,

      },

    });


  // ==========================================================
  // 401 RECOVERY
  //
  // Shopify recommends refreshing and retrying when an
  // expiring offline token is rejected.
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

        variables: {

          first,

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


  const orders =
    Array.isArray(
      connection.nodes
    )
      ? connection.nodes
      : [];


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

    tokenRefreshed:
      token.refreshed,

  };

}

// ============================================================
// FETCH EARLIEST SHOPIFY ORDER
//
// Returns:
//
// {
//   order: null | {
//     id,
//     legacyResourceId,
//     name,
//     createdAt,
//     updatedAt
//   },
//   tokenRefreshed
// }
//
// Empty store is valid:
//
// order = null
// ============================================================

export async function fetchEarliestShopifyOrder(
  runtime
) {

  // ==========================================================
  // VALID / REFRESHED CREDENTIAL
  // ==========================================================

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