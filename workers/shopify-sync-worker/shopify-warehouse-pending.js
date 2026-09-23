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

const TABLE_ID =
  String(
    process.env.GROWTHOS_SHOPIFY_PENDING_TABLE
    ||
    'shopify_warehouse_pending'
  ).trim();


if (!PROJECT_ID) {

  throw new Error(
    'SHOPIFY_PENDING_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({
    projectId:
      PROJECT_ID,
  });


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


function recordIdFromPayload(
  payload
) {

  return requireString(
    payload?.id,
    'SHOPIFY_PENDING_RECORD_ID_MISSING'
  );

}


function sourceUpdatedAt(
  payload
) {

  const raw =
    payload?.updatedAt
    ??
    payload?.createdAt
    ??
    null;


  if (!raw) {

    return null;

  }


  const parsed =
    Date.parse(
      String(
        raw
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


// ============================================================
// REALTIME / INCREMENTAL LANDING
//
// This path deliberately performs no BigQuery query/DML scan.
// It only appends rows through the BigQuery insert API.
//
// Canonical RAW + STATE/CURRENT are consolidated later by the
// warehouse refresh supervisor according to the brand policy.
// ============================================================

export async function enqueueShopifyWarehouseRecords(
  input
) {

  const workspaceId =
    requireString(
      input?.workspaceId,
      'SHOPIFY_PENDING_WORKSPACE_MISSING'
    );

  const brandId =
    requireString(
      input?.brandId,
      'SHOPIFY_PENDING_BRAND_MISSING'
    );

  const integrationAccountId =
    requireString(
      input?.integrationAccountId,
      'SHOPIFY_PENDING_ACCOUNT_MISSING'
    );

  const entity =
    requireString(
      input?.entity,
      'SHOPIFY_PENDING_ENTITY_MISSING'
    );

  const records =
    Array.isArray(
      input?.records
    )
      ? input.records
      : [];


  if (
    ![
      'orders',
      'customers',
      'products',
    ].includes(
      entity
    )
  ) {

    throw new Error(
      'SHOPIFY_PENDING_ENTITY_UNSUPPORTED'
    );

  }


  if (
    records.length ===
    0
  ) {

    return {
      queued:
        0,
    };

  }


  const now =
    new Date()
      .toISOString();


  const rows =
    records.map(
      record => {

        const recordId =
          recordIdFromPayload(
            record
          );


        return {

          pending_id:
            crypto.randomUUID(),

          workspace_id:
            workspaceId,

          brand_id:
            brandId,

          integration_account_id:
            integrationAccountId,

          entity,

          record_id:
            recordId,

          payload:
            JSON.stringify(
              record
            ),

          source_updated_at:
            sourceUpdatedAt(
              record
            ),

          queued_at:
            now,

          processed_at:
            null,

          refresh_batch_id:
            null,

        };

      }
    );


  // Keep append requests bounded.
  const chunkSize =
    250;


  for (
    let offset = 0;
    offset < rows.length;
    offset +=
      chunkSize
  ) {

    const chunk =
      rows.slice(
        offset,
        offset
        +
        chunkSize
      );


    await bigquery
      .dataset(
        DATASET_ID
      )
      .table(
        TABLE_ID
      )
      .insert(
        chunk,
        {
          raw:
            false,
        }
      );

  }


  return {
    queued:
      rows.length,
  };

}
