import {
  publishCanonicalMetaEvent,
} from './meta-events-publisher.js';


const PAID_FINANCIAL_STATUSES =
  new Set([
    'PAID',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
  ]);


function objectOrNull(
  value
) {
  return (
    value
    &&
    typeof value ===
      'object'
    &&
    !Array.isArray(
      value
    )
  )
    ? value
    : null;
}


function stringOrNull(
  value
) {
  const normalized =
    String(
      value
      ??
      ''
    ).trim();

  return normalized
    ||
    null;
}


function numberOrNull(
  value
) {
  if (
    value ===
      null
    ||
    value ===
      undefined
    ||
    value ===
      ''
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function integerOrNull(
  value
) {
  const parsed =
    numberOrNull(
      value
    );

  if (
    parsed ===
      null
  ) {
    return null;
  }

  const integer =
    Math.trunc(
      parsed
    );

  return integer >=
    0
    ? integer
    : null;
}


function timestampOrNull(
  value
) {
  const raw =
    stringOrNull(
      value
    );

  if (!raw) {
    return null;
  }

  const parsed =
    Date.parse(
      raw
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


function firstValue(
  ...values
) {
  for (
    const value
    of values
  ) {
    if (
      value !==
        null
      &&
      value !==
        undefined
      &&
      value !==
        ''
    ) {
      return value;
    }
  }

  return null;
}


function moneyAmount(
  value
) {
  const source =
    objectOrNull(
      value
    );

  return numberOrNull(
    firstValue(
      source?.shopMoney?.amount,
      source?.presentmentMoney?.amount,
      source?.amount,
      value
    )
  );
}


function moneyCurrency(
  value
) {
  const source =
    objectOrNull(
      value
    );

  return stringOrNull(
    firstValue(
      source?.shopMoney?.currencyCode,
      source?.presentmentMoney?.currencyCode,
      source?.currencyCode
    )
  );
}


function normalizeFinancialStatus(
  order
) {
  return String(
    order?.displayFinancialStatus
    ??
    order?.financialStatus
    ??
    ''
  )
    .trim()
    .toUpperCase();
}


function normalizeFulfillmentStatus(
  order
) {
  return String(
    order?.displayFulfillmentStatus
    ??
    order?.fulfillmentStatus
    ??
    ''
  )
    .trim()
    .toUpperCase();
}


function isPaidOrder(
  order
) {
  return PAID_FINANCIAL_STATUSES
    .has(
      normalizeFinancialStatus(
        order
      )
    );
}


function getOrderCustomer(
  order,
  customer
) {
  return (
    objectOrNull(
      customer
    )
    ||
    objectOrNull(
      order?.customer
    )
    ||
    null
  );
}


function getCustomerId(
  order,
  customer
) {
  const resolved =
    getOrderCustomer(
      order,
      customer
    );

  return stringOrNull(
    firstValue(
      resolved?.id,
      order?.customerId
    )
  );
}


function getCustomerPurchaseNumber(
  order,
  customer
) {
  const resolved =
    getOrderCustomer(
      order,
      customer
    );

  return integerOrNull(
    firstValue(
      resolved?.numberOfOrders,
      resolved?.ordersCount,
      order?.customer?.numberOfOrders,
      order?.customer?.ordersCount
    )
  );
}


function getEmail(
  order,
  customer
) {
  const resolved =
    getOrderCustomer(
      order,
      customer
    );

  return stringOrNull(
    firstValue(
      order?.email,
      order?.contactEmail,
      resolved?.defaultEmailAddress?.emailAddress,
      resolved?.email,
      order?.billingAddress?.email,
      order?.shippingAddress?.email
    )
  );
}


function getPhone(
  order,
  customer
) {
  const resolved =
    getOrderCustomer(
      order,
      customer
    );

  return stringOrNull(
    firstValue(
      order?.phone,
      resolved?.defaultPhoneNumber?.phoneNumber,
      resolved?.phone,
      order?.billingAddress?.phone,
      order?.shippingAddress?.phone
    )
  );
}


function lineItemArray(
  input,
  order
) {
  const candidates = [
    input,
    input?.nodes,
    input?.items,
    input?.lineItems,
    order?.lineItems,
    order?.lineItems?.nodes,
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      return candidate;
    }
  }

  return [];
}


function getLineItemUnitPrice(
  line
) {
  return firstValue(
    moneyAmount(
      line?.discountedUnitPriceAfterAllDiscountsSet
    ),
    moneyAmount(
      line?.discountedUnitPriceSet
    ),
    moneyAmount(
      line?.originalUnitPriceSet
    ),
    numberOrNull(
      line?.price
    )
  );
}


function getLineItemValue(
  line,
  quantity,
  unitPrice
) {
  return firstValue(
    moneyAmount(
      line?.discountedTotalSet
    ),
    moneyAmount(
      line?.originalTotalSet
    ),
    (
      quantity !==
        null
      &&
      unitPrice !==
        null
    )
      ? quantity *
        unitPrice
      : null
  );
}


function buildCommerceItems(
  input,
  order
) {
  return lineItemArray(
    input,
    order
  )
    .map(
      line => {
        const quantity =
          integerOrNull(
            firstValue(
              line?.currentQuantity,
              line?.quantity
            )
          );

        const itemPrice =
          numberOrNull(
            getLineItemUnitPrice(
              line
            )
          );

        const lineValue =
          numberOrNull(
            getLineItemValue(
              line,
              quantity,
              itemPrice
            )
          );

        return {
          itemId:
            stringOrNull(
              line?.id
            ),

          productId:
            stringOrNull(
              firstValue(
                line?.product?.id,
                line?.productId
              )
            ),

          variantId:
            stringOrNull(
              firstValue(
                line?.variant?.id,
                line?.variantId
              )
            ),

          sku:
            stringOrNull(
              firstValue(
                line?.sku,
                line?.variant?.sku
              )
            ),

          name:
            stringOrNull(
              firstValue(
                line?.name,
                line?.title
              )
            ),

          variantTitle:
            stringOrNull(
              firstValue(
                line?.variantTitle,
                line?.variant?.title
              )
            ),

          quantity,
          itemPrice,
          lineValue,
        };
      }
    )
    .filter(
      item =>
        Boolean(
          item.itemId
          ||
          item.productId
          ||
          item.variantId
          ||
          item.sku
          ||
          item.name
        )
    );
}


function buildContentIds(
  items
) {
  return [
    ...new Set(
      items
        .map(
          item =>
            stringOrNull(
              firstValue(
                item.sku,
                item.variantId,
                item.productId,
                item.itemId
              )
            )
        )
        .filter(Boolean)
    ),
  ];
}


function queryParamFromUrl(
  url,
  name
) {
  const raw =
    stringOrNull(
      url
    );

  if (!raw) {
    return null;
  }

  try {
    return stringOrNull(
      new URL(
        raw
      )
        .searchParams
        .get(
          name
        )
    );
  } catch {
    return null;
  }
}


function getJourneySnapshot(
  order
) {
  return (
    objectOrNull(
      order?.customerJourneySummary
    )
    ||
    objectOrNull(
      order?.customerJourney
    )
    ||
    null
  );
}


function getAttributionVisit(
  journey
) {
  return (
    objectOrNull(
      journey?.lastVisit
    )
    ||
    objectOrNull(
      journey?.firstVisit
    )
    ||
    null
  );
}


function buildAttribution(
  order
) {
  const journey =
    getJourneySnapshot(
      order
    );

  const visit =
    getAttributionVisit(
      journey
    );

  const utm =
    objectOrNull(
      visit?.utmParameters
    )
    ||
    objectOrNull(
      visit?.utm
    )
    ||
    {};

  const landingPage =
    stringOrNull(
      firstValue(
        visit?.landingPage,
        visit?.landingPageUrl,
        journey?.lastVisit?.landingPage,
        journey?.firstVisit?.landingPage
      )
    );

  const attribution = {
    utmSource:
      stringOrNull(
        firstValue(
          utm?.source,
          utm?.utmSource,
          order?.utmSource
        )
      ),

    utmMedium:
      stringOrNull(
        firstValue(
          utm?.medium,
          utm?.utmMedium,
          order?.utmMedium
        )
      ),

    utmCampaign:
      stringOrNull(
        firstValue(
          utm?.campaign,
          utm?.campaignName,
          utm?.utmCampaign,
          order?.utmCampaign
        )
      ),

    utmContent:
      stringOrNull(
        firstValue(
          utm?.content,
          utm?.utmContent,
          order?.utmContent
        )
      ),

    utmTerm:
      stringOrNull(
        firstValue(
          utm?.term,
          utm?.utmTerm,
          order?.utmTerm
        )
      ),

    fbclid:
      stringOrNull(
        firstValue(
          order?.fbclid,
          visit?.fbclid,
          queryParamFromUrl(
            landingPage,
            'fbclid'
          )
        )
      ),

    gclid:
      stringOrNull(
        firstValue(
          order?.gclid,
          visit?.gclid,
          queryParamFromUrl(
            landingPage,
            'gclid'
          )
        )
      ),

    campaignId:
      stringOrNull(
        firstValue(
          visit?.campaignId,
          order?.campaignId
        )
      ),

    adSetId:
      stringOrNull(
        firstValue(
          visit?.adSetId,
          order?.adSetId
        )
      ),

    adId:
      stringOrNull(
        firstValue(
          visit?.adId,
          order?.adId
        )
      ),

    sourcePlatform:
      stringOrNull(
        firstValue(
          visit?.source,
          order?.sourceName
        )
      ),

    sourceChannel:
      stringOrNull(
        firstValue(
          visit?.sourceType,
          visit?.sourceChannel
        )
      ),
  };

  return Object.values(
    attribution
  )
    .some(Boolean)
      ? attribution
      : null;
}


function buildContext(
  order,
  currency
) {
  const journey =
    getJourneySnapshot(
      order
    );

  const visit =
    getAttributionVisit(
      journey
    );

  const eventSourceUrl =
    stringOrNull(
      firstValue(
        visit?.landingPage,
        visit?.landingPageUrl,
        order?.landingPageUrl
      )
    );

  const referrerUrl =
    stringOrNull(
      firstValue(
        visit?.referrerUrl,
        visit?.referrer,
        order?.referrerUrl
      )
    );

  return {
    eventSourceUrl,
    referrerUrl,
    pageTitle:
      null,
    pageType:
      'order',
    sessionId:
      stringOrNull(
        firstValue(
          visit?.sessionId,
          journey?.customerVisitId
        )
      ),
    clientId:
      null,
    locale:
      stringOrNull(
        order?.customerLocale
      ),
    currency,
    platform:
      'shopify',
    deviceType:
      stringOrNull(
        visit?.deviceType
      ),
  };
}


function latestTimestampFromArray(
  values,
  keys
) {
  if (
    !Array.isArray(
      values
    )
  ) {
    return null;
  }

  const timestamps =
    values
      .flatMap(
        item =>
          keys.map(
            key =>
              timestampOrNull(
                item?.[key]
              )
          )
      )
      .filter(Boolean)
      .sort();

  return timestamps.length >
    0
    ? timestamps[
        timestamps.length -
        1
      ]
    : null;
}


function extractConnectionNodes(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  if (
    Array.isArray(
      value?.nodes
    )
  ) {
    return value.nodes;
  }

  return [];
}


function buildBase(
  input
) {
  const order =
    input?.order;

  if (
    !order
    ||
    typeof order !==
      'object'
  ) {
    throw new Error(
      'SHOPIFY_META_EVENTS_ORDER_MISSING'
    );
  }

  const workspaceId =
    stringOrNull(
      input?.job?.workspaceId
    );

  const brandId =
    stringOrNull(
      input?.job?.brandId
    );

  const orderId =
    stringOrNull(
      firstValue(
        order?.id,
        input?.job?.orderId
      )
    );

  if (
    !workspaceId
    ||
    !brandId
    ||
    !orderId
  ) {
    throw new Error(
      'SHOPIFY_META_EVENTS_IDENTITY_INCOMPLETE'
    );
  }

  const customer =
    getOrderCustomer(
      order,
      input?.customer
    );

  const customerId =
    getCustomerId(
      order,
      customer
    );

  const currency =
    stringOrNull(
      firstValue(
        order?.currencyCode,
        moneyCurrency(
          order?.currentTotalPriceSet
        ),
        moneyCurrency(
          order?.totalPriceSet
        )
      )
    );

  const items =
    buildCommerceItems(
      input?.lineItems,
      order
    );

  const contentIds =
    buildContentIds(
      items
    );

  const numItems =
    items.length >
      0
      ? items.reduce(
          (
            total,
            item
          ) =>
            total +
            (
              item.quantity
              ??
              0
            ),
          0
        )
      : null;

  const refundTotal =
    numberOrNull(
      firstValue(
        moneyAmount(
          order?.totalRefundedSet
        ),
        moneyAmount(
          order?.currentTotalRefundedSet
        )
      )
    );

  const purchaseNumber =
    getCustomerPurchaseNumber(
      order,
      customer
    );

  const journey =
    getJourneySnapshot(
      order
    );

  return {
    workspaceId,
    brandId,
    orderId,
    orderName:
      stringOrNull(
        order?.name
      ),
    customer,
    customerId,
    purchaseNumber,
    financialStatus:
      normalizeFinancialStatus(
        order
      ),
    fulfillmentStatus:
      normalizeFulfillmentStatus(
        order
      ),
    createdAt:
      timestampOrNull(
        order?.createdAt
      )
      ||
      new Date()
        .toISOString(),
    updatedAt:
      timestampOrNull(
        order?.updatedAt
      )
      ||
      timestampOrNull(
        order?.createdAt
      )
      ||
      new Date()
        .toISOString(),
    cancelledAt:
      timestampOrNull(
        order?.cancelledAt
      ),
    processedAt:
      timestampOrNull(
        firstValue(
          order?.processedAt,
          order?.processedAtShopify
        )
      ),
    currency,
    identity: {
      email:
        getEmail(
          order,
          customer
        ),
      phone:
        getPhone(
          order,
          customer
        ),
      externalId:
        customerId,
    },
    context:
      buildContext(
        order,
        currency
      ),
    attribution:
      buildAttribution(
        order
      ),
    commerce: {
      currency,
      value:
        moneyAmount(
          firstValue(
            order?.currentTotalPriceSet,
            order?.totalPriceSet
          )
        ),
      orderId,
      orderName:
        stringOrNull(
          order?.name
        ),
      customerId,
      contentType:
        'product',
      contentIds:
        contentIds.length >
          0
          ? contentIds
          : null,
      contents:
        items.length >
          0
          ? items
          : null,
      numItems,
      subtotal:
        moneyAmount(
          firstValue(
            order?.currentSubtotalPriceSet,
            order?.subtotalPriceSet
          )
        ),
      discountTotal:
        moneyAmount(
          firstValue(
            order?.currentTotalDiscountsSet,
            order?.totalDiscountsSet
          )
        ),
      taxTotal:
        moneyAmount(
          firstValue(
            order?.currentTotalTaxSet,
            order?.totalTaxSet
          )
        ),
      shippingTotal:
        moneyAmount(
          firstValue(
            order?.currentShippingPriceSet,
            order?.totalShippingPriceSet
          )
        ),
      refundTotal,
    },
    data: {
      shopify_order_id:
        orderId,
      shopify_legacy_order_id:
        stringOrNull(
          order?.legacyResourceId
        ),
      order_name:
        stringOrNull(
          order?.name
        ),
      financial_status:
        normalizeFinancialStatus(
          order
        ),
      fulfillment_status:
        normalizeFulfillmentStatus(
          order
        ),
      source_name:
        stringOrNull(
          order?.sourceName
        ),
      tags:
        Array.isArray(
          order?.tags
        )
          ? order.tags
          : null,
      customer_purchase_number:
        purchaseNumber,
      customer_derivation_status:
        customerId
          ? (
              purchaseNumber !==
                null
                ? 'available'
                : 'purchase_number_unavailable'
            )
          : 'guest_or_customer_unavailable',
      shopify_customer_journey:
        journey,
    },
    metadata: {
      sourceSystem:
        'shopify',
      sourceRecordId:
        orderId,
      integrationAccountId:
        stringOrNull(
          input?.job?.integrationAccountId
        ),
      connectionId:
        stringOrNull(
          input?.job?.connectionId
        ),
      providerAccountId:
        stringOrNull(
          input?.job?.providerAccountId
        ),
      webhookId:
        stringOrNull(
          input?.job?.webhookId
        ),
      webhookTopic:
        stringOrNull(
          input?.job?.webhookTopic
        ),
      shopifyJobId:
        stringOrNull(
          input?.job?.jobId
        ),
      warehouseReceived:
        numberOrNull(
          input?.warehouse?.received
        ),
      warehouseChanged:
        numberOrNull(
          input?.warehouse?.changed
        ),
      warehouseSkipped:
        numberOrNull(
          input?.warehouse?.skipped
        ),
      warehouseLoaded:
        numberOrNull(
          input?.warehouse?.loaded
        ),
    },
  };
}


function canonicalEvent(
  base,
  input
) {
  return {
    workspaceId:
      base.workspaceId,
    brandId:
      base.brandId,
    source:
      input.source,
    sourceEvent:
      input.sourceEvent,
    eventVersion:
      1,
    sourceEntityId:
      input.sourceEntityId,
    occurredAt:
      input.occurredAt,
    idempotencyKey:
      input.idempotencyKey,
    identity:
      base.identity,
    context:
      base.context,
    attribution:
      base.attribution,
    commerce:
      base.commerce,
    data: {
      ...base.data,
      ...(
        input.data
        ??
        {}
      ),
    },
    metadata: {
      ...base.metadata,
      ...(
        input.metadata
        ??
        {}
      ),
    },
  };
}


function planCommerceEvents(
  base,
  order
) {
  const events = [];

  events.push(
    canonicalEvent(
      base,
      {
        source:
          'commerce',
        sourceEvent:
          'commerce.order_created',
        sourceEntityId:
          base.orderId,
        occurredAt:
          base.createdAt,
        idempotencyKey: [
          base.orderId,
          'created',
        ],
      }
    )
  );

  const confirmedAt =
    timestampOrNull(
      firstValue(
        order?.confirmedAt,
        order?.processedAt
      )
    );

  const confirmed =
    order?.confirmed ===
      true
    ||
    Boolean(
      stringOrNull(
        order?.confirmationNumber
      )
    )
    ||
    Boolean(
      confirmedAt
    );

  if (confirmed) {
    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_confirmed',
          sourceEntityId:
            base.orderId,
          occurredAt:
            confirmedAt
            ||
            base.createdAt,
          idempotencyKey: [
            base.orderId,
            'confirmed',
          ],
        }
      )
    );
  }

  if (
    PAID_FINANCIAL_STATUSES
      .has(
        base.financialStatus
      )
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_paid',
          sourceEntityId:
            base.orderId,
          occurredAt:
            base.processedAt
            ||
            base.updatedAt,
          idempotencyKey: [
            base.orderId,
            'paid',
          ],
          data: {
            financial_status:
              base.financialStatus,
          },
        }
      )
    );
  }

  if (
    base.cancelledAt
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_cancelled',
          sourceEntityId:
            base.orderId,
          occurredAt:
            base.cancelledAt,
          idempotencyKey: [
            base.orderId,
            'cancelled',
          ],
          data: {
            cancel_reason:
              stringOrNull(
                order?.cancelReason
              ),
          },
        }
      )
    );
  }

  const refunds =
    extractConnectionNodes(
      order?.refunds
    );

  const refundOccurredAt =
    latestTimestampFromArray(
      refunds,
      [
        'createdAt',
        'updatedAt',
      ]
    )
    ||
    base.updatedAt;

  if (
    base.financialStatus ===
      'PARTIALLY_REFUNDED'
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_partially_refunded',
          sourceEntityId:
            base.orderId,
          occurredAt:
            refundOccurredAt,
          idempotencyKey: [
            base.orderId,
            'partial_refund',
            base.commerce.refundTotal
            ??
            'unknown',
          ],
          data: {
            refund_amount:
              base.commerce.refundTotal,
            refund_ids:
              refunds
                .map(
                  refund =>
                    stringOrNull(
                      refund?.id
                    )
                )
                .filter(Boolean),
          },
        }
      )
    );
  }

  if (
    base.financialStatus ===
      'REFUNDED'
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_refunded',
          sourceEntityId:
            base.orderId,
          occurredAt:
            refundOccurredAt,
          idempotencyKey: [
            base.orderId,
            'refunded',
          ],
          data: {
            refund_amount:
              base.commerce.refundTotal,
            refund_ids:
              refunds
                .map(
                  refund =>
                    stringOrNull(
                      refund?.id
                    )
                )
                .filter(Boolean),
          },
        }
      )
    );
  }

  if (
    base.fulfillmentStatus ===
      'PARTIALLY_FULFILLED'
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_partially_fulfilled',
          sourceEntityId:
            base.orderId,
          occurredAt:
            base.updatedAt,
          idempotencyKey: [
            base.orderId,
            'partially_fulfilled',
          ],
        }
      )
    );
  }

  if (
    base.fulfillmentStatus ===
      'FULFILLED'
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_fulfilled',
          sourceEntityId:
            base.orderId,
          occurredAt:
            base.updatedAt,
          idempotencyKey: [
            base.orderId,
            'fulfilled',
          ],
        }
      )
    );
  }

  const returns =
    extractConnectionNodes(
      order?.returns
    );

  if (
    returns.length >
      0
  ) {
    const returnIds =
      returns
        .map(
          item =>
            stringOrNull(
              item?.id
            )
        )
        .filter(Boolean)
        .sort();

    events.push(
      canonicalEvent(
        base,
        {
          source:
            'commerce',
          sourceEvent:
            'commerce.order_returned',
          sourceEntityId:
            base.orderId,
          occurredAt:
            latestTimestampFromArray(
              returns,
              [
                'createdAt',
                'updatedAt',
              ]
            )
            ||
            base.updatedAt,
          idempotencyKey: [
            base.orderId,
            'returned',
            returnIds.join(','),
          ],
          data: {
            return_ids:
              returnIds,
          },
        }
      )
    );
  }

  return events;
}


