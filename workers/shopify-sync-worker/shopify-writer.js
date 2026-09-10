import crypto from 'crypto';

import {
  BigQuery,
} from '@google-cloud/bigquery';


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
    'SHOPIFY_WRITER_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });

// ============================================================
// BIGQUERY MUTATING DML RETRY
//
// Realtime Shopify webhooks can arrive concurrently.
//
// BigQuery internally retries conflicting mutating DML, but
// sustained webhook bursts can still surface:
//
// - concurrent update / serialization conflicts
// - mutating-DML queue saturation
//
// IMPORTANT:
//
// Retry ONLY the STATE MERGE.
//
// RAW has already been appended before this point, so the
// complete writeShopifyOrders() operation must NOT be blindly
// retried inside this writer.
// ============================================================

const ORDER_STATE_MERGE_MAX_ATTEMPTS =
  3;


// ============================================================
// RETRYABLE BIGQUERY STATE ERROR
// ============================================================

function isRetryableOrderStateMergeError(
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


// ============================================================
// RETRY DELAY
//
// Short exponential backoff + jitter.
//
// Attempt 1 failure:
// ~500-750 ms
//
// Attempt 2 failure:
// ~1500-1750 ms
// ============================================================

function getOrderStateMergeRetryDelayMs(
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


  return (
    baseDelay
    +
    jitter
  );

}


// ============================================================
// SLEEP
// ============================================================

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


// ============================================================
// RUN ORDER STATE MERGE WITH RETRY
//
// BigQuery itself already performs internal conflict retries.
//
// This is one additional bounded application-level recovery
// layer for bursts that survive BigQuery's internal retries.
// ============================================================

async function runOrderStateMergeWithRetry(
  queryOptions
) {

  let lastError =
    null;


  for (
    let attempt = 1;
    attempt <=
      ORDER_STATE_MERGE_MAX_ATTEMPTS;
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


      const retryable =
        isRetryableOrderStateMergeError(
          error
        );


      if (
        !retryable
        ||
        attempt >=
          ORDER_STATE_MERGE_MAX_ATTEMPTS
      ) {

        throw error;

      }


      const delayMs =
        getOrderStateMergeRetryDelayMs(
          attempt
        );


      console.warn(
        'SHOPIFY_ORDER_STATE_MERGE_RETRY',
        {

          attempt,

          nextAttempt:
            attempt + 1,

          maxAttempts:
            ORDER_STATE_MERGE_MAX_ATTEMPTS,

          delayMs,

          message:
            String(
              error?.message
              ||
              'Unknown BigQuery state MERGE failure'
            ),

        }
      );


      await sleep(
        delayMs
      );

    }

  }


  throw (
    lastError
    ||
    new Error(
      'SHOPIFY_ORDER_STATE_MERGE_FAILED'
    )
  );

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

    const output = {};


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
// WRITE ORDERS
// ============================================================

export async function writeShopifyOrders(
  input
) {

  const workspaceId =
    String(
      input.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      input.brandId
      ||
      ''
    ).trim();


  const integrationAccountId =
    String(
      input.integrationAccountId
      ||
      ''
    ).trim();


  const orders =
    Array.isArray(
      input.orders
    )
      ? input.orders
      : [];


  if (
    !workspaceId
    ||
    !brandId
    ||
    !integrationAccountId
  ) {

    throw new Error(
      'SHOPIFY_WRITER_TENANT_IDENTITY_MISSING'
    );

  }


  const batchId =
    crypto.randomUUID();


  if (
    orders.length === 0
  ) {

    return {

      batchId,

      received:
        0,

      changed:
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


  const normalized =
    orders.map(
      order => {

        const recordId =
          String(
            order?.id
            ||
            ''
          ).trim();


        if (!recordId) {

          throw new Error(
            'SHOPIFY_ORDER_ID_MISSING'
          );

        }


        const payload =
          JSON.stringify(
            canonicalize(
              order
            )
          );


        return {

          workspace_id:
            workspaceId,

          brand_id:
            brandId,

          integration_account_id:
            integrationAccountId,

          batch_id:
            batchId,

          entity:
            'orders',

          record_id:
            recordId,

          created_at:
            order?.createdAt
            ??
            null,

          updated_at:
            order?.updatedAt
            ??
            order?.createdAt
            ??
            null,

          payload,

          source_hash:
            hashPayload(
              payload
            ),

          loaded_at:
            loadedAt,

        };

      }
    );


  // ==========================================================
  // CURRENT STATE
  // ==========================================================

  const recordIds =
    normalized.map(
      row =>
        row.record_id
    );


  const [
    stateRows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          record_id,

          latest_source_hash

        FROM
          \`${PROJECT_ID}.${DATASET_ID}.shopify_orders_state\`

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND integration_account_id =
            @integration_account_id

          AND record_id IN
            UNNEST(
              @record_ids
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

        record_ids:
          recordIds,

      },

    });


  const currentHashes =
    new Map();


  for (
    const row
    of stateRows
  ) {

    currentHashes.set(

      String(
        row.record_id
      ),

      String(
        row.latest_source_hash
        ||
        ''
      )

    );

  }


  // ==========================================================
  // CHANGED ONLY
  // ==========================================================

  const changed =
    normalized.filter(
      row =>

        currentHashes.get(
          row.record_id
        )
        !==
        row.source_hash

    );


  const skipped =
    normalized.length
    -
    changed.length;


  if (
    changed.length === 0
  ) {

    return {

      batchId,

      received:
        normalized.length,

      changed:
        0,

      skipped,

      loaded:
        0,

    };

  }


  // ==========================================================
  // APPEND RAW
  // ==========================================================

  await bigquery
    .dataset(
      DATASET_ID
    )
    .table(
      'shopify_orders_raw_json'
    )
    .insert(
      changed
    );


  // ==========================================================
  // MERGE STATE
  // ==========================================================

  const rowsJson =
    JSON.stringify(

      changed.map(
        row => ({

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


  await runOrderStateMergeWithRetry({

    query: `

      MERGE
        \`${PROJECT_ID}.${DATASET_ID}.shopify_orders_state\`
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
          source.batch_id


      WHEN NOT MATCHED THEN

        INSERT
        (
          workspace_id,
          brand_id,
          integration_account_id,
          record_id,
          latest_source_hash,
          source_updated_at,
          last_loaded_at,
          last_batch_id
        )

        VALUES
        (
          source.workspace_id,
          source.brand_id,
          source.integration_account_id,
          source.record_id,
          source.source_hash,
          source.source_updated_at,
          source.loaded_at,
          source.batch_id
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

  });


  return {

    batchId,

    received:
      normalized.length,

    changed:
      changed.length,

    skipped,

    loaded:
      changed.length,

  };

}