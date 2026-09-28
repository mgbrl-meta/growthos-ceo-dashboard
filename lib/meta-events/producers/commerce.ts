import 'server-only';

import {
  emitCanonicalMetaEvent,
} from '../producer';

import type {
  MetaEventsAttribution,
  MetaEventsCommerce,
  MetaEventsContext,
  MetaEventsIdentity,
  MetaEventsMetadata,
} from '../types';

type CommerceProducerBase = {
  workspaceId: string;
  brandId: string;

  orderId: string;
  occurredAt: string;

  transitionId?: string | null;

  customerId?: string | null;
  orderName?: string | null;

  identity?: MetaEventsIdentity | null;
  context?: MetaEventsContext | null;
  attribution?: MetaEventsAttribution | null;
  commerce?: MetaEventsCommerce | null;
  metadata?: MetaEventsMetadata | null;

  data?: Record<string, unknown> | null;
};

function emitCommerceEvent(
  sourceEvent: string,
  input: CommerceProducerBase,
  extraData?: Record<string, unknown> | null
) {
  const transitionId =
    input.transitionId
    ??
    input.occurredAt;

  return emitCanonicalMetaEvent({
    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    source:
      'commerce',

    sourceEvent,

    sourceEntityId:
      input.orderId,

    occurredAt:
      input.occurredAt,

    idempotencyKey: [
      input.orderId,
      sourceEvent,
      transitionId,
    ],

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

    commerce: {
      ...(
        input.commerce
        ??
        {}
      ),
      orderId:
        input.orderId,
      orderName:
        input.orderName
        ??
        input.commerce?.orderName
        ??
        null,
      customerId:
        input.customerId
        ??
        input.commerce?.customerId
        ??
        null,
    },

    data: {
      order_id:
        input.orderId,
      order_name:
        input.orderName
        ??
        null,
      customer_id:
        input.customerId
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
        'growthos_commerce',
      sourceRecordId:
        input.orderId,
      ...(
        input.metadata
        ??
        {}
      ),
    },
  });
}

export function emitCommerceOrderCreated(
  input: CommerceProducerBase
) {
  return emitCommerceEvent(
    'commerce.order_created',
    input
  );
}

export function emitCommerceOrderConfirmed(
  input: CommerceProducerBase
) {
  return emitCommerceEvent(
    'commerce.order_confirmed',
    input
  );
}

export function emitCommerceOrderPaid(
  input: CommerceProducerBase & {
    paymentGateway?: string | null;
    financialStatus?: string | null;
  }
) {
  return emitCommerceEvent(
    'commerce.order_paid',
    input,
    {
      payment_gateway:
        input.paymentGateway
        ??
        null,
      financial_status:
        input.financialStatus
        ??
        'paid',
    }
  );
}

export function emitCommerceOrderCancelled(
  input: CommerceProducerBase & {
    cancelReason?: string | null;
  }
) {
  return emitCommerceEvent(
    'commerce.order_cancelled',
    input,
    {
      cancel_reason:
        input.cancelReason
        ??
        null,
    }
  );
}

export function emitCommerceOrderPartiallyRefunded(
  input: CommerceProducerBase & {
    refundId?: string | null;
    refundAmount?: number | null;
  }
) {
  return emitCommerceEvent(
    'commerce.order_partially_refunded',
    {
      ...input,
      transitionId:
        input.transitionId
        ??
        input.refundId
        ??
        input.occurredAt,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        refundTotal:
          input.refundAmount
          ??
          input.commerce?.refundTotal
          ??
          null,
      },
    },
    {
      refund_id:
        input.refundId
        ??
        null,
      refund_amount:
        input.refundAmount
        ??
        null,
    }
  );
}

export function emitCommerceOrderRefunded(
  input: CommerceProducerBase & {
    refundId?: string | null;
    refundAmount?: number | null;
  }
) {
  return emitCommerceEvent(
    'commerce.order_refunded',
    {
      ...input,
      transitionId:
        input.transitionId
        ??
        input.refundId
        ??
        input.occurredAt,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        refundTotal:
          input.refundAmount
          ??
          input.commerce?.refundTotal
          ??
          null,
      },
    },
    {
      refund_id:
        input.refundId
        ??
        null,
      refund_amount:
        input.refundAmount
        ??
        null,
    }
  );
}

export function emitCommerceOrderPartiallyFulfilled(
  input: CommerceProducerBase & {
    fulfillmentId?: string | null;
  }
) {
  return emitCommerceEvent(
    'commerce.order_partially_fulfilled',
    {
      ...input,
      transitionId:
        input.transitionId
        ??
        input.fulfillmentId
        ??
        input.occurredAt,
    },
    {
      fulfillment_id:
        input.fulfillmentId
        ??
        null,
    }
  );
}

export function emitCommerceOrderFulfilled(
  input: CommerceProducerBase & {
    fulfillmentId?: string | null;
  }
) {
  return emitCommerceEvent(
    'commerce.order_fulfilled',
    {
      ...input,
      transitionId:
        input.transitionId
        ??
        input.fulfillmentId
        ??
        input.occurredAt,
    },
    {
      fulfillment_id:
        input.fulfillmentId
        ??
        null,
    }
  );
}

export function emitCommerceOrderReturned(
  input: CommerceProducerBase & {
    returnId?: string | null;
    returnReason?: string | null;
  }
) {
  return emitCommerceEvent(
    'commerce.order_returned',
    {
      ...input,
      transitionId:
        input.transitionId
        ??
        input.returnId
        ??
        input.occurredAt,
    },
    {
      return_id:
        input.returnId
        ??
        null,
      return_reason:
        input.returnReason
        ??
        null,
    }
  );
}
