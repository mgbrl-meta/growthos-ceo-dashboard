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
// MUTATION
// ============================================================

const START_BULK_MUTATION = `

  mutation GrowthOsStartBulk(
    $query: String!,
    $groupObjects: Boolean!
  ) {

    bulkOperationRunQuery(
      query: $query,
      groupObjects: $groupObjects
    ) {

      bulkOperation {

        id
        status
        createdAt

      }

      userErrors {

        field
        message
        code

      }

    }

  }

`;


// ============================================================
// ORDERS BULK QUERY
//
// created_at:
//   >= start
//   < end
//
// End-exclusive window prevents overlap.
// ============================================================

function buildOrdersBulkQuery(
  from,
  to
) {

  const search =
    `created_at:>='${from}' AND created_at:<'${to}'`;


  return `

    {
      orders(
        query: "${search}"
        sortKey: CREATED_AT
      ) {

        edges {

          node {

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

    }

  `;

}


// ============================================================
// EXECUTE
// ============================================================

async function execute(
  runtime,
  accessToken,
  query,
  variables
) {

  const response =
    await fetch(

      `https://${runtime.credential.shopDomain}/admin/api/${API_VERSION}/graphql.json`,

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

            query,

            variables,

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
      'SHOPIFY_BULK_RESPONSE_INVALID'
    );

  }


  return {

    response,

    json,

  };

}


// ============================================================
// START ORDERS BULK OPERATION
// ============================================================

export async function startOrdersBulkOperation(
  runtime,
  input
) {

  if (
    !input?.from
    ||
    !input?.to
  ) {

    throw new Error(
      'SHOPIFY_BULK_WINDOW_MISSING'
    );

  }


  let token =
    await getValidShopifyAccessToken(
      runtime
    );


  const bulkQuery =
    buildOrdersBulkQuery(
      input.from,
      input.to
    );


  let result =
    await execute(

      runtime,

      token.accessToken,

      START_BULK_MUTATION,

      {

        query:
          bulkQuery,

        groupObjects:
          false,

      }

    );


  // ==========================================================
  // 401 → refresh once → retry
  // ==========================================================

  if (
    result.response.status ===
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
      await execute(

        runtime,

        token.accessToken,

        START_BULK_MUTATION,

        {

          query:
            bulkQuery,

          groupObjects:
            false,

        }

      );

  }


  if (
    !result.response.ok
  ) {

    throw new Error(
      `SHOPIFY_BULK_HTTP_${result.response.status}`
    );

  }


  if (
    Array.isArray(
      result.json?.errors
    )
    &&
    result.json.errors.length
  ) {

    console.error(
      'SHOPIFY_BULK_GRAPHQL_ERROR',
      {

        errors:
          result.json.errors.map(
            error =>
              error?.message
              ??
              'Unknown GraphQL error'
          ),

      }
    );


    throw new Error(
      'SHOPIFY_BULK_GRAPHQL_FAILED'
    );

  }


  const payload =
    result
      .json
      ?.data
      ?.bulkOperationRunQuery;


  const userErrors =
    payload?.userErrors
    ??
    [];


  if (
    userErrors.length > 0
  ) {

    console.error(
      'SHOPIFY_BULK_USER_ERRORS',
      userErrors
    );


    throw new Error(
      'SHOPIFY_BULK_USER_ERROR'
    );

  }


  const operation =
    payload?.bulkOperation;


  if (
    !operation?.id
  ) {

    throw new Error(
      'SHOPIFY_BULK_OPERATION_ID_MISSING'
    );

  }


  return {

    id:
      operation.id,

    status:
      operation.status,

    createdAt:
      operation.createdAt
      ??
      null,

    tokenRefreshed:
      token.refreshed,

  };

}

// ============================================================
// GET BULK OPERATION
//
// Shopify API 2026-01+:
//
// bulkOperation(id:)
// ============================================================

const GET_BULK_OPERATION_QUERY = `

  query GrowthOsBulkOperation(
    $id: ID!
  ) {

    bulkOperation(
      id: $id
    ) {

      id
      status
      errorCode

      createdAt
      completedAt

      objectCount
      rootObjectCount

      fileSize

      url
      partialDataUrl

      type

    }

  }

`;


// ============================================================
// RESOLVE EXACT BULK OPERATION
// ============================================================

export async function getBulkOperation(
  runtime,
  bulkOperationId
) {

  const operationId =
    String(
      bulkOperationId
      ||
      ''
    ).trim();


  if (!operationId) {

    throw new Error(
      'SHOPIFY_BULK_OPERATION_ID_MISSING'
    );

  }


  let token =
    await getValidShopifyAccessToken(
      runtime
    );


  let result =
    await execute(

      runtime,

      token.accessToken,

      GET_BULK_OPERATION_QUERY,

      {

        id:
          operationId,

      }

    );


  // ==========================================================
  // 401 → refresh once
  // ==========================================================

  if (
    result.response.status ===
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
      await execute(

        runtime,

        token.accessToken,

        GET_BULK_OPERATION_QUERY,

        {

          id:
            operationId,

        }

      );

  }


  if (
    !result.response.ok
  ) {

    throw new Error(
      `SHOPIFY_BULK_STATUS_HTTP_${result.response.status}`
    );

  }


  if (
    Array.isArray(
      result.json?.errors
    )
    &&
    result.json.errors.length > 0
  ) {

    console.error(
      'SHOPIFY_BULK_STATUS_GRAPHQL_ERROR',
      {

        errors:
          result.json.errors.map(
            error =>
              error?.message
              ??
              'Unknown GraphQL error'
          ),

      }
    );


    throw new Error(
      'SHOPIFY_BULK_STATUS_GRAPHQL_FAILED'
    );

  }


  const operation =
    result
      .json
      ?.data
      ?.bulkOperation;


  if (!operation) {

    throw new Error(
      'SHOPIFY_BULK_OPERATION_NOT_FOUND'
    );

  }


  if (
    String(
      operation.id
    ) !==
    operationId
  ) {

    throw new Error(
      'SHOPIFY_BULK_OPERATION_ID_MISMATCH'
    );

  }


  return {

    id:
      operation.id,

    status:
      operation.status,

    errorCode:
      operation.errorCode
      ??
      null,

    createdAt:
      operation.createdAt
      ??
      null,

    completedAt:
      operation.completedAt
      ??
      null,

    objectCount:
      Number(
        operation.objectCount
        ??
        0
      ),

    rootObjectCount:
      Number(
        operation.rootObjectCount
        ??
        0
      ),

    fileSize:
      operation.fileSize !==
        null
        &&
        operation.fileSize !==
          undefined

        ? Number(
            operation.fileSize
          )

        : null,

    url:
      operation.url
      ??
      null,

    partialDataUrl:
      operation.partialDataUrl
      ??
      null,

    type:
      operation.type
      ??
      null,

    tokenRefreshed:
      token.refreshed,

  };

}