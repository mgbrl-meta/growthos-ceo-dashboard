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


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// LIST AVAILABLE BRANDS
//
// PASSWORD USER:
//
// users
//    ↓
// brand_memberships
//    ↓
// allowed brands
//
//
// SHOPIFY SESSION:
//
// Shopify launch is bound to the installed store.
//
// Return only the currently authenticated Shopify brand.
// ============================================================

export async function GET(
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
    // Shopify authentication is store-bound.
    //
    // Do not expose unrelated external-user memberships.
    // ========================================================

    if (
      identity.authMethod ===
        'shopify'
    ) {

      if (
        !identity.workspaceId
        ||
        !identity.brandId
      ) {

        throw new Error(
          'SHOPIFY_SESSION_TENANT_MISSING'
        );

      }


      const tenant =
        await resolveTenantContextById(

          identity.workspaceId,

          identity.brandId

        );


      return NextResponse.json({

        ok:
          true,

        active: {

          workspaceId:
            tenant.workspaceId,

          brandId:
            tenant.brandId,

        },

        brands: [

          {

            workspaceId:
              tenant.workspaceId,

            workspaceName:
              tenant.workspaceName,

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
              identity.role
              ||
              'admin',

            isDefault:
              true,

            isActive:
              true,

          },

        ],

        canSwitch:
          false,

      });

    }


    // ========================================================
    // 3. EXTERNAL / PASSWORD USER
    // ========================================================

    const memberships =
      await listActiveBrandMemberships(
        identity.userId
      );


    // ========================================================
    // 4. RESOLVE BRAND DETAILS
    // ========================================================

    const brands =
      await Promise.all(

        memberships.map(
          async membership => {

            const tenant =
              await resolveTenantContextById(

                membership.workspace_id,

                membership.brand_id

              );


            return {

              membershipId:
                membership.membership_id,

              workspaceId:
                tenant.workspaceId,

              workspaceName:
                tenant.workspaceName,

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

              isDefault:
                membership.is_default,

              isActive:
                (
                  identity.workspaceId ===
                    tenant.workspaceId

                  &&

                  identity.brandId ===
                    tenant.brandId
                ),

            };

          }
        )

      );


    // ========================================================
    // 5. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      active: {

        workspaceId:
          identity.workspaceId
          ??
          null,

        brandId:
          identity.brandId
          ??
          null,

      },

      brands,

      canSwitch:
        brands.length >
        1,

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load Growth OS brand access'
      );


    console.error(
      'GROWTHOS_BRANDS_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to load brand access',

      },
      {
        status:
          500,
      }
    );

  }

}