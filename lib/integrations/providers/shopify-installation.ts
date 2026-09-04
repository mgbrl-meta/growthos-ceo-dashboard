import 'server-only';

import type {
  ShopifyResolvedShop,
} from '@/lib/auth/shopify';

import {
  normalizeShopDomain,
} from '@/lib/auth/config';

import {
  resolveTenantContext,
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import {
  upsertGrowthOSTenant,
} from '@/lib/tenancy/control-plane';

import {
  getIntegrationAccountByProviderAccountId,
  upsertIntegrationAccount,
  upsertIntegrationConnection,
} from '@/lib/integrations/store';


// ============================================================
// SAFE SLUG
// ============================================================

function makeSlug(
  value: string
) {

  const slug =
    String(
      value
      ||
      ''
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(
        0,
        100
      );


  if (!slug) {

    throw new Error(
      'SHOPIFY_TENANT_SLUG_INVALID'
    );

  }


  return slug;

}


// ============================================================
// SHOPIFY STORE KEY
//
// my-store.myshopify.com
//          ↓
// my-store
//
// myshopify domains are stable Shopify store identities and
// make good human-readable SaaS tenant seeds.
//
// Canonical Shop GID remains the provider account identity.
// ============================================================

function getShopKey(
  shopDomain: string
) {

  const normalized =
    normalizeShopDomain(
      shopDomain
    );


  const key =
    normalized
      .replace(
        /\.myshopify\.com$/i,
        ''
      );


  return makeSlug(
    key
  );

}


// ============================================================
// RESOLVE OR PROVISION SHOPIFY TENANT
//
// Priority:
//
// 1. Existing Shopify integration_account
// 2. Temporary legacy primary-shop adoption
// 3. Automatic SaaS tenant provisioning
//
// The legacy branch exists ONLY so the current Brillare store
// is attached to its existing Growth OS tenant instead of
// creating a duplicate tenant.
//
// Once the integration_account exists, that branch is no
// longer needed for the store.
// ============================================================

export async function resolveOrProvisionShopifyTenant(
  shop: ShopifyResolvedShop
) {

  // ==========================================================
  // 1. EXISTING SHOPIFY ACCOUNT MAPPING
  // ==========================================================

  const existingAccount =
    await getIntegrationAccountByProviderAccountId(
      'shopify',
      shop.shopId
    );


  if (existingAccount) {

    return resolveTenantContextById(

      existingAccount.workspace_id,

      existingAccount.brand_id

    );

  }


  // ==========================================================
  // 2. TEMPORARY LEGACY STORE ADOPTION
  //
  // Existing environment already contains:
  //
  // SHOPIFY_PRIMARY_SHOP_DOMAIN
  //
  // This lets the current Brillare store adopt its existing
  // Growth OS workspace exactly once.
  //
  // Future stores will not enter this branch.
  // ==========================================================

  const legacyPrimaryShop =
    String(
      process.env.SHOPIFY_PRIMARY_SHOP_DOMAIN
      ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    legacyPrimaryShop
    &&
    legacyPrimaryShop ===
      shop.shopDomain
        .trim()
        .toLowerCase()
  ) {

    return resolveTenantContext();

  }


  // ==========================================================
  // 3. NEW SAAS TENANT
  // ==========================================================

  const shopKey =
    getShopKey(
      shop.shopDomain
    );


  const shopName =
    String(
      shop.shopName
      ||
      shopKey
    ).trim();


  const currency =
    String(
      process.env.GROWTHOS_DEFAULT_CURRENCY
      ||
      'INR'
    )
      .trim()
      .toUpperCase();


  const timezone =
    String(
      process.env.GROWTHOS_DEFAULT_TIMEZONE
      ||
      'Asia/Kolkata'
    ).trim();


  return upsertGrowthOSTenant({

    workspaceId:
      shopKey,

    workspaceName:
      shopName,

    workspaceSlug:
      shopKey,

    brandId:
      shopKey,

    brandName:
      shopName,

    brandSlug:
      shopKey,

    currency,

    timezone,

  });

}


// ============================================================
// REGISTER SHOPIFY INTEGRATION
//
// Requires:
//
// verified Shopify identity
// resolved Growth OS tenant
// Secret Manager credential pointer
//
// Creates:
//
// integration_connection
// integration_account
//
// Idempotent.
// ============================================================

export async function registerShopifyIntegration(
  input: {

    tenant: {

      workspaceId:
        string;

      brandId:
        string;

    };

    shop:
      ShopifyResolvedShop;

    secretName:
      string;

  }
) {

  // ==========================================================
  // CONNECTION
  // ==========================================================

  const connectionId =
    await upsertIntegrationConnection({

      workspaceId:
        input.tenant.workspaceId,

      brandId:
        input.tenant.brandId,

      provider:
        'shopify',

      connectionMode:
        'oauth',

      // Growth OS Shopify architecture:
      //
      // Admin API
      // + Webhooks
      // + Web Pixel / Cart Bridge
      ingestionAdapter:
        'shopify_hybrid_v1',

      status:
        'connected',

      providerAccountId:
        input.shop.shopId,

      providerAccountName:
        input.shop.shopName,

      secretName:
        input.secretName,

      error:
        null,

    });


  // ==========================================================
  // PROVIDER ACCOUNT
  // ==========================================================

  const integrationAccountId =
    await upsertIntegrationAccount({

      workspaceId:
        input.tenant.workspaceId,

      brandId:
        input.tenant.brandId,

      connectionId,

      provider:
        'shopify',

      providerAccountId:
        input.shop.shopId,

      providerAccountName:
        input.shop.shopName,

      accountType:
        'store',

      isSelected:
        true,

      currency:
        null,

      timezone:
        null,

      metadata: {

        shop_domain:
          input.shop.shopDomain,

        installation_source:
          'shopify_oauth',

        ingestion_mode:
          'hybrid',

  // --------------------------------------------------------
  // CONNECTOR ONBOARDING STATE
  //
  // Every fresh/re-authorized Shopify installation must
  // complete the storefront identity bridge setup before
  // Growth OS treats the connector as fully ready.
  // --------------------------------------------------------

        setup_status:
          'required',

        setup_required_at:
          new Date()
            .toISOString(),

        },

      });


  return {

    connectionId,

    integrationAccountId,

  };

}