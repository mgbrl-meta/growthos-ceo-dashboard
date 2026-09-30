import {

  getValidShopifyAccessToken,

} from './shopify-auth.js';



import {

  SHOPIFY_ORDER_CORE_SELECTION,

  SHOPIFY_ORDER_LINE_ITEM_SELECTION,

} from './shopify-commerce-contract.js';





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

    $lineItemsFirst: Int!

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



        ${SHOPIFY_ORDER_CORE_SELECTION}





        # ------------------------------------------------------

        # LINE ITEMS

        #

        # First 10 are fetched inside the existing Orders call.

        #

        # They are separated from the Order object before the

        # canonical Order writer sees the payload.

        #

        # Overflow is fetched only when hasNextPage = true.

        # ------------------------------------------------------



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

// ONE ORDER QUERY

//

// Realtime webhook path.

//

// IMPORTANT:

//

// This field set intentionally matches ORDERS_QUERY exactly.

//

// Webhook payload

//      â†“

// Order GID

//      â†“

// this canonical GraphQL representation

//      â†“

// same warehouse writer used by incremental.

// ============================================================



const ORDER_BY_ID_QUERY = `



  query GrowthOsOrderById(

    $id: ID!

    $lineItemsFirst: Int!

  ) {



    order(

      id: $id

    ) {



      ${SHOPIFY_ORDER_CORE_SELECTION}





      # --------------------------------------------------------

      # LINE ITEMS

      #

      # Realtime webhook refetch receives Order Core and the

      # first Line Item page in the same Shopify request.

      # --------------------------------------------------------



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



`;



// ============================================================

// ORDER LINE ITEMS OVERFLOW QUERY

//

// Only called when the initial nested first-10 connection says

// hasNextPage = true.

//

// We deliberately use a large isolated Line Item page here.

//

// Normal Order:

//   zero extra calls.

//

// Order with 11-260 Line Items:

//   one extra call.

//

// Order with >260:

//   additional cursor pages until exhausted.

// ============================================================



const ORDER_LINE_ITEMS_OVERFLOW_QUERY = `



  query GrowthOsOrderLineItemsOverflow(

    $id: ID!

    $first: Int!

    $after: String!

  ) {



    order(

      id: $id

    ) {



      id



      lineItems(

        first: $first

        after: $after

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

// LINE ITEM FETCH CONFIG

// ============================================================



const ORDER_LINE_ITEMS_INITIAL_SIZE =

  10;





const ORDER_LINE_ITEMS_OVERFLOW_SIZE =

  250;





const ORDER_LINE_ITEMS_MAX_OVERFLOW_PAGES =

  100;





// ============================================================

// CUSTOMERS QUERY

//

// Canonical Customer representation.

//

// Initially:

// manual Customer sync.

//

// Later the SAME representation is reused by:

//

// - incremental reconciliation

// - Bulk historical backfill

// - realtime webhook GraphQL re-fetch

//

// Incremental contract:

//

// [from, to)

//

// updated_at >= from

// updated_at <  to

//

// Exactly the same recovery-window philosophy as Orders.

// ============================================================



const CUSTOMERS_QUERY = `



  query GrowthOsCustomersPage(

    $first: Int!

    $after: String

    $searchQuery: String

    $reverse: Boolean!

  ) {



    customers(

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



        firstName

        lastName

        displayName



        createdAt

        updatedAt



        state



        tags



        locale



        note



        verifiedEmail



        taxExempt



        numberOfOrders





        amountSpent {



          amount

          currencyCode



        }





        defaultEmailAddress {



          emailAddress

          marketingState



        }





        defaultPhoneNumber {



          phoneNumber

          marketingState



        }





        defaultAddress {



          id



          firstName

          lastName



          company



          address1

          address2



          city



          province

          provinceCode



          country

          countryCodeV2



          zip

          phone



        }



      }



    }



  }



