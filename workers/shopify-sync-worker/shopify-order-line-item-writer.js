import crypto from 'crypto';

import {
  BigQuery,
} from '@google-cloud/bigquery';

import {
  enqueueShopifyWarehouseRecords,
} from './shopify-warehouse-pending.js';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.GOOGLE_CLOUD_PROJECT
    ||
    ''
  ).trim();


const DATASET_ID =
  String(
    process.env.GROWTHOS_DATA_DATASET
    ||
    'growthos_data'
  ).trim();


const LOCATION =
  String(
    process.env.GROWTHOS_DATA_LOCATION
    ||
    'asia-south1'
  ).trim();


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_LINE_ITEM_WRITER_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({
    projectId:
      PROJECT_ID,
  });


// ============================================================
// STATE DML RETRY
// ============================================================

const STATE_DML_MAX_ATTEMPTS =
  3;


function isRetryableStateError(
  error
) {

  const message =
    String(
      error?.message
      ||
      ''
    )
      .toLowerCase();


  return (

    message.includes(
      'could not serialize access'
    )

    ||

    message.includes(
      'concurrent update'
    )

    ||

    message.includes(
      'too many dml statements outstanding'
    )

    ||

    message.includes(
      'rate limit'
    )

  );

}


function stateRetryDelay(
  attempt
) {

  const baseDelay =
    attempt === 1
      ?
        500
      :
        1500;


  const jitter =
    Math.floor(
      Math.random()
      *
      250
    );


  return baseDelay
    +
    jitter;

}


function sleep(
  milliseconds
) {

  return new Promise(
    resolve => {

      setTimeout(
        resolve,
        milliseconds
      );

    }
  );

}


async function runStateDmlWithRetry(
  queryOptions,
  operation
) {

  let lastError =
    null;


  for (
    let attempt = 1;
    attempt <= STATE_DML_MAX_ATTEMPTS;
    attempt += 1
  ) {

    try {

      return await bigquery.query(
        queryOptions
      );

    } catch (
      error
    ) {

      lastError =
        error;


      if (
        !isRetryableStateError(
          error
        )
        ||
        attempt >=
          STATE_DML_MAX_ATTEMPTS
      ) {

        throw error;

      }


      const delayMs =
        stateRetryDelay(
          attempt
        );


      console.warn(
        'SHOPIFY_LINE_ITEM_STATE_DML_RETRY',
        {

          operation,

          attempt,

          nextAttempt:
            attempt + 1,

          delayMs,

        }
      );


      await sleep(
        delayMs
      );

    }

  }


  throw lastError
    ??
    new Error(
      'SHOPIFY_LINE_ITEM_STATE_DML_FAILED'
    );

}


// ============================================================
// STRING
// ============================================================

function requireString(
  value,
  errorCode
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
// TIMESTAMP
// ============================================================

function normalizeTimestamp(
  value
) {

  if (
    value === null
    ||
    value === undefined
    ||
    value === ''
  ) {

    return null;

  }


  const parsed =
    Date.parse(
      String(
        value
      )
    );


  if (
    Number.isNaN(
      parsed
    )
  ) {

    return null;

  }


  return new Date(
    parsed
  ).toISOString();

}


function timestampValue(
  value
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return null;

  }


  if (
    typeof value ===
      'string'
  ) {

    return normalizeTimestamp(
      value
    );

  }


  if (
    value?.value
  ) {

    return normalizeTimestamp(
      value.value
    );

  }


  return normalizeTimestamp(
    String(
      value
    )
  );

}


// ============================================================
// SOURCE FRESHNESS
//
// Shopify Order updatedAt acts as the Line Item snapshot
// version timestamp.
// ============================================================

function sourceIsNotOlder(
  sourceTimestamp,
  targetTimestamp
) {

  if (
    !sourceTimestamp
    ||
    !targetTimestamp
  ) {

    return true;

  }


  const sourceMillis =
    Date.parse(
      sourceTimestamp
    );


  const targetMillis =
    Date.parse(
      targetTimestamp
    );


  if (
    Number.isNaN(
      sourceMillis
    )
    ||
    Number.isNaN(
      targetMillis
    )
  ) {

    return true;

  }


  return sourceMillis >=
    targetMillis;

}


