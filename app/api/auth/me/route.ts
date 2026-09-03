import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// CURRENT AUTHENTICATED IDENTITY
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const identity =
      await authenticateRequest(
        request
      );


    if (!identity) {

      return NextResponse.json(
        {

          ok:
            false,

          authenticated:
            false,

        },
        {
          status:
            401,
        }
      );

    }


    return NextResponse.json({

      ok:
        true,

      authenticated:
        true,

      identity: {

        authSource:
          identity.authSource,

        authMethod:
          identity.authMethod
          ??
          null,

        userId:
          identity.userId,

        email:
          identity.email
          ??
          null,

        workspaceId:
          identity.workspaceId
          ??
          null,

        brandId:
          identity.brandId
          ??
          null,

        role:
          identity.role
          ??
          null,

        // ----------------------------------------------------
        // TEMPORARY COMPATIBILITY
        // ----------------------------------------------------

        tenantId:
          identity.tenantId,

        // ----------------------------------------------------
        // SHOPIFY CONTEXT
        // ----------------------------------------------------

        shopId:
          identity.shopId
          ??
          null,

        shopDomain:
          identity.shopDomain
          ??
          null,

      },

    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_ME_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        authenticated:
          false,

        error:
          'Authentication check failed',

      },
      {
        status:
          500,
      }
    );

  }

}