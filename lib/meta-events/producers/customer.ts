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

type CustomerProducerBase = {
  workspaceId: string;
  brandId: string;

  customerId: string;
  occurredAt: string;

  orderId?: string | null;

  identity?: MetaEventsIdentity | null;
  context?: MetaEventsContext | null;
  attribution?: MetaEventsAttribution | null;
  commerce?: MetaEventsCommerce | null;
  metadata?: MetaEventsMetadata | null;
  data?: Record<string, unknown> | null;
};

function emitCustomerEvent(
  sourceEvent: string,
  input: CustomerProducerBase,
  extraData?: Record<string, unknown> | null
) {
  return emitCanonicalMetaEvent({
    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    source:
      'customer',

    sourceEvent,

    sourceEntityId:
      input.customerId,

    occurredAt:
      input.occurredAt,

    idempotencyKey: [
      input.customerId,
      input.orderId
      ??
      '',
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
        input.customerId,
    },

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
      customerId:
        input.customerId,
      orderId:
        input.orderId
        ??
        input.commerce?.orderId
        ??
        null,
    },

    data: {
      customer_id:
        input.customerId,
      order_id:
        input.orderId
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
        'growthos_customer_intelligence',
      sourceRecordId:
        input.orderId
        ??
        input.customerId,
      ...(
        input.metadata
        ??
        {}
      ),
    },
  });
}

export function emitCustomerCreated(
  input: CustomerProducerBase
) {
  return emitCustomerEvent(
    'customer.created',
    input
  );
}

export function emitNewCustomerPurchase(
  input: CustomerProducerBase & {
    orderId: string;
  }
) {
  return emitCustomerEvent(
    'customer.new_customer_purchase',
    input,
    {
      purchase_number:
        1,
      customer_type:
        'new',
    }
  );
}

export function emitExistingCustomerPurchase(
  input: CustomerProducerBase & {
    orderId: string;
    purchaseNumber?: number | null;
  }
) {
  return emitCustomerEvent(
    'customer.existing_customer_purchase',
    input,
    {
      purchase_number:
        input.purchaseNumber
        ??
        null,
      customer_type:
        'existing',
    }
  );
}

export function emitSecondPurchase(
  input: CustomerProducerBase & {
    orderId: string;
  }
) {
  return emitCustomerEvent(
    'customer.second_purchase',
    input,
    {
      purchase_number:
        2,
    }
  );
}

export function emitRepeatPurchase(
  input: CustomerProducerBase & {
    orderId: string;
    purchaseNumber?: number | null;
  }
) {
  return emitCustomerEvent(
    'customer.repeat_purchase',
    input,
    {
      purchase_number:
        input.purchaseNumber
        ??
        null,
    }
  );
}

export function emitHighValuePurchase(
  input: CustomerProducerBase & {
    orderId: string;
    threshold?: number | null;
  }
) {
  return emitCustomerEvent(
    'customer.high_value_purchase',
    input,
    {
      high_value_threshold:
        input.threshold
        ??
        null,
    }
  );
}

export function emitReactivatedPurchase(
  input: CustomerProducerBase & {
    orderId: string;
    daysSincePreviousPurchase?: number | null;
  }
) {
  return emitCustomerEvent(
    'customer.reactivated_purchase',
    input,
    {
      days_since_previous_purchase:
        input.daysSincePreviousPurchase
        ??
        null,
    }
  );
}
