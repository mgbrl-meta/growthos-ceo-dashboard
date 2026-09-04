import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveShopifyShopIdentity,
} from '@/lib/auth/shopify';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import {
  getIntegrationAccountByProviderAccountId,
  getShopifyIntegrationAccountByDomain,
  getIntegrationConnection,
  upsertIntegrationConnection,
  upsertIntegrationAccount,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SHOPIFY SHOP IDENTITY RESOLUTION
//
// Shopify App Bridge
//       ↓
// Shopify ID token
//       ↓
// verify authentic Shopify session
//       ↓
// canonical Shopify Shop identity
//       ↓
// integration_accounts lookup
//       ↓
// existing Growth OS workspace + brand
//       ↓
// verify / refresh integration identity
//
//
// IMPORTANT:
//
// This route NEVER uses environment/default tenant resolution.

//
// Shopify itself determines the tenant:
//
// canonical Shopify Shop ID
//         ↓
// integration_accounts
//         ↓
// workspace_id + brand_id
//
//
// NEW SHOP:
//
// A Shopify store that has never been registered must complete
// the Shopify installation/OAuth flow first.
//
// This route does NOT silently provision unknown stores.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. SHOPIFY ID TOKEN
    // ========================================================

    const authorization =
      request.headers.get(
        'authorization'
      );


    if (
      !authorization
      ||
      !authorization
        .toLowerCase()
        .startsWith(
          'bearer '
        )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Missing Shopify ID token',

        },
        {
          status:
            401,
        }
      );

    }


    const idToken =
      authorization
        .slice(
          7
        )
        .trim();


    if (!idToken) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Missing Shopify ID token',

        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // 2. RESOLVE CANONICAL SHOPIFY IDENTITY
    //
    // Shopify ID token
    //       ↓
    // verified shop domain
    //       ↓
    // online Admin token exchange
    //       ↓
    // Shopify Admin API
    //       ↓
    // canonical Shop GID
    //
    // Returns:
    //
    // shopId
    // shopDomain
    // shopName
    // ========================================================

    const shop =
      await resolveShopifyShopIdentity(
        idToken
      );


    if (
      !shop?.shopId
      ||
      !shop?.shopDomain
    ) {

      throw new Error(
        'SHOPIFY_CANONICAL_IDENTITY_INCOMPLETE'
      );

    }


    // ========================================================
    // 3. FIND EXISTING SHOPIFY → GROWTH OS MAPPING
    //
    // Primary lookup:
    //
    // canonical Shopify Shop GID
    //
    // This is the strongest external provider identity.
    // ========================================================

    let mappedAccount =
      await getIntegrationAccountByProviderAccountId(

        'shopify',

        shop.shopId

      );


    // ========================================================
    // 4. DOMAIN COMPATIBILITY LOOKUP
    //
    // Temporary compatibility path for existing installations
    // that may have been registered by domain before canonical
    // Shop GID mapping was fully established.
    //
    // This still uses Growth OS control-plane data.
    //
    // It does NOT use ENV tenant defaults.
    // ========================================================

    if (
      !mappedAccount
      &&
      shop.shopDomain
    ) {

      mappedAccount =
        await getShopifyIntegrationAccountByDomain(
          shop.shopDomain
        );

    }


    // ========================================================
    // 5. UNKNOWN SHOP
    //
    // An unknown Shopify store should enter the canonical
    // installation flow.
    //
    // We must NOT attach it to:
    //
    // Brillare
    // current ENV tenant
    // current browser tenant
    // any arbitrary workspace
    // ========================================================

    if (!mappedAccount) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_INTEGRATION_NOT_REGISTERED',

          installRequired:
            true,

          shop: {

            id:
              shop.shopId,

            domain:
              shop.shopDomain,

            name:
              shop.shopName,

          },

        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 6. RESOLVE EXACT GROWTH OS TENANT
    //
    // integration_account is the authority:
    //
    // Shopify Shop
    //       ↓
    // workspace_id
    // brand_id
    //       ↓
    // control plane
    // ========================================================

    const tenant =
      await resolveTenantContextById(

        mappedAccount.workspace_id,

        mappedAccount.brand_id

      );


    // ========================================================
    // 7. DEFENCE-IN-DEPTH TENANT CHECK
    // ========================================================

    if (
      tenant.workspaceId !==
        mappedAccount.workspace_id
      ||
      tenant.brandId !==
        mappedAccount.brand_id
    ) {

      throw new Error(
        'SHOPIFY_TENANT_MAPPING_MISMATCH'
      );

    }


    // ========================================================
    // 8. LOAD SHOPIFY CONNECTION
    //
    // Strictly scoped to resolved tenant.
    // ========================================================

    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        'shopify'

      );


    if (!connection) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_CONNECTION_NOT_REGISTERED',

          installRequired:
            true,

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 9. CANONICAL PROVIDER ACCOUNT IDENTITY
    // ========================================================

    const providerAccountId =
      String(
        shop.shopId
      ).trim();


    const providerAccountName =
      String(
        shop.shopName
        ||
        shop.shopDomain
        ||
        providerAccountId
      ).trim();


    // ========================================================
    // 10. REFRESH SHOPIFY CONNECTION IDENTITY
    //
    // Preserve existing:
    //
    // connection mode
    // ingestion adapter
    // status
    // credential pointer
    //
    // This route verifies identity.
    //
    // It does NOT redesign or migrate ingestion architecture.
    // ========================================================

    const connectionId =
      await upsertIntegrationConnection({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        provider:
          'shopify',

        connectionMode:
          connection.connection_mode
          ||
          'legacy',

        ingestionAdapter:
          connection.ingestion_adapter
          ||
          'existing_bigquery_pipeline',

        status:
          connection.status
          ||
          'connected',

        providerUserId:
          connection.provider_user_id
          ??
          null,

        providerUserName:
          connection.provider_user_name
          ??
          null,

        providerAccountId,

        providerAccountName,

        secretName:
          connection.secret_name
          ??
          null,

        error:
          null,

      });


    // ========================================================
    // 11. REFRESH INTEGRATION ACCOUNT
    //
    // Preserve existing account metadata and enrich canonical
    // Shopify identity.
    //
    // IMPORTANT:
    //
    // Do not wipe currency/timezone/account metadata that may
    // already have been discovered.
    // ========================================================

    const existingMetadata =
      (
        mappedAccount.metadata
        &&
        typeof mappedAccount.metadata ===
          'object'
      )
        ? mappedAccount.metadata
        : {};


    const integrationAccountId =
      await upsertIntegrationAccount({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId,

        provider:
          'shopify',

        providerAccountId,

        providerAccountName,

        accountType:
          mappedAccount.account_type
          ||
          'store',

        isSelected:
          mappedAccount.is_selected
          ??
          true,

        currency:
          mappedAccount.currency
          ??
          null,

        timezone:
          mappedAccount.timezone
          ??
          null,

        metadata: {

          ...existingMetadata,

          shop_domain:
            shop.shopDomain,

          shop_name:
            shop.shopName
            ??
            null,

          canonical_shop_id:
            shop.shopId,

          identity_source:
            'shopify_id_token',

          identity_verified_at:
            new Date()
              .toISOString(),

        },

      });


    // ========================================================
    // 12. SAFE RESPONSE
    //
    // Never return Shopify Admin credentials.
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        shop: {

          id:
            shop.shopId,

          domain:
            shop.shopDomain,

          name:
            shop.shopName,

          integrationAccountId,

        },

        integration: {

          workspaceId:
            tenant.workspaceId,

          brandId:
            tenant.brandId,

          connectionId,

          integrationAccountId,

          provider:
            'shopify',

          providerAccountId,

        },

      }
    );


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Failed to resolve Shopify Shop ID'
      );


    console.error(
      'SHOPIFY_RESOLVE_SHOP_ERROR',
      {
        message,
      }
    );


    // ========================================================
    // AUTHENTICATION FAILURE
    // ========================================================

    const looksLikeAuthenticationError =

      /token|authentication|unauthorized|unauthenticated|jwt/i
        .test(
          message
        );


    if (
      looksLikeAuthenticationError
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_AUTHENTICATION_FAILED',

        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // TENANT MAPPING FAILURE
    // ========================================================

    if (
      message.includes(
        'TENANT_MAPPING'
      )
      ||
      message.includes(
        'Growth OS tenant could not be resolved'
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_TENANT_CONTEXT_INVALID',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // INTERNAL FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Failed to resolve Shopify store',

      },
      {
        status:
          500,
      }
    );

  }

}