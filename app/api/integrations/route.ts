import {
  NextResponse,
} from 'next/server';

import {
  integrationRegistry,
} from '@/lib/integrations/registry';

import {
  getIntegrationTenant,
  listIntegrationConnections,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';


// ============================================================
// GET INTEGRATIONS
//
// Registry = what Growth OS supports.
//
// Connection store = what current workspace / brand
// actually has connected.
//
// The response merges both.
// ============================================================

export async function GET() {

  try {

    // ========================================================
    // TENANT
    // ========================================================

    const tenant =
      await getIntegrationTenant();


    // ========================================================
    // LIVE CONNECTIONS
    // ========================================================

    const connections =
      await listIntegrationConnections(

        tenant.workspaceId,

        tenant.brandId

      );


    // ========================================================
    // CONNECTION LOOKUP
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
    // MERGE REGISTRY + CONNECTION STATE
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
    // RESPONSE
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

    console.error(
      'INTEGRATIONS_API_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Failed to load integrations',

      },
      {
        status:
          500,
      }
    );

  }

}