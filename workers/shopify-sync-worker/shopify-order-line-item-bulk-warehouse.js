import {
  randomUUID,
} from 'node:crypto';

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
    'SHOPIFY_LINE_ITEM_BULK_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({
    projectId:
      PROJECT_ID,
  });


// ============================================================
// SAFE STAGE TABLE ID
// ============================================================

function requireTableId(
  value
) {

  const normalized =
    String(
      value
      ??
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
      'SHOPIFY_LINE_ITEM_BULK_STAGE_TABLE_INVALID'
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
      ??
      ''
    ).trim();

  const brandId =
    String(
      input?.brandId
      ??
      ''
    ).trim();

  const integrationAccountId =
    String(
      input?.integrationAccountId
      ??
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
      'SHOPIFY_LINE_ITEM_BULK_TENANT_IDENTITY_MISSING'
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
// VALIDATE LINE ITEM PARENTAGE
//
// We deliberately validate again here even though the Orders
// bulk writer now performs whole-stage classification.
//
// Why:
//
// this module must remain safe if called independently later.
//
// Every LineItem child must point to an Order root present in
// the SAME Shopify Bulk stage.
// ============================================================

async function validateLineItemStage(
  input
) {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        WITH stage_rows AS
        (

          SELECT

            JSON_VALUE(
              payload_raw,
              '$.id'
            )
              AS record_id,

            JSON_VALUE(
              payload_raw,
              '$.__parentId'
            )
              AS parent_id

          FROM
            \`${PROJECT_ID}.${STAGE_DATASET}.${input.stageTableId}\`

        ),

        order_roots AS
        (

          SELECT
            record_id AS order_id

          FROM
            stage_rows

          WHERE
            STARTS_WITH(
              record_id,
              'gid://shopify/Order/'
            )

            AND parent_id IS NULL

        ),

        line_items AS
        (

          SELECT
            record_id,
            parent_id AS order_id

          FROM
            stage_rows

          WHERE
            STARTS_WITH(
              record_id,
              'gid://shopify/LineItem/'
            )

            AND STARTS_WITH(
              IFNULL(
                parent_id,
                ''
              ),
              'gid://shopify/Order/'
            )

        )

        SELECT

          (
            SELECT
              COUNT(*)

            FROM
              order_roots
          )
            AS order_rows,

          (
            SELECT
              COUNT(*)

            FROM
              line_items
          )
            AS line_item_rows,

          (
            SELECT
              COUNT(*)

            FROM
              line_items AS item

            LEFT JOIN
              order_roots AS root

            ON
              root.order_id =
                item.order_id

            WHERE
              root.order_id IS NULL
          )
            AS orphan_line_items

      `,

      location:
        LOCATION,

    });


  const row =
    rows?.[0]
    ??
    {};


  const result = {

    orderRows:
      Number(
        row.order_rows
        ??
        0
      ),

    lineItemRows:
      Number(
        row.line_item_rows
        ??
        0
      ),

    orphanLineItems:
      Number(
        row.orphan_line_items
        ??
        0
      ),

  };


  if (
    result.orphanLineItems >
      0
  ) {

    throw new Error(
      'SHOPIFY_LINE_ITEM_BULK_ORPHAN_CHILD_ROWS'
    );

  }


  return result;

}


// ============================================================
// CANONICAL LINE ITEM SQL
//
// IMPORTANT:
//
// Shopify Bulk adds:
//
// __parentId
//
// to LineItem JSONL child rows.
//
// Realtime/incremental LineItem objects do NOT contain this
// transport field.
//
// Therefore:
//
// __parentId → order_id
//
// and then __parentId MUST be removed before canonicalization.
//
// This preserves identical payload/hash semantics between:
//
// Bulk historical
// Webhook
// Incremental
//
// Canonicalization mirrors shopify-order-line-item-writer.js:
//
// recursively sort object keys
// preserve array order
// JSON.stringify
// SHA256 lowercase hexadecimal
// ============================================================

function canonicalSql(
  stageTableId
) {

  return `

    CREATE TEMP FUNCTION
      CanonicalShopifyLineItemJson(
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

          const output = {};

          for (
            const key
            of Object.keys(value).sort()
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


      const parsed =
        JSON.parse(
          payload
        );


      if (
        parsed
        &&
        typeof parsed === 'object'
        &&
        !Array.isArray(parsed)
      ) {

        delete parsed.__parentId;

      }


      return JSON.stringify(
        canonicalize(
          parsed
        )
      );

    """;


    -- ========================================================
    -- COMPLETE ORDER SNAPSHOTS
    --
    -- Order timestamps are intentionally inherited by the
    -- Line Item warehouse rows.
    --
    -- This matches the realtime Line Item writer, where
    -- created_at / updated_at come from the owning Order
    -- snapshot rather than from the LineItem itself.
    -- ========================================================

    CREATE TEMP TABLE
      order_snapshots

    AS

    SELECT

      JSON_VALUE(
        payload_raw,
        '$.id'
      )
        AS order_id,

      SAFE_CAST(
        JSON_VALUE(
          payload_raw,
          '$.createdAt'
        )
        AS TIMESTAMP
      )
        AS created_at,

      COALESCE(

        SAFE_CAST(
          JSON_VALUE(
            payload_raw,
            '$.updatedAt'
          )
          AS TIMESTAMP
        ),

        SAFE_CAST(
          JSON_VALUE(
            payload_raw,
            '$.createdAt'
          )
          AS TIMESTAMP
        )

      )
        AS updated_at

    FROM
      \`${PROJECT_ID}.${STAGE_DATASET}.${stageTableId}\`

    WHERE

      STARTS_WITH(
        JSON_VALUE(
          payload_raw,
          '$.id'
        ),
        'gid://shopify/Order/'
      )

      AND JSON_VALUE(
        payload_raw,
        '$.__parentId'
      )
        IS NULL;


    -- ========================================================
    -- CANONICAL LINE ITEMS
    -- ========================================================

    CREATE TEMP TABLE
      normalized_line_items

    AS

    WITH source_line_items AS
    (

      SELECT

        JSON_VALUE(
          payload_raw,
          '$.id'
        )
          AS record_id,

        JSON_VALUE(
          payload_raw,
          '$.__parentId'
        )
          AS order_id,

        CanonicalShopifyLineItemJson(
          payload_raw
        )
          AS payload

      FROM
        \`${PROJECT_ID}.${STAGE_DATASET}.${stageTableId}\`

      WHERE

        STARTS_WITH(
          JSON_VALUE(
            payload_raw,
            '$.id'
          ),
          'gid://shopify/LineItem/'
        )

        AND STARTS_WITH(
          IFNULL(
            JSON_VALUE(
              payload_raw,
              '$.__parentId'
            ),
            ''
          ),
          'gid://shopify/Order/'
        )

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

      'order_line_items'
        AS entity,

      source.record_id
        AS record_id,

      source.order_id
        AS order_id,

      orders.created_at
        AS created_at,

      orders.updated_at
        AS updated_at,

      source.payload
        AS payload,

      LOWER(
        TO_HEX(
          SHA256(
            source.payload
          )
        )
      )
        AS source_hash,

      TIMESTAMP(
        @loaded_at
      )
        AS loaded_at

    FROM
      source_line_items AS source

    INNER JOIN
      order_snapshots AS orders

    ON
      orders.order_id =
        source.order_id;

  `;

}


// ============================================================
// WRITE HISTORICAL LINE ITEMS
//
// SAME CANONICAL TABLES AS REALTIME:
//
// shopify_order_line_items_raw_json
// shopify_order_line_items_state
// shopify_order_line_items_current
//
// CURRENT remains a view over RAW + STATE.
// ============================================================

export async function writeShopifyOrderLineItemBulkStage(
  rawInput
) {

  const startedAt =
    Date.now();


  const input =
    normalizeInput(
      rawInput
    );


  const validation =
    await validateLineItemStage(
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
        -- ACTIVE LINE ITEMS CHANGED RELATIVE TO STATE
        --
        -- Same semantics as realtime:
        --
        -- state missing
        -- OR hash differs
        -- OR currently inactive
        --      ↓
        -- candidate active version
        -- ====================================================

        CREATE TEMP TABLE
          changed_line_items

        AS

        SELECT
          normalized.*

        FROM
          normalized_line_items AS normalized

        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_state\`
          AS state

        ON
          state.workspace_id =
            normalized.workspace_id

          AND state.brand_id =
            normalized.brand_id

          AND state.integration_account_id =
            normalized.integration_account_id

          AND state.order_id =
            normalized.order_id

          AND state.record_id =
            normalized.record_id

        WHERE

          state.record_id IS NULL

          OR state.latest_source_hash !=
            normalized.source_hash

          OR state.is_active !=
            TRUE;


        -- ====================================================
        -- RAW VERSION IDEMPOTENCY
        --
        -- Historical replay may encounter a payload version
        -- already stored in RAW.
        --
        -- Never insert the same canonical version twice.
        -- ====================================================

        CREATE TEMP TABLE
          raw_insert_line_items

        AS

        SELECT
          changed.*

        FROM
          changed_line_items AS changed

        WHERE
          NOT EXISTS
          (

            SELECT
              1

            FROM
              \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_raw_json\`
              AS raw

            WHERE
              raw.workspace_id =
                changed.workspace_id

              AND raw.brand_id =
                changed.brand_id

              AND raw.integration_account_id =
                changed.integration_account_id

              AND raw.order_id =
                changed.order_id

              AND raw.record_id =
                changed.record_id

              AND raw.source_hash =
                changed.source_hash

          );


        -- ====================================================
        -- REMOVAL RECONCILIATION
        --
        -- Every Order root in this Bulk stage represents a
        -- complete current Order snapshot.
        --
        -- Therefore an existing active LineItem belonging to
        -- that Order, but absent from normalized_line_items,
        -- is a removal candidate.
        --
        -- Timestamp guard prevents an older Bulk snapshot from
        -- overriding newer realtime/incremental state.
        -- ====================================================

        CREATE TEMP TABLE
          removal_candidates

        AS

        SELECT

          state.workspace_id,

          state.brand_id,

          state.integration_account_id,

          state.record_id,

          state.order_id,

          orders.updated_at
            AS source_updated_at,

          TIMESTAMP(
            @loaded_at
          )
            AS loaded_at,

          @batch_id
            AS batch_id,

          COALESCE(
            orders.updated_at,
            TIMESTAMP(
              @loaded_at
            )
          )
            AS removed_at

        FROM
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_state\`
          AS state

        INNER JOIN
          order_snapshots AS orders

        ON
          orders.order_id =
            state.order_id

        LEFT JOIN
          normalized_line_items AS current_snapshot

        ON
          current_snapshot.workspace_id =
            state.workspace_id

          AND current_snapshot.brand_id =
            state.brand_id

          AND current_snapshot.integration_account_id =
            state.integration_account_id

          AND current_snapshot.order_id =
            state.order_id

          AND current_snapshot.record_id =
            state.record_id

        WHERE

          state.workspace_id =
            @workspace_id

          AND state.brand_id =
            @brand_id

          AND state.integration_account_id =
            @integration_account_id

          AND state.is_active =
            TRUE

          AND current_snapshot.record_id
            IS NULL

          AND
          (
            state.source_updated_at
              IS NULL

            OR orders.updated_at
              IS NULL

            OR orders.updated_at >=
              state.source_updated_at
          );


        -- ====================================================
        -- ATOMIC CANONICAL WRITE
        -- ====================================================

        BEGIN TRANSACTION;


        -- ====================================================
        -- APPEND ACTIVE RAW VERSIONS
        -- ====================================================

        INSERT INTO
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_raw_json\`
        (
          workspace_id,
          brand_id,
          integration_account_id,

          batch_id,
          entity,
          record_id,
          order_id,

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
          order_id,

          created_at,
          updated_at,

          payload,
          source_hash,
          loaded_at

        FROM
          raw_insert_line_items;


        -- ====================================================
        -- MERGE ACTIVE STATE
        --
        -- Timestamp guard is intentionally identical to the
        -- realtime Line Item writer.
        -- ====================================================

        MERGE
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_state\`
          AS target

        USING
          changed_line_items
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

            OR source.updated_at
              IS NULL

            OR source.updated_at >=
              target.source_updated_at
          )

        THEN UPDATE SET

          order_id =
            source.order_id,

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
            source.updated_at,
            source.loaded_at,
            source.batch_id,

            TRUE,
            NULL
          );


        -- ====================================================
        -- APPLY REMOVALS
        --
        -- No RAW tombstone is created.
        --
        -- This mirrors the realtime writer: RAW remains source
        -- payload history while STATE carries active/inactive
        -- lifecycle.
        -- ====================================================

        MERGE
          \`${PROJECT_ID}.${DATASET_ID}.shopify_order_line_items_state\`
          AS target

        USING
          removal_candidates
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
            source.removed_at;


        COMMIT TRANSACTION;


        -- ====================================================
        -- METRICS
        -- ====================================================

        SELECT

          (
            SELECT
              COUNT(*)

            FROM
              order_snapshots
          )
            AS order_snapshots,

          (
            SELECT
              COUNT(*)

            FROM
              normalized_line_items
          )
            AS received,

          (
            SELECT
              COUNT(*)

            FROM
              changed_line_items
          )
            AS changed,

          (
            SELECT
              COUNT(*)

            FROM
              raw_insert_line_items
          )
            AS raw_inserted,

          (
            SELECT
              COUNT(*)

            FROM
              removal_candidates
          )
            AS removed

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

  const removed =
    Number(
      metrics.removed
      ??
      0
    );


  return {

    mode:
      'write',

    canonicalContract:
      'shopify_order_line_item_canonical_sha256_v1',

    batchId,

    stageTableId:
      input.stageTableId,

    validation,

    orderSnapshots:
      Number(
        metrics.order_snapshots
        ??
        0
      ),

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

    removed,

    durationMs:
      Date.now()
      -
      startedAt,

  };

}


// ============================================================
// DIAGNOSTICS
// ============================================================

export const shopifyOrderLineItemBulkWarehouseConfig = {

  projectId:
    PROJECT_ID,

  dataDataset:
    DATASET_ID,

  stageDataset:
    STAGE_DATASET,

  location:
    LOCATION,

  canonicalContract:
    'shopify_order_line_item_canonical_sha256_v1',

};