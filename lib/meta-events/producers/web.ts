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

type WebProducerBase = {
  workspaceId: string;
  brandId: string;

  browserEventId: string;
  occurredAt: string;

  sourceEntityId?: string | null;

  identity?: MetaEventsIdentity | null;
  context?: MetaEventsContext | null;
  attribution?: MetaEventsAttribution | null;
  commerce?: MetaEventsCommerce | null;
  metadata?: MetaEventsMetadata | null;
};

function emitWebEvent(
  sourceEvent: string,
  input: WebProducerBase,
  data?: Record<string, unknown> | null
) {
  return emitCanonicalMetaEvent({
    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    source:
      'web',

    sourceEvent,

    sourceEntityId:
      input.sourceEntityId
      ??
      null,

    occurredAt:
      input.occurredAt,

    idempotencyKey: [
      input.browserEventId,
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

    commerce:
      input.commerce
      ??
      null,

    data:
      data
      ??
      null,

    metadata: {
      sourceSystem:
        'growthos_web_pixel',

      sourceRecordId:
        input.browserEventId,

      ...(
        input.metadata
        ??
        {}
      ),
    },
  });
}

export function emitWebPageView(
  input: WebProducerBase & {
    pageUrl: string;
    pageTitle?: string | null;
    pageType?: string | null;
  }
) {
  return emitWebEvent(
    'web.page_view',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.pageUrl,
      context: {
        ...(
          input.context
          ??
          {}
        ),
        eventSourceUrl:
          input.pageUrl,
        pageTitle:
          input.pageTitle
          ??
          input.context?.pageTitle
          ??
          null,
        pageType:
          input.pageType
          ??
          input.context?.pageType
          ??
          null,
      },
    },
    {
      page_url:
        input.pageUrl,
      page_title:
        input.pageTitle
        ??
        null,
      page_type:
        input.pageType
        ??
        null,
    }
  );
}

export function emitWebProductView(
  input: WebProducerBase & {
    productId: string;
    variantId?: string | null;
    productName?: string | null;
    value?: number | null;
    currency?: string | null;
  }
) {
  return emitWebEvent(
    'web.product_view',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.variantId
        ??
        input.productId,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        value:
          input.value
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
        contentType:
          'product',
        contentIds: [
          input.variantId
          ??
          input.productId,
        ],
      },
    },
    {
      product_id:
        input.productId,
      variant_id:
        input.variantId
        ??
        null,
      product_name:
        input.productName
        ??
        null,
    }
  );
}

export function emitWebCollectionView(
  input: WebProducerBase & {
    collectionId: string;
    collectionName?: string | null;
  }
) {
  return emitWebEvent(
    'web.collection_view',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.collectionId,
    },
    {
      collection_id:
        input.collectionId,
      collection_name:
        input.collectionName
        ??
        null,
    }
  );
}

export function emitWebSearch(
  input: WebProducerBase & {
    query: string;
    resultCount?: number | null;
  }
) {
  return emitWebEvent(
    'web.search',
    input,
    {
      search_query:
        input.query,
      result_count:
        input.resultCount
        ??
        null,
    }
  );
}

export function emitWebCartView(
  input: WebProducerBase & {
    cartId: string;
    value?: number | null;
    currency?: string | null;
    numItems?: number | null;
  }
) {
  return emitWebEvent(
    'web.cart_view',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.cartId,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        cartId:
          input.cartId,
        value:
          input.value
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
        numItems:
          input.numItems
          ??
          input.commerce?.numItems
          ??
          null,
      },
    },
    {
      cart_id:
        input.cartId,
    }
  );
}

export function emitWebAddToCart(
  input: WebProducerBase & {
    cartId?: string | null;
    productId: string;
    variantId?: string | null;
    quantity?: number | null;
    value?: number | null;
    currency?: string | null;
  }
) {
  return emitWebEvent(
    'web.add_to_cart',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.variantId
        ??
        input.productId,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        cartId:
          input.cartId
          ??
          input.commerce?.cartId
          ??
          null,
        value:
          input.value
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
        contentType:
          'product',
        contentIds: [
          input.variantId
          ??
          input.productId,
        ],
        contents: [
          {
            productId:
              input.productId,
            variantId:
              input.variantId
              ??
              null,
            quantity:
              input.quantity
              ??
              1,
          },
        ],
      },
    },
    {
      cart_id:
        input.cartId
        ??
        null,
      product_id:
        input.productId,
      variant_id:
        input.variantId
        ??
        null,
      quantity:
        input.quantity
        ??
        1,
    }
  );
}

export function emitWebRemoveFromCart(
  input: WebProducerBase & {
    cartId?: string | null;
    productId: string;
    variantId?: string | null;
    quantity?: number | null;
  }
) {
  return emitWebEvent(
    'web.remove_from_cart',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.variantId
        ??
        input.productId,
    },
    {
      cart_id:
        input.cartId
        ??
        null,
      product_id:
        input.productId,
      variant_id:
        input.variantId
        ??
        null,
      quantity:
        input.quantity
        ??
        1,
    }
  );
}

export function emitWebCheckoutStarted(
  input: WebProducerBase & {
    checkoutId: string;
    cartId?: string | null;
    value?: number | null;
    currency?: string | null;
    numItems?: number | null;
  }
) {
  return emitWebEvent(
    'web.checkout_started',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.checkoutId,
      commerce: {
        ...(
          input.commerce
          ??
          {}
        ),
        checkoutId:
          input.checkoutId,
        cartId:
          input.cartId
          ??
          input.commerce?.cartId
          ??
          null,
        value:
          input.value
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
        numItems:
          input.numItems
          ??
          input.commerce?.numItems
          ??
          null,
      },
    },
    {
      checkout_id:
        input.checkoutId,
      cart_id:
        input.cartId
        ??
        null,
    }
  );
}

export function emitWebCheckoutContactSubmitted(
  input: WebProducerBase & {
    checkoutId: string;
  }
) {
  return emitWebEvent(
    'web.checkout_contact_submitted',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.checkoutId,
    },
    {
      checkout_id:
        input.checkoutId,
    }
  );
}

export function emitWebCheckoutShippingSubmitted(
  input: WebProducerBase & {
    checkoutId: string;
    shippingMethod?: string | null;
  }
) {
  return emitWebEvent(
    'web.checkout_shipping_submitted',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.checkoutId,
    },
    {
      checkout_id:
        input.checkoutId,
      shipping_method:
        input.shippingMethod
        ??
        null,
    }
  );
}

export function emitWebPaymentInfoSubmitted(
  input: WebProducerBase & {
    checkoutId: string;
  }
) {
  return emitWebEvent(
    'web.payment_info_submitted',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
        ??
        input.checkoutId,
    },
    {
      checkout_id:
        input.checkoutId,
    }
  );
}

export function emitWebPurchaseObserved(
  input: WebProducerBase & {
    orderId: string;
    value?: number | null;
    currency?: string | null;
  }
) {
  return emitWebEvent(
    'web.purchase_observed',
    {
      ...input,
      sourceEntityId:
        input.sourceEntityId
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
        value:
          input.value
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
        input.orderId,
      browser_observed:
        true,
    }
  );
}
