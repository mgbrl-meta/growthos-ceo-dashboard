import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  getIntegrationAccountByProviderAccountId,
  getIntegrationConnectionById,
} from '@/lib/integrations/store';

import {
  queryEarliestOrderWithStoredShopifyCredential,
} from '@/lib/integrations/providers/shopify-credentials';

import {
  createShopifyOrdersBackfill,
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


  const orderCount =
    Number(
      row.order_count
      ??
      0
    );


  return {

    orderCount,

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
// EXISTING EQUIVALENT BACKFILL
//
// Prevent repeated setup / reinstall from creating a backfill
// that is already planned, active or completed.
//
// A covering run is enough:
//
// existing.from <= missing.from
// existing.to   >= missing.to
// ============================================================

async function findCoveringBackfill(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    integrationAccountId:
      string;

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
            'orders'

          AND requested_from <=
            TIMESTAMP(
              @requested_from
            )

          AND requested_to >=
            TIMESTAMP(
              @requested_to
            )

          AND status IN (
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
// Shopify earliest accessible order
// Growth OS current earliest order
// definite historical prefix gap
// planned quarterly windows
// already-covering backfill
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
  //
  // Resolve using canonical Shopify Shop GID.
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


    // ========================================================
    // STABLE BOOTSTRAP CUTOFF
    //
    // Concurrent/retried setup requests must calculate the
    // same initial-history range.
    //
    // Prefer setup_required_at.
    // Fall back to installed_at.
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
    // Fill the definite prefix only.
    //
    // Internal-gap reconciliation is separate.
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
  // DUPLICATE / COVERING RUN CHECK
  // ==========================================================

  const existingBackfill =
    await findCoveringBackfill({

      workspaceId,

      brandId,

      integrationAccountId,

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
// Same inspection first.
//
// If:
// - no Shopify orders
// - history already complete
// - covering run already exists
//
// then this is a NO-OP.
//
// Otherwise:
// - construct deterministic idempotency key
// - create/ensure parent run
// - create/ensure quarterly windows
//
// createShopifyOrdersBackfill() uses deterministic IDs +
// BigQuery MERGE when idempotencyKey is supplied.
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

  // ==========================================================
  // INSPECT
  // ==========================================================

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
  // IDEMPOTENCY KEY
  //
  // Same logical initial-history request:
  //
  // same workspace
  // same brand
  // same Shopify integration account
  // same missing range
  //
  //       ↓
  //
  // same deterministic run/window IDs
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
  // CREATE / ENSURE BACKFILL
  //
  // No dispatch here.
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