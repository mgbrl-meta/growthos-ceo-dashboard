import 'server-only';

import {
  emitCanonicalMetaEvent,
} from '../producer';

import type {
  MetaEventsCommerce,
  MetaEventsIdentity,
  MetaEventsMetadata,
} from '../types';

type CallCommerceBase = {
  workspaceId: string;
  brandId: string;

  leadId: string;
  callId: string;
  occurredAt: string;

  businessNumber?: string | null;
  providerCallId?: string | null;

  identity?: MetaEventsIdentity | null;
  commerce?: MetaEventsCommerce | null;
  metadata?: MetaEventsMetadata | null;
  data?: Record<string, unknown> | null;
};

function emitCallCommerceEvent(
  sourceEvent: string,
  input: CallCommerceBase,
  extraData?: Record<string, unknown> | null
) {
  return emitCanonicalMetaEvent({
    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    source:
      'call_commerce',

    sourceEvent,

    sourceEntityId:
      input.leadId,

    occurredAt:
      input.occurredAt,

    idempotencyKey: [
      input.leadId,
      input.callId,
      sourceEvent,
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
        input.leadId,
    },

    commerce:
      input.commerce
      ??
      null,

    data: {
      lead_id:
        input.leadId,
      call_id:
        input.callId,
      business_number:
        input.businessNumber
        ??
        null,
      provider_call_id:
        input.providerCallId
        ??
        null,
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
        'growthos_call_commerce',
      sourceRecordId:
        input.providerCallId
        ??
        input.callId,
      ...(
        input.metadata
        ??
        {}
      ),
    },
  });
}

export function emitCallCommerceConnected(
  input: CallCommerceBase & {
    businessNumber: string;
    durationSeconds?: number | null;
  }
) {
  return emitCallCommerceEvent(
    'call_commerce.connected',
    input,
    {
      duration_seconds:
        input.durationSeconds
        ??
        null,
    }
  );
}

export function emitCallCommerceQualified(
  input: CallCommerceBase
) {
  return emitCallCommerceEvent(
    'call_commerce.qualified',
    input
  );
}

export function emitCallCommerceUnqualified(
  input: CallCommerceBase & {
    reason?: string | null;
  }
) {
  return emitCallCommerceEvent(
    'call_commerce.unqualified',
    input,
    {
      reason:
        input.reason
        ??
        null,
    }
  );
}

export function emitCallCommercePurchased(
  input: CallCommerceBase & {
    orderId?: string | null;
    amount?: number | null;
    currency?: string | null;
  }
) {
  return emitCallCommerceEvent(
    'call_commerce.purchased',
    {
      ...input,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        orderId:
          input.orderId
          ??
          input.commerce?.orderId
          ??
          null,
        value:
          input.amount
          ??
          input.commerce?.value
          ??
          null,
        currency:
          input.currency
          ??
          input.commerce?.currency
          ??
          null,
      },
    },
    {
      order_id:
        input.orderId
        ??
        null,
      amount:
        input.amount
        ??
        null,
      currency:
        input.currency
        ??
        null,
    }
  );
}
