import {
  createHash,
} from 'node:crypto';

import {
  Readable,
  Transform,
} from 'node:stream';

import {
  pipeline,
} from 'node:stream/promises';

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
    'SHOPIFY_GCS_PROJECT_MISSING'
  );

}


const BUCKET_NAME =
  String(
    process.env.GROWTHOS_SHOPIFY_BULK_BUCKET
    ||
    `growthos-shopify-bulk-${PROJECT_ID}`
  ).trim();


if (!BUCKET_NAME) {

  throw new Error(
    'SHOPIFY_GCS_BUCKET_MISSING'
  );

}


const storage =
  new Storage({

    projectId:
      PROJECT_ID,

  });


const bucket =
  storage.bucket(
    BUCKET_NAME
  );


// ============================================================
// SAFE OBJECT PATH SEGMENT
// ============================================================

function safeSegment(
  value,
  fallback = 'unknown'
) {

  const normalized =
    String(
      value
      ??
      ''
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        '-'
      )
      .replace(
        /^[-_.]+|[-_.]+$/g,
        ''
      )
      .slice(
        0,
        120
      );


  return normalized
    ||
    fallback;

}


// ============================================================
// SHORT HASH
//
// Used for integration account / Shopify operation identities.
//
// This keeps GCS paths compact and avoids placing raw Shopify
// GIDs inside object paths.
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
      20
    );

}


// ============================================================
// OBJECT NAME
//
// Immutable deterministic path:
//
// shopify/
//   workspace/
//     brand/
//       account-hash/
//         orders/
//           runs/
//             bfr_x/
//               windows/
//                 bfw_x/
//                   result-<bulk-hash>.jsonl
//
// Deterministic naming means retrying the same Bulk Operation
// reuses the same staged object.
// ============================================================

export function buildShopifyBulkObjectName(
  input
) {

  const entity =
    safeSegment(
      input.entity
      ||
      'orders'
    );


  return [

    'shopify',

    safeSegment(
      input.workspaceId,
      'workspace'
    ),

    safeSegment(
      input.brandId,
      'brand'
    ),

    shortHash(
      input.integrationAccountId
    ),

    entity,

    'runs',

    safeSegment(
      input.backfillRunId,
      'run'
    ),

    'windows',

    safeSegment(
      input.backfillWindowId,
      'window'
    ),

    `result-${shortHash(
      input.bulkOperationId
    )}.jsonl`,

  ].join(
    '/'
  );

}


// ============================================================
// EXISTING OBJECT
//
// Historical staging objects are immutable.
//
// If the exact operation was already successfully staged,
// retries simply reuse it rather than downloading Shopify again.
// ============================================================

async function getExistingObject(
  objectName
) {

  const file =
    bucket.file(
      objectName
    );


  const [
    exists,
  ] =
    await file.exists();


  if (!exists) {

    return null;

  }


  const [
    metadata,
  ] =
    await file.getMetadata();


  return {

    file,

    metadata,

    gcsUri:
      `gs://${BUCKET_NAME}/${objectName}`,

    sizeBytes:
      Number(
        metadata?.size
        ??
        0
      ),

    generation:
      metadata?.generation
      ??
      null,

    crc32c:
      metadata?.crc32c
      ??
      null,

  };

}


// ============================================================
// STAGE SHOPIFY BULK RESULT
//
// Shopify signed URL
//       ↓
// HTTP streaming response
//       ↓
// Node stream
//       ↓
// GCS upload stream
//
// IMPORTANT:
//
// The full JSONL file is NEVER buffered in RAM.
// ============================================================

