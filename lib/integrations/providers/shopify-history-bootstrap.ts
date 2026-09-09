import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  getIntegrationAccountByProviderAccountId,
  getIntegrationConnectionById,
} from '@/lib/integrations/store';

import {
  queryEarliestCustomerWithStoredShopifyCredential,
  queryEarliestOrderWithStoredShopifyCredential,
} from '@/lib/integrations/providers/shopify-credentials';

import {
  createShopifyCustomersBackfill,
  createShopifyOrdersBackfill,
  planShopifyCustomersBackfillWindows,
  planShopifyOrdersBackfillWindows,
} from '@/lib/integrations/providers/shopify-backfill';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


const DATA_DATASET =
  process.env.GROWTHOS_DATA_DATASET
  ||
  'growthos_data';


const DATA_LOCATION =
  process.env.GROWTHOS_DATA_LOCATION
  ||
  'asia-south1';


const OPS_DATASET =
  process.env.GROWTHOS_OPS_DATASET
  ||
  'growthos_ops';


const OPS_LOCATION =
  process.env.GROWTHOS_OPS_LOCATION
  ||
  'asia-south1';


// ============================================================
// REQUIRED STRING
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
// METADATA
// ============================================================

function normalizeMetadata(
  value: unknown
):
  Record<string, any> {

  if (
    value
    &&
    typeof value ===
      'object'
    &&
    !Array.isArray(
      value
    )
  ) {

    return value as Record<
      string,
      any
    >;

  }


  if (
    typeof value ===
      'string'
  ) {

    try {

      const parsed =
        JSON.parse(
          value
        );


      if (
        parsed
        &&
        typeof parsed ===
          'object'
        &&
        !Array.isArray(
          parsed
        )
      ) {

        return parsed;

      }

    } catch {

      return {};

    }

  }


  return {};

}


// ============================================================
// TIMESTAMP NORMALIZER
// ============================================================

function timestampToIso(
  value: any
):
  string | null {

  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {

    return null;

  }


  const raw =
    value?.value
    ??
    value;


  const date =
    new Date(
      raw
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date
    .toISOString();

}


// ============================================================
// EXISTING LOCAL ORDER COVERAGE
// ============================================================

async function getExistingOrderCoverage(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    integrationAccountId:
      string;

  }
) {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          COUNT(*) AS order_count,

          MIN(created_at)
            AS earliest_order,

          MAX(created_at)
            AS latest_order,

          MAX(updated_at)
            AS latest_order_update,

          MAX(loaded_at)
            AS latest_load

        FROM
          \`${PROJECT_ID}.${DATA_DATASET}.shopify_orders_current\`

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND integration_account_id =
            @integration_account_id

      `,

      location:
        DATA_LOCATION,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        integration_account_id:
          input.integrationAccountId,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

      },

    });


  const row =
    rows?.[0]
    ??
    {};


  return {

    orderCount:
      Number(
        row.order_count
        ??
        0
      ),

    earliestOrder:
      timestampToIso(
        row.earliest_order
      ),

    latestOrder:
      timestampToIso(
        row.latest_order
      ),

    latestOrderUpdate:
      timestampToIso(
        row.latest_order_update
      ),

    latestLoad:
      timestampToIso(
        row.latest_load
      ),

  };

}


// ============================================================
// EXISTING LOCAL CUSTOMER COVERAGE
// ============================================================

async function getExistingCustomerCoverage(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    integrationAccountId:
      string;

  }
) {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          COUNT(*) AS customer_count,

          MIN(created_at)
            AS earliest_customer,

          MAX(created_at)
            AS latest_customer,

          MAX(updated_at)
            AS latest_customer_update,

          MAX(loaded_at)
            AS latest_load

        FROM
          \`${PROJECT_ID}.${DATA_DATASET}.shopify_customers_current\`

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND integration_account_id =
            @integration_account_id

      `,

      location:
        DATA_LOCATION,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        integration_account_id:
          input.integrationAccountId,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

      },

    });


  const row =
    rows?.[0]
    ??
    {};


  return {

    customerCount:
      Number(
        row.customer_count
        ??
        0
      ),

    earliestCustomer:
      timestampToIso(
        row.earliest_customer
      ),

    latestCustomer:
      timestampToIso(
        row.latest_customer
      ),

    latestCustomerUpdate:
      timestampToIso(
        row.latest_customer_update
      ),

    latestLoad:
      timestampToIso(
        row.latest_load
      ),

  };

}