`;



// ============================================================

// PRODUCTS QUERY

//

// Canonical Product representation.

//

// SAME field set must be used by:

//

// manual Product sync

// future incremental reconciliation

// Bulk historical backfill

// realtime webhook GraphQL re-fetch

//

// IMPORTANT:

//

// ProductVariant is intentionally NOT embedded here.

//

// Products and ProductVariants are different Shopify entities.

// This prevents variant pagination/truncation from changing the

// canonical Product hash between realtime and historical paths.

//

// Incremental contract:

//

// [from, to)

//

// updated_at >= from

// updated_at <  to

// ============================================================



const PRODUCTS_QUERY = `



  query GrowthOsProductsPage(

    $first: Int!

    $after: String

    $searchQuery: String

    $reverse: Boolean!

  ) {



    products(

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



        title

        handle



        descriptionHtml



        vendor

        productType



        status



        tags



        createdAt

        updatedAt

        publishedAt



        templateSuffix



        hasOnlyDefaultVariant



        totalInventory

        tracksInventory





        variantsCount {



          count



        }





        priceRangeV2 {



          minVariantPrice {



            amount

            currencyCode



          }



          maxVariantPrice {



            amount

            currencyCode



          }



        }





        options {



          id

          name

          position

          values



        }





        seo {



          title

          description



        }



      }



    }



  }



`;





// ============================================================

// ONE PRODUCT QUERY

//

// Realtime webhook path.

//

// IMPORTANT:

//

// Field set intentionally matches PRODUCTS_QUERY exactly.

//

// Webhook payload

//      â†“

// Product GID

//      â†“

// canonical GraphQL Product

//      â†“

// same Product writer used by all ingestion paths.

// ============================================================



const PRODUCT_BY_ID_QUERY = `



  query GrowthOsProductById(

    $id: ID!

  ) {



    product(

      id: $id

    ) {



      id



      legacyResourceId



      title

      handle



      descriptionHtml



      vendor

      productType



      status



      tags



      createdAt

      updatedAt

      publishedAt



      templateSuffix



      hasOnlyDefaultVariant



      totalInventory

      tracksInventory





      variantsCount {



        count



      }





      priceRangeV2 {



        minVariantPrice {



          amount

          currencyCode



        }



        maxVariantPrice {



          amount

          currencyCode



        }



      }





      options {



        id

        name

        position

        values



      }





      seo {



        title

        description



      }



    }



  }



