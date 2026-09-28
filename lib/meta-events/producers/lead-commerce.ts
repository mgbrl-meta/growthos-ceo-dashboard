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

type LeadCommerceProducerBase = {
  workspaceId: string;
  brandId: string;

  leadId: string;
  occurredAt: string;

  eventInstanceId?: string | null;

  identity?: MetaEventsIdentity | null;
  context?: MetaEventsContext | null;
  attribution?: MetaEventsAttribution | null;
  commerce?: MetaEventsCommerce | null;
  metadata?: MetaEventsMetadata | null;
  data?: Record<string, unknown> | null;
};

function emitLeadCommerceEvent(
  sourceEvent: string,
  input: LeadCommerceProducerBase,
  extraData?: Record<string, unknown> | null
) {
  return emitCanonicalMetaEvent({
    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    source:
      'lead_commerce',

    sourceEvent,

    sourceEntityId:
      input.leadId,

    occurredAt:
      input.occurredAt,

    idempotencyKey: [
      input.leadId,
      sourceEvent,
      input.eventInstanceId
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
        input.leadId,
    },

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

    data: {
      lead_id:
        input.leadId,
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
        'growthos_lead_commerce',
      sourceRecordId:
        input.eventInstanceId
        ??
        input.leadId,
      ...(
        input.metadata
        ??
        {}
      ),
    },
  });
}

export function emitLeadCreated(
  input: LeadCommerceProducerBase
) {
  return emitLeadCommerceEvent(
    'lead_commerce.lead_created',
    input
  );
}

export function emitLeadQualified(
  input: LeadCommerceProducerBase
) {
  return emitLeadCommerceEvent(
    'lead_commerce.qualified',
    input
  );
}

export function emitLeadUnqualified(
  input: LeadCommerceProducerBase & {
    reason?: string | null;
  }
) {
  return emitLeadCommerceEvent(
    'lead_commerce.unqualified',
    input,
    {
      reason:
        input.reason
        ??
        null,
    }
  );
}

export function emitConsultationBooked(
  input: LeadCommerceProducerBase & {
    consultationId: string;
    consultationAt?: string | null;
  }
) {
  return emitLeadCommerceEvent(
    'lead_commerce.consultation_booked',
    {
      ...input,
      eventInstanceId:
        input.eventInstanceId
        ??
        input.consultationId,
    },
    {
      consultation_id:
        input.consultationId,
      consultation_at:
        input.consultationAt
        ??
        null,
    }
  );
}

export function emitConsultationCompleted(
  input: LeadCommerceProducerBase & {
    consultationId: string;
    consultant?: string | null;
  }
) {
  return emitLeadCommerceEvent(
    'lead_commerce.consultation_completed',
    {
      ...input,
      eventInstanceId:
        input.eventInstanceId
        ??
        input.consultationId,
    },
    {
      consultation_id:
        input.consultationId,
      consultant:
        input.consultant
        ??
        null,
    }
  );
}

export function emitConsultationNoShow(
  input: LeadCommerceProducerBase & {
    consultationId: string;
  }
) {
  return emitLeadCommerceEvent(
    'lead_commerce.consultation_no_show',
    {
      ...input,
      eventInstanceId:
        input.eventInstanceId
        ??
        input.consultationId,
    },
    {
      consultation_id:
        input.consultationId,
    }
  );
}

export function emitConsultationCancelled(
  input: LeadCommerceProducerBase & {
    consultationId: string;
    reason?: string | null;
  }
) {
  return emitLeadCommerceEvent(
    'lead_commerce.consultation_cancelled',
    {
      ...input,
      eventInstanceId:
        input.eventInstanceId
        ??
        input.consultationId,
    },
    {
      consultation_id:
        input.consultationId,
      reason:
        input.reason
        ??
        null,
    }
  );
}

export function emitLeadPurchased(
  input: LeadCommerceProducerBase & {
    orderId: string;
  }
) {
  return emitLeadCommerceEvent(
    'lead_commerce.purchased',
    {
      ...input,
      eventInstanceId:
        input.eventInstanceId
        ??
        input.orderId,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        orderId:
          input.orderId,
      },
    },
    {
      order_id:
        input.orderId,
    }
  );
}
