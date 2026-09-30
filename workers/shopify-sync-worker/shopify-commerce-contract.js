// ============================================================
// GROWTH OS
// SHOPIFY COMMERCE CONTRACT
//
// Purpose:
//
// ONE canonical Shopify commerce schema definition shared by:
//
// - incremental Admin GraphQL ingestion
// - reconciliation ingestion
// - historical Bulk Operations
// - future webhook normalization
//
// IMPORTANT:
//
// This file defines WHAT Growth OS asks Shopify for.
// It does NOT write BigQuery rows.
// It does NOT change the existing ingestion pipeline yet.
//
// Contract changes must be versioned.
// ============================================================


// ============================================================
// CONTRACT VERSION
// ============================================================

export const SHOPIFY_COMMERCE_CONTRACT_VERSION =
  'shopify_commerce_v2';

export const SHOPIFY_ORDER_CONTRACT_VERSION =
  'shopify_orders_v2';

export const SHOPIFY_ORDER_LINE_ITEM_CONTRACT_VERSION =
  'shopify_order_line_items_v1';


// ============================================================
// REUSABLE MONEY BAG
// ============================================================

export const SHOPIFY_MONEY_BAG_SELECTION = `

  shopMoney {
    amount
    currencyCode
  }

  presentmentMoney {
    amount
    currencyCode
  }

`;


// ============================================================
// REUSABLE ATTRIBUTE
// ============================================================

export const SHOPIFY_ATTRIBUTE_SELECTION = `

  key
  value

`;


// ============================================================
// REUSABLE MAILING ADDRESS
// ============================================================

export const SHOPIFY_MAILING_ADDRESS_SELECTION = `

  id

  firstName
  lastName
  name

  company

  address1
  address2

  city

  province
  provinceCode

  country
  countryCodeV2

  zip
  phone

  latitude
  longitude

  formattedArea
  timeZone

`;


// ============================================================
// REUSABLE CUSTOMER VISIT / SHOPIFY ATTRIBUTION
// ============================================================

export const SHOPIFY_CUSTOMER_VISIT_SELECTION = `

  id
  occurredAt

  landingPage
  referrerUrl

  referralCode

  source
  sourceDescription
  sourceType

  utmParameters {

    source
    medium
    campaign
    term
    content

  }

`;


// ============================================================
// ORDER CORE
//
// RULE:
//
// This contains ORDER-LEVEL information only.
//
// Do NOT put paginated child connections here.
//
// Examples intentionally excluded:
//
// - lineItems
// - shippingLines
// - returns
// - discountApplications
//
// Those have their own canonical entities.
//
// This prevents:
// - giant unstable order documents
// - Bulk JSONL parent/child ambiguity
// - unnecessary hash changes
// ============================================================

