import {
  randomUUID,
} from 'node:crypto';

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


const STAGE_DATASET =
  String(
    process.env.GROWTHOS_STAGE_DATASET
    ||
    'growthos_stage'
  ).trim();


const LOCATION =
  String(
    process.env.GROWTHOS_DATA_LOCATION
    ||
    'asia-south1'
  ).trim();


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_CUSTOMER_BULK_WAREHOUSE_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });


// ============================================================
// CANONICAL CONTRACT
//
// MUST remain compatible with:
//
// shopify-customer-writer.js
//
// canonicalize(customer)
//      ↓
// JSON.stringify(...)
//      ↓
// SHA256(payload)
//      ↓
// lowercase hexadecimal hash
//
// Historical Bulk + manual + future incremental/webhook must
// therefore converge on the same source_hash.
// ============================================================

const CANONICAL_CONTRACT =
  'shopify_customer_canonical_sha256_v1';


// ============================================================
// SAFE BIGQUERY TABLE ID
// ============================================================

function requireTableId(
  value
) {

  const normalized =
    String(
      value
      ||
      ''
    ).trim();


  if (
    !normalized
    ||
    !/^[A-Za-z0-9_]+$/.test(
      normalized
    )
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_BULK_STAGE_TABLE_INVALID'
    );

  }


  return normalized;

}


// ============================================================
// INPUT
// ============================================================

function normalizeInput(
  input
) {

  const workspaceId =
    String(
      input?.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      input?.brandId
      ||
      ''
    ).trim();


  const integrationAccountId =
    String(
      input?.integrationAccountId
      ||
      ''
    ).trim();


  const stageTableId =
    requireTableId(
      input?.stageTableId
    );


  if (
    !workspaceId
    ||
    !brandId
    ||
    !integrationAccountId
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_BULK_WAREHOUSE_TENANT_IDENTITY_MISSING'
    );

  }


  return {

    workspaceId,

    brandId,

    integrationAccountId,

    stageTableId,

  };

}


// ============================================================
// VALIDATE LOSSLESS STAGING TABLE
//
// Extra Customer safety check:
//
// every root object must have:
//
// gid://shopify/Customer/...
//
// This prevents an Orders Bulk result from ever entering the
// Customer warehouse accidentally.
// ============================================================

async function validateStage(
  input
) {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          COUNT(*)
            AS rows_loaded,

          COUNTIF(
            SAFE.PARSE_JSON(
              payload_raw
            )
            IS NULL
          )
            AS invalid_json,

          COUNTIF(
            JSON_VALUE(
              payload_raw,
              '$.id'
            )
            IS NULL
          )
            AS missing_id,

          COUNTIF(
            JSON_VALUE(
              payload_raw,
              '$.id'
            )
            IS NOT NULL

            AND NOT STARTS_WITH(
              JSON_VALUE(
                payload_raw,
                '$.id'
              ),
              'gid://shopify/Customer/'
            )
          )
            AS invalid_customer_id,

          COUNT(*)
          -
          COUNT(
            DISTINCT
            JSON_VALUE(
              payload_raw,
              '$.id'
            )
          )
            AS duplicate_ids

        FROM
          \`${PROJECT_ID}.${STAGE_DATASET}.${input.stageTableId}\`

      `,

      location:
        LOCATION,

    });


  const row =
    rows?.[0]
    ??
    {};


  const result = {

    rowsLoaded:
      Number(
        row.rows_loaded
        ??
        0
      ),

    invalidJson:
      Number(
        row.invalid_json
        ??
        0
      ),

    missingId:
      Number(
        row.missing_id
        ??
        0
      ),

    invalidCustomerId:
      Number(
        row.invalid_customer_id
        ??
        0
      ),

    duplicateIds:
      Number(
        row.duplicate_ids
        ??
        0
      ),

  };


  if (
    result.invalidJson !==
      0
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_BULK_WAREHOUSE_INVALID_JSON'
    );

  }


  if (
    result.missingId !==
      0
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_BULK_WAREHOUSE_CUSTOMER_ID_MISSING'
    );

  }


  if (
    result.invalidCustomerId !==
      0
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_BULK_WAREHOUSE_ENTITY_MISMATCH'
    );

  }


  if (
    result.duplicateIds !==
      0
  ) {

    throw new Error(
      'SHOPIFY_CUSTOMER_BULK_WAREHOUSE_DUPLICATE_CUSTOMER_IDS'
    );

  }


  return result;

}


