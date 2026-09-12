import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  listActiveBrandMemberships,
} from '@/lib/auth/user-store';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import {
  setGrowthOsSessionCookie,
} from '@/lib/auth/session';

import {
  updateGrowthOSSecuritySessionContext,
} from '@/lib/auth/security-store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// SWITCH ACTIVE GROWTH OS BRAND
//
// Browser requests:
//
// workspaceId
// brandId
//
// Server verifies:
//
// authenticated user
//        ↓
// brand_memberships
//        ↓
// requested membership exists + active
//        ↓
// tenant active
//        ↓
// issue NEW signed Growth OS session
//
// Browser cannot gain access merely by changing brandId.
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATE
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
    // 2. SHOPIFY SESSION
    //
    // Shopify launch is tied to the installed Shopify store.
    //
    // Multi-brand switching belongs to external Growth OS
    // users for now.
    // ========================================================

    if (
      identity.authMethod ===
        'shopify'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Shopify sessions cannot switch brands',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 3. REQUEST BODY
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


    const workspaceId =
      String(
        body?.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        body?.brandId
        ||
        ''
      ).trim();


    if (
      !workspaceId
      ||
      !brandId
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'workspaceId and brandId are required',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 4. LOAD CURRENT USER MEMBERSHIPS
    // ========================================================

    const memberships =
      await listActiveBrandMemberships(
        identity.userId
      );


    // ========================================================
    // 5. VERIFY BRAND ACCESS
    // ========================================================

    const membership =
      memberships.find(
        item =>

          item.workspace_id ===
            workspaceId

          &&

          item.brand_id ===
            brandId

      );


    if (!membership) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'You do not have access to this brand',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 6. VERIFY WORKSPACE + BRAND ARE ACTIVE
    // ========================================================

    const tenant =
      await resolveTenantContextById(

        membership.workspace_id,

        membership.brand_id

      );


    // ========================================================
    // 7. CREATE NEW SESSION
    //
    // User stays the same.
    //
    // Active:
    //
    // workspace
    // brand
    // role
    //
    // change according to membership.
    // ========================================================

    if (!identity.authSessionId) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'SECURITY_SESSION_REQUIRED',
        },
        {
          status:
            401,
        }
      );

    }


    await updateGrowthOSSecuritySessionContext({

      sessionId:
        identity.authSessionId,

      userId:
        identity.userId,

      workspaceId:
        tenant.workspaceId,

      brandId:
        tenant.brandId,

    });


    await setGrowthOsSessionCookie({

      userId:
        identity.userId,

      sessionId:
        identity.authSessionId,

      email:
        identity.email,

      workspaceId:
        tenant.workspaceId,

      brandId:
        tenant.brandId,

      role:
        membership.role,

      authMethod:
        'password',

      authSource:
        'public',

    });


    // ========================================================
    // 8. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      activeContext: {

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

        role:
          membership.role,

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to switch Growth OS brand'
      );


    console.error(
      'GROWTHOS_SWITCH_BRAND_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to switch brand',

      },
      {
        status:
          500,
      }
    );

  }

}