// ============================================================
// EXISTING EQUIVALENT BACKFILL
//
// Prevent repeated setup / reinstall from creating a backfill
// that is already planned, active or completed.
//
// A covering run is enough:
//
// existing.from <= missing.from
// existing.to   >= missing.to
//
// Entity is mandatory so Orders and Customers can never cover
// one another accidentally.
// ============================================================

async function findCoveringBackfill(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    integrationAccountId:
      string;

    entity:
      'orders' | 'customers';

    from:
      string;

    to:
      string;

  }
) {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          backfill_run_id,
          entity,
          status,
          requested_from,
          requested_to,
          created_at,
          updated_at

        FROM
          \`${PROJECT_ID}.${OPS_DATASET}.shopify_backfill_runs\`

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND integration_account_id =
            @integration_account_id

          AND provider =
            'shopify'

          AND entity =
            @entity

          AND requested_from <=
            TIMESTAMP(
              @requested_from
            )

          AND requested_to >=
            TIMESTAMP(
              @requested_to
            )

          AND status IN
            (
              'queued',
              'running',
              'completed'
            )

        ORDER BY
          updated_at DESC

        LIMIT 1

      `,

      location:
        OPS_LOCATION,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        integration_account_id:
          input.integrationAccountId,

        entity:
          input.entity,

        requested_from:
          input.from,

        requested_to:
          input.to,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

        entity:
          'STRING',

        requested_from:
          'STRING',

        requested_to:
          'STRING',

      },

    });


  return (
    rows?.[0]
    ??
    null
  );

}


// ============================================================
// INSPECT INITIAL ORDERS HISTORY
//
// READ ONLY.
//
// Determines:
//
// Shopify earliest accessible Order
// Growth OS current earliest Order
// definite historical prefix gap
// planned quarterly windows
// already-covering Orders backfill
//
// DOES NOT CREATE A BACKFILL.
// ============================================================