`;





// ============================================================

// ONE CUSTOMER QUERY

//

// Realtime Customer webhook path.

//

// IMPORTANT:

//

// This field set intentionally matches CUSTOMERS_QUERY exactly.

//

// Webhook payload

//      â†“

// Customer GID

//      â†“

// this canonical GraphQL representation

//      â†“

// same Customer warehouse writer used by manual / Bulk.

//

// The webhook JSON itself never becomes the canonical

// warehouse Customer payload.

// ============================================================



const CUSTOMER_BY_ID_QUERY = `



  query GrowthOsCustomerById(

    $id: ID!

  ) {



    customer(

      id: $id

    ) {



      id



      legacyResourceId



      firstName

      lastName

      displayName



      createdAt

      updatedAt



      state



      tags



      locale



      note



      verifiedEmail



      taxExempt



      numberOfOrders





      amountSpent {



        amount

        currencyCode



      }





      defaultEmailAddress {



        emailAddress

        marketingState



      }





      defaultPhoneNumber {



        phoneNumber

        marketingState



      }





      defaultAddress {



        id



        firstName

        lastName



        company



        address1

        address2



        city



        province

        provinceCode



        country

        countryCodeV2



        zip

        phone



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

// ORDERS UPDATED_AT SEARCH QUERY

//

// Shopify Admin search syntax:

//

// updated_at:>='...'

// updated_at:<'...'

//

// Canonical range:

//

// [from, to)

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

// CUSTOMERS UPDATED_AT SEARCH QUERY

//

// Same contract as Orders:

//

// [from, to)

//

// This prepares Customers for the same:

// - incremental reconciliation

// - overlap recovery

// - watermark architecture

// ============================================================



function buildCustomersUpdatedSearch(

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

      'SHOPIFY_CUSTOMERS_UPDATED_WINDOW_INCOMPLETE'

    );



  }





  const normalizedFrom =

    normalizeTimestamp(

      from,

      'SHOPIFY_CUSTOMERS_UPDATED_FROM_INVALID'

    );





  const normalizedTo =

    normalizeTimestamp(

      to,

      'SHOPIFY_CUSTOMERS_UPDATED_TO_INVALID'

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

      'SHOPIFY_CUSTOMERS_UPDATED_WINDOW_INVALID'

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

// PRODUCT UPDATED_AT SEARCH

//

// Canonical incremental range:

//

// [from, to)

//

// Shopify search narrows the source request.

// Growth OS still performs its own local boundary check.

// ============================================================



function buildProductsUpdatedSearch(

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

      'SHOPIFY_PRODUCTS_UPDATED_WINDOW_INCOMPLETE'

    );



  }





  const normalizedFrom =

    normalizeTimestamp(

      from,

      'SHOPIFY_PRODUCTS_UPDATED_FROM_INVALID'

    );





  const normalizedTo =

    normalizeTimestamp(

      to,

      'SHOPIFY_PRODUCTS_UPDATED_TO_INVALID'

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

      'SHOPIFY_PRODUCTS_UPDATED_WINDOW_INVALID'

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

// SPLIT ORDER CORE FROM LINE ITEM CONNECTION

//

// CRITICAL:

//

// Line Items are a separate canonical Growth OS entity.

//

// Therefore:

//

// lineItems MUST NOT enter shopify_orders_raw_json.

//

// The Shopify response may contain them for API efficiency,

// but this function strips the connection before the Order is

// returned to the canonical Order writer.

// ============================================================



function splitOrderAndLineItems(

  sourceOrder

) {



  if (

    !sourceOrder

    ||

    typeof sourceOrder !==

      'object'

  ) {



    throw new Error(

      'SHOPIFY_ORDER_RESPONSE_INVALID'

    );



  }





  const {

    lineItems,

    ...order

  } =

    sourceOrder;





  const nodes =

    Array.isArray(

      lineItems?.nodes

    )

      ?

        lineItems.nodes

      :

        [];





  return {



    order,



    lineItems: {



      nodes,



      pageInfo: {



        hasNextPage:

          Boolean(

            lineItems

              ?.pageInfo

              ?.hasNextPage

          ),



        endCursor:

          lineItems

            ?.pageInfo

            ?.endCursor

          ??

          null,



      },



    },



  };



}





// ============================================================

// APPEND UNIQUE LINE ITEMS

//

// Cursor pagination should already be non-overlapping.

//

// This map is an additional safety guard against duplicate

// LineItem GIDs appearing across pages.

// ============================================================



function appendUniqueLineItems(

  target,

  source

) {



  for (

    const lineItem

    of source

  ) {



    const id =

      String(

        lineItem?.id

        ??

        ''

      ).trim();





    if (!id) {



      throw new Error(

        'SHOPIFY_LINE_ITEM_ID_MISSING'

      );



    }





    target.set(

      id,

      lineItem

    );



  }



}





// ============================================================

// FETCH ONE LINE ITEM OVERFLOW PAGE

//

// Reuses the current valid token where possible.

//

// If Shopify returns 401:

// - refresh once

// - retry the same page

//

// Returns the potentially refreshed token so subsequent

// overflow pages reuse it instead of refreshing independently.

// ============================================================



async function fetchOrderLineItemsOverflowPage(

  runtime,

  token,

  input

) {



  const orderId =

    String(

      input?.orderId

      ??

      ''

    ).trim();





  const after =

    String(

      input?.after

      ??

      ''

    ).trim();





  if (

    !orderId.startsWith(

      'gid://shopify/Order/'

    )

  ) {



    throw new Error(

      'SHOPIFY_LINE_ITEMS_ORDER_ID_INVALID'

    );



  }





  if (!after) {



    throw new Error(

      'SHOPIFY_LINE_ITEMS_CURSOR_MISSING'

    );



  }





  const variables = {



    id:

      orderId,



    first:

      ORDER_LINE_ITEMS_OVERFLOW_SIZE,



    after,



  };





  let activeToken =

    token;





  let result =

    await executeGraphQL({



      shopDomain:

        runtime

          .credential

          .shopDomain,



      accessToken:

        activeToken.accessToken,



      query:

        ORDER_LINE_ITEMS_OVERFLOW_QUERY,



      variables,



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



    activeToken =

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

          activeToken.accessToken,



        query:

          ORDER_LINE_ITEMS_OVERFLOW_QUERY,



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



    throw new Error(

      `SHOPIFY_LINE_ITEMS_HTTP_${result.response.status}`

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

      'SHOPIFY_LINE_ITEMS_GRAPHQL_ERROR',

      {



        orderId,



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

      'SHOPIFY_LINE_ITEMS_GRAPHQL_ERROR'

    );



  }





  const returnedOrder =

    result

      .json

      ?.data

      ?.order

    ??

    null;





  if (!returnedOrder) {



    throw new Error(

      'SHOPIFY_LINE_ITEMS_ORDER_NOT_FOUND'

    );



  }





  const connection =

    returnedOrder

      ?.lineItems;





  if (!connection) {



    throw new Error(

      'SHOPIFY_LINE_ITEMS_RESPONSE_MISSING'

    );



  }





  return {



    nodes:

      Array.isArray(

        connection.nodes

      )

        ?

          connection.nodes

        :

          [],



    pageInfo: {



      hasNextPage:

        Boolean(

          connection

            ?.pageInfo

            ?.hasNextPage

        ),



      endCursor:

        connection

          ?.pageInfo

          ?.endCursor

        ??

        null,



    },



    token:

      activeToken,



  };



}





// ============================================================

// COMPLETE ONE ORDER LINE ITEM SNAPSHOT

//

// Input already contains first 10 Line Items from the parent

// Orders query.

//

// Only performs additional Shopify requests when necessary.

// ============================================================



async function completeOrderLineItemSnapshot(

  runtime,

  token,

  sourceOrder

) {



  const split =

    splitOrderAndLineItems(

      sourceOrder

    );





  const order =

    split.order;





  const orderId =

    String(

      order?.id

      ??

      ''

    ).trim();





  if (

    !orderId.startsWith(

      'gid://shopify/Order/'

    )

  ) {



    throw new Error(

      'SHOPIFY_LINE_ITEM_SNAPSHOT_ORDER_ID_INVALID'

    );



  }





  const lineItems =

    new Map();





  appendUniqueLineItems(

    lineItems,

    split.lineItems.nodes

  );





  let hasNextPage =

    split

      .lineItems

      .pageInfo

      .hasNextPage;





  let cursor =

    split

      .lineItems

      .pageInfo

      .endCursor;





  let overflowPages =

    0;





  let overflowItems =

    0;





  let activeToken =

    token;





  while (

    hasNextPage

  ) {



    overflowPages +=

      1;





    if (

      overflowPages >

        ORDER_LINE_ITEMS_MAX_OVERFLOW_PAGES

    ) {



      throw new Error(

        'SHOPIFY_LINE_ITEMS_PAGE_LIMIT_EXCEEDED'

      );



    }





    if (!cursor) {



      throw new Error(

        'SHOPIFY_LINE_ITEMS_CURSOR_MISSING'

      );



    }





    const page =

      await fetchOrderLineItemsOverflowPage(



        runtime,



        activeToken,



        {



          orderId,



          after:

            cursor,



        }



      );





    activeToken =

      page.token;





    overflowItems +=

      page.nodes.length;





    appendUniqueLineItems(

      lineItems,

      page.nodes

    );





    hasNextPage =

      page

        .pageInfo

        .hasNextPage;





    cursor =

      page

        .pageInfo

        .endCursor;



  }





  return {



    order,



    snapshot: {



      id:

        orderId,



      createdAt:

        order?.createdAt

        ??

        null,



      updatedAt:

        order?.updatedAt

        ??

        order?.createdAt

        ??

        null,



      snapshotComplete:

        true,



      lineItems:

        Array.from(

          lineItems.values()

        ),



    },



    overflowPages,



    overflowItems,



    token:

      activeToken,



  };



}





// ============================================================

// COMPLETE LINE ITEM SNAPSHOTS FOR AN ORDER PAGE

//

// Sequential overflow execution is intentional.

//

// Almost all Orders finish from the nested first-10 payload.

// For the exceptional large Order we use one 250-item overflow

// call.

//

// Sequential execution also prevents a burst of simultaneous

// forced credential refreshes if a token expires mid-page.

// ============================================================



async function separateOrdersAndCompleteLineItems(

  runtime,

  token,

  sourceOrders

) {



  const orders =

    [];





  const lineItemSnapshots =

    [];





  let overflowOrders =

    0;





  let overflowPages =

    0;





  let overflowItems =

    0;





  let activeToken =

    token;





  for (

    const sourceOrder

    of sourceOrders

  ) {



    const completed =

      await completeOrderLineItemSnapshot(



        runtime,



        activeToken,



        sourceOrder



      );





    activeToken =

      completed.token;





    orders.push(

      completed.order

    );





    lineItemSnapshots.push(

      completed.snapshot

    );





    if (

      completed.overflowPages >

        0

    ) {



      overflowOrders +=

        1;



    }





    overflowPages +=

      completed.overflowPages;





    overflowItems +=

      completed.overflowItems;



  }





  return {



    orders,



    lineItemSnapshots,



    overflowOrders,



    overflowPages,



    overflowItems,



    token:

      activeToken,



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
  // Windowed incremental:
  // oldest -> newest
  //
  // Manual:
  // latest -> oldest
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

    lineItemsFirst:
      ORDER_LINE_ITEMS_INITIAL_SIZE,

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
      .length >
        0
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
  // Shopify search performs source-side filtering.
  //
  // Growth OS independently enforces:
  //
  // [from, to)
  //
  // before anything reaches the warehouse.
  // ==========================================================

  let selectedSourceOrders =
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


    selectedSourceOrders =
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


  // ==========================================================
  // SEPARATE ORDER CORE + COMPLETE LINE ITEM SNAPSHOTS
  //
  // Only Orders that survive the local [from,to) guard are
  // eligible for Line Item overflow work.
  // ==========================================================

  const separated =
    await separateOrdersAndCompleteLineItems(

      runtime,

      token,

      selectedSourceOrders

    );


  token =
    separated.token;


  const orders =
    separated.orders;


  const lineItemSnapshots =
    separated.lineItemSnapshots;


  // ==========================================================
  // RESULT
  // ==========================================================

  return {

    orders,

    lineItemSnapshots,

    lineItemStats: {

      snapshots:
        lineItemSnapshots.length,

      lineItems:
        lineItemSnapshots.reduce(
          (
            total,
            snapshot
          ) =>

            total
            +
            snapshot.lineItems.length,

          0
        ),

      overflowOrders:
        separated.overflowOrders,

      overflowPages:
        separated.overflowPages,

      overflowItems:
        separated.overflowItems,

    },


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
      Boolean(
        token
          ?.refreshed
      ),

  };

}


// ============================================================



export async function fetchCustomersPage(

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

    buildCustomersUpdatedSearch(



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

  // Same as Orders:

  //

  // windowed:

  // oldest â†’ newest

  //

  // manual:

  // latest â†’ oldest

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





  // ==========================================================

  // FIRST REQUEST

  // ==========================================================



  let result =

    await executeGraphQL({



      shopDomain:

        runtime

          .credential

          .shopDomain,



      accessToken:

        token.accessToken,



      query:

        CUSTOMERS_QUERY,



      variables,



    });





  // ==========================================================

  // 401 RECOVERY

  //

  // Identical token lifecycle to Orders.

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

          CUSTOMERS_QUERY,



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

      'SHOPIFY_CUSTOMERS_HTTP_ERROR',

      {



        status:

          result

            .response

            .status,



      }

    );





    throw new Error(

      `SHOPIFY_CUSTOMERS_HTTP_${result.response.status}`

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

      'SHOPIFY_CUSTOMERS_GRAPHQL_ERROR',

      {



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

      'SHOPIFY_CUSTOMERS_GRAPHQL_ERROR'

    );



  }





  // ==========================================================

  // CONNECTION

  // ==========================================================



  const connection =

    result

      .json

      ?.data

      ?.customers;





  if (!connection) {



    throw new Error(

      'SHOPIFY_CUSTOMERS_RESPONSE_MISSING'

    );



  }





  const sourceCustomers =

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

  // Same correctness guarantee as Orders.

  //

  // Shopify query:

  // source-side optimisation.

  //

  // Growth OS:

  // authoritative [from,to) enforcement.

  // ==========================================================



  let customers =

    sourceCustomers;





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





    customers =

      sourceCustomers.filter(

        customer => {



          const updatedTime =

            Date.parse(

              String(

                customer?.updatedAt

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

              'SHOPIFY_CUSTOMER_UPDATED_AT_INVALID'

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





  // ==========================================================

  // RESULT

  // ==========================================================



  return {



    customers,





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

        sourceCustomers.length,



      recordsFilteredOut:

        sourceCustomers.length

        -

        customers.length,



    },





    tokenRefreshed:

      Boolean(

        token

          ?.refreshed

      ),



  };



}



// ============================================================

// FETCH PRODUCTS PAGE

//

// Same pagination / recovery contract as Orders + Customers.

//

// Manual:

//

// first = 25

// latest â†’ oldest

//

// Incremental:

//

// first = 250

// after = cursor

// [from, to)

// UPDATED_AT

// oldest â†’ newest

// ============================================================



export async function fetchProductsPage(

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

  // UPDATED WINDOW

  // ==========================================================



  const searchQuery =

    buildProductsUpdatedSearch(



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

  // windowed:

  // oldest â†’ newest

  //

  // manual:

  // latest â†’ oldest

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

  // VALID / REFRESHED TOKEN

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





  // ==========================================================

  // FIRST REQUEST

  // ==========================================================



  let result =

    await executeGraphQL({



      shopDomain:

        runtime

          .credential

          .shopDomain,



      accessToken:

        token.accessToken,



      query:

        PRODUCTS_QUERY,



      variables,



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

      await executeGraphQL({



        shopDomain:

          runtime

            .credential

            .shopDomain,



        accessToken:

          token.accessToken,



        query:

          PRODUCTS_QUERY,



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

      'SHOPIFY_PRODUCTS_HTTP_ERROR',

      {



        status:

          result

            .response

            .status,



      }

    );





    throw new Error(

      `SHOPIFY_PRODUCTS_HTTP_${result.response.status}`

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

      'SHOPIFY_PRODUCTS_GRAPHQL_ERROR',

      {



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

      'SHOPIFY_PRODUCTS_GRAPHQL_ERROR'

    );



  }





  // ==========================================================

  // CONNECTION

  // ==========================================================



  const connection =

    result

      .json

      ?.data

      ?.products;





  if (!connection) {



    throw new Error(

      'SHOPIFY_PRODUCTS_RESPONSE_MISSING'

    );



  }





  const sourceProducts =

    Array.isArray(

      connection.nodes

    )

      ?

        connection.nodes

      :

        [];





  // ==========================================================

  // LOCAL [FROM, TO) GUARD

  // ==========================================================



  let products =

    sourceProducts;





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





    products =

      sourceProducts.filter(

        product => {



          const updatedTime =

            Date.parse(

              String(

                product?.updatedAt

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

              'SHOPIFY_PRODUCT_UPDATED_AT_INVALID'

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





  // ==========================================================

  // RESULT

  // ==========================================================



  return {



    products,



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

        sourceProducts.length,



      recordsFilteredOut:

        sourceProducts.length

        -

        products.length,



    },



    tokenRefreshed:

      Boolean(

        token

          ?.refreshed

      ),



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

        lineItemsFirst:
          ORDER_LINE_ITEMS_INITIAL_SIZE,

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

          lineItemsFirst:
            ORDER_LINE_ITEMS_INITIAL_SIZE,

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


  const sourceOrder =
    result
      .json
      ?.data
      ?.order
    ??
    null;


  if (!sourceOrder) {

    return {

      order:
        null,

      lineItemSnapshot:
        null,

      lineItemStats: {

        lineItems:
          0,

        overflowPages:
          0,

        overflowItems:
          0,

      },

      tokenRefreshed:
        Boolean(
          token
            ?.refreshed
        ),

    };

  }


  const completed =
    await completeOrderLineItemSnapshot(

      runtime,

      token,

      sourceOrder

    );


  token =
    completed.token;


  return {

    order:
      completed.order,

    lineItemSnapshot:
      completed.snapshot,

    lineItemStats: {

      lineItems:
        completed
          .snapshot
          .lineItems
          .length,

      overflowPages:
        completed.overflowPages,

      overflowItems:
        completed.overflowItems,

    },

    tokenRefreshed:
      Boolean(
        token
          ?.refreshed
      ),

  };

}


// ============================================================



export async function fetchShopifyCustomerById(

  runtime,

  customerId

) {



  const id =

    String(

      customerId

      ??

      ''

    ).trim();





  // ==========================================================

  // CUSTOMER ID

  // ==========================================================



  if (

    !id.startsWith(

      'gid://shopify/Customer/'

    )

  ) {



    throw new Error(

      'SHOPIFY_CUSTOMER_ID_INVALID'

    );



  }





  // ==========================================================

  // CREDENTIAL

  // ==========================================================



  let token =

    await getValidShopifyAccessToken(

      runtime

    );





  // ==========================================================

  // QUERY

  // ==========================================================



  let result =

    await executeGraphQL({



      shopDomain:

        runtime

          .credential

          .shopDomain,



      accessToken:

        token.accessToken,



      query:

        CUSTOMER_BY_ID_QUERY,



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

          CUSTOMER_BY_ID_QUERY,



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

      `SHOPIFY_CUSTOMER_HTTP_${result.response.status}`

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

      'SHOPIFY_CUSTOMER_GRAPHQL_ERROR',

      {



        customerId:

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

      'SHOPIFY_CUSTOMER_GRAPHQL_ERROR'

    );



  }





  // ==========================================================

  // RESULT

  // ==========================================================



  return {



    customer:

      result

        .json

        ?.data

        ?.customer

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

// FETCH ONE SHOPIFY PRODUCT

//

// Used by future realtime Product webhook processing.

//

// Uses exactly the same canonical Product field set as

// fetchProductsPage().

// ============================================================



export async function fetchShopifyProductById(

  runtime,

  productId

) {



  const id =

    String(

      productId

      ??

      ''

    ).trim();





  if (

    !id.startsWith(

      'gid://shopify/Product/'

    )

  ) {



    throw new Error(

      'SHOPIFY_PRODUCT_ID_INVALID'

    );



  }





  // ==========================================================

  // VALID TOKEN

  // ==========================================================



  let token =

    await getValidShopifyAccessToken(

      runtime

    );





  // ==========================================================

  // QUERY

  // ==========================================================



  let result =

    await executeGraphQL({



      shopDomain:

        runtime

          .credential

          .shopDomain,



      accessToken:

        token.accessToken,



      query:

        PRODUCT_BY_ID_QUERY,



      variables: {



        id,



      },



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

      await executeGraphQL({



        shopDomain:

          runtime

            .credential

            .shopDomain,



        accessToken:

          token.accessToken,



        query:

          PRODUCT_BY_ID_QUERY,



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

      `SHOPIFY_PRODUCT_HTTP_${result.response.status}`

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

      'SHOPIFY_PRODUCT_GRAPHQL_ERROR',

      {



        productId:

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

      'SHOPIFY_PRODUCT_GRAPHQL_ERROR'

    );



  }





  // ==========================================================

  // RESULT

  // ==========================================================



  return {



    product:

      result

        .json

        ?.data

        ?.product

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

      .length >

        0

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

      Boolean(

        token

          ?.refreshed

      ),



  };



}