export const SHOPIFY_ORDER_CORE_SELECTION = `

  # ----------------------------------------------------------
  # IDENTITY
  # ----------------------------------------------------------

  id
  legacyResourceId

  name
  number
  confirmationNumber


  # ----------------------------------------------------------
  # TIME
  # ----------------------------------------------------------

  createdAt
  updatedAt

  processedAt

  cancelledAt
  closedAt


  # ----------------------------------------------------------
  # STATUS / LIFECYCLE
  # ----------------------------------------------------------

  displayFinancialStatus
  displayFulfillmentStatus

  returnStatus

  confirmed
  closed

  fullyPaid
  unpaid

  edited

  refundable
  restockable

  requiresShipping

  test


  # ----------------------------------------------------------
  # CUSTOMER / CONTACT
  # ----------------------------------------------------------

  email
  phone

  customerLocale
  customerAcceptsMarketing

  customer {
    id
  }


  # ----------------------------------------------------------
  # SOURCE / CHANNEL
  # ----------------------------------------------------------

  sourceName
  sourceIdentifier

  registeredSourceUrl

  clientIp


  # ----------------------------------------------------------
  # SHOPIFY NATIVE ATTRIBUTION
  # ----------------------------------------------------------

  customerJourneySummary {

    ready

    customerOrderIndex
    daysToConversion

    firstVisit {

      ${SHOPIFY_CUSTOMER_VISIT_SELECTION}

    }

    lastVisit {

      ${SHOPIFY_CUSTOMER_VISIT_SELECTION}

    }

  }


  # ----------------------------------------------------------
  # ORDER METADATA
  # ----------------------------------------------------------

  tags

  note

  poNumber

  customAttributes {

    ${SHOPIFY_ATTRIBUTE_SELECTION}

  }


  # ----------------------------------------------------------
  # PRODUCT / QUANTITY SUMMARY
  # ----------------------------------------------------------

  subtotalLineItemsQuantity
  currentSubtotalLineItemsQuantity

  totalWeight
  currentTotalWeight


  # ----------------------------------------------------------
  # CURRENCY
  # ----------------------------------------------------------

  currencyCode
  presentmentCurrencyCode


  # ----------------------------------------------------------
  # PAYMENT
  # ----------------------------------------------------------

  paymentGatewayNames


  # ----------------------------------------------------------
  # DISCOUNT CODES
  # ----------------------------------------------------------

  discountCodes


  # ----------------------------------------------------------
  # TAX FLAGS
  # ----------------------------------------------------------

  taxesIncluded
  taxExempt


  # ----------------------------------------------------------
  # ORIGINAL MONEY
  # ----------------------------------------------------------

  originalTotalPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  originalTotalDutiesSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  originalTotalAdditionalFeesSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # SUBTOTAL
  # ----------------------------------------------------------

  subtotalPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  currentSubtotalPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # CART DISCOUNT
  # ----------------------------------------------------------

  cartDiscountAmountSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  currentCartDiscountAmountSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # TOTAL DISCOUNTS
  # ----------------------------------------------------------

  totalDiscountsSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  currentTotalDiscountsSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # SHIPPING
  # ----------------------------------------------------------

  totalShippingPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  currentShippingPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # TAX
  # ----------------------------------------------------------

  totalTaxSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  currentTotalTaxSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # DUTIES
  # ----------------------------------------------------------

  currentTotalDutiesSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # ADDITIONAL FEES
  # ----------------------------------------------------------

  currentTotalAdditionalFeesSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # TOTAL VALUE
  # ----------------------------------------------------------

  totalPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  currentTotalPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # PAYMENT STATE
  # ----------------------------------------------------------

  totalReceivedSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  totalOutstandingSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  totalCapturableSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  netPaymentSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # REFUND SUMMARY
  # ----------------------------------------------------------

  totalRefundedSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  totalRefundedShippingSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  refundDiscrepancySet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # TIP
  # ----------------------------------------------------------

  totalTipReceivedSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # ADDRESSES
  # ----------------------------------------------------------

  billingAddressMatchesShippingAddress

  billingAddress {

    ${SHOPIFY_MAILING_ADDRESS_SELECTION}

  }

  shippingAddress {

    ${SHOPIFY_MAILING_ADDRESS_SELECTION}

  }

`;


// ============================================================
// ORDER LINE ITEM
//
// Canonical Grain:
//
// integration_account_id
// + order_id
// + line_item_id
//
// In Shopify Bulk JSONL:
//
// line item __parentId = Shopify Order GID
// ============================================================