// ============================================================
// CANONICALIZE
// ============================================================

function canonicalize(
  value
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return value ?? null;

  }


  if (
    Array.isArray(
      value
    )
  ) {

    return value.map(
      canonicalize
    );

  }


  if (
    typeof value ===
      'object'
  ) {

    const output =
      {};


    for (
      const key
      of Object.keys(
        value
      ).sort()
    ) {

      output[key] =
        canonicalize(
          value[key]
        );

    }


    return output;

  }


  return value;

}


// ============================================================
// HASH
// ============================================================

function hashPayload(
  payload
) {

  return crypto
    .createHash(
      'sha256'
    )
    .update(
      payload
    )
    .digest(
      'hex'
    );

}


// ============================================================
// NORMALIZE COMPLETE ORDER SNAPSHOT
//
// Pending contract:
//
// {
//   id: Shopify Order GID,
//   createdAt,
//   updatedAt,
//   snapshotComplete: true,
//   lineItems: [ canonical LineItem objects ]
// }
//
// IMPORTANT:
//
// Partial Line Item pages must NEVER reach this writer with
// snapshotComplete=true.
// ============================================================

function normalizeSnapshot(
  snapshot
) {

  const orderId =
    requireString(
      snapshot?.id,
      'SHOPIFY_LINE_ITEM_SNAPSHOT_ORDER_ID_MISSING'
    );


  if (
    snapshot?.snapshotComplete !==
      true
  ) {

    throw new Error(
      'SHOPIFY_LINE_ITEM_SNAPSHOT_INCOMPLETE'
    );

  }


  const rawLineItems =
    Array.isArray(
      snapshot?.lineItems
    )
      ?
        snapshot.lineItems
      :
        Array.isArray(
          snapshot?.lineItems?.nodes
        )
          ?
            snapshot.lineItems.nodes
          :
            [];


  return {

    id:
      orderId,

    createdAt:
      normalizeTimestamp(
        snapshot?.createdAt
      ),

    updatedAt:
      normalizeTimestamp(
        snapshot?.updatedAt
        ??
        snapshot?.createdAt
      ),

    snapshotComplete:
      true,

    lineItems:
      rawLineItems,

  };

}


// ============================================================
// COLLAPSE DUPLICATE ORDER SNAPSHOTS
//
// Latest Order.updatedAt wins.
// Equal/missing timestamp -> later occurrence wins.
// ============================================================

function collapseSnapshots(
  snapshots
) {

  const byOrderId =
    new Map();


  for (
    const rawSnapshot
    of snapshots
  ) {

    const snapshot =
      normalizeSnapshot(
        rawSnapshot
      );


    const existing =
      byOrderId.get(
        snapshot.id
      );


    if (!existing) {

      byOrderId.set(
        snapshot.id,
        snapshot
      );

      continue;

    }


    const existingMillis =
      Date.parse(
        existing.updatedAt
        ??
        existing.createdAt
        ??
        ''
      );


    const candidateMillis =
      Date.parse(
        snapshot.updatedAt
        ??
        snapshot.createdAt
        ??
        ''
      );


    const existingValid =
      !Number.isNaN(
        existingMillis
      );


    const candidateValid =
      !Number.isNaN(
        candidateMillis
      );


    if (
      !existingValid
      ||
      (
        candidateValid
        &&
        candidateMillis >=
          existingMillis
      )
    ) {

      byOrderId.set(
        snapshot.id,
        snapshot
      );

    }

  }


  return Array.from(
    byOrderId.values()
  );

}


// ============================================================
// WRITE COMPLETE ORDER LINE ITEM SNAPSHOTS
// ============================================================

