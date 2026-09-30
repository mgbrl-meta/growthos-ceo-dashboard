import crypto from 'crypto';

import {
  PubSub,
} from '@google-cloud/pubsub';


const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.GOOGLE_CLOUD_PROJECT
    ||
    ''
  ).trim();


const META_EVENTS_TOPIC =
  String(
    process.env.GROWTHOS_META_EVENTS_TOPIC
    ||
    process.env.META_EVENTS_TOPIC
    ||
    'growthos-meta-events'
  ).trim();


if (!PROJECT_ID) {
  throw new Error(
    'SHOPIFY_META_EVENTS_PROJECT_MISSING'
  );
}


if (!META_EVENTS_TOPIC) {
  throw new Error(
    'SHOPIFY_META_EVENTS_TOPIC_MISSING'
  );
}


const pubsub =
  new PubSub({
    projectId:
      PROJECT_ID,
  });


function requiredString(
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


function normalizeOccurredAt(
  value
) {
  const raw =
    requiredString(
      value,
      'SHOPIFY_META_EVENTS_OCCURRED_AT_MISSING'
    );

  const timestamp =
    Date.parse(
      raw
    );

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    throw new Error(
      'SHOPIFY_META_EVENTS_OCCURRED_AT_INVALID'
    );
  }

  return new Date(
    timestamp
  ).toISOString();
}


export function buildCanonicalSourceEventId(
  input
) {
  const workspaceId =
    requiredString(
      input?.workspaceId,
      'SHOPIFY_META_EVENTS_WORKSPACE_MISSING'
    );

  const brandId =
    requiredString(
      input?.brandId,
      'SHOPIFY_META_EVENTS_BRAND_MISSING'
    );

  const sourceEvent =
    requiredString(
      input?.sourceEvent,
      'SHOPIFY_META_EVENTS_SOURCE_EVENT_MISSING'
    );

  const idempotencyKey =
    Array.isArray(
      input?.idempotencyKey
    )
      ? input.idempotencyKey
      : [];

  if (
    idempotencyKey.length ===
      0
  ) {
    throw new Error(
      'SHOPIFY_META_EVENTS_IDEMPOTENCY_KEY_MISSING'
    );
  }

  return `meevt_${crypto
    .createHash('sha256')
    .update(
      [
        workspaceId,
        brandId,
        sourceEvent,
        ...idempotencyKey,
      ]
        .map(
          value =>
            String(
              value
              ??
              ''
            )
        )
        .join(':')
    )
    .digest('hex')
    .slice(0, 32)}`;
}


export async function publishCanonicalMetaEvent(
  input
) {
  const workspaceId =
    requiredString(
      input?.workspaceId,
      'SHOPIFY_META_EVENTS_WORKSPACE_MISSING'
    );

  const brandId =
    requiredString(
      input?.brandId,
      'SHOPIFY_META_EVENTS_BRAND_MISSING'
    );

  const source =
    requiredString(
      input?.source,
      'SHOPIFY_META_EVENTS_SOURCE_MISSING'
    );

  const sourceEvent =
    requiredString(
      input?.sourceEvent,
      'SHOPIFY_META_EVENTS_SOURCE_EVENT_MISSING'
    );

  const sourcePrefix =
    String(
      sourceEvent
        .split('.')[0]
      ??
      ''
    ).trim();

  if (
    sourcePrefix
    &&
    sourcePrefix !==
      source
  ) {
    throw new Error(
      `SHOPIFY_META_EVENTS_SOURCE_EVENT_MISMATCH:${source}:${sourceEvent}`
    );
  }

  const eventVersion =
    Number(
      input?.eventVersion
      ??
      1
    );

  if (
    !Number.isInteger(
      eventVersion
    )
    ||
    eventVersion <
      1
  ) {
    throw new Error(
      'SHOPIFY_META_EVENTS_EVENT_VERSION_INVALID'
    );
  }

  const occurredAt =
    normalizeOccurredAt(
      input?.occurredAt
    );

  const explicitSourceEventId =
    String(
      input?.sourceEventId
      ??
      ''
    ).trim();

  const sourceEventId =
    explicitSourceEventId
    ||
    buildCanonicalSourceEventId({
      workspaceId,
      brandId,
      sourceEvent,
      idempotencyKey:
        input?.idempotencyKey,
    });

  const payload = {
    version:
      1,

    jobType:
      'source_event',

    eventVersion,

    sourceEventId,

    workspaceId,
    brandId,

    source,
    sourceEvent,

    sourceEntityId:
      input?.sourceEntityId
      ??
      null,

    occurredAt,

    identity:
      input?.identity
      ??
      null,

    context:
      input?.context
      ??
      null,

    attribution:
      input?.attribution
      ??
      null,

    commerce:
      input?.commerce
      ??
      null,

    data:
      input?.data
      ??
      null,

    metadata: {
      producer:
        'shopify_meta_events_adapter',

      producerVersion:
        'phase5-v1',

      observedAt:
        new Date()
          .toISOString(),

      ...(
        input?.metadata
        ??
        {}
      ),
    },
  };

  const data =
    Buffer.from(
      JSON.stringify(
        payload
      )
    );

  const messageId =
    await pubsub
      .topic(
        META_EVENTS_TOPIC
      )
      .publishMessage({
        data,

        attributes: {
          job_type:
            'source_event',

          event_version:
            String(
              eventVersion
            ),

          workspace_id:
            workspaceId,

          brand_id:
            brandId,

          source,

          source_event:
            sourceEvent,

          source_event_id:
            sourceEventId,
        },
      });

  return {
    messageId,
    sourceEventId,
    sourceEvent,
    source,
  };
}