function planCustomerEvents(
  base
) {
  if (
    !PAID_FINANCIAL_STATUSES
      .has(
        base.financialStatus
      )
    ||
    !base.customerId
    ||
    base.purchaseNumber ===
      null
    ||
    base.purchaseNumber <
      1
  ) {
    return [];
  }

  const common = {
    sourceEntityId:
      base.customerId,
    occurredAt:
      base.processedAt
      ||
      base.updatedAt,
  };

  const events = [];

  if (
    base.purchaseNumber ===
      1
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          ...common,
          source:
            'customer',
          sourceEvent:
            'customer.new_customer_purchase',
          idempotencyKey: [
            base.customerId,
            base.orderId,
            'new_customer_purchase',
          ],
          data: {
            purchase_number:
              1,
            customer_type:
              'new',
          },
        }
      )
    );

    return events;
  }

  events.push(
    canonicalEvent(
      base,
      {
        ...common,
        source:
          'customer',
        sourceEvent:
          'customer.existing_customer_purchase',
        idempotencyKey: [
          base.customerId,
          base.orderId,
          'existing_customer_purchase',
        ],
        data: {
          purchase_number:
            base.purchaseNumber,
          customer_type:
            'existing',
        },
      }
    )
  );

  events.push(
    canonicalEvent(
      base,
      {
        ...common,
        source:
          'customer',
        sourceEvent:
          'customer.repeat_purchase',
        idempotencyKey: [
          base.customerId,
          base.orderId,
          'repeat_purchase',
        ],
        data: {
          purchase_number:
            base.purchaseNumber,
        },
      }
    )
  );

  if (
    base.purchaseNumber ===
      2
  ) {
    events.push(
      canonicalEvent(
        base,
        {
          ...common,
          source:
            'customer',
          sourceEvent:
            'customer.second_purchase',
          idempotencyKey: [
            base.customerId,
            base.orderId,
            'second_purchase',
          ],
          data: {
            purchase_number:
              2,
          },
        }
      )
    );
  }

  return events;
}