export const SHOPIFY_ORDER_LINE_ITEM_SELECTION = `

  # ----------------------------------------------------------
  # IDENTITY / ORDER-TIME SNAPSHOT
  # ----------------------------------------------------------

  id

  name
  title

  sku

  variantTitle
  vendor


  # ----------------------------------------------------------
  # QUANTITY
  #
  # quantity:
  #   originally ordered, including removed/refunded units
  #
  # currentQuantity:
  #   excludes refunded/removed units
  #
  # refundableQuantity:
  #   currently eligible quantity for refund
  #
  # unfulfilledQuantity:
  #   quantity not yet fulfilled
  #
  # nonFulfillableQuantity:
  #   quantity that cannot be fulfilled
  # ----------------------------------------------------------

  quantity

  currentQuantity

  refundableQuantity

  unfulfilledQuantity

  nonFulfillableQuantity


  # ----------------------------------------------------------
  # BUSINESS FLAGS
  # ----------------------------------------------------------

  requiresShipping

  taxable

  isGiftCard

  restockable

  merchantEditable


  # ----------------------------------------------------------
  # ORIGINAL UNIT PRICE
  # ----------------------------------------------------------

  originalUnitPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # DISCOUNTED UNIT PRICE
  # ----------------------------------------------------------

  discountedUnitPriceSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  discountedUnitPriceAfterAllDiscountsSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # ORIGINAL LINE TOTAL
  # ----------------------------------------------------------

  originalTotalSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # DISCOUNTED LINE TOTAL
  # ----------------------------------------------------------

  discountedTotalSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # TOTAL DISCOUNT
  # ----------------------------------------------------------

  totalDiscountSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # DISCOUNT ALLOCATIONS
  #
  # Actual discount amount applied to THIS line.
  # Also retain the originating discount application's
  # allocation semantics.
  # ----------------------------------------------------------

  discountAllocations {

    allocatedAmountSet {

      ${SHOPIFY_MONEY_BAG_SELECTION}

    }

    discountApplication {

      __typename

      allocationMethod
      index
      targetSelection
      targetType

      value {

        __typename

        ... on MoneyV2 {

          amount
          currencyCode

        }

        ... on PricingPercentageValue {

          percentage

        }

      }

      ... on DiscountCodeApplication {

        code

      }

      ... on AutomaticDiscountApplication {

        title

      }

      ... on ManualDiscountApplication {

        title
        description

      }

    }

  }


  # ----------------------------------------------------------
  # TAX
  # ----------------------------------------------------------

  taxLines {

    title

    rate
    ratePercentage

    source
    channelLiable

    priceSet {

      ${SHOPIFY_MONEY_BAG_SELECTION}

    }

  }


  # ----------------------------------------------------------
  # DUTIES
  #
  # Important for international / cross-border commerce.
  # ----------------------------------------------------------

  duties {

    id

    countryCodeOfOrigin

    harmonizedSystemCode

    price {

      ${SHOPIFY_MONEY_BAG_SELECTION}

    }

    taxLines {

      title

      rate
      ratePercentage

      source
      channelLiable

      priceSet {

        ${SHOPIFY_MONEY_BAG_SELECTION}

      }

    }

  }


  # ----------------------------------------------------------
  # UNFULFILLED VALUE
  # ----------------------------------------------------------

  unfulfilledOriginalTotalSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }

  unfulfilledDiscountedTotalSet {

    ${SHOPIFY_MONEY_BAG_SELECTION}

  }


  # ----------------------------------------------------------
  # CUSTOM LINE PROPERTIES
  # ----------------------------------------------------------

  customAttributes {

    ${SHOPIFY_ATTRIBUTE_SELECTION}

  }


  # ----------------------------------------------------------
  # SELLING PLAN
  #
  # Subscription / recurring-purchase context without querying
  # SubscriptionContract, which requires additional scopes.
  # ----------------------------------------------------------

  sellingPlan {

    sellingPlanId
    name

  }


  # ----------------------------------------------------------
  # BUNDLE / LINE ITEM GROUP
  # ----------------------------------------------------------

  lineItemGroup {

    id

    title
    quantity

    productId

    variantId
    variantSku

    customAttributes {

      ${SHOPIFY_ATTRIBUTE_SELECTION}

    }

  }


  # ----------------------------------------------------------
  # PRODUCT RELATIONSHIP
  # ----------------------------------------------------------

  product {

    id
    legacyResourceId

    title
    handle

    vendor
    productType

  }


  # ----------------------------------------------------------
  # VARIANT RELATIONSHIP
  # ----------------------------------------------------------

  variant {

    id
    legacyResourceId

    title

    sku
    barcode

  }

`;


// ============================================================
// CANONICAL ENTITY REGISTRY
//
// This is deliberately broader than today's four Shopify
// warehouse objects.
//
// It defines where Growth OS is going so future development
// doesn't collapse everything back into Order JSON.
// ============================================================

