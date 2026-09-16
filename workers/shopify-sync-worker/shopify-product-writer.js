import crypto from 'crypto';

import {
  BigQuery,
} from '@google-cloud/bigquery';


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
    'SHOPIFY_PRODUCT_WRITER_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });


// ============================================================
// CANONICAL JSON
//
// Same principle as Orders + Customers:
//
// object keys are sorted recursively before hashing.
//
// This allows:
//
// webhook
// manual
// incremental
// backfill
//
// to converge on the same canonical source hash.
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
// WRITE SHOPIFY PRODUCTS
//
// Canonical identity:
//
// workspace_id
// + brand_id
// + integration_account_id
// + record_id
//
// RAW:
//
// append changed Product versions.
//
// STATE:
//
// latest canonical source version.
//
// CURRENT:
//
// existing shopify_products_current view.
// ============================================================

export async function writeShopifyProducts(
  input
) {

  // ==========================================================
  // TENANT IDENTITY
  // ==========================================================

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


  if (
    !workspaceId
    ||
    !brandId
    ||
    !integrationAccountId
  ) {

    throw new Error(
      'SHOPIFY_PRODUCT_WRITER_TENANT_IDENTITY_MISSING'
    );

  }


  // ==========================================================
  // PRODUCTS
  // ==========================================================

  const products =
    Array.isArray(
      input.products
    )
      ?
        input.products
      :
        [];


  const batchId =
    crypto.randomUUID();


  // ==========================================================
  // EMPTY BATCH
  // ==========================================================

  if (
    products.length ===
      0
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


  // ==========================================================
  // NORMALIZE
  // ==========================================================

  const normalized =
    products.map(
      product => {

        const recordId =
          String(
            product?.id
            ||
            ''
          ).trim();


        if (!recordId) {

          throw new Error(
            'SHOPIFY_PRODUCT_ID_MISSING'
          );

        }


        if (
          !recordId.startsWith(
            'gid://shopify/Product/'
          )
        ) {

          throw new Error(
            'SHOPIFY_PRODUCT_ID_INVALID'
          );

        }


        const payload =
          JSON.stringify(
            canonicalize(
              product
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
            'products',

          record_id:
            recordId,

          created_at:
            product?.createdAt
            ??
            null,

          updated_at:
            product?.updatedAt
            ??
            product?.createdAt
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
  // DEDUPE NORMALIZED BATCH BY RECORD ID
  //
  // One canonical Product candidate per record_id must enter
  // STATE comparison / RAW append / STATE MERGE.
  //
  // This protects against duplicate Product rows inside one
  // writer invocation.
  //
  // Realtime cross-request ordering will be enforced separately
  // through the per-Product Pub/Sub ordering key.
  // ==========================================================

  const normalizedByRecordId =
    new Map();


  for (
    const row
    of normalized
  ) {

    const existing =
      normalizedByRecordId.get(
        row.record_id
      );


    if (!existing) {

      normalizedByRecordId.set(
        row.record_id,
        row
      );

      continue;

    }


    const existingUpdatedAt =
      Date.parse(
        existing.updated_at
        ??
        ''
      );


    const incomingUpdatedAt =
      Date.parse(
        row.updated_at
        ??
        ''
      );


    const existingTimestampValid =
      Number.isFinite(
        existingUpdatedAt
      );


    const incomingTimestampValid =
      Number.isFinite(
        incomingUpdatedAt
      );


    if (
      (
        incomingTimestampValid
        &&
        !existingTimestampValid
      )
      ||
      (
        incomingTimestampValid
        &&
        existingTimestampValid
        &&
        incomingUpdatedAt >=
          existingUpdatedAt
      )
      ||
      (
        !incomingTimestampValid
        &&
        !existingTimestampValid
      )
    ) {

      normalizedByRecordId.set(
        row.record_id,
        row
      );

    }

  }


  const canonicalBatch =
    Array.from(
      normalizedByRecordId.values()
    );


  const collapsedBatchDuplicates =
    normalized.length
    -
    canonicalBatch.length;


  if (
    collapsedBatchDuplicates >
      0
  ) {

    console.warn(
      'SHOPIFY_PRODUCT_BATCH_DUPLICATES_COLLAPSED',
      {

        workspaceId,

        brandId,

        integrationAccountId,

        received:
          normalized.length,

        canonical:
          canonicalBatch.length,

        collapsed:
          collapsedBatchDuplicates,

      }
    );

  }


  // ==========================================================
  // LOAD EXISTING CURRENT HASHES
  // ==========================================================

  const recordIds =
    canonicalBatch.map(
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
          \`${PROJECT_ID}.${DATASET_ID}.shopify_products_state\`

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

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

        record_ids: [
          'STRING',
        ],

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
  // CHANGED RECORDS ONLY
  // ==========================================================

  const changed =
    canonicalBatch.filter(
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


  // ==========================================================
  // NOTHING CHANGED
  // ==========================================================

  if (
    changed.length ===
      0
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
  // RAW APPEND
  // ==========================================================

  await bigquery
    .dataset(
      DATASET_ID
    )
    .table(
      'shopify_products_raw_json'
    )
    .insert(
      changed
    );


  // ==========================================================
  // STATE PAYLOAD
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


  // ==========================================================
  // STATE MERGE
  //
  // Timestamp guard:
  //
  // an older recovery/backfill result must never replace a
  // newer Product version already stored by webhook/manual/
  // incremental ingestion.
  // ==========================================================

  await bigquery.query({

    query: `

      MERGE
        \`${PROJECT_ID}.${DATASET_ID}.shopify_products_state\`
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


  // ==========================================================
  // RESULT
  // ==========================================================

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