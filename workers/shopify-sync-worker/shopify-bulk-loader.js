import readline from 'node:readline';

import {
  Readable,
} from 'node:stream';

import {
  writeShopifyOrders,
} from './shopify-writer.js';


// ============================================================
// CONFIG
// ============================================================

const DEFAULT_BATCH_SIZE =
  250;


// ============================================================
// WRITE ONE BATCH
// ============================================================

async function writeBatch(
  input,
  orders
) {

  if (
    !Array.isArray(
      orders
    )
    ||
    orders.length === 0
  ) {

    return {

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


  return writeShopifyOrders({

    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    integrationAccountId:
      input.integrationAccountId,

    orders,

  });

}


// ============================================================
// LOAD SHOPIFY ORDERS JSONL
//
// IMPORTANT:
//
// - URL is never logged.
// - Full file is never held in memory.
// - JSONL is parsed one line at a time.
// - Orders are written in bounded batches.
// - Existing canonical writer provides dedupe.
// ============================================================

export async function loadOrdersBulkJsonl(
  input
) {

  const resultUrl =
    String(
      input.resultUrl
      ||
      ''
    ).trim();


  if (!resultUrl) {

    throw new Error(
      'SHOPIFY_BULK_RESULT_URL_MISSING'
    );

  }


  const batchSize =
    Math.max(
      1,
      Math.min(
        Number(
          input.batchSize
          ||
          DEFAULT_BATCH_SIZE
        ),
        1000
      )
    );


  // ==========================================================
  // DOWNLOAD
  // ==========================================================

  const response =
    await fetch(
      resultUrl,
      {

        method:
          'GET',

        headers: {

          Accept:
            'application/jsonl, application/x-ndjson, application/octet-stream',

        },

      }
    );


  if (
    !response.ok
  ) {

    throw new Error(
      `SHOPIFY_BULK_DOWNLOAD_HTTP_${response.status}`
    );

  }


  if (
    !response.body
  ) {

    throw new Error(
      'SHOPIFY_BULK_DOWNLOAD_BODY_MISSING'
    );

  }


  // ==========================================================
  // WEB STREAM → NODE STREAM
  // ==========================================================

  const stream =
    Readable.fromWeb(
      response.body
    );


  const lines =
    readline.createInterface({

      input:
        stream,

      crlfDelay:
        Infinity,

    });


  // ==========================================================
  // COUNTERS
  // ==========================================================

  let linesReceived =
    0;


  let ordersReceived =
    0;


  let ignoredLines =
    0;


  let changed =
    0;


  let skipped =
    0;


  let loaded =
    0;


  let batches =
    0;


  let batch = [];


  // ==========================================================
  // FLUSH
  // ==========================================================

  async function flush() {

    if (
      batch.length === 0
    ) {

      return;

    }


    const currentBatch =
      batch;


    batch = [];


    const warehouse =
      await writeBatch(
        input,
        currentBatch
      );


    changed +=
      Number(
        warehouse.changed
        ||
        0
      );


    skipped +=
      Number(
        warehouse.skipped
        ||
        0
      );


    loaded +=
      Number(
        warehouse.loaded
        ||
        0
      );


    batches +=
      1;

  }


  // ==========================================================
  // STREAM JSONL
  // ==========================================================

  for await (
    const rawLine
    of lines
  ) {

    const line =
      String(
        rawLine
        ||
        ''
      ).trim();


    if (!line) {

      continue;

    }


    linesReceived +=
      1;


    let object;


    try {

      object =
        JSON.parse(
          line
        );

    } catch {

      throw new Error(
        `SHOPIFY_BULK_JSONL_INVALID_LINE_${linesReceived}`
      );

    }


    // ========================================================
    // ORDERS ONLY
    //
    // Future nested-connection exports could contain child
    // lines. They must never enter the Orders writer.
    // ========================================================

    const id =
      String(
        object?.id
        ||
        ''
      );


    if (
      !id.startsWith(
        'gid://shopify/Order/'
      )
    ) {

      ignoredLines +=
        1;

      continue;

    }


    ordersReceived +=
      1;


    batch.push(
      object
    );


    if (
      batch.length >=
        batchSize
    ) {

      await flush();

    }

  }


  // ==========================================================
  // FINAL PARTIAL BATCH
  // ==========================================================

  await flush();


  // ==========================================================
  // ROOT COUNT VALIDATION
  //
  // For our current Orders-only Bulk query every root object
  // must be an Order.
  // ==========================================================

  const expectedRootObjectCount =
    input.expectedRootObjectCount !==
      undefined
    &&
    input.expectedRootObjectCount !==
      null

      ? Number(
          input.expectedRootObjectCount
        )

      : null;


  if (
    expectedRootObjectCount !==
      null
    &&
    expectedRootObjectCount >=
      0
    &&
    ordersReceived !==
      expectedRootObjectCount
  ) {

    throw new Error(
      `SHOPIFY_BULK_ROOT_COUNT_MISMATCH_EXPECTED_${expectedRootObjectCount}_RECEIVED_${ordersReceived}`
    );

  }


  // ==========================================================
  // RESULT
  // ==========================================================

  return {

    linesReceived,

    ordersReceived,

    ignoredLines,

    changed,

    skipped,

    loaded,

    batches,

    batchSize,

  };

}