import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  getIntegrationConnection,
} from '@/lib/integrations/store';

import {
  runIntegrationSync,
} from '@/lib/integrations/sync-engine';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// MANUAL INTEGRATION SYNC TEST
//
// GET /api/system/sync-test
//
// Example:
//
// /api/system/sync-test
//   ?provider=meta_ads
//   &entity=campaigns
//
// ARCHITECTURE:
//
// authenticated Growth OS request
//        ↓
// active workspace + brand
//        ↓
// provider connection for THAT brand
//        ↓
// runIntegrationSync()
//        ↓
// sync state / warehouse
//
//
// IMPORTANT:
//
// This route does NOT use:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// Therefore a manual sync can never silently run against
// Brillare merely because Brillare is configured in ENV.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATED ACTIVE TENANT
    // ========================================================

    const {
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 2. REQUEST PARAMETERS
    // ========================================================

    const provider =
      String(
        request
          .nextUrl
          .searchParams
          .get(
            'provider'
          )
        ||
        'meta_ads'
      ).trim();


    const entity =
      String(
        request
          .nextUrl
          .searchParams
          .get(
            'entity'
          )
        ||
        'campaigns'
      ).trim();


    if (!provider) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'PROVIDER_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    if (!entity) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'ENTITY_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 3. LOAD PROVIDER CONNECTION
    //
    // Strictly scoped to:
    //
    // active workspace
    // active brand
    // requested provider
    // ========================================================

    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        provider

      );


    if (!connection) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'INTEGRATION_CONNECTION_NOT_FOUND',

          provider,

        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 4. CONNECTION MUST BE USABLE
    //
    // Do not accidentally start a sync for a connection that
    // has not completed provider/account setup.
    // ========================================================

    if (
      connection.status !==
        'connected'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'INTEGRATION_NOT_CONNECTED',

          provider,

          status:
            connection.status,

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 5. RUN MANUAL SYNC
    //
    // No tenant discovery occurs inside this route after this
    // point.
    //
    // The authenticated tenant is explicitly propagated into
    // the sync engine.
    // ========================================================

    const result =
      await runIntegrationSync({

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        connectionId:
          connection.connection_id,

        providerId:
          provider,

        providerAccountId:
          connection.provider_account_id
          ??
          null,

        entity,

        syncType:
          'manual',

      });


    // ========================================================
    // 6. RESPONSE
    // ========================================================

    return NextResponse.json(
      result
    );


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Sync test failed'
      );


    console.error(
      'SYNC_TEST_ERROR',
      {
        message,
      }
    );


    // ========================================================
    // AUTHENTICATION FAILURE
    // ========================================================

    if (
      message ===
      'UNAUTHENTICATED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'UNAUTHENTICATED',

        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // INVALID TENANT CONTEXT
    // ========================================================

    if (
      message ===
        'AUTHENTICATED_TENANT_CONTEXT_MISSING'
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
            'TENANT_CONTEXT_INVALID',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // INTERNAL / PROVIDER / SYNC FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Sync test failed',

      },
      {
        status:
          500,
      }
    );

  }

}