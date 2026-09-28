import 'server-only';

import {
  buildMetaSourceEventId,
  emitMetaSourceEvent,
} from './publisher';

import type {
  MetaEventKey,
} from './catalogue';

import type {
  MetaEventsAttribution,
  MetaEventsCommerce,
  MetaEventsContext,
  MetaEventsIdentity,
  MetaEventsMetadata,
  MetaEventsSource,
} from './types';

const META_EVENTS_PRODUCER_VERSION =
  'phase4-v1';

export type CanonicalMetaEventInput = {
  workspaceId: string;
  brandId: string;

  source: MetaEventsSource;
  sourceEvent: MetaEventKey | string;

  eventVersion?: number;

  sourceEntityId?: string | null;

  occurredAt: string;

  sourceEventId?: string | null;

  idempotencyKey?: Array<
    string | number | null | undefined
  >;

  identity?: MetaEventsIdentity | null;
  context?: MetaEventsContext | null;
  attribution?: MetaEventsAttribution | null;
  commerce?: MetaEventsCommerce | null;
  data?: Record<string, unknown> | null;
  metadata?: MetaEventsMetadata | null;
};

function requireString(
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

function normalizeOccurredAt(
  value: string
) {
  const timestamp =
    Date.parse(
      value
    );

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    throw new Error(
      'META_EVENTS_OCCURRED_AT_INVALID'
    );
  }

  return new Date(
    timestamp
  ).toISOString();
}

function validateSourceEventPair(
  source: string,
  sourceEvent: string
) {
  const prefix =
    String(
      sourceEvent
      .split('.')[0]
      ??
      ''
    ).trim();

  if (
    prefix
    &&
    prefix !== source
  ) {
    throw new Error(
      `META_EVENTS_SOURCE_EVENT_MISMATCH:${source}:${sourceEvent}`
    );
  }
}

export async function emitCanonicalMetaEvent(
  input: CanonicalMetaEventInput
) {
  const workspaceId =
    requireString(
      input.workspaceId,
      'META_EVENTS_WORKSPACE_MISSING'
    );

  const brandId =
    requireString(
      input.brandId,
      'META_EVENTS_BRAND_MISSING'
    );

  const source =
    requireString(
      input.source,
      'META_EVENTS_SOURCE_MISSING'
    );

  const sourceEvent =
    requireString(
      input.sourceEvent,
      'META_EVENTS_SOURCE_EVENT_MISSING'
    );

  validateSourceEventPair(
    source,
    sourceEvent
  );

  const occurredAt =
    normalizeOccurredAt(
      input.occurredAt
    );

  const explicitSourceEventId =
    String(
      input.sourceEventId
      ??
      ''
    ).trim();

  const idempotencyParts =
    input.idempotencyKey
    ??
    [];

  if (
    !explicitSourceEventId
    &&
    idempotencyParts.length === 0
  ) {
    throw new Error(
      'META_EVENTS_IDEMPOTENCY_KEY_MISSING'
    );
  }

  const sourceEventId =
    explicitSourceEventId
    ||
    buildMetaSourceEventId(
      'meevt',
      [
        workspaceId,
        brandId,
        sourceEvent,
        ...idempotencyParts,
      ]
    );

  return emitMetaSourceEvent({
    eventVersion:
      Number(
        input.eventVersion
        ??
        1
      ),

    sourceEventId,

    workspaceId,
    brandId,

    source,
    sourceEvent,

    sourceEntityId:
      input.sourceEntityId
      ??
      null,

    occurredAt,

    identity:
      input.identity
      ??
      null,

    context:
      input.context
      ??
      null,

    attribution:
      input.attribution
      ??
      null,

    commerce:
      input.commerce
      ??
      null,

    data:
      input.data
      ??
      null,

    metadata: {
      producer:
        'growthos_meta_events_sdk',

      producerVersion:
        META_EVENTS_PRODUCER_VERSION,

      observedAt:
        new Date().toISOString(),

      ...(
        input.metadata
        ??
        {}
      ),
    },
  });
}
