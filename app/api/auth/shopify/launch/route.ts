import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  validateShopifyOAuthShop,
  verifyShopifyOAuthHmac,
  verifyShopifyOAuthTimestamp,
} from '@/lib/integrations/providers/shopify-oauth';

import {
  getShopifyIntegrationAccountByDomain,
} from '@/lib/integrations/store';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import {
  setGrowthOsSessionCookie,
} from '@/lib/auth/session';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// METADATA NORMALIZER
//
// BigQuery JSON may arrive as:
// - object
// - serialized JSON string
//
// Normalize both into one safe object.
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

    return value as
      Record<string, any>;

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

        return parsed as
          Record<string, any>;

      }

    } catch {

      // Ignore invalid compatibility metadata.

    }

  }


  return {};

}


// ============================================================
// GROWTH OS APP URL
// ============================================================

function getGrowthOSAppUrl() {

  return String(
    process.env.GROWTHOS_APP_URL
    ||
    'http://localhost:3000'
  )
    .trim()
    .replace(
      /\/+$/,
      ''
    );

}


// ============================================================
// SHOPIFY STANDALONE APP LAUNCH
//
// Shopify Admin
//       ↓
// signed Shopify launch
//       ↓
// verify HMAC
// verify timestamp
// verify shop domain
//       ↓
// integration account lookup
//
//
// UNKNOWN SHOP
//       ↓
// Shopify OAuth installation
//
//
// EXISTING + UNINSTALLED
//       ↓
// Shopify OAuth reinstallation
//
//
// EXISTING + SETUP NOT READY
//       ↓
// connector setup page
//
//
// EXISTING + READY
//       ↓
// Growth OS dashboard
//
//
// IMPORTANT:
//
// Permanent fail-closed rules:
//
// installation_status = uninstalled
//     → OAuth
//
// setup_status = ready
//     → Dashboard
//
// setup_status = required
//     → Setup
//
// setup_status missing / unknown
//     → Setup
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const params =
      request
        .nextUrl
        .searchParams;


    // ========================================================
    // 1. SHOPIFY LAUNCH PARAMETERS
    // ========================================================

    const shop =
      String(
        params.get(
          'shop'
        )
        ||
        ''
      )
        .trim();


    const timestamp =
      String(
        params.get(
          'timestamp'
        )
        ||
        ''
      )
        .trim();


    if (!shop) {

      throw new Error(
        'SHOPIFY_LAUNCH_SHOP_MISSING'
      );

    }


    // ========================================================
    // 2. VERIFY SHOPIFY-SIGNED LAUNCH
    // ========================================================

    verifyShopifyOAuthHmac(
      params
    );


    verifyShopifyOAuthTimestamp(
      timestamp
    );


    const verifiedShop =
      validateShopifyOAuthShop(
        shop
      );


    // ========================================================
    // 3. RESOLVE SHOPIFY STORE IN GROWTH OS
    //
    // Shopify domain
    //      ↓
    // integration_accounts
    //      ↓
    // workspace
    // brand
    // connection
    // metadata
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        verifiedShop
      );


    // ========================================================
    // 4. UNKNOWN STORE → INSTALL
    //
    // No Growth OS account mapping exists yet.
    //
    // Send through canonical Shopify OAuth installation.
    // ========================================================

    if (!account) {

      const installUrl =
        new URL(
          '/api/integrations/shopify/install',
          getGrowthOSAppUrl()
        );


      installUrl.searchParams.set(
        'shop',
        verifiedShop
      );


      const response =
        NextResponse.redirect(
          installUrl
        );


      // ------------------------------------------------------
      // Temporary launch-flow marker.
      //
      // Useful for installation lineage / compatibility.
      // ------------------------------------------------------

      response.cookies.set(

        'growthos_shopify_launch_flow',

        '1',

        {

          httpOnly:
            true,

          secure:
            process.env.NODE_ENV ===
            'production',

          sameSite:
            'lax',

          path:
            '/',

          maxAge:
            10 * 60,

        }

      );


      return response;

    }


    // ========================================================
    // 5. VALIDATE EXISTING ACCOUNT IDENTITY
    // ========================================================

    const connectionId =
      String(
        account.connection_id
        ||
        ''
      )
        .trim();


    const workspaceId =
      String(
        account.workspace_id
        ||
        ''
      )
        .trim();


    const brandId =
      String(
        account.brand_id
        ||
        ''
      )
        .trim();


    const providerAccountId =
      String(
        account.provider_account_id
        ||
        ''
      )
        .trim();


    if (!connectionId) {

      throw new Error(
        'SHOPIFY_LAUNCH_CONNECTION_ID_MISSING'
      );

    }


    if (
      !workspaceId
      ||
      !brandId
    ) {

      throw new Error(
        'SHOPIFY_LAUNCH_TENANT_IDENTITY_MISSING'
      );

    }


    if (!providerAccountId) {

      throw new Error(
        'SHOPIFY_LAUNCH_PROVIDER_ACCOUNT_ID_MISSING'
      );

    }


    // ========================================================
    // 6. CANONICAL GROWTH OS TENANT
    // ========================================================

    const tenant =
      await resolveTenantContextById(

        workspaceId,

        brandId

      );


    // ========================================================
    // 7. CONNECTOR LIFECYCLE STATE
    // ========================================================

    const metadata =
      normalizeMetadata(
        account.metadata
      );


    const setupStatus =
      String(
        metadata.setup_status
        ||
        ''
      )
        .trim()
        .toLowerCase();


    const installationStatus =
      String(
        metadata.installation_status
        ||
        ''
      )
        .trim()
        .toLowerCase();


    // ========================================================
    // 8. UNINSTALLED → REAUTHORIZE
    //
    // Historical Growth OS tenant/account mapping remains.
    //
    // But the Shopify installation is no longer active.
    //
    // Do NOT create a Growth OS session before Shopify
    // reauthorization succeeds.
    // ========================================================

    if (
      installationStatus ===
        'uninstalled'
    ) {

      const installUrl =
        new URL(
          '/api/integrations/shopify/install',
          getGrowthOSAppUrl()
        );


      installUrl.searchParams.set(
        'shop',
        verifiedShop
      );


      const response =
        NextResponse.redirect(
          installUrl
        );


      response.cookies.set(

        'growthos_shopify_launch_flow',

        '1',

        {

          httpOnly:
            true,

          secure:
            process.env.NODE_ENV ===
            'production',

          sameSite:
            'lax',

          path:
            '/',

          maxAge:
            10 * 60,

        }

      );


      return response;

    }


    // ========================================================
    // 9. CREATE TENANT-AWARE GROWTH OS SESSION
    //
    // At this point:
    //
    // Shopify launch is verified
    // store exists in Growth OS
    // installation is not explicitly uninstalled
    //
    // setup may still be required.
    // ========================================================

    await setGrowthOsSessionCookie({

      userId:
        `shopify:${providerAccountId}`,

      workspaceId:
        tenant.workspaceId,

      brandId:
        tenant.brandId,

      role:
        'admin',

      authMethod:
        'shopify',

      authSource:
        'public',

    });


    // ========================================================
    // 10. SETUP REQUIRED
    //
    // FAIL CLOSED.
    //
    // ONLY explicit:
    //
    // setup_status = ready
    //
    // may enter the dashboard.
    //
    // Therefore:
    //
    // required → setup
    // NULL     → setup
    // unknown  → setup
    // ========================================================

    if (
      setupStatus !==
        'ready'
    ) {

      const setupUrl =
        new URL(
          '/integrations/setup',
          getGrowthOSAppUrl()
        );


      setupUrl.searchParams.set(
        'connectionId',
        connectionId
      );


      return NextResponse.redirect(
        setupUrl
      );

    }


    // ========================================================
    // 11. READY → DASHBOARD
    // ========================================================

    return NextResponse.redirect(
      `${getGrowthOSAppUrl()}/`
    );


  } catch (
    error: any
  ) {

    // ========================================================
    // SAFE ERROR HANDLING
    //
    // Never log:
    //
    // access token
    // refresh token
    // Shopify secret
    // OAuth state
    // HMAC
    // ========================================================

    const message =
      String(
        error?.message
        ||
        'Shopify app launch authentication failed'
      );


    console.error(
      'SHOPIFY_APP_LAUNCH_ERROR',
      {
        message,
      }
    );


    let status =
      403;


    if (
      message.includes(
        'CONNECTION_ID_MISSING'
      )
      ||
      message.includes(
        'TENANT_IDENTITY_MISSING'
      )
      ||
      message.includes(
        'PROVIDER_ACCOUNT_ID_MISSING'
      )
    ) {

      status =
        500;

    }


    return NextResponse.json(
      {

        ok:
          false,

        authenticated:
          false,

        step:
          'SHOPIFY_APP_LAUNCH',

        error:
          message,

      },
      {
        status,
      }
    );

  }

}