import 'server-only';

import crypto from 'crypto';

import {
  getShopifySyncTopicName,
  publishJsonMessage,
} from '@/lib/queue/pubsub';


// ============================================================
// TYPES
// ============================================================

export type ShopifySyncEntity =
  | 'orders'
  | 'customers'
  | 'products'
  | 'order_transactions';


export type ShopifySyncType =
  | 'manual'
  | 'backfill'
  | 'incremental'
  | 'reconciliation';


export type ShopifySyncJob = {

  schemaVersion:
    1;

  eventType:
    'shopify.sync.requested';

  jobId:
    string;

  provider:
    'shopify';

  workspaceId:
    string;

  brandId:
    string;

  connectionId:
    string;

  integrationAccountId:
    string;

  providerAccountId:
    string;

  entity:
    ShopifySyncEntity;

  syncType:
    ShopifySyncType;

  requestedAt:
    string;

  requestedBy:
    string | null;

  window: {

    from:
      string | null;

    to:
      string | null;

  };

  cursor:
    string | null;


  // ==========================================================
  // BACKFILL IDENTITY
  //
  // Present only for historical backfill window jobs.
  // ==========================================================

  backfillRunId:
    string | null;

  backfillWindowId:
    string | null;

};


export type ShopifyQueueTestJob = {

  schemaVersion:
    1;

  eventType:
    'shopify.queue.test';

  jobId:
    string;

  provider:
    'shopify';

  workspaceId:
    string;

  brandId:
    string;

  connectionId:
    string;

  integrationAccountId:
    string;

  providerAccountId:
    string;

  requestedAt:
    string;

};


// ============================================================
// REQUIRED
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
// PUBLISH SYNC JOB
// ============================================================

export async function publishShopifySyncJob(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    connectionId:
      string;

    integrationAccountId:
      string;

    providerAccountId:
      string;

    entity:
      ShopifySyncEntity;

    syncType:
      ShopifySyncType;

    requestedBy?:
      string | null;

    from?:
      string | null;

    to?:
      string | null;

    cursor?:
      string | null;

    backfillRunId?:
      string | null;

    backfillWindowId?:
      string | null;

  }
) {

  const job:
    ShopifySyncJob = {

    schemaVersion:
      1,

    eventType:
      'shopify.sync.requested',

    jobId:
      crypto.randomUUID(),

    provider:
      'shopify',

    workspaceId:
      requireValue(
        input.workspaceId,
        'SHOPIFY_JOB_WORKSPACE_MISSING'
      ),

    brandId:
      requireValue(
        input.brandId,
        'SHOPIFY_JOB_BRAND_MISSING'
      ),

    connectionId:
      requireValue(
        input.connectionId,
        'SHOPIFY_JOB_CONNECTION_MISSING'
      ),

    integrationAccountId:
      requireValue(
        input.integrationAccountId,
        'SHOPIFY_JOB_ACCOUNT_MISSING'
      ),

    providerAccountId:
      requireValue(
        input.providerAccountId,
        'SHOPIFY_JOB_PROVIDER_ACCOUNT_MISSING'
      ),

    entity:
      input.entity,

    syncType:
      input.syncType,

    requestedAt:
      new Date()
        .toISOString(),

    requestedBy:
      input.requestedBy
      ??
      null,

    window: {

      from:
        input.from
        ??
        null,

      to:
        input.to
        ??
        null,

    },

    cursor:
      input.cursor
      ??
      null,

    backfillRunId:
      input.backfillRunId
      ??
      null,

    backfillWindowId:
      input.backfillWindowId
      ??
      null,

  };


  if (
    job.syncType ===
      'backfill'
  ) {

    if (
      !job.window.from
      ||
      !job.window.to
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_WINDOW_MISSING'
      );

    }


    if (
      !job.backfillRunId
      ||
      !job.backfillWindowId
    ) {

      throw new Error(
        'SHOPIFY_BACKFILL_IDENTITY_MISSING'
      );

    }

  }


  const published =
    await publishJsonMessage({

      topic:
        getShopifySyncTopicName(),

      payload:
        job,

      attributes: {

        schemaVersion:
          '1',

        provider:
          'shopify',

        eventType:
          job.eventType,

        workspaceId:
          job.workspaceId,

        brandId:
          job.brandId,

        entity:
          job.entity,

        syncType:
          job.syncType,

      },

    });


  return {

    ...published,

    job,

  };

}


// ============================================================
// QUEUE TEST
// ============================================================

export async function publishShopifyQueueTest(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    connectionId:
      string;

    integrationAccountId:
      string;

    providerAccountId:
      string;

  }
) {

  const job:
    ShopifyQueueTestJob = {

    schemaVersion:
      1,

    eventType:
      'shopify.queue.test',

    jobId:
      crypto.randomUUID(),

    provider:
      'shopify',

    workspaceId:
      requireValue(
        input.workspaceId,
        'SHOPIFY_JOB_WORKSPACE_MISSING'
      ),

    brandId:
      requireValue(
        input.brandId,
        'SHOPIFY_JOB_BRAND_MISSING'
      ),

    connectionId:
      requireValue(
        input.connectionId,
        'SHOPIFY_JOB_CONNECTION_MISSING'
      ),

    integrationAccountId:
      requireValue(
        input.integrationAccountId,
        'SHOPIFY_JOB_ACCOUNT_MISSING'
      ),

    providerAccountId:
      requireValue(
        input.providerAccountId,
        'SHOPIFY_JOB_PROVIDER_ACCOUNT_MISSING'
      ),

    requestedAt:
      new Date()
        .toISOString(),

  };


  const published =
    await publishJsonMessage({

      topic:
        getShopifySyncTopicName(),

      payload:
        job,

      attributes: {

        schemaVersion:
          '1',

        provider:
          'shopify',

        eventType:
          job.eventType,

        workspaceId:
          job.workspaceId,

        brandId:
          job.brandId,

      },

    });


  return {

    ...published,

    jobId:
      job.jobId,

  };

}