export const SHOPIFY_COMMERCE_ENTITIES =
  Object.freeze({

    orders: {

      contractVersion:
        SHOPIFY_ORDER_CONTRACT_VERSION,

      shopifyType:
        'Order',

      parentEntity:
        null,

      relationType:
        'root',

      canonicalPrefix:
        'shopify_orders',

      status:
        'active_upgrade',

    },


    order_line_items: {

      contractVersion:
        SHOPIFY_ORDER_LINE_ITEM_CONTRACT_VERSION,

      shopifyType:
        'LineItem',

      parentEntity:
        'orders',

      parentKey:
        'order_id',

      bulkParentField:
        '__parentId',

      relationType:
        'connection',

      shopifyField:
        'lineItems',

      canonicalPrefix:
        'shopify_order_line_items',

      status:
        'next',

    },


    order_transactions: {

      contractVersion:
        'shopify_order_transactions_v2',

      shopifyType:
        'OrderTransaction',

      parentEntity:
        'orders',

      parentKey:
        'order_id',

      relationType:
        'embedded_list',

      shopifyField:
        'transactions',

      canonicalPrefix:
        'shopify_order_transactions',

      status:
        'existing_upgrade',

    },


    order_refunds: {

      contractVersion:
        'shopify_order_refunds_v1',

      shopifyType:
        'Refund',

      parentEntity:
        'orders',

      parentKey:
        'order_id',

      relationType:
        'embedded_list',

      shopifyField:
        'refunds',

      canonicalPrefix:
        'shopify_order_refunds',

      status:
        'planned',

    },


    order_refund_line_items: {

      contractVersion:
        'shopify_order_refund_line_items_v1',

      shopifyType:
        'RefundLineItem',

      parentEntity:
        'order_refunds',

      parentKey:
        'refund_id',

      relationType:
        'connection',

      canonicalPrefix:
        'shopify_order_refund_line_items',

      status:
        'planned',

    },


    order_shipping_lines: {

      contractVersion:
        'shopify_order_shipping_lines_v1',

      shopifyType:
        'ShippingLine',

      parentEntity:
        'orders',

      parentKey:
        'order_id',

      bulkParentField:
        '__parentId',

      relationType:
        'connection',

      shopifyField:
        'shippingLines',

      canonicalPrefix:
        'shopify_order_shipping_lines',

      status:
        'planned',

    },


    order_discount_applications: {

      contractVersion:
        'shopify_order_discount_applications_v1',

      shopifyType:
        'DiscountApplication',

      parentEntity:
        'orders',

      parentKey:
        'order_id',

      bulkParentField:
        '__parentId',

      relationType:
        'connection',

      shopifyField:
        'discountApplications',

      canonicalPrefix:
        'shopify_order_discount_applications',

      status:
        'planned',

    },


    order_fulfillments: {

      contractVersion:
        'shopify_order_fulfillments_v1',

      shopifyType:
        'Fulfillment',

      parentEntity:
        'orders',

      parentKey:
        'order_id',

      relationType:
        'embedded_list',

      shopifyField:
        'fulfillments',

      canonicalPrefix:
        'shopify_order_fulfillments',

      status:
        'planned',

    },


    order_returns: {

      contractVersion:
        'shopify_order_returns_v1',

      shopifyType:
        'Return',

      parentEntity:
        'orders',

      parentKey:
        'order_id',

      bulkParentField:
        '__parentId',

      relationType:
        'connection',

      shopifyField:
        'returns',

      canonicalPrefix:
        'shopify_order_returns',

      status:
        'planned',

    },

  });


// ============================================================
// CONTRACT HELPER
// ============================================================

export function getShopifyCommerceEntity(
  entityName
) {

  const key =
    String(
      entityName
      ?? ''
    ).trim();

  const entity =
    SHOPIFY_COMMERCE_ENTITIES[
      key
    ];

  if (!entity) {

    throw new Error(
      `SHOPIFY_COMMERCE_ENTITY_UNKNOWN:${key}`
    );

  }

  return entity;

}