export function shopifyOrderNeedsCustomerEnrichment(
  order
) {
  if (
    !isPaidOrder(
      order
    )
  ) {
    return false;
  }

  const customer =
    objectOrNull(
      order?.customer
    );

  const customerId =
    stringOrNull(
      customer?.id
    );

  if (!customerId) {
    return false;
  }

  const purchaseNumber =
    integerOrNull(
      firstValue(
        customer?.numberOfOrders,
        customer?.ordersCount
      )
    );

  const email =
    stringOrNull(
      firstValue(
        order?.email,
        customer?.defaultEmailAddress?.emailAddress,
        customer?.email
      )
    );

  const phone =
    stringOrNull(
      firstValue(
        order?.phone,
        customer?.defaultPhoneNumber?.phoneNumber,
        customer?.phone
      )
    );

  return (
    purchaseNumber ===
      null
    ||
    (!email && !phone)
  );
}


export function planShopifyOrderCanonicalMetaEvents(
  input
) {
  const base =
    buildBase(
      input
    );

  const commerce =
    planCommerceEvents(
      base,
      input.order
    );

  const customer =
    planCustomerEvents(
      base
    );

  return {
    base: {
      orderId:
        base.orderId,
      customerId:
        base.customerId,
      purchaseNumber:
        base.purchaseNumber,
      financialStatus:
        base.financialStatus,
      fulfillmentStatus:
        base.fulfillmentStatus,
    },
    events: [
      ...commerce,
      ...customer,
    ],
  };
}


export async function emitShopifyOrderCanonicalMetaEvents(
  input
) {
  const plan =
    planShopifyOrderCanonicalMetaEvents(
      input
    );

  const published = [];

  for (
    const event
    of plan.events
  ) {
    const result =
      await publishCanonicalMetaEvent(
        event
      );

    published.push(
      result
    );
  }

  const result = {
    orderId:
      plan.base.orderId,
    customerId:
      plan.base.customerId,
    purchaseNumber:
      plan.base.purchaseNumber,
    financialStatus:
      plan.base.financialStatus,
    fulfillmentStatus:
      plan.base.fulfillmentStatus,
    planned:
      plan.events.length,
    published:
      published.length,
    events:
      published.map(
        item =>
          item.sourceEvent
      ),
    sourceEventIds:
      published.map(
        item =>
          item.sourceEventId
      ),
  };

  console.log(
    'SHOPIFY_CANONICAL_META_EVENTS_PUBLISHED',
    result
  );

  return result;
}