export async function stageShopifyBulkResult(
  input
) {

  const startedAt =
    Date.now();


  const resultUrl =
    String(
      input.resultUrl
      ||
      ''
    ).trim();


  if (!resultUrl) {

    throw new Error(
      'SHOPIFY_GCS_RESULT_URL_MISSING'
    );

  }


  const bulkOperationId =
    String(
      input.bulkOperationId
      ||
      ''
    ).trim();


  if (!bulkOperationId) {

    throw new Error(
      'SHOPIFY_GCS_BULK_OPERATION_ID_MISSING'
    );

  }


  const objectName =
    buildShopifyBulkObjectName({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      integrationAccountId:
        input.integrationAccountId,

      entity:
        input.entity
        ||
        'orders',

      backfillRunId:
        input.backfillRunId,

      backfillWindowId:
        input.backfillWindowId,

      bulkOperationId,

    });


  // ==========================================================
  // IDEMPOTENT REUSE
  // ==========================================================

  const existing =
    await getExistingObject(
      objectName
    );


  if (existing) {

    const expectedFileSize =
      Number(
        input.expectedFileSize
        ??
        0
      );


    return {

      reused:
        true,

      bucket:
        BUCKET_NAME,

      objectName,

      gcsUri:
        existing.gcsUri,

      sizeBytes:
        existing.sizeBytes,

      expectedFileSize,

      sizeMatchesExpected:
        expectedFileSize > 0
          ?
            existing.sizeBytes ===
              expectedFileSize
          :
            null,

      generation:
        existing.generation,

      crc32c:
        existing.crc32c,

      durationMs:
        Date.now()
        -
        startedAt,

    };

  }


  // ==========================================================
  // DOWNLOAD FROM SHOPIFY
  // ==========================================================

  const response =
    await fetch(
      resultUrl,
      {

        method:
          'GET',

        headers: {

          Accept:
            'application/x-ndjson,application/json,text/plain,*/*',

        },

        redirect:
          'follow',

      }
    );


  if (
    !response.ok
  ) {

    throw new Error(
      `SHOPIFY_GCS_SOURCE_HTTP_${response.status}`
    );

  }


  if (
    !response.body
  ) {

    throw new Error(
      'SHOPIFY_GCS_SOURCE_BODY_MISSING'
    );

  }


  // ==========================================================
  // STREAM BYTE COUNTER
  // ==========================================================

  let streamedBytes =
    0;


  const byteCounter =
    new Transform({

      transform(
        chunk,
        _encoding,
        callback
      ) {

        streamedBytes +=
          Buffer.isBuffer(
            chunk
          )
            ?
              chunk.length
            :
              Buffer.byteLength(
                chunk
              );


        callback(
          null,
          chunk
        );

      },

    });


  // ==========================================================
  // GCS DESTINATION
  // ==========================================================

  const file =
    bucket.file(
      objectName
    );


  const writeStream =
    file.createWriteStream({

      resumable:
        true,

      validation:
        'crc32c',

      contentType:
        'application/x-ndjson',

      metadata: {

        cacheControl:
          'no-store',

        metadata: {

          source:
            'shopify_bulk_operation',

          provider:
            'shopify',

          entity:
            String(
              input.entity
              ||
              'orders'
            ),

          workspaceId:
            String(
              input.workspaceId
              ||
              ''
            ),

          brandId:
            String(
              input.brandId
              ||
              ''
            ),

          backfillRunId:
            String(
              input.backfillRunId
              ||
              ''
            ),

          backfillWindowId:
            String(
              input.backfillWindowId
              ||
              ''
            ),

          bulkOperationId,

        },

      },

    });


  // ==========================================================
  // WEB STREAM → NODE STREAM → GCS
  // ==========================================================

  const sourceStream =
    Readable.fromWeb(
      response.body
    );


  await pipeline(

    sourceStream,

    byteCounter,

    writeStream

  );


  // ==========================================================
  // VERIFY FINAL GCS OBJECT
  // ==========================================================

  const [
    metadata,
  ] =
    await file.getMetadata();


  const sizeBytes =
    Number(
      metadata?.size
      ??
      streamedBytes
    );


  const expectedFileSize =
    Number(
      input.expectedFileSize
      ??
      0
    );


  return {

    reused:
      false,

    bucket:
      BUCKET_NAME,

    objectName,

    gcsUri:
      `gs://${BUCKET_NAME}/${objectName}`,

    streamedBytes,

    sizeBytes,

    expectedFileSize,

    sizeMatchesExpected:
      expectedFileSize > 0
        ?
          sizeBytes ===
            expectedFileSize
        :
          null,

    generation:
      metadata?.generation
      ??
      null,

    crc32c:
      metadata?.crc32c
      ??
      null,

    durationMs:
      Date.now()
      -
      startedAt,

  };

}


// ============================================================
// DIAGNOSTICS
// ============================================================

export const SHOPIFY_GCS_CONFIG = {

  projectId:
    PROJECT_ID,

  bucket:
    BUCKET_NAME,

};