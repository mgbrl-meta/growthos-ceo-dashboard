import {
  createHash,
} from 'node:crypto';

import {
  BigQuery,
} from '@google-cloud/bigquery';

import {
  Storage,
} from '@google-cloud/storage';


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


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_STAGE_PROJECT_MISSING'
  );

}


const STAGE_DATASET =
  String(
    process.env.GROWTHOS_STAGE_DATASET
    ||
    'growthos_stage'
  ).trim();


const LOCATION =
  String(
    process.env.GROWTHOS_STAGE_LOCATION
    ||
    'asia-south1'
  ).trim();


const bigquery =
  new BigQuery({

    projectId:
      PROJECT_ID,

  });


const storage =
  new Storage({

    projectId:
      PROJECT_ID,

  });


// ============================================================
// SHORT HASH
// ============================================================

function shortHash(
  value
) {

  return createHash(
    'sha256'
  )
    .update(
      String(
        value
        ??
        ''
      ),
      'utf8'
    )
    .digest(
      'hex'
    )
    .slice(
      0,
      16
    );

}


// ============================================================
// GCS URI
// ============================================================

function parseGcsUri(
  gcsUri
) {

  const normalized =
    String(
      gcsUri
      ||
      ''
    ).trim();


  const match =
    normalized.match(
      /^gs:\/\/([^/]+)\/(.+)$/
    );


  if (!match) {

    throw new Error(
      'SHOPIFY_STAGE_GCS_URI_INVALID'
    );

  }


  return {

    bucketName:
      match[1],

    objectName:
      match[2],

  };

}


// ============================================================
// TABLE ID
//
// Deterministic per backfill window.
//
// Replaying the same window rebuilds the same temporary table.
// ============================================================

export function buildShopifyStageTableId(
  input
) {

  return [

    'shopify_orders',

    shortHash(
      input.backfillRunId
    ),

    shortHash(
      input.backfillWindowId
    ),

  ].join(
    '_'
  );

}


// ============================================================
// TABLE INFO
// ============================================================

async function getTableInfo(
  table
) {

  const [
    exists,
  ] =
    await table.exists();


  if (!exists) {

    return null;

  }


  const [
    metadata,
  ] =
    await table.getMetadata();


  return {

    tableId:
      metadata
        ?.tableReference
        ?.tableId
      ??
      null,

    numRows:
      Number(
        metadata?.numRows
        ??
        0
      ),

    numBytes:
      Number(
        metadata?.numBytes
        ??
        0
      ),

    schema:
      metadata
        ?.schema
        ?.fields
      ??
      [],

    createdAt:
      metadata?.creationTime
        ?
          new Date(
            Number(
              metadata.creationTime
            )
          ).toISOString()
        :
          null,

    modifiedAt:
      metadata?.lastModifiedTime
        ?
          new Date(
            Number(
              metadata.lastModifiedTime
            )
          ).toISOString()
        :
          null,

  };

}


// ============================================================
// GCS JSONL → LOSSLESS BIGQUERY STAGE
//
// IMPORTANT:
//
// Shopify supplies:
//
// {"id":"...","createdAt":"...",...}
// {"id":"...","createdAt":"...",...}
//
// We intentionally DO NOT let BigQuery interpret the JSON
// schema here.
//
// Instead every physical JSONL line becomes:
//
// payload_raw STRING
//
// Why:
//
// The production small-volume writer hashes:
//
// JSON.stringify(
//   canonicalize(order)
// )
//
// Therefore historical ingestion must retain the original JSON
// values before applying the same canonicalization.
//
// IMPLEMENTATION:
//
// Load JSONL as one-column CSV.
//
// Field delimiter is ASCII Unit Separator (0x1F).
//
// A literal JSON control character cannot legally appear
// unescaped inside JSON, so the complete JSON object remains
// one field.
//
// This retains BigQuery native-load performance while keeping
// the source payload lossless.
// ============================================================