// ============================================================
// CANONICAL NORMALIZATION SQL
//
// IMPORTANT:
//
// This deliberately reproduces the JavaScript canonicalization
// used by shopify-customer-writer.js:
//
// recursively sort object keys
// preserve array order
// JSON.stringify
// SHA256
//
// Therefore a Customer already written manually will have the
// exact same source_hash when later encountered in Bulk.
// ============================================================

function canonicalSql(
  stageTableId
) {

  return `

    CREATE TEMP FUNCTION
      CanonicalShopifyJson(
        payload STRING
      )

    RETURNS STRING

    LANGUAGE js

    AS """

      function canonicalize(value) {

        if (
          value === null
          ||
          value === undefined
        ) {

          return value === undefined
            ? null
            : value;

        }


        if (
          Array.isArray(value)
        ) {

          return value.map(
            canonicalize
          );

        }


        if (
          typeof value === 'object'
        ) {

          var output = {};


          Object
            .keys(
              value
            )
            .sort()
            .forEach(
              function (key) {

                output[key] =
                  canonicalize(
                    value[key]
                  );

              }
            );


          return output;

        }


        return value;

      }


      var parsed =
        JSON.parse(
          payload
        );


      return JSON.stringify(
        canonicalize(
          parsed
        )
      );

    """;


    CREATE TEMP TABLE
      normalized_customers

    AS

    WITH canonical AS
    (

      SELECT

        CanonicalShopifyJson(
          payload_raw
        )
          AS payload

      FROM
        \`${PROJECT_ID}.${STAGE_DATASET}.${stageTableId}\`

    )

    SELECT

      @workspace_id
        AS workspace_id,

      @brand_id
        AS brand_id,

      @integration_account_id
        AS integration_account_id,

      @batch_id
        AS batch_id,

      'customers'
        AS entity,

      JSON_VALUE(
        payload,
        '$.id'
      )
        AS record_id,

      SAFE_CAST(
        JSON_VALUE(
          payload,
          '$.createdAt'
        )
        AS TIMESTAMP
      )
        AS created_at,

      COALESCE(

        SAFE_CAST(
          JSON_VALUE(
            payload,
            '$.updatedAt'
          )
          AS TIMESTAMP
        ),

        SAFE_CAST(
          JSON_VALUE(
            payload,
            '$.createdAt'
          )
          AS TIMESTAMP
        )

      )
        AS updated_at,

      payload,

      LOWER(
        TO_HEX(
          SHA256(
            payload
          )
        )
      )
        AS source_hash,

      TIMESTAMP(
        @loaded_at
      )
        AS loaded_at

    FROM
      canonical

    WHERE

      JSON_VALUE(
        payload,
        '$.id'
      )
      IS NOT NULL

      AND STARTS_WITH(
        JSON_VALUE(
          payload,
          '$.id'
        ),
        'gid://shopify/Customer/'
      );

  `;

}


// ============================================================
// ANALYZE CUSTOMER BULK STAGE
//
// READ ONLY.
//
// Used as compatibility / diagnostics gate.
//
// No RAW changes.
// No STATE changes.
// ============================================================

