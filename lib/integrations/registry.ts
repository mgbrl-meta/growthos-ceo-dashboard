import type {
  IntegrationProvider,
} from './types';


export const integrationRegistry:
  IntegrationProvider[] = [


  // =========================================================
  // SHOPIFY
  // =========================================================

  {
    id:
      'shopify',

    name:
      'Shopify',

    shortName:
      'Shopify',

    description:
      'Orders, customers, products, transactions and customer journey events.',

    category:
      'commerce',

    authType:
      'shopify_oauth',

    capabilities: [
      'Orders',
      'Customers',
      'Products',
      'Transactions',
      'Webhooks',
      'Customer Journey',
      'Attribution Pixel',
    ],

    status:
      'not_connected',

    accountName:
      null,

    accountId:
      null,

    lastSyncAt:
      null,

    nextSyncAt:
      null,

    error:
      null,

    connectionManaged:
      false,
  },


  // =========================================================
  // META ADS
  // =========================================================

  {
    id:
      'meta_ads',

    name:
      'Meta Ads',

    shortName:
      'Meta',

    description:
      'Campaign, ad set, creative, spend and conversion performance.',

    category:
      'advertising',

    authType:
      'oauth',

    capabilities: [
      'Campaigns',
      'Ad Sets',
      'Ads',
      'Creatives',
      'Spend',
      'Conversions',
      'Breakdowns',
    ],

    status:
      'not_connected',

    accountName:
      null,

    accountId:
      null,

    lastSyncAt:
      null,

    nextSyncAt:
      null,

    error:
      null,

    connectionManaged:
      false,
  },


  // =========================================================
  // GOOGLE ADS
  // =========================================================

  {
    id:
      'google_ads',

    name:
      'Google Ads',

    shortName:
      'Google',

    description:
      'Search, Shopping, campaigns, ad groups, keywords and search terms.',

    category:
      'advertising',

    authType:
      'oauth',

    capabilities: [
      'Campaigns',
      'Ad Groups',
      'Search Terms',
      'Keywords',
      'Shopping',
      'Conversions',
      'Spend',
    ],

    status:
      'not_connected',

    accountName:
      null,

    accountId:
      null,

    lastSyncAt:
      null,

    nextSyncAt:
      null,

    error:
      null,

    connectionManaged:
      false,
  },


  // =========================================================
  // BIGQUERY
  // =========================================================

  {
    id:
      'bigquery',

    name:
      'Google BigQuery',

    shortName:
      'BigQuery',

    description:
      'Primary analytical warehouse used by Growth OS.',

    category:
      'warehouse',

    authType:
      'internal',

    capabilities: [
      'Warehouse',
      'Analytics Tables',
      'Transformation Layer',
      'Historical Data',
    ],

    /*
     * Growth OS already queries BigQuery directly.
     *
     * We mark this as connected for the current installation.
     * Later this status will come from integration_connections.
     */
    status:
      'connected',

    accountName:
      'shopify-colab / brillare_shopify',

    accountId:
      'shopify-colab',

    lastSyncAt:
      null,

    nextSyncAt:
      null,

    error:
      null,

    connectionManaged:
      true,
  },

];