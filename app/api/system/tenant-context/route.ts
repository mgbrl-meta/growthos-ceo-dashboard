import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// CURRENT GROWTH OS TENANT CONTEXT
//
// GET /api/system/tenant-context
//
// Authenticated Growth OS request
//        ↓
// signed session
//        ↓
// workspaceId + brandId
//        ↓
// control-plane validation
//        ↓
// current TenantContext
//
// IMPORTANT:
//
// This route does NOT use:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// Therefore after a user switches brand, this endpoint
// immediately reflects the newly active tenant.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATED TENANT
    // ========================================================

    const {
      identity,
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 2. SAFE RESPONSE
    //
    // No secrets or provider credentials are exposed.
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        tenant: {

          workspaceId:
            tenant.workspaceId,

          workspaceName:
            tenant.workspaceName,

          workspaceSlug:
            tenant.workspaceSlug,

          brandId:
            tenant.brandId,

          brandName:
            tenant.brandName,

          brandSlug:
            tenant.brandSlug,

          currency:
            tenant.currency,

          timezone:
            tenant.timezone,

        },

        identity: {

          userId:
            identity.userId,

          email:
            identity.email
            ??
            null,

          role:
            identity.role
            ??
            null,

          authMethod:
            identity.authMethod
            ??
            null,

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
        'Unable to resolve tenant context'
      );


    console.error(
      'TENANT_CONTEXT_API_ERROR',
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
    // INTERNAL FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to resolve tenant context',

      },
      {
        status:
          500,
      }
    );

  }

}