export async function loadShopifyBulkGcsToStage(
  input
) {

  const startedAt =
    Date.now();


  // ==========================================================
  // VALIDATE
  // ==========================================================

  const gcsUri =
    String(
      input.gcsUri
      ||
      ''
    ).trim();


  if (!gcsUri) {

    throw new Error(
      'SHOPIFY_STAGE_GCS_URI_MISSING'
    );

  }


  const backfillRunId =
    String(
      input.backfillRunId
      ||
      ''
    ).trim();


  if (!backfillRunId) {

    throw new Error(
      'SHOPIFY_STAGE_BACKFILL_RUN_ID_MISSING'
    );

  }


  const backfillWindowId =
    String(
      input.backfillWindowId
      ||
      ''
    ).trim();


  if (!backfillWindowId) {

    throw new Error(
      'SHOPIFY_STAGE_BACKFILL_WINDOW_ID_MISSING'
    );

  }


  // ==========================================================
  // SOURCE
  // ==========================================================

  const {
    bucketName,
    objectName,
  } =
    parseGcsUri(
      gcsUri
    );


  const sourceFile =
    storage
      .bucket(
        bucketName
      )
      .file(
        objectName
      );


  const [
    sourceExists,
  ] =
    await sourceFile.exists();


  if (!sourceExists) {

    throw new Error(
      'SHOPIFY_STAGE_GCS_OBJECT_NOT_FOUND'
    );

  }


  const [
    sourceMetadata,
  ] =
    await sourceFile.getMetadata();


  const sourceSizeBytes =
    Number(
      sourceMetadata?.size
      ??
      0
    );


  // ==========================================================
  // DESTINATION
  // ==========================================================

  const tableId =
    buildShopifyStageTableId({

      backfillRunId,

      backfillWindowId,

    });


  const dataset =
    bigquery.dataset(
      STAGE_DATASET
    );


  const table =
    dataset.table(
      tableId
    );


  // ==========================================================
  // BIGQUERY NATIVE LOAD
  //
  // Shopify JSONL is deliberately interpreted as:
  //
  // one physical line = one STRING
  //
  // WRITE_TRUNCATE makes replay deterministic.
  // ==========================================================

  const [
    job,
  ] =
    await table.load(

      sourceFile,

      {

        sourceFormat:
          'CSV',

        schema: {
          fields: [
            {
              name: 'payload_raw',
              type: 'STRING',
              mode: 'NULLABLE',
            },
          ],
        },

        // ASCII Unit Separator.
        //
        // Valid JSON control characters must be escaped,
        // therefore this cannot split normal Shopify JSON.
        fieldDelimiter:
          '\u001f',

        // Disable CSV quoting semantics.
        //
        // Shopify JSON itself contains many double quotes and
        // they must remain untouched.
        quote:
          '',

        skipLeadingRows:
          0,

        allowJaggedRows:
          false,

        allowQuotedNewlines:
          false,

        encoding:
          'UTF-8',

        writeDisposition:
          'WRITE_TRUNCATE',

        createDisposition:
          'CREATE_IF_NEEDED',

        maxBadRecords:
          0,

        location:
          LOCATION,

      }

    );


  // ==========================================================
  // JOB ERROR
  //
  // table.load() waits for completion.
  //
  // Do not call job.getMetadata(); different client-library
  // versions expose the returned job differently.
  // ==========================================================

  const jobMetadata =
    job?.metadata
    ??
    null;


  const errorResult =
    jobMetadata
      ?.status
      ?.errorResult
    ??
    null;


  if (errorResult) {

    throw new Error(
      `SHOPIFY_STAGE_LOAD_FAILED: ${
        JSON.stringify(
          errorResult
        )
      }`
    );

  }


  // ==========================================================
  // VERIFY TABLE
  // ==========================================================

  const tableInfo =
    await getTableInfo(
      table
    );


  if (!tableInfo) {

    throw new Error(
      'SHOPIFY_STAGE_TABLE_MISSING_AFTER_LOAD'
    );

  }


  // Stage table MUST have exactly the lossless raw column.
  const schemaFields =
    tableInfo.schema;


  if (
    schemaFields.length !== 1
    ||
    schemaFields[0]?.name !==
      'payload_raw'
    ||
    schemaFields[0]?.type !==
      'STRING'
  ) {

    throw new Error(
      'SHOPIFY_STAGE_SCHEMA_INVALID'
    );

  }


  return {

    projectId:
      PROJECT_ID,

    dataset:
      STAGE_DATASET,

    location:
      LOCATION,

    tableId,

    fullyQualifiedTable:
      `${PROJECT_ID}.${STAGE_DATASET}.${tableId}`,

    gcsUri,

    sourceSizeBytes,

    rowsLoaded:
      tableInfo.numRows,

    tableBytes:
      tableInfo.numBytes,

    schemaMode:
      'lossless_jsonl_string_v1',

    jobId:
      job?.id
      ??
      jobMetadata
        ?.jobReference
        ?.jobId
      ??
      null,

    createdAt:
      tableInfo.createdAt,

    modifiedAt:
      tableInfo.modifiedAt,

    durationMs:
      Date.now()
      -
      startedAt,

  };

}


// ============================================================
// DIAGNOSTICS
// ============================================================

export const SHOPIFY_STAGE_CONFIG = {

  projectId:
    PROJECT_ID,

  dataset:
    STAGE_DATASET,

  location:
    LOCATION,

  schemaMode:
    'lossless_jsonl_string_v1',

};