export async function writeShopifyOrderLineItemSnapshots(
  input
) {

  const workspaceId =
    requireString(
      input?.workspaceId,
      'SHOPIFY_LINE_ITEM_WORKSPACE_MISSING'
    );


  const brandId =
    requireString(
      input?.brandId,
      'SHOPIFY_LINE_ITEM_BRAND_MISSING'
    );


  const integrationAccountId =
    requireString(
      input?.integrationAccountId,
      'SHOPIFY_LINE_ITEM_ACCOUNT_MISSING'
    );


  const inputSnapshots =
    Array.isArray(
      input?.snapshots
    )
      ?
        input.snapshots
      :
        [];


  const batchId =
    crypto.randomUUID();


  if (
    inputSnapshots.length ===
      0
  ) {

    return {

      batchId,

      snapshots:
        0,

      received:
        0,

      changed:
        0,

      removed:
        0,

      skipped:
        0,

      loaded:
        0,

    };

  }


  const snapshots =
    collapseSnapshots(
      inputSnapshots
    );


  const receivedLineItems =
    snapshots.reduce(
      (
        total,
        snapshot
      ) =>

        total
        +
        snapshot.lineItems.length,

      0
    );


  // ==========================================================
  // DEFER NORMAL REALTIME / INCREMENTAL WORK
  //
  // Pending record_id = Shopify Order GID.
  //
  // Therefore multiple Order updates within one warehouse
  // refresh window collapse naturally to the newest complete
  // Line Item snapshot for that Order.
  // ==========================================================

  if (
    input?.bypassWarehouseDeferral !==
      true
  ) {

    const queued =
      await enqueueShopifyWarehouseRecords({

        workspaceId,

        brandId,

        integrationAccountId,

        entity:
          'order_line_items',

        records:
          snapshots,

      });


    return {

      batchId,

      snapshots:
        snapshots.length,

      queuedSnapshots:
        queued.queued,

      received:
        receivedLineItems,

      changed:
        receivedLineItems,

      removed:
        0,

      skipped:
        0,

      loaded:
        0,

    };

  }


  const loadedAt =
    new Date()
      .toISOString();


  // ==========================================================
  // NORMALIZE LINE ITEMS
  // ==========================================================

  const normalized =
    [];


  const activeIdsByOrder =
    new Map();


  const snapshotByOrder =
    new Map();


  for (
    const snapshot
    of snapshots
  ) {

    const orderId =
      snapshot.id;


    snapshotByOrder.set(
      orderId,
      snapshot
    );


    const activeIds =
      new Set();


    activeIdsByOrder.set(
      orderId,
      activeIds
    );


    for (
      const lineItem
      of snapshot.lineItems
    ) {

      const recordId =
        requireString(
          lineItem?.id,
          'SHOPIFY_LINE_ITEM_ID_MISSING'
        );


      activeIds.add(
        recordId
      );


      const payload =
        JSON.stringify(
          canonicalize(
            lineItem
          )
        );


      normalized.push({

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        integration_account_id:
          integrationAccountId,

        batch_id:
          batchId,

        entity:
          'order_line_items',

        record_id:
          recordId,

        order_id:
          orderId,

        created_at:
          snapshot.createdAt,

        updated_at:
          snapshot.updatedAt
          ??
          snapshot.createdAt
          ??
          null,

        payload,

        source_hash:
          hashPayload(
            payload
          ),

        loaded_at:
          loadedAt,

      });

    }

  }


  // ==========================================================
  // COLLAPSE DUPLICATE LINE ITEMS
  // ==========================================================

  const canonicalByKey =
    new Map();


  for (
    const row
    of normalized
  ) {

    const key =
      `${row.order_id}\u0000${row.record_id}`;


    canonicalByKey.set(
      key,
      row
    );

  }


  const canonicalBatch =
    Array.from(
      canonicalByKey.values()
    );


  const orderIds =
    snapshots.map(
      snapshot =>
        snapshot.id
    );


  // ==========================================================
  // LOAD CURRENT STATE FOR ALL AFFECTED ORDERS
  //
  // We query by order_id, not only current LineItem IDs,
  // because missing active rows are how removals are detected.
  // ==========================================================

  const [
    stateRows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          order_id,

          record_id,

          latest_source_hash,

          source_updated_at,

          is_active,

          removed_at

        FROM
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_state\`

        WHERE
          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND integration_account_id =
            @integration_account_id

          AND order_id IN
            UNNEST(
              @order_ids
            )

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        integration_account_id:
          integrationAccountId,

        order_ids:
          orderIds,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

        order_ids: [
          'STRING',
        ],

      },

    });


  const stateByKey =
    new Map();


  for (
    const row
    of stateRows
  ) {

    const orderId =
      String(
        row.order_id
        ??
        ''
      );


    const recordId =
      String(
        row.record_id
        ??
        ''
      );


    stateByKey.set(
      `${orderId}\u0000${recordId}`,
      row
    );

  }


  // ==========================================================
  // CHANGED / REACTIVATED LINE ITEMS
  // ==========================================================

  const changed =
    canonicalBatch.filter(
      row => {

        const key =
          `${row.order_id}\u0000${row.record_id}`;


        const current =
          stateByKey.get(
            key
          );


        if (!current) {

          return true;

        }


        const currentTimestamp =
          timestampValue(
            current.source_updated_at
          );


        if (
          !sourceIsNotOlder(
            row.updated_at,
            currentTimestamp
          )
        ) {

          return false;

        }


        return (

          String(
            current.latest_source_hash
            ??
            ''
          )
          !==
          row.source_hash

          ||

          current.is_active !==
            true

        );

      }
    );


  // ==========================================================
  // REMOVAL RECONCILIATION
  //
  // Only complete snapshots are allowed here.
  //
  // Existing active Line Items that no longer occur in the
  // newest complete Order snapshot are marked inactive.
  // ==========================================================

  const removals =
    [];


  for (
    const stateRow
    of stateRows
  ) {

    if (
      stateRow.is_active !==
        true
    ) {

      continue;

    }


    const orderId =
      String(
        stateRow.order_id
        ??
        ''
      );


    const recordId =
      String(
        stateRow.record_id
        ??
        ''
      );


    const snapshot =
      snapshotByOrder.get(
        orderId
      );


    if (!snapshot) {

      continue;

    }


    const activeIds =
      activeIdsByOrder.get(
        orderId
      )
      ??
      new Set();


    if (
      activeIds.has(
        recordId
      )
    ) {

      continue;

    }


    const snapshotUpdatedAt =
      snapshot.updatedAt
      ??
      snapshot.createdAt
      ??
      null;


    const stateUpdatedAt =
      timestampValue(
        stateRow.source_updated_at
      );


    if (
      !sourceIsNotOlder(
        snapshotUpdatedAt,
        stateUpdatedAt
      )
    ) {

      continue;

    }


    removals.push({

      order_id:
        orderId,

      record_id:
        recordId,

      source_updated_at:
        snapshotUpdatedAt,

      loaded_at:
        loadedAt,

      batch_id:
        batchId,

      removed_at:
        snapshotUpdatedAt
        ??
        loadedAt,

    });

  }


  // ==========================================================
  // APPEND CHANGED ACTIVE VERSIONS TO RAW
  // ==========================================================

  if (
    changed.length >
      0
  ) {

    await bigquery
      .dataset(
        DATASET_ID
      )
      .table(
        'shopify_order_line_items_raw_json'
      )
      .insert(
        changed
      );

  }


  // ==========================================================
  // MERGE ACTIVE STATE
  // ==========================================================

  if (
    changed.length >
      0
  ) {

    const rowsJson =
      JSON.stringify(
        changed.map(
          row => ({

            order_id:
              row.order_id,

            record_id:
              row.record_id,

            source_hash:
              row.source_hash,

            source_updated_at:
              row.updated_at,

            loaded_at:
              row.loaded_at,

            batch_id:
              row.batch_id,

          })
        )
      );


    await runStateDmlWithRetry({

      query: `

        MERGE
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_state\`
          AS target

        USING
        (

          SELECT

            @workspace_id
              AS workspace_id,

            @brand_id
              AS brand_id,

            @integration_account_id
              AS integration_account_id,

            JSON_VALUE(
              item,
              '$.order_id'
            )
              AS order_id,

            JSON_VALUE(
              item,
              '$.record_id'
            )
              AS record_id,

            JSON_VALUE(
              item,
              '$.source_hash'
            )
              AS source_hash,

            SAFE_CAST(
              JSON_VALUE(
                item,
                '$.source_updated_at'
              )
              AS TIMESTAMP
            )
              AS source_updated_at,

            SAFE_CAST(
              JSON_VALUE(
                item,
                '$.loaded_at'
              )
              AS TIMESTAMP
            )
              AS loaded_at,

            JSON_VALUE(
              item,
              '$.batch_id'
            )
              AS batch_id

          FROM
            UNNEST(
              JSON_QUERY_ARRAY(
                PARSE_JSON(
                  @rows_json
                )
              )
            )
              AS item

        )
          AS source

        ON
          target.workspace_id =
            source.workspace_id

          AND target.brand_id =
            source.brand_id

          AND target.integration_account_id =
            source.integration_account_id

          AND target.order_id =
            source.order_id

          AND target.record_id =
            source.record_id

        WHEN MATCHED
          AND
          (
            target.source_updated_at
              IS NULL

            OR source.source_updated_at
              IS NULL

            OR source.source_updated_at >=
              target.source_updated_at
          )
        THEN UPDATE SET

          latest_source_hash =
            source.source_hash,

          source_updated_at =
            COALESCE(
              source.source_updated_at,
              target.source_updated_at
            ),

          last_loaded_at =
            source.loaded_at,

          last_batch_id =
            source.batch_id,

          is_active =
            TRUE,

          removed_at =
            NULL

        WHEN NOT MATCHED THEN

          INSERT
          (
            workspace_id,
            brand_id,
            integration_account_id,
            record_id,
            order_id,
            latest_source_hash,
            source_updated_at,
            last_loaded_at,
            last_batch_id,
            is_active,
            removed_at
          )

          VALUES
          (
            source.workspace_id,
            source.brand_id,
            source.integration_account_id,
            source.record_id,
            source.order_id,
            source.source_hash,
            source.source_updated_at,
            source.loaded_at,
            source.batch_id,
            TRUE,
            NULL
          )

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        integration_account_id:
          integrationAccountId,

        rows_json:
          rowsJson,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

        rows_json:
          'STRING',

      },

    }, 'activate');

  }


  // ==========================================================
  // MARK REMOVED LINE ITEMS INACTIVE
  // ==========================================================

  if (
    removals.length >
      0
  ) {

    const rowsJson =
      JSON.stringify(
        removals
      );


    await runStateDmlWithRetry({

      query: `

        MERGE
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_state\`
          AS target

        USING
        (

          SELECT

            @workspace_id
              AS workspace_id,

            @brand_id
              AS brand_id,

            @integration_account_id
              AS integration_account_id,

            JSON_VALUE(
              item,
              '$.order_id'
            )
              AS order_id,

            JSON_VALUE(
              item,
              '$.record_id'
            )
              AS record_id,

            SAFE_CAST(
              JSON_VALUE(
                item,
                '$.source_updated_at'
              )
              AS TIMESTAMP
            )
              AS source_updated_at,

            SAFE_CAST(
              JSON_VALUE(
                item,
                '$.loaded_at'
              )
              AS TIMESTAMP
            )
              AS loaded_at,

            JSON_VALUE(
              item,
              '$.batch_id'
            )
              AS batch_id,

            SAFE_CAST(
              JSON_VALUE(
                item,
                '$.removed_at'
              )
              AS TIMESTAMP
            )
              AS removed_at

          FROM
            UNNEST(
              JSON_QUERY_ARRAY(
                PARSE_JSON(
                  @rows_json
                )
              )
            )
              AS item

        )
          AS source

        ON
          target.workspace_id =
            source.workspace_id

          AND target.brand_id =
            source.brand_id

          AND target.integration_account_id =
            source.integration_account_id

          AND target.order_id =
            source.order_id

          AND target.record_id =
            source.record_id

        WHEN MATCHED
          AND target.is_active =
            TRUE

          AND
          (
            target.source_updated_at
              IS NULL

            OR source.source_updated_at
              IS NULL

            OR source.source_updated_at >=
              target.source_updated_at
          )
        THEN UPDATE SET

          source_updated_at =
            COALESCE(
              source.source_updated_at,
              target.source_updated_at
            ),

          last_loaded_at =
            source.loaded_at,

          last_batch_id =
            source.batch_id,

          is_active =
            FALSE,

          removed_at =
            source.removed_at

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        integration_account_id:
          integrationAccountId,

        rows_json:
          rowsJson,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

        rows_json:
          'STRING',

      },

    }, 'remove');

  }


  const skipped =
    canonicalBatch.length
    -
    changed.length;


  return {

    batchId,

    snapshots:
      snapshots.length,

    received:
      canonicalBatch.length,

    changed:
      changed.length
      +
      removals.length,

    removed:
      removals.length,

    skipped,

    loaded:
      changed.length,

  };

}