export async function inspectShopifyInitialOrdersHistory(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    connectionId:
      string;

  }
) {

  if (!PROJECT_ID) {

    throw new Error(
      'SHOPIFY_HISTORY_PROJECT_MISSING'
    );

  }


  const workspaceId =
    requireValue(
      input.workspaceId,
      'SHOPIFY_HISTORY_WORKSPACE_MISSING'
    );


  const brandId =
    requireValue(
      input.brandId,
      'SHOPIFY_HISTORY_BRAND_MISSING'
    );


  const connectionId =
    requireValue(
      input.connectionId,
      'SHOPIFY_HISTORY_CONNECTION_MISSING'
    );


  // ==========================================================
  // CONNECTION
  // ==========================================================

  const connection =
    await getIntegrationConnectionById(
      connectionId
    );


  if (!connection) {

    throw new Error(
      'SHOPIFY_HISTORY_CONNECTION_NOT_FOUND'
    );

  }


  if (
    connection.workspace_id !==
      workspaceId
    ||
    connection.brand_id !==
      brandId
  ) {

    throw new Error(
      'SHOPIFY_HISTORY_CONNECTION_TENANT_MISMATCH'
    );

  }


  if (
    connection.provider !==
      'shopify'
  ) {

    throw new Error(
      'SHOPIFY_HISTORY_PROVIDER_INVALID'
    );

  }


  const providerAccountId =
    requireValue(
      connection.provider_account_id,
      'SHOPIFY_HISTORY_PROVIDER_ACCOUNT_MISSING'
    );


  const secretName =
    requireValue(
      connection.secret_name,
      'SHOPIFY_HISTORY_SECRET_MISSING'
    );


  // ==========================================================
  // EXACT SHOPIFY ACCOUNT
  // ==========================================================

  const account =
    await getIntegrationAccountByProviderAccountId(

      'shopify',

      providerAccountId

    );


  if (!account) {

    throw new Error(
      'SHOPIFY_HISTORY_ACCOUNT_NOT_FOUND'
    );

  }


  if (
    account.workspace_id !==
      workspaceId
    ||
    account.brand_id !==
      brandId
    ||
    account.connection_id !==
      connectionId
  ) {

    throw new Error(
      'SHOPIFY_HISTORY_ACCOUNT_IDENTITY_MISMATCH'
    );

  }


  const integrationAccountId =
    requireValue(
      account.integration_account_id,
      'SHOPIFY_HISTORY_INTEGRATION_ACCOUNT_MISSING'
    );


  const metadata =
    normalizeMetadata(
      account.metadata
    );


  const shopDomain =
    requireValue(
      metadata.shop_domain,
      'SHOPIFY_HISTORY_SHOP_DOMAIN_MISSING'
    );


  // ==========================================================
  // SHOPIFY SOURCE BOUNDARY
  // ==========================================================

  const source =
    await queryEarliestOrderWithStoredShopifyCredential({

      workspaceId,

      brandId,

      secretName,

      expectedShopId:
        providerAccountId,

      expectedShopDomain:
        shopDomain,

    });


  const earliestShopifyOrder =
    source.order?.createdAt
    ??
    null;


  // ==========================================================
  // EMPTY SHOPIFY STORE
  // ==========================================================

  if (!earliestShopifyOrder) {

    return {

      ok:
        true,

      decision:
        'no_orders',

      backfillRequired:
        false,

      workspaceId,

      brandId,

      connectionId,

      integrationAccountId,

      providerAccountId,

      shopDomain,

      source: {

        hasOrders:
          false,

        earliestOrder:
          null,

        tokenRefreshed:
          source.tokenRefreshed,

      },

      warehouse: {

        orderCount:
          0,

        earliestOrder:
          null,

        latestOrder:
          null,

        latestOrderUpdate:
          null,

        latestLoad:
          null,

      },

      missingRange:
        null,

      plannedBackfill:
        null,

      existingBackfill:
        null,

    };

  }


  // ==========================================================
  // LOCAL WAREHOUSE COVERAGE
  // ==========================================================

  const warehouse =
    await getExistingOrderCoverage({

      workspaceId,

      brandId,

      integrationAccountId,

    });


  let missingFrom:
    string | null =
      null;


  let missingTo:
    string | null =
      null;


  let decision:
    string =
      'history_complete';


  // ==========================================================
  // BRAND NEW IN GROWTH OS
  //
  // No warehouse history:
  //
  // Shopify earliest → stable setup cutoff
  // ==========================================================

  if (
    warehouse.orderCount ===
      0
    ||
    !warehouse.earliestOrder
  ) {

    missingFrom =
      earliestShopifyOrder;


    const bootstrapCutoffRaw =
      String(
        metadata.setup_required_at
        ??
        metadata.installed_at
        ??
        ''
      ).trim();


    const bootstrapCutoffTimestamp =
      Date.parse(
        bootstrapCutoffRaw
      );


    if (
      !Number.isFinite(
        bootstrapCutoffTimestamp
      )
    ) {

      throw new Error(
        'SHOPIFY_HISTORY_BOOTSTRAP_CUTOFF_MISSING'
      );

    }


    missingTo =
      new Date(
        bootstrapCutoffTimestamp
      ).toISOString();


    decision =
      'full_history_required';

  } else {

    // ========================================================
    // EXISTING GROWTH OS DATA
    //
    // Fill definite historical prefix only.
    //
    // Internal-gap reconciliation remains separate.
    // ========================================================

    const sourceStart =
      Date.parse(
        earliestShopifyOrder
      );


    const localStart =
      Date.parse(
        warehouse.earliestOrder
      );


    if (
      !Number.isFinite(
        sourceStart
      )
      ||
      !Number.isFinite(
        localStart
      )
    ) {

      throw new Error(
        'SHOPIFY_HISTORY_BOUNDARY_INVALID'
      );

    }


    if (
      sourceStart <
        localStart
    ) {

      missingFrom =
        earliestShopifyOrder;

      missingTo =
        warehouse.earliestOrder;

      decision =
        'historical_prefix_required';

    }

  }


  // ==========================================================
  // NOTHING MISSING AT PREFIX LEVEL
  // ==========================================================

  if (
    !missingFrom
    ||
    !missingTo
  ) {

    return {

      ok:
        true,

      decision,

      backfillRequired:
        false,

      workspaceId,

      brandId,

      connectionId,

      integrationAccountId,

      providerAccountId,

      shopDomain,

      source: {

        hasOrders:
          true,

        earliestOrder:
          earliestShopifyOrder,

        tokenRefreshed:
          source.tokenRefreshed,

      },

      warehouse,

      missingRange:
        null,

      plannedBackfill:
        null,

      existingBackfill:
        null,

    };

  }


  // ==========================================================
  // VALIDATE MISSING RANGE
  // ==========================================================

  const missingStart =
    Date.parse(
      missingFrom
    );


  const missingEnd =
    Date.parse(
      missingTo
    );


  if (
    !Number.isFinite(
      missingStart
    )
    ||
    !Number.isFinite(
      missingEnd
    )
    ||
    missingStart >=
      missingEnd
  ) {

    throw new Error(
      'SHOPIFY_HISTORY_MISSING_RANGE_INVALID'
    );

  }


  // ==========================================================
  // READ-ONLY MULTI-WINDOW PREVIEW
  // ==========================================================

  const plannedBackfill =
    planShopifyOrdersBackfillWindows({

      from:
        missingFrom,

      to:
        missingTo,

    });


  // ==========================================================
  // DUPLICATE / COVERING ORDERS RUN CHECK
  // ==========================================================

  const existingBackfill =
    await findCoveringBackfill({

      workspaceId,

      brandId,

      integrationAccountId,

      entity:
        'orders',

      from:
        missingFrom,

      to:
        missingTo,

    });


  const lastPlannedWindow =
    plannedBackfill.windows[
      plannedBackfill.windows.length - 1
    ]
    ??
    null;


  return {

    ok:
      true,

    decision:
      existingBackfill
        ?
          'already_planned'
        :
          decision,

    backfillRequired:
      !existingBackfill,

    workspaceId,

    brandId,

    connectionId,

    integrationAccountId,

    providerAccountId,

    shopDomain,

    source: {

      hasOrders:
        true,

      earliestOrder:
        earliestShopifyOrder,

      tokenRefreshed:
        source.tokenRefreshed,

    },

    warehouse,

    missingRange: {

      from:
        missingFrom,

      to:
        missingTo,

    },

    plannedBackfill: {

      strategy:
        plannedBackfill.strategy,

      totalWindows:
        plannedBackfill.totalWindows,

      firstWindow:
        plannedBackfill.windows[0]
        ??
        null,

      lastWindow:
        lastPlannedWindow,

      windows:
        plannedBackfill.windows,

    },

    existingBackfill:
      existingBackfill
        ?
          {

            backfillRunId:
              String(
                existingBackfill
                  .backfill_run_id
              ),

            entity:
              String(
                existingBackfill
                  .entity
              ),

            status:
              String(
                existingBackfill
                  .status
              ),

            requestedFrom:
              timestampToIso(
                existingBackfill
                  .requested_from
              ),

            requestedTo:
              timestampToIso(
                existingBackfill
                  .requested_to
              ),

          }
        :
          null,

  };

}


