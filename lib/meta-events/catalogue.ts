import type {
  MetaEventsSource,
} from './types';

export const META_EVENTS_CATALOGUE_SEED_VERSION = 3;

export type MetaEventsCatalogueLifecycleStatus =
  | 'active'
  | 'planned'
  | 'legacy'
  | 'internal';

export type MetaEventsCatalogueProducerType =
  | 'system'
  | 'pixel'
  | 'commerce'
  | 'derived'
  | 'call_commerce'
  | 'lead_commerce'
  | 'retention'
  | 'shopify';

export type MetaEventsCatalogueSchema = {
  requiredDataPaths: string[];
  identityAnyOf: string[];
};

export type MetaEventsCatalogueDefinition = {
  eventKey: string;
  eventVersion: number;
  source: MetaEventsSource;
  label: string;
  description: string;
  producerType: MetaEventsCatalogueProducerType;
  lifecycleStatus: MetaEventsCatalogueLifecycleStatus;
  routingAllowed: boolean;
  schema: MetaEventsCatalogueSchema;
};

const plannedSchema: MetaEventsCatalogueSchema = {
  requiredDataPaths: [],
  identityAnyOf: [],
};

export const META_EVENTS_CATALOGUE_V1 = [
  // ==========================================================
  // INTERNAL / HEALTH
  // ==========================================================
  {
    eventKey: 'call_commerce.__queue_test',
    eventVersion: 1,
    source: 'call_commerce',
    label: 'Call Commerce queue test',
    description: 'Internal transport and routing health-check event.',
    producerType: 'system',
    lifecycleStatus: 'internal',
    routingAllowed: false,
    schema: plannedSchema,
  },

  // ==========================================================
  // CALL COMMERCE — CURRENT ACTIVE CONTRACTS
  // ==========================================================
  {
    eventKey: 'call_commerce.connected',
    eventVersion: 1,
    source: 'call_commerce',
    label: 'Connected call',
    description: 'A Call Commerce lead reached a connected call state.',
    producerType: 'call_commerce',
    lifecycleStatus: 'active',
    routingAllowed: true,
    schema: {
      requiredDataPaths: [
        'call_id',
        'lead_id',
        'business_number',
      ],
      identityAnyOf: [
        'phone',
        'externalId',
      ],
    },
  },
  {
    eventKey: 'call_commerce.qualified',
    eventVersion: 1,
    source: 'call_commerce',
    label: 'Qualified call lead',
    description: 'A Call Commerce lead reached the qualified business state.',
    producerType: 'call_commerce',
    lifecycleStatus: 'active',
    routingAllowed: true,
    schema: plannedSchema,
  },
  {
    eventKey: 'call_commerce.unqualified',
    eventVersion: 1,
    source: 'call_commerce',
    label: 'Unqualified call lead',
    description: 'A Call Commerce lead reached the unqualified business state.',
    producerType: 'call_commerce',
    lifecycleStatus: 'active',
    routingAllowed: true,
    schema: plannedSchema,
  },
  {
    eventKey: 'call_commerce.purchased',
    eventVersion: 1,
    source: 'call_commerce',
    label: 'Purchased call lead',
    description: 'A Call Commerce lead reached the purchased business state.',
    producerType: 'call_commerce',
    lifecycleStatus: 'active',
    routingAllowed: true,
    schema: plannedSchema,
  },

  // ==========================================================
  // LEGACY SHOPIFY — KEEP UNTIL RULE MIGRATION IS COMPLETE
  // ==========================================================
  {
    eventKey: 'shopify.order_paid_new',
    eventVersion: 1,
    source: 'shopify',
    label: 'New customer paid order',
    description: 'Legacy Shopify-specific new-customer paid-order event.',
    producerType: 'shopify',
    lifecycleStatus: 'legacy',
    routingAllowed: true,
    schema: plannedSchema,
  },
  {
    eventKey: 'shopify.order_paid_existing',
    eventVersion: 1,
    source: 'shopify',
    label: 'Existing customer paid order',
    description: 'Legacy Shopify-specific existing-customer paid-order event.',
    producerType: 'shopify',
    lifecycleStatus: 'legacy',
    routingAllowed: true,
    schema: plannedSchema,
  },

  // ==========================================================
  // WEB / PIXEL FAMILY — PLANNED, SAFE / NON-ROUTABLE
  // ==========================================================
  {
    eventKey: 'web.page_view',
    eventVersion: 1,
    source: 'web',
    label: 'Page view',
    description: 'A browser session viewed a Growth OS tracked page.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.product_view',
    eventVersion: 1,
    source: 'web',
    label: 'Product view',
    description: 'A browser session viewed a product.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.collection_view',
    eventVersion: 1,
    source: 'web',
    label: 'Collection view',
    description: 'A browser session viewed a collection or category.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.search',
    eventVersion: 1,
    source: 'web',
    label: 'Search',
    description: 'A browser session performed an on-site search.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.cart_view',
    eventVersion: 1,
    source: 'web',
    label: 'Cart view',
    description: 'A browser session viewed the cart.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.add_to_cart',
    eventVersion: 1,
    source: 'web',
    label: 'Add to cart',
    description: 'A browser session added an item to cart.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.remove_from_cart',
    eventVersion: 1,
    source: 'web',
    label: 'Remove from cart',
    description: 'A browser session removed an item from cart.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.checkout_started',
    eventVersion: 1,
    source: 'web',
    label: 'Checkout started',
    description: 'A browser session started checkout.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.checkout_contact_submitted',
    eventVersion: 1,
    source: 'web',
    label: 'Checkout contact submitted',
    description: 'A browser checkout submitted contact information.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.checkout_shipping_submitted',
    eventVersion: 1,
    source: 'web',
    label: 'Checkout shipping submitted',
    description: 'A browser checkout submitted a shipping step.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.payment_info_submitted',
    eventVersion: 1,
    source: 'web',
    label: 'Payment info submitted',
    description: 'A browser checkout submitted payment information.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'web.purchase_observed',
    eventVersion: 1,
    source: 'web',
    label: 'Browser purchase observed',
    description: 'The browser observed a purchase completion; server commerce remains authoritative.',
    producerType: 'pixel',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },

  // ==========================================================
  // COMMERCE FAMILY — AUTHORITATIVE BUSINESS STATE
  // ==========================================================
  {
    eventKey: 'commerce.order_created',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order created',
    description: 'A commerce system created an order.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_confirmed',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order confirmed',
    description: 'A commerce system confirmed an order.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_paid',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order paid',
    description: 'A commerce system confirmed that an order became paid.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_cancelled',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order cancelled',
    description: 'A commerce system cancelled an order.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_partially_refunded',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order partially refunded',
    description: 'A commerce system partially refunded an order.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_refunded',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order refunded',
    description: 'A commerce system fully refunded an order.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_partially_fulfilled',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order partially fulfilled',
    description: 'A commerce system partially fulfilled an order.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_fulfilled',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order fulfilled',
    description: 'A commerce system fully fulfilled an order.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'commerce.order_returned',
    eventVersion: 1,
    source: 'commerce',
    label: 'Order returned',
    description: 'A commerce system recorded an order return.',
    producerType: 'commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },

  // ==========================================================
  // CUSTOMER / DERIVED PURCHASE FAMILY
  // ==========================================================
  {
    eventKey: 'customer.created',
    eventVersion: 1,
    source: 'customer',
    label: 'Customer created',
    description: 'Growth OS observed a newly created customer record.',
    producerType: 'derived',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'customer.new_customer_purchase',
    eventVersion: 1,
    source: 'customer',
    label: 'New customer purchase',
    description: 'Growth OS determined that a paid order is the customer first purchase.',
    producerType: 'derived',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'customer.existing_customer_purchase',
    eventVersion: 1,
    source: 'customer',
    label: 'Existing customer purchase',
    description: 'Growth OS determined that a paid order belongs to an existing customer.',
    producerType: 'derived',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'customer.second_purchase',
    eventVersion: 1,
    source: 'customer',
    label: 'Second purchase',
    description: 'Growth OS determined that a customer completed a second purchase.',
    producerType: 'derived',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'customer.repeat_purchase',
    eventVersion: 1,
    source: 'customer',
    label: 'Repeat purchase',
    description: 'Growth OS determined that a customer completed a repeat purchase.',
    producerType: 'derived',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'customer.high_value_purchase',
    eventVersion: 1,
    source: 'customer',
    label: 'High-value purchase',
    description: 'Growth OS classified a purchase as high value under tenant business logic.',
    producerType: 'derived',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'customer.reactivated_purchase',
    eventVersion: 1,
    source: 'customer',
    label: 'Reactivated purchase',
    description: 'Growth OS determined that a lapsed customer purchased again.',
    producerType: 'derived',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },

  // ==========================================================
  // LEAD COMMERCE FAMILY
  // ==========================================================
  {
    eventKey: 'lead_commerce.lead_created',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Lead created',
    description: 'Lead Commerce captured a new lead.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'lead_commerce.qualified',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Lead qualified',
    description: 'Lead Commerce classified a lead as qualified.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'lead_commerce.unqualified',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Lead unqualified',
    description: 'Lead Commerce classified a lead as unqualified.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'lead_commerce.consultation_booked',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Consultation booked',
    description: 'Lead Commerce recorded a booked consultation.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'lead_commerce.consultation_completed',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Consultation completed',
    description: 'Lead Commerce recorded a completed consultation.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'lead_commerce.consultation_no_show',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Consultation no-show',
    description: 'Lead Commerce recorded a consultation no-show.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'lead_commerce.consultation_cancelled',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Consultation cancelled',
    description: 'Lead Commerce recorded a cancelled consultation.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'lead_commerce.purchased',
    eventVersion: 1,
    source: 'lead_commerce',
    label: 'Lead purchased',
    description: 'Lead Commerce recorded that a lead converted to a purchase.',
    producerType: 'lead_commerce',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },

  // ==========================================================
  // RETENTION / DERIVED CUSTOMER STATE FAMILY
  // ==========================================================
  {
    eventKey: 'retention.segment_entered',
    eventVersion: 1,
    source: 'retention',
    label: 'Retention segment entered',
    description: 'A customer entered a retention segment.',
    producerType: 'retention',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'retention.replenishment_due',
    eventVersion: 1,
    source: 'retention',
    label: 'Replenishment due',
    description: 'Growth OS determined that a customer is due for replenishment.',
    producerType: 'retention',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'retention.winback_eligible',
    eventVersion: 1,
    source: 'retention',
    label: 'Winback eligible',
    description: 'Growth OS determined that a customer is eligible for a winback journey.',
    producerType: 'retention',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'retention.lapsed',
    eventVersion: 1,
    source: 'retention',
    label: 'Customer lapsed',
    description: 'Growth OS classified a customer as lapsed.',
    producerType: 'retention',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
  {
    eventKey: 'retention.reactivated',
    eventVersion: 1,
    source: 'retention',
    label: 'Customer reactivated',
    description: 'Growth OS classified a previously lapsed customer as reactivated.',
    producerType: 'retention',
    lifecycleStatus: 'planned',
    routingAllowed: false,
    schema: plannedSchema,
  },
] as const satisfies readonly MetaEventsCatalogueDefinition[];

export type MetaEventKey =
  typeof META_EVENTS_CATALOGUE_V1[number]['eventKey'];

export const META_EVENT_KEYS =
  META_EVENTS_CATALOGUE_V1.map(
    definition =>
      definition.eventKey
  ) as MetaEventKey[];
