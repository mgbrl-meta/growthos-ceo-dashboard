import 'server-only';

import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';


// ============================================================
// SHOPIFY CANONICAL WAREHOUSE WRITER
//
// Shopify API / Webhook
//        ↓
// this writer
//        ↓
// growthos_data.shopify_*_raw_json
//        ↓
// growthos_data.shopify_*_state
//        ↓
// shopify_*_current views
//
// MULTI-TENANT IDENTITY:
//
// workspace_id
// brand_id
// integration_account_id
//
// IMPORTANT:
//
// No Brillare-specific dataset.
// No brand-specific dataset.
// No ENV-based brand identity.
// ============================================================


// ============================================================
// TYPES
// ============================================================

export type ShopifyWarehouseEntity =
  | 'orders'
  | 'customers'
  | 'products'
  | 'order_transactions';


export type ShopifyWarehouseRecord = {

  recordId:
    string;

  createdAt?:
    string | null;

  updatedAt?:
    string | null;

  payload:
    unknown;

};


export type ShopifyWarehouseWriteResult = {

  entity:
    ShopifyWarehouseEntity;

  batchId:
    string;

  recordsReceived:
    number;

  recordsChanged:
    number;

  recordsSkipped:
    number;

  recordsLoaded:
    number;

  latestSourceTimestamp:
    string | null;

};


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  String(
    process.env.GROWTHOS_DATA_PROJECT
    ||
    process.env.GCP_PROJECT_ID
    ||
    process.env.BQ_PROJECT_ID
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
    process.env.GCP_BQ_LOCATION
    ||
    'asia-southeast1'
  ).trim();


// ============================================================
// TABLE MAP
// ============================================================

const ENTITY_TABLES:
  Record<
    ShopifyWarehouseEntity,
    {
      raw:
        string;

      state:
        string;
    }
  > = {

  orders: {

    raw:
      'shopify_orders_raw_json',

    state:
      'shopify_orders_state',

  },


  customers: {

    raw:
      'shopify_customers_raw_json',

    state:
      'shopify_customers_state',

  },


  products: {

    raw:
      'shopify_products_raw_json',

    state:
      'shopify_products_state',

  },


  order_transactions: {

    raw:
      'shopify_order_transactions_raw_json',

    state:
      'shopify_order_transactions_state',

  },

};


// ============================================================
// CONFIG VALIDATION
// ============================================================

function requireConfig() {

  if (!PROJECT_ID) {

    throw new Error(
      'SHOPIFY_WAREHOUSE_PROJECT_MISSING'
    );

  }


  if (!DATASET_ID) {

    throw new Error(
      'SHOPIFY_WAREHOUSE_DATASET_MISSING'
    );

  }


  if (!LOCATION) {

    throw new Error(
      'SHOPIFY_WAREHOUSE_LOCATION_MISSING'
    );

  }


  return {

    projectId:
      PROJECT_ID,

    datasetId:
      DATASET_ID,

    location:
      LOCATION,

  };

}


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
// TIMESTAMP
// ============================================================

