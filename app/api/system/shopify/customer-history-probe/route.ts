import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  getIntegrationAccountByProviderAccountId,
  getIntegrationConnection,
} from '@/lib/integrations/store';

import {
  queryEarliestCustomerWithStoredShopifyCredential,
} from '@/lib/integrations/providers/shopify-credentials';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// METADATA
// ============================================================

function normalizeMetadata(
  value: unknown
):
  Record<string, any> {

  if (
    value
    &&
    typeof value ===
      'object'
    &&
    !Array.isArray(
      value
    )
  ) {

    return value as Record<
      string,
      any
    >;

  }


  if (
    typeof value ===
      'string'
  ) {

    try {

      const parsed =
        JSON.parse(
          value
        );


      if (
        parsed
        &&
        typeof parsed ===
          'object'
        &&
        !Array.isArray(
          parsed
        )
      ) {

        return parsed;

      }

    } catch {

      return {};

    }

  }


  return {};

}


// ============================================================
// REQUIRED STRING
// ============================================================

function requireValue(
  value: unknown,
  errorCode: string
) {

  const normalized =
    String(
      value
      ??
      ''
    ).trim();


  if (!normalized) {

    throw new Error(
      errorCode
    );

  }


  return normalized;

}


// ============================================================
// CUSTOMER HISTORY SOURCE PROBE
//
// READ ONLY.
//
// Growth OS authenticated tenant
//        ↓
// canonical Shopify connection
//        ↓
// exact integration account
//        ↓
// Secret Manager credential
//        ↓
// earliest accessible Shopify Customer
//
// NO:
//
// backfill creation
// Pub/Sub
// warehouse writes
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // TENANT
    // ========================================================

    const {
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // SHOPIFY CONNECTION
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
            'SHOPIFY_CUSTOMER_HISTORY_CONNECTION_NOT_FOUND',

        },
        {
          status:
            404,
        }
      );

    }


    if (
      connection.status !==
        'connected'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_CUSTOMER_HISTORY_CONNECTION_NOT_CONNECTED',

          connectionStatus:
            connection.status,

        },
        {
          status:
            409,
        }
      );

    }


    const providerAccountId =
      requireValue(
        connection.provider_account_id,
        'SHOPIFY_CUSTOMER_HISTORY_PROVIDER_ACCOUNT_MISSING'
      );


    const secretName =
      requireValue(
        connection.secret_name,
        'SHOPIFY_CUSTOMER_HISTORY_SECRET_MISSING'
      );


    // ========================================================
    // EXACT SHOPIFY ACCOUNT
    // ========================================================

    const account =
      await getIntegrationAccountByProviderAccountId(

        'shopify',

        providerAccountId

      );


    if (!account) {

      throw new Error(
        'SHOPIFY_CUSTOMER_HISTORY_ACCOUNT_NOT_FOUND'
      );

    }


    if (
      account.workspace_id !==
        tenant.workspaceId
      ||
      account.brand_id !==
        tenant.brandId
      ||
      account.connection_id !==
        connection.connection_id
    ) {

      throw new Error(
        'SHOPIFY_CUSTOMER_HISTORY_ACCOUNT_IDENTITY_MISMATCH'
      );

    }


    const integrationAccountId =
      requireValue(
        account.integration_account_id,
        'SHOPIFY_CUSTOMER_HISTORY_INTEGRATION_ACCOUNT_MISSING'
      );


    const metadata =
      normalizeMetadata(
        account.metadata
      );


    const shopDomain =
      requireValue(
        metadata.shop_domain,
        'SHOPIFY_CUSTOMER_HISTORY_SHOP_DOMAIN_MISSING'
      );


    // ========================================================
    // READ SHOPIFY SOURCE BOUNDARY
    // ========================================================

    const source =
      await queryEarliestCustomerWithStoredShopifyCredential({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        secretName,

        expectedShopId:
          providerAccountId,

        expectedShopDomain:
          shopDomain,

      });


    // ========================================================
    // SAFE RESPONSE
    //
    // No credential material.
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      step:
        'SHOPIFY_EARLIEST_CUSTOMER_PROBED',

      data: {

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId:
          connection.connection_id,

        integrationAccountId,

        providerAccountId,

        shopDomain,

        hasCustomers:
          Boolean(
            source.customer
          ),

        earliestCustomer:
          source.customer
            ?
              {

                id:
                  source.customer.id,

                legacyResourceId:
                  source.customer.legacyResourceId,

                createdAt:
                  source.customer.createdAt,

                updatedAt:
                  source.customer.updatedAt,

              }
            :
              null,

        tokenRefreshed:
          source.tokenRefreshed,

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify Customer history probe failed'
      );


    console.error(
      'SHOPIFY_CUSTOMER_HISTORY_PROBE_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_CUSTOMER_HISTORY_PROBE_FAILED',

        message:
          process.env.NODE_ENV ===
            'development'
            ?
              message
            :
              undefined,

      },
      {
        status:
          500,
      }
    );

  }

}