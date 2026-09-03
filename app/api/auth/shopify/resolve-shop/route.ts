import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveShopifyShopIdentity,
} from '@/lib/auth/shopify';

import {
  getIntegrationTenant,
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
//      ↓
// Shopify ID token
//      ↓
// Resolve real Shopify shop
//      ↓
// Update integration connection
//      ↓
// Create / update integration account
//      ↓
// Return Growth OS account identity
//
// No Shopify Admin access token is returned.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // SHOPIFY ID TOKEN
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


    // ========================================================
    // RESOLVE SHOPIFY SHOP
    // ========================================================

    const shop =
      await resolveShopifyShopIdentity(
        idToken
      );


    if (
      !shop?.shopId
    ) {

      throw new Error(
        'Shopify shop identity did not return a Shop ID'
      );

    }


    // ========================================================
    // CURRENT GROWTH OS TENANT
    //
    // No Brillare hardcoding.
    //
    // Today:
    // environment → Brillare
    //
    // Future:
    // authenticated SaaS user → workspace → brand
    // ========================================================

    const tenant =
      await getIntegrationTenant();


    // ========================================================
    // EXISTING SHOPIFY CONNECTION
    // ========================================================

    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        'shopify'

      );


    if (!connection) {

      throw new Error(
        'Shopify integration connection is not configured for the current brand'
      );

    }


    const providerAccountId =
      String(
        shop.shopId
      );


    const providerAccountName =
      shop.shopName
      ||
      shop.shopDomain
      ||
      providerAccountId;


    // ========================================================
    // UPDATE CONNECTION WITH REAL SHOPIFY ACCOUNT IDENTITY
    //
    // IMPORTANT:
    //
    // Preserve the current connection mode / ingestion adapter.
    //
    // We do NOT switch legacy → native here yet.
    //
    // Native ingestion will be enabled separately once the new
    // growthos_data writer is ready.
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
    // REGISTER SHOPIFY STORE AS INTEGRATION ACCOUNT
    //
    // This is the identity that all new Shopify warehouse rows
    // will carry.
    // ========================================================

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
          'shop',

        isSelected:
          true,


        // ----------------------------------------------------
        // Do not invent currency / timezone here.
        //
        // resolveShopifyShopIdentity currently gives:
        //
        // shopId
        // shopDomain
        // shopName
        //
        // We can populate currency/timezone later from Shopify
        // Shop API metadata.
        // ----------------------------------------------------

        currency:
          null,

        timezone:
          null,

        metadata: {

          shopDomain:
            shop.shopDomain
            ??
            null,

          shopName:
            shop.shopName
            ??
            null,

        },

      });


    // ========================================================
    // RESPONSE
    //
    // Never return Shopify Admin access tokens.
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

    console.error(
      'SHOPIFY_RESOLVE_SHOP_ERROR',
      error
    );


    const message =
      error?.message
      ||
      'Failed to resolve Shopify Shop ID';


    const looksLikeAuthenticationError =

      /token|authentication|unauthorized|unauthenticated|jwt/i
        .test(
          message
        );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          message,

      },
      {
        status:
          looksLikeAuthenticationError
            ? 401
            : 500,
      }
    );

  }

}