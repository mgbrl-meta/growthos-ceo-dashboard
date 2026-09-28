import 'server-only';

import {
  emitCanonicalMetaEvent,
} from '../producer';

import type {
  MetaEventsIdentity,
  MetaEventsMetadata,
} from '../types';

type RetentionProducerBase = {
  workspaceId: string;
  brandId: string;

  customerId: string;
  occurredAt: string;

  stateVersion?: string | number | null;

  identity?: MetaEventsIdentity | null;
  metadata?: MetaEventsMetadata | null;
  data?: Record<string, unknown> | null;
};

function emitRetentionEvent(
  sourceEvent: string,
  input: RetentionProducerBase,
  extraData?: Record<string, unknown> | null
) {
  return emitCanonicalMetaEvent({
    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    source:
      'retention',

    sourceEvent,

    sourceEntityId:
      input.customerId,

    occurredAt:
      input.occurredAt,

    idempotencyKey: [
      input.customerId,
      sourceEvent,
      input.stateVersion
      ??
      input.occurredAt,
    ],

    identity: {
      ...(
        input.identity
        ??
        {}
      ),
      externalId:
        input.identity?.externalId
        ??
        input.customerId,
    },

    data: {
      customer_id:
        input.customerId,
      ...(
        input.data
        ??
        {}
      ),
      ...(
        extraData
        ??
        {}
      ),
    },

    metadata: {
      sourceSystem:
        'growthos_retention',
      sourceRecordId:
        input.customerId,
      ...(
        input.metadata
        ??
        {}
      ),
    },
  });
}

export function emitRetentionSegmentEntered(
  input: RetentionProducerBase & {
    segment: string;
  }
) {
  return emitRetentionEvent(
    'retention.segment_entered',
    input,
    {
      segment:
        input.segment,
    }
  );
}

export function emitReplenishmentDue(
  input: RetentionProducerBase & {
    productId?: string | null;
    expectedDueAt?: string | null;
  }
) {
  return emitRetentionEvent(
    'retention.replenishment_due',
    input,
    {
      product_id:
        input.productId
        ??
        null,
      expected_due_at:
        input.expectedDueAt
        ??
        null,
    }
  );
}

export function emitWinbackEligible(
  input: RetentionProducerBase & {
    daysSinceLastPurchase?: number | null;
  }
) {
  return emitRetentionEvent(
    'retention.winback_eligible',
    input,
    {
      days_since_last_purchase:
        input.daysSinceLastPurchase
        ??
        null,
    }
  );
}

export function emitCustomerLapsed(
  input: RetentionProducerBase & {
    daysSinceLastPurchase?: number | null;
  }
) {
  return emitRetentionEvent(
    'retention.lapsed',
    input,
    {
      days_since_last_purchase:
        input.daysSinceLastPurchase
        ??
        null,
    }
  );
}

export function emitCustomerReactivated(
  input: RetentionProducerBase & {
    orderId?: string | null;
  }
) {
  return emitRetentionEvent(
    'retention.reactivated',
    input,
    {
      order_id:
        input.orderId
        ??
        null,
    }
  );
}
