import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getIntegrationConnectionById,
  markIntegrationSetupReady,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// COMPLETE CONNECTOR SETUP
//
// Browser
//      ↓
// authenticated Growth OS session
//      ↓
// connection lookup
//      ↓
// verify workspace + brand ownership
//      ↓
// setup_status = ready
//
// Provider is NOT trusted from browser input.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATION
    // ========================================================

    const identity =
      await authenticateRequest(
        request
      );


    if (
      !identity
      ||
      !identity.workspaceId
      ||
      !identity.brandId
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
    // 2. REQUEST
    // ========================================================

    let body:
      any;


    try {

      body =
        await request.json();

    } catch {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Invalid request body',

        },
        {
          status:
            400,
        }
      );

    }


    const connectionId =
      String(
        body?.connectionId
        ||
        ''
      ).trim();


    if (!connectionId) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'connectionId is required',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 3. CONNECTION
    // ========================================================

    const connection =
      await getIntegrationConnectionById(
        connectionId
      );


    if (!connection) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Integration connection not found',

        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 4. TENANT AUTHORIZATION
    // ========================================================

    if (
      connection.workspace_id !==
        identity.workspaceId
      ||
      connection.brand_id !==
        identity.brandId
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'FORBIDDEN',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 5. MARK READY
    // ========================================================

    await markIntegrationSetupReady({

      connectionId,

      workspaceId:
        identity.workspaceId,

      brandId:
        identity.brandId,

    });


    return NextResponse.json({

      ok:
        true,

      connectionId,

      provider:
        connection.provider,

      setupStatus:
        'ready',

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Integration setup completion failed'
      );


    console.error(
      'INTEGRATION_SETUP_COMPLETE_ERROR',
      {
        message,
      }
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
          500,
      }
    );

  }

}