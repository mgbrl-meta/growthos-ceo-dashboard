import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSUserById,
} from '@/lib/auth/user-store';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// CURRENT AUTHENTICATED IDENTITY
//
// Returns:
//
// authenticated user
// +
// active workspace / brand
// +
// resolved tenant metadata
//
// This becomes the canonical client-side identity endpoint.
//
// IMPORTANT:
//
// Browser does NOT provide workspaceId / brandId here.
//
// They come from the authenticated signed Growth OS session.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATE REQUEST
    // ========================================================

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


    // ========================================================
    // 2. NORMALIZE ACTIVE TENANT IDS
    // ========================================================

    const workspaceId =
      String(
        identity.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        identity.brandId
        ||
        ''
      ).trim();


    // ========================================================
    // 3. RESOLVE ACTIVE TENANT
    //
    // Runtime tenant identity comes from the authenticated
    // session.
    //
    // Browser cannot choose another workspace / brand through
    // this endpoint.
    // ========================================================

    let tenant:
      Awaited<
        ReturnType<
          typeof resolveTenantContextById
        >
      >
      |
      null =
        null;


    if (
      workspaceId
      &&
      brandId
    ) {

      tenant =
        await resolveTenantContextById(
          workspaceId,
          brandId
        );

    }


    // ========================================================
    // 4. LOAD USER PROFILE
    //
    // Password-authenticated users exist in:
    //
    // growthos_control.users
    //
    // Shopify authentication may not necessarily have a
    // corresponding password-user record, so failure to find
    // one is not an authentication failure.
    // ========================================================

    let user:
      Awaited<
        ReturnType<
          typeof getGrowthOSUserById
        >
      >
      |
      null =
        null;


    if (
      identity.userId
    ) {

      try {

        user =
          await getGrowthOSUserById(
            identity.userId
          );

      } catch (
        error
      ) {

        console.error(
          'GROWTHOS_ME_USER_LOOKUP_ERROR',
          {
            userId:
              identity.userId,
          }
        );

      }

    }


    // ========================================================
    // 5. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      authenticated:
        true,


      // ======================================================
      // USER
      // ======================================================

      user: {

        userId:
          identity.userId,

        email:
          identity.email
          ??
          user?.email
          ??
          null,

        fullName:
          user?.full_name
          ??
          null,

        role:
          identity.role
          ??
          null,

      },


      // ======================================================
      // ACTIVE WORKSPACE / BRAND CONTEXT
      // ======================================================

      activeContext: {

        workspaceId:
          tenant?.workspaceId
          ??
          workspaceId
          ??
          null,

        workspaceName:
          tenant?.workspaceName
          ??
          null,

        workspaceSlug:
          tenant?.workspaceSlug
          ??
          null,

        brandId:
          tenant?.brandId
          ??
          brandId
          ??
          null,

        brandName:
          tenant?.brandName
          ??
          null,

        brandSlug:
          tenant?.brandSlug
          ??
          null,

        currency:
          tenant?.currency
          ??
          null,

        timezone:
          tenant?.timezone
          ??
          null,

        role:
          identity.role
          ??
          null,

      },


      // ======================================================
      // AUTH CONTEXT
      // ======================================================

      auth: {

        source:
          identity.authSource,

        method:
          identity.authMethod
          ??
          null,

      },


      // ======================================================
      // PROVIDER CONTEXT
      //
      // Relevant primarily for Shopify-launched sessions.
      // ======================================================

      providerContext: {

        shopId:
          identity.shopId
          ??
          null,

        shopDomain:
          identity.shopDomain
          ??
          null,

      },


      // ======================================================
      // TEMPORARY BACKWARD COMPATIBILITY
      //
      // Keep the old identity object until all existing callers
      // have moved to:
      //
      // user
      // activeContext
      // auth
      // providerContext
      // ======================================================

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

        tenantId:
          identity.tenantId,

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
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Authentication check failed'
      );


    console.error(
      'GROWTHOS_ME_ERROR',
      {
        message,
      }
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