export async function analyzeShopifyCustomerBulkStage(
  rawInput
) {

  const startedAt =
    Date.now();


  const input =
    normalizeInput(
      rawInput
    );


  const validation =
    await validateStage(
      input
    );


  const batchId =
    randomUUID();


  const loadedAt =
    new Date()
      .toISOString();


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        ${canonicalSql(
          input.stageTableId
        )}


        -- ====================================================
        -- EXISTING RAW HASHES
        -- ====================================================

        CREATE TEMP TABLE
          existing_customer_raw_hashes

        AS

        SELECT DISTINCT

          record_id,
          source_hash

        FROM
          \`${PROJECT_ID}.${DATASET_ID}.shopify_customers_raw_json\`

        WHERE

          workspace_id =
            @workspace_id

          AND brand_id =
            @brand_id

          AND integration_account_id =
            @integration_account_id;


        -- ====================================================
        -- COMPATIBILITY METRICS
        -- ====================================================

        SELECT

          COUNT(*)
            AS received,

          COUNTIF(
            state.record_id
            IS NULL
          )
            AS state_missing,

          COUNTIF(

            state.record_id
              IS NOT NULL

            AND

            state.latest_source_hash =
              normalized.source_hash

          )
            AS state_hash_matches,

          COUNTIF(

            state.record_id
              IS NOT NULL

            AND

            state.latest_source_hash !=
              normalized.source_hash

          )
            AS state_hash_differs,

          COUNTIF(
            raw.record_id
            IS NOT NULL
          )
            AS raw_hash_present,

          COUNTIF(
            raw.record_id
            IS NULL
          )
            AS raw_hash_missing

        FROM
          normalized_customers
          AS normalized

        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.shopify_customers_state\`
          AS state

        ON

          state.workspace_id =
            normalized.workspace_id

          AND state.brand_id =
            normalized.brand_id

          AND state.integration_account_id =
            normalized.integration_account_id

          AND state.record_id =
            normalized.record_id

        LEFT JOIN
          existing_customer_raw_hashes
          AS raw

        ON

          raw.record_id =
            normalized.record_id

          AND raw.source_hash =
            normalized.source_hash

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        integration_account_id:
          input.integrationAccountId,

        batch_id:
          batchId,

        loaded_at:
          loadedAt,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

        batch_id:
          'STRING',

        loaded_at:
          'STRING',

      },

    });


  const metrics =
    rows?.[0]
    ??
    {};


  return {

    mode:
      'analyze',

    canonicalContract:
      CANONICAL_CONTRACT,

    batchId,

    stageTableId:
      input.stageTableId,

    validation,

    received:
      Number(
        metrics.received
        ??
        0
      ),

    stateMissing:
      Number(
        metrics.state_missing
        ??
        0
      ),

    stateHashMatches:
      Number(
        metrics.state_hash_matches
        ??
        0
      ),

    stateHashDiffers:
      Number(
        metrics.state_hash_differs
        ??
        0
      ),

    rawHashPresent:
      Number(
        metrics.raw_hash_present
        ??
        0
      ),

    rawHashMissing:
      Number(
        metrics.raw_hash_missing
        ??
        0
      ),

    durationMs:
      Date.now()
      -
      startedAt,

  };

}


// ============================================================
// WRITE CUSTOMER BULK STAGE
//
// HIGH-VOLUME HISTORICAL CUSTOMER PATH
//
// STAGE
//   ↓
// canonicalize
//   ↓
// SHA256
//   ↓
// compare Customer STATE
//   ↓
// append unseen versions → Customer RAW
//   ↓
// MERGE Customer STATE
//   ↓
// shopify_customers_current follows automatically
//
// IMPORTANT:
//
// Historical data is append-oriented.
//
// Older historical versions are allowed into RAW.
//
// Timestamp guard prevents them from rolling CURRENT/STATE
// backwards when a newer realtime/manual Customer already
// exists.
// ============================================================

export async function writeShopifyCustomerBulkStage(
  rawInput
) {

  const startedAt =
    Date.now();


  const input =
    normalizeInput(
      rawInput
    );


  const validation =
    await validateStage(
      input
    );


  const batchId =
    randomUUID();


  const loadedAt =
    new Date()
      .toISOString();


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        ${canonicalSql(
          input.stageTableId
        )}


        -- ====================================================
        -- CHANGED RELATIVE TO CURRENT STATE
        -- ====================================================

        CREATE TEMP TABLE
          changed_customers

        AS

        SELECT
          normalized.*

        FROM
          normalized_customers
          AS normalized

        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.shopify_customers_state\`
          AS state

        ON

          state.workspace_id =
            normalized.workspace_id

          AND state.brand_id =
            normalized.brand_id

          AND state.integration_account_id =
            normalized.integration_account_id

          AND state.record_id =
            normalized.record_id

        WHERE

          state.record_id
            IS NULL

          OR

          state.latest_source_hash !=
            normalized.source_hash;


        -- ====================================================
        -- RAW VERSION IDEMPOTENCY
        --
        -- Historical replay may encounter a Customer version
        -- already preserved in RAW even when STATE has since
        -- advanced.
        --
        -- Never append the same payload/hash twice.
        -- ====================================================

        CREATE TEMP TABLE
          raw_insert_customers

        AS

        SELECT
          changed.*

        FROM
          changed_customers
          AS changed

        WHERE

          NOT EXISTS
          (

            SELECT
              1

            FROM
              \`${PROJECT_ID}.${DATASET_ID}.shopify_customers_raw_json\`
              AS raw

            WHERE

              raw.workspace_id =
                changed.workspace_id

              AND raw.brand_id =
                changed.brand_id

              AND raw.integration_account_id =
                changed.integration_account_id

              AND raw.record_id =
                changed.record_id

              AND raw.source_hash =
                changed.source_hash

          );


        -- ====================================================
        -- ATOMIC RAW + STATE WRITE
        -- ====================================================

        BEGIN TRANSACTION;


        -- ====================================================
        -- APPEND CUSTOMER RAW VERSIONS
        -- ====================================================

        INSERT INTO
          \`${PROJECT_ID}.${DATASET_ID}.shopify_customers_raw_json\`
        (
          workspace_id,
          brand_id,
          integration_account_id,

          batch_id,
          entity,
          record_id,

          created_at,
          updated_at,

          payload,
          source_hash,
          loaded_at
        )

        SELECT

          workspace_id,
          brand_id,
          integration_account_id,

          batch_id,
          entity,
          record_id,

          created_at,
          updated_at,

          payload,
          source_hash,
          loaded_at

        FROM
          raw_insert_customers;


        -- ====================================================
        -- MERGE CUSTOMER STATE
        --
        -- Same timestamp guard as the canonical manual
        -- Customer writer.
        --
        -- A historical Customer version must never replace a
        -- newer realtime Customer version.
        -- ====================================================

        MERGE
          \`${PROJECT_ID}.${DATASET_ID}.shopify_customers_state\`
          AS target

        USING
          changed_customers
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

            OR source.updated_at
              IS NULL

            OR source.updated_at >=
              target.source_updated_at
          )

        THEN UPDATE SET

          latest_source_hash =
            source.source_hash,

          source_updated_at =
            COALESCE(
              source.updated_at,
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
            source.updated_at,

            source.loaded_at,
            source.batch_id
          );


        COMMIT TRANSACTION;


        -- ====================================================
        -- METRICS
        -- ====================================================

        SELECT

          (
            SELECT
              COUNT(*)

            FROM
              normalized_customers
          )
            AS received,

          (
            SELECT
              COUNT(*)

            FROM
              changed_customers
          )
            AS changed,

          (
            SELECT
              COUNT(*)

            FROM
              raw_insert_customers
          )
            AS raw_inserted

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        integration_account_id:
          input.integrationAccountId,

        batch_id:
          batchId,

        loaded_at:
          loadedAt,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        integration_account_id:
          'STRING',

        batch_id:
          'STRING',

        loaded_at:
          'STRING',

      },

    });


  const metrics =
    rows?.[0]
    ??
    {};


  const received =
    Number(
      metrics.received
      ??
      0
    );


  const changed =
    Number(
      metrics.changed
      ??
      0
    );


  const rawInserted =
    Number(
      metrics.raw_inserted
      ??
      0
    );


  return {

    mode:
      'write',

    canonicalContract:
      CANONICAL_CONTRACT,

    batchId,

    stageTableId:
      input.stageTableId,

    validation,

    received,

    changed,

    skipped:
      received
      -
      changed,

    rawInserted,

    rawAlreadyPresent:
      changed
      -
      rawInserted,

    loaded:
      rawInserted,

    durationMs:
      Date.now()
      -
      startedAt,

  };

}


// ============================================================
// DIAGNOSTICS
// ============================================================

export const SHOPIFY_CUSTOMER_BULK_WAREHOUSE_CONFIG = {

  projectId:
    PROJECT_ID,

  dataDataset:
    DATASET_ID,

  stageDataset:
    STAGE_DATASET,

  location:
    LOCATION,

  entity:
    'customers',

  canonicalContract:
    CANONICAL_CONTRACT,

};