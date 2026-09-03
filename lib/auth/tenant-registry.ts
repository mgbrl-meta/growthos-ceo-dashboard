import 'server-only';

import {
  getPrimaryShopifyShopDomain,
  getPrimaryShopifyShopId,
  getPrimaryShopifyTenantId,
  normalizeShopDomain,
} from './config';


// ============================================================
// TENANT
// ============================================================

export type GrowthOsTenant = {

  tenantId: string;

  provider:
    'shopify';

  shopId: string;

  shopDomain: string;

};


// ============================================================
// CURRENT TENANT REGISTRY
//
// V1:
// environment-backed single tenant.
//
// Future:
// BigQuery / Postgres tenant registry.
//
// IMPORTANT:
// Shopify Shop ID is the canonical external identity.
// Domain is used to locate the tenant from Shopify's
// verified ID-token "dest" claim.
// ============================================================

export function getShopifyTenants():

  GrowthOsTenant[] {

  const shopDomain =
    getPrimaryShopifyShopDomain();


  const shopId =
    getPrimaryShopifyShopId();


  return [

    {

      tenantId:
        getPrimaryShopifyTenantId(),

      provider:
        'shopify',

      shopId,

      shopDomain,

    },

  ];

}


// ============================================================
// LOOKUP BY VERIFIED SHOP DOMAIN
// ============================================================

export function findTenantByShopDomain(
  shopDomain: string
):

  GrowthOsTenant | null {

  const normalized =
    normalizeShopDomain(
      shopDomain
    );


  if (!normalized) {

    return null;

  }


  return (
    getShopifyTenants()
      .find(
        tenant =>
          tenant.shopDomain ===
          normalized
      )
    ||
    null
  );

}


// ============================================================
// LOOKUP BY CANONICAL SHOP ID
// ============================================================

export function findTenantByShopId(
  shopId: string
):

  GrowthOsTenant | null {

  const normalized =
    String(
      shopId || ''
    ).trim();


  if (!normalized) {

    return null;

  }


  return (
    getShopifyTenants()
      .find(
        tenant =>
          tenant.shopId ===
          normalized
      )
    ||
    null
  );

}


// ============================================================
// REQUIRE FULL TENANT CONFIGURATION
// ============================================================

export function requireConfiguredShopifyTenant(
  shopDomain: string
):

  GrowthOsTenant {

  const tenant =
    findTenantByShopDomain(
      shopDomain
    );


  if (!tenant) {

    throw new Error(
      `Shopify shop is not registered: ${shopDomain}`
    );

  }


  if (!tenant.shopId) {

    throw new Error(
      'SHOPIFY_PRIMARY_SHOP_ID is not configured'
    );

  }


  return tenant;

}