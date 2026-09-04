import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  integrationRegistry,
} from '@/lib/integrations/registry';

import {
  listIntegrationConnections,
} from '@/lib/integrations/store';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// GET INTEGRATIONS
//
// Registry:
// what Growth OS supports.
//
// Connection store:
// what the authenticated workspace / brand actually has
// connected.
//
// IMPORTANT:
//
// Tenant context comes ONLY from the authenticated request:
//
// session
//    ↓
// workspaceId + brandId
//    ↓
// control plane validation
//
// This route does NOT use:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// Therefore brand switching changes the integration data
// returned by this API.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATED TENANT
    // ========================================================

    const {
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 2. LIVE CONNECTIONS
    //
    // Scoped strictly to:
    //
    // active workspace
    // active brand
    // ========================================================

    const connections =
      await listIntegrationConnections(

        tenant.workspaceId,

        tenant.brandId

      );


    // ========================================================
    // 3. CONNECTION LOOKUP
    //
    // One connection record per provider for the active brand.
    // ========================================================

    const connectionMap =
      new Map(

        connections.map(
          connection => [

            String(
              connection.provider
            ),

            connection,

          ]
        )

      );


    // ========================================================
    // 4. MERGE PROVIDER REGISTRY + CONNECTION STATE
    //
    // Registry defines:
    //
    // - supported integrations
    // - labels
    // - UI metadata
    //
    // Connection store defines:
    //
    // - connection status
    // - selected account
    // - ingestion adapter
    // - last sync
    // - errors
    // ========================================================

    const integrations =
      integrationRegistry.map(
        provider => {

          const connection =
            connectionMap.get(
              provider.id
            );


          // ==================================================
          // NOT CONNECTED
          // ==================================================

          if (!connection) {

            return {

              ...provider,

              status:
                provider.status
                ||
                'not_connected',

              connectionMode:
                null,

              ingestionAdapter:
                null,

              accountName:
                provider.accountName
                ||
                null,

              accountId:
                provider.accountId
                ||
                null,

              lastSyncAt:
                provider.lastSyncAt
                ||
                null,

              error:
                provider.error
                ||
                null,

              connectionManaged:
                provider.connectionManaged
                ||
                false,

              connectionId:
                null,

            };

          }


          // ==================================================
          // CONNECTED / MANAGED CONNECTION
          // ==================================================

          return {

            ...provider,

            status:
              connection.status,

            connectionMode:
              connection.connection_mode
              ||
              null,

            ingestionAdapter:
              connection.ingestion_adapter
              ||
              null,

            accountName:
              connection.provider_account_name
              ||
              connection.provider_user_name
              ||
              provider.accountName
              ||
              null,

            accountId:
              connection.provider_account_id
              ||
              provider.accountId
              ||
              null,

            lastSyncAt:
              connection.last_sync_at
              ||
              provider.lastSyncAt
              ||
              null,

            error:
              connection.error
              ||
              null,

            connectionManaged:
              true,

            connectionId:
              connection.connection_id,

          };

        }
      );


    // ========================================================
    // 5. RESPONSE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,


        data: {

          integrations,

        },


        meta: {

          workspaceId:
            tenant.workspaceId,

          workspaceName:
            tenant.workspaceName,

          brandId:
            tenant.brandId,

          brandName:
            tenant.brandName,

          registeredConnections:
            connections.length,

          count:
            integrations.length,

        },

      }
    );


  } catch (
    error: any
  ) {

    // ========================================================
    // SAFE ERROR RESPONSE
    //
    // Do not expose arbitrary internal exception text.
    // ========================================================

    const message =
      String(
        error?.message
        ||
        'Failed to load integrations'
      );


    console.error(
      'INTEGRATIONS_API_ERROR',
      {
        message,
      }
    );


    // ========================================================
    // AUTH FAILURE
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
    // TENANT CONTEXT FAILURE
    //
    // A valid authenticated session exists, but its active
    // workspace / brand cannot be resolved.
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
    // INTERNAL FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Failed to load integrations',

      },
      {
        status:
          500,
      }
    );

  }

}