function normalizeTimestamp(
  value:
    string | null | undefined
) {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value
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
// CANONICAL JSON
//
// Hashing regular JSON.stringify() can become unstable if
// object key ordering changes.
//
// This normalizes objects recursively before hashing.
// ============================================================

function canonicalize(
  value: any
): any {

  if (
    value ===
    null
    ||
    value ===
    undefined
  ) {

    return value
      ??
      null;

  }


  if (
    typeof value ===
    'bigint'
  ) {

    return value
      .toString();

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

    const output:
      Record<string, any> = {};


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
// SERIALIZE PAYLOAD
// ============================================================

function serializePayload(
  payload: unknown
) {

  return JSON.stringify(
    canonicalize(
      payload
    )
  );

}


// ============================================================
// SOURCE HASH
// ============================================================

function createSourceHash(
  payload:
    string
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
// MAX SOURCE TIMESTAMP
// ============================================================

function getLatestTimestamp(
  records:
    ShopifyWarehouseRecord[]
) {

  let latest:
    number | null =
      null;


  for (
    const record
    of records
  ) {

    const source =
      record.updatedAt
      ||
      record.createdAt;


    if (!source) {

      continue;

    }


    const timestamp =
      new Date(
        source
      ).getTime();


    if (
      Number.isNaN(
        timestamp
      )
    ) {

      continue;

    }


    if (
      latest ===
        null
      ||
      timestamp >
        latest
    ) {

      latest =
        timestamp;

    }

  }


  return latest ===
    null

    ? null

    : new Date(
        latest
      ).toISOString();

}


// ============================================================
// WRITE SHOPIFY RECORDS
// ============================================================

export async function writeShopifyRecords(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    integrationAccountId:
      string;

    entity:
      ShopifyWarehouseEntity;

    records:
      ShopifyWarehouseRecord[];

    batchId?:
      string;

  }
):

  Promise<
    ShopifyWarehouseWriteResult
  > {

  const {
    projectId,
    datasetId,
    location,
  } =
    requireConfig();


  const workspaceId =
    requireValue(
      input.workspaceId,
      'SHOPIFY_WAREHOUSE_WORKSPACE_MISSING'
    );


  const brandId =
    requireValue(
      input.brandId,
      'SHOPIFY_WAREHOUSE_BRAND_MISSING'
    );


  const integrationAccountId =
    requireValue(
      input.integrationAccountId,
      'SHOPIFY_WAREHOUSE_ACCOUNT_MISSING'
    );


  const tables =
    ENTITY_TABLES[
      input.entity
    ];


  if (!tables) {

    throw new Error(
      'SHOPIFY_WAREHOUSE_ENTITY_UNSUPPORTED'
    );

  }


  const records =
    Array.isArray(
      input.records
    )
      ? input.records
      : [];


  const batchId =
    input.batchId
    ||
    crypto.randomUUID();


  // ==========================================================
  // EMPTY BATCH
  // ==========================================================

  if (
    records.length ===
    0
  ) {

    return {

      entity:
        input.entity,

      batchId,

      recordsReceived:
        0,

      recordsChanged:
        0,

      recordsSkipped:
        0,

      recordsLoaded:
        0,

      latestSourceTimestamp:
        null,

    };

  }


  // ==========================================================
  // NORMALIZE INCOMING RECORDS
  // ==========================================================

  const loadedAt =
    new Date()
      .toISOString();


  const normalized =
    records.map(
      record => {

        const recordId =
          requireValue(
            record.recordId,
            'SHOPIFY_RECORD_ID_MISSING'
          );


        const payload =
          serializePayload(
            record.payload
          );


        const sourceHash =
          createSourceHash(
            payload
          );


        const createdAt =
          normalizeTimestamp(
            record.createdAt
          );


        // For entities without a distinct updated_at,
        // created_at becomes the ordering timestamp.
        const updatedAt =
          normalizeTimestamp(
            record.updatedAt
          )
          ||
          createdAt;


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
            input.entity,

          record_id:
            recordId,

          created_at:
            createdAt,

          updated_at:
            updatedAt,

          payload,

          source_hash:
            sourceHash,

          loaded_at:
            loadedAt,

        };

      }
    );


  // ==========================================================
  // READ CURRENT HASH STATE
  //
  // Recovery / overlapping sync windows are expected.
  //
  // If Shopify returns the exact same record again, we avoid
  // writing another identical RAW version.
  // ==========================================================

  const recordIds =
    normalized.map(
      row =>
        row.record_id
    );


  const stateQuery = `

    SELECT

      record_id,

      latest_source_hash

    FROM
      \`${projectId}.${datasetId}.${tables.state}\`

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

  `;


  const [
    stateRows,
  ] =
    await bigquery.query({

      query:
        stateQuery,

      location,

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


  const currentHashById =
    new Map<
      string,
      string
    >();


  for (
    const row
    of stateRows
  ) {

    currentHashById.set(

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
  // CHANGED RECORDS ONLY
  // ==========================================================

  const changed =
    normalized.filter(
      row => {

        const previousHash =
          currentHashById.get(
            row.record_id
          );


        return (
          !previousHash
          ||
          previousHash !==
            row.source_hash
        );

      }
    );


  const skipped =
    normalized.length
    -
    changed.length;


  // ==========================================================
  // NOTHING CHANGED
  // ==========================================================

  if (
    changed.length ===
    0
  ) {

    return {

      entity:
        input.entity,

      batchId,

      recordsReceived:
        records.length,

      recordsChanged:
        0,

      recordsSkipped:
        skipped,

      recordsLoaded:
        0,

      latestSourceTimestamp:
        getLatestTimestamp(
          records
        ),

    };

  }


  // ==========================================================
  // APPEND RAW HISTORY
  //
  // RAW is immutable / append oriented.
  //
  // We deliberately do not UPDATE or DELETE historical
  // Shopify source versions.
  // ==========================================================

  await bigquery
    .dataset(
      datasetId
    )
    .table(
      tables.raw
    )
    .insert(
      changed,
      {

        skipInvalidRows:
          false,

        ignoreUnknownValues:
          false,

      }
    );


  // ==========================================================
  // UPDATE CURRENT STATE
  //
  // Use JSON parameter so the state update is one BigQuery
  // operation rather than N queries.
  //
  // The timestamp guard prevents an older recovery record from
  // replacing a newer Shopify version.
  // ==========================================================

  const statePayload =
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
    );


  const mergeStateQuery = `

    MERGE
      \`${projectId}.${datasetId}.${tables.state}\`
      AS target

    USING
    (

      SELECT

        workspace_id,

        brand_id,

        integration_account_id,

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
      (

        SELECT

          @workspace_id
            AS workspace_id,

          @brand_id
            AS brand_id,

          @integration_account_id
            AS integration_account_id,

          item

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

  `;


  await bigquery.query({

    query:
      mergeStateQuery,

    location,

    params: {

      workspace_id:
        workspaceId,

      brand_id:
        brandId,

      integration_account_id:
        integrationAccountId,

      rows_json:
        JSON.stringify(
          statePayload
        ),

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


  // ==========================================================
  // RESULT
  // ==========================================================

  return {

    entity:
      input.entity,

    batchId,

    recordsReceived:
      records.length,

    recordsChanged:
      changed.length,

    recordsSkipped:
      skipped,

    recordsLoaded:
      changed.length,

    latestSourceTimestamp:
      getLatestTimestamp(
        records
      ),

  };

}