// ============================================================
// INSPECT INITIAL CUSTOMERS HISTORY
//
// READ ONLY.
//
// Determines:
//
// Shopify earliest accessible Customer
// Growth OS current earliest Customer
// definite historical prefix gap
// planned quarterly windows
// already-covering Customers backfill
//
// DOES NOT CREATE A BACKFILL.
// DOES NOT PUBLISH PUB/SUB.
// DOES NOT MUTATE WAREHOUSE STATE.
// ============================================================

export async function inspectShopifyInitialCustomersHistory(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    connectionId:
      string;

  }
) {

  if (!PROJECT_ID) {

    throw new Error(
      'SHOPIFY_CUSTOMER_HISTORY_PROJECT_MISSING'
    );

  }


  const workspaceId =
    requireValue(
      input.workspaceId,
      'SHOPIFY_CUSTOMER_HISTORY_WORKSPACE_MISSING'
    );


  const brandId =
    requireValue(
      input.brandId,
      'SHOPIFY_CUSTOMER_HISTORY_BRAND_MISSING'
    );


  const connectionId =
    requireValue(
      input.connectionId,
      'SHOPIFY_CUSTOMER_HISTORY_CONNECTION_MISSING'
    );


  // ==========================================================
  // CONNECTION
  // ==========================================================

  const connection =
    await getIntegrationConnectionById(
      connectionId
    );


  if (!connection) {

    throw new Error(
      'SHOPIFY_CUSTOMER_HISTORY_CONNECTION_NOT_FOUND'
    );

  }


  if (
    connection.workspace_id !==
      workspaceId
    ||
    connection.brand_id !==
      brandId
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_HISTORY_CONNECTION_TENANT_MISMATCH'
    );

  }


  if (
    connection.provider !==
      'shopify'
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_HISTORY_PROVIDER_INVALID'
    );

  }


  const providerAccountId =
    requireValue(
      connection.provider_account_id,
      'SHOPIFY_CUSTOMER_HISTORY_PROVIDER_ACCOUNT_MISSING'
    );


  const secretName =
    requireValue(
      connection.secret_name,
      'SHOPIFY_CUSTOMER_HISTORY_SECRET_MISSING'
    );


  // ==========================================================
  // EXACT SHOPIFY ACCOUNT
  // ==========================================================

  const account =
    await getIntegrationAccountByProviderAccountId(

      'shopify',

      providerAccountId

    );


  if (!account) {

    throw new Error(
      'SHOPIFY_CUSTOMER_HISTORY_ACCOUNT_NOT_FOUND'
    );

  }


  if (
    account.workspace_id !==
      workspaceId
    ||
    account.brand_id !==
      brandId
    ||
    account.connection_id !==
      connectionId
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_HISTORY_ACCOUNT_IDENTITY_MISMATCH'
    );

  }


  const integrationAccountId =
    requireValue(
      account.integration_account_id,
      'SHOPIFY_CUSTOMER_HISTORY_INTEGRATION_ACCOUNT_MISSING'
    );


  const metadata =
    normalizeMetadata(
      account.metadata
    );


  const shopDomain =
    requireValue(
      metadata.shop_domain,
      'SHOPIFY_CUSTOMER_HISTORY_SHOP_DOMAIN_MISSING'
    );


  // ==========================================================
  // SHOPIFY SOURCE BOUNDARY
  // ==========================================================

  const source =
    await queryEarliestCustomerWithStoredShopifyCredential({

      workspaceId,

      brandId,

      secretName,

      expectedShopId:
        providerAccountId,

      expectedShopDomain:
        shopDomain,

    });


  const earliestShopifyCustomer =
    source.customer?.createdAt
    ??
    null;


  // ==========================================================
  // EMPTY CUSTOMER BASE
  // ==========================================================

  if (!earliestShopifyCustomer) {

    return {

      ok:
        true,

      decision:
        'no_customers',

      backfillRequired:
        false,

      workspaceId,

      brandId,

      connectionId,

      integrationAccountId,

      providerAccountId,

      shopDomain,

      source: {

        hasCustomers:
          false,

        earliestCustomer:
          null,

        tokenRefreshed:
          source.tokenRefreshed,

      },

      warehouse: {

        customerCount:
          0,

        earliestCustomer:
          null,

        latestCustomer:
          null,

        latestCustomerUpdate:
          null,

        latestLoad:
          null,

      },

      missingRange:
        null,

      plannedBackfill:
        null,

      existingBackfill:
        null,

    };

  }


  // ==========================================================
  // LOCAL WAREHOUSE COVERAGE
  // ==========================================================

  const warehouse =
    await getExistingCustomerCoverage({

      workspaceId,

      brandId,

      integrationAccountId,

    });


  let missingFrom:
    string | null =
      null;


  let missingTo:
    string | null =
      null;


  let decision:
    string =
      'history_complete';


  // ==========================================================
  // BRAND NEW GROWTH OS CUSTOMER WAREHOUSE
  //
  // Shopify earliest Customer
  //        ↓
  // stable installation/setup cutoff
  // ==========================================================

  if (
    warehouse.customerCount ===
      0
    ||
    !warehouse.earliestCustomer
  ) {

    missingFrom =
      earliestShopifyCustomer;


    // ========================================================
    // STABLE BOOTSTRAP CUTOFF
    //
    // Use the same stable installation metadata as Orders.
    //
    // Concurrent/retried installation calls therefore produce
    // the same logical initial-history range.
    // ========================================================

    const bootstrapCutoffRaw =
      String(
        metadata.setup_required_at
        ??
        metadata.installed_at
        ??
        ''
      ).trim();


    const bootstrapCutoffTimestamp =
      Date.parse(
        bootstrapCutoffRaw
      );


    if (
      !Number.isFinite(
        bootstrapCutoffTimestamp
      )
    ) {

      throw new Error(
        'SHOPIFY_CUSTOMER_HISTORY_BOOTSTRAP_CUTOFF_MISSING'
      );

    }


    missingTo =
      new Date(
        bootstrapCutoffTimestamp
      ).toISOString();


    decision =
      'full_history_required';

  } else {

    // ========================================================
    // EXISTING CUSTOMER DATA
    //
    // Fill only the definite historical prefix.
    //
    // Example:
    //
    // Shopify:
    // 2020-11-06
    //
    // Local:
    // 2022-10-01
    //
    // Missing:
    //
    // [2020-11-06, 2022-10-01)
    //
    // Internal-gap reconciliation is a separate concern.
    // ========================================================

    const sourceStart =
      Date.parse(
        earliestShopifyCustomer
      );


    const localStart =
      Date.parse(
        warehouse.earliestCustomer
      );


    if (
      !Number.isFinite(
        sourceStart
      )
      ||
      !Number.isFinite(
        localStart
      )
    ) {

      throw new Error(
        'SHOPIFY_CUSTOMER_HISTORY_BOUNDARY_INVALID'
      );

    }


    if (
      sourceStart <
        localStart
    ) {

      missingFrom =
        earliestShopifyCustomer;

      missingTo =
        warehouse.earliestCustomer;

      decision =
        'historical_prefix_required';

    }

  }


  // ==========================================================
  // NOTHING MISSING AT PREFIX LEVEL
  // ==========================================================

  if (
    !missingFrom
    ||
    !missingTo
  ) {

    return {

      ok:
        true,

      decision,

      backfillRequired:
        false,

      workspaceId,

      brandId,

      connectionId,

      integrationAccountId,

      providerAccountId,

      shopDomain,

      source: {

        hasCustomers:
          true,

        earliestCustomer:
          earliestShopifyCustomer,

        tokenRefreshed:
          source.tokenRefreshed,

      },

      warehouse,

      missingRange:
        null,

      plannedBackfill:
        null,

      existingBackfill:
        null,

    };

  }


  // ==========================================================
  // VALIDATE MISSING RANGE
  // ==========================================================

  const missingStart =
    Date.parse(
      missingFrom
    );


  const missingEnd =
    Date.parse(
      missingTo
    );


  if (
    !Number.isFinite(
      missingStart
    )
    ||
    !Number.isFinite(
      missingEnd
    )
    ||
    missingStart >=
      missingEnd
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_HISTORY_MISSING_RANGE_INVALID'
    );

  }


  // ==========================================================
  // READ-ONLY MULTI-WINDOW PREVIEW
  // ==========================================================

  const plannedBackfill =
    planShopifyCustomersBackfillWindows({

      from:
        missingFrom,

      to:
        missingTo,

    });


  // ==========================================================
  // DUPLICATE / COVERING CUSTOMER RUN CHECK
  // ==========================================================

  const existingBackfill =
    await findCoveringBackfill({

      workspaceId,

      brandId,

      integrationAccountId,

      entity:
        'customers',

      from:
        missingFrom,

      to:
        missingTo,

    });


  const lastPlannedWindow =
    plannedBackfill.windows[
      plannedBackfill.windows.length - 1
    ]
    ??
    null;


  return {

    ok:
      true,

    decision:
      existingBackfill
        ?
          'already_planned'
        :
          decision,

    backfillRequired:
      !existingBackfill,

    workspaceId,

    brandId,

    connectionId,

    integrationAccountId,

    providerAccountId,

    shopDomain,

    source: {

      hasCustomers:
        true,

      earliestCustomer:
        earliestShopifyCustomer,

      tokenRefreshed:
        source.tokenRefreshed,

    },

    warehouse,

    missingRange: {

      from:
        missingFrom,

      to:
        missingTo,

    },

    plannedBackfill: {

      strategy:
        plannedBackfill.strategy,

      totalWindows:
        plannedBackfill.totalWindows,

      firstWindow:
        plannedBackfill.windows[0]
        ??
        null,

      lastWindow:
        lastPlannedWindow,

      windows:
        plannedBackfill.windows,

    },

    existingBackfill:
      existingBackfill
        ?
          {

            backfillRunId:
              String(
                existingBackfill
                  .backfill_run_id
              ),

            entity:
              String(
                existingBackfill
                  .entity
              ),

            status:
              String(
                existingBackfill
                  .status
              ),

            requestedFrom:
              timestampToIso(
                existingBackfill
                  .requested_from
              ),

            requestedTo:
              timestampToIso(
                existingBackfill
                  .requested_to
              ),

          }
        :
          null,

  };

}


// ============================================================
// ENSURE INITIAL ORDERS HISTORY
//
// WRITE PATH.
//
// Inspection first.
//
// If:
// - no Shopify Orders
// - history already complete
// - covering Orders run already exists
//
// then this is a NO-OP.
//
// Otherwise:
//
// deterministic idempotency key
//        ↓
// create/ensure Orders parent run
//        ↓
// create/ensure quarterly Orders windows
//
// Scheduler + Supervisor remain execution authority.
// ============================================================

export async function ensureShopifyInitialOrdersHistory(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    connectionId:
      string;

    requestedBy?:
      string | null;

  }
) {

  const inspection =
    await inspectShopifyInitialOrdersHistory({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      connectionId:
        input.connectionId,

    });


  // ==========================================================
  // NO ACTION
  // ==========================================================

  if (
    !inspection.backfillRequired
    ||
    !inspection.missingRange
  ) {

    return {

      ...inspection,

      created:
        false,

      idempotencyKey:
        null,

      backfill:
        null,

    };

  }


  // ==========================================================
  // DETERMINISTIC IDEMPOTENCY KEY
  //
  // Existing Orders contract remains unchanged.
  // ==========================================================

  const idempotencyKey =
    [

      'shopify_initial_orders_history_v1',

      inspection.workspaceId,

      inspection.brandId,

      inspection.integrationAccountId,

      inspection.missingRange.from,

      inspection.missingRange.to,

    ].join(
      ':'
    );


  // ==========================================================
  // CREATE / ENSURE ORDERS BACKFILL
  //
  // No direct dispatch.
  // ==========================================================

  const backfill =
    await createShopifyOrdersBackfill({

      workspaceId:
        inspection.workspaceId,

      brandId:
        inspection.brandId,

      connectionId:
        inspection.connectionId,

      integrationAccountId:
        inspection.integrationAccountId,

      providerAccountId:
        inspection.providerAccountId,

      from:
        inspection.missingRange.from,

      to:
        inspection.missingRange.to,

      requestedBy:
        input.requestedBy
        ??
        null,

      idempotencyKey,

    });


  return {

    ...inspection,

    created:
      true,

    idempotencyKey,

    backfill,

  };

}


// ============================================================
// ENSURE INITIAL CUSTOMERS HISTORY
//
// WRITE PATH.
//
// Inspection first.
//
// If:
// - Shopify has no Customers
// - Customer history already starts at Shopify source boundary
// - covering Customer backfill already exists
//
// then this is a NO-OP.
//
// Otherwise:
//
// deterministic Customer idempotency key
//        ↓
// create/ensure Customer parent run
//        ↓
// create/ensure quarterly Customer windows
//
// No Pub/Sub publish happens here.
//
// Shared Scheduler/Supervisor remains execution authority.
// ============================================================

export async function ensureShopifyInitialCustomersHistory(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    connectionId:
      string;

    requestedBy?:
      string | null;

  }
) {

  // ==========================================================
  // INSPECT
  // ==========================================================

  const inspection =
    await inspectShopifyInitialCustomersHistory({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      connectionId:
        input.connectionId,

    });


  // ==========================================================
  // NO ACTION
  // ==========================================================

  if (
    !inspection.backfillRequired
    ||
    !inspection.missingRange
  ) {

    return {

      ...inspection,

      created:
        false,

      idempotencyKey:
        null,

      backfill:
        null,

    };

  }


  // ==========================================================
  // DETERMINISTIC CUSTOMER IDEMPOTENCY KEY
  //
  // createShopifyCustomersBackfill() additionally namespaces
  // Customer deterministic identity inside the shared generic
  // backfill creator.
  // ==========================================================

  const idempotencyKey =
    [

      'shopify_initial_customers_history_v1',

      inspection.workspaceId,

      inspection.brandId,

      inspection.integrationAccountId,

      inspection.missingRange.from,

      inspection.missingRange.to,

    ].join(
      ':'
    );


  // ==========================================================
  // CREATE / ENSURE CUSTOMER BACKFILL
  //
  // No direct dispatch here.
  // ==========================================================

  const backfill =
    await createShopifyCustomersBackfill({

      workspaceId:
        inspection.workspaceId,

      brandId:
        inspection.brandId,

      connectionId:
        inspection.connectionId,

      integrationAccountId:
        inspection.integrationAccountId,

      providerAccountId:
        inspection.providerAccountId,

      from:
        inspection.missingRange.from,

      to:
        inspection.missingRange.to,

      requestedBy:
        input.requestedBy
        ??
        null,

      idempotencyKey,

    });


  return {

    ...inspection,

    created:
      true,

    idempotencyKey,

    backfill,

  };

}