import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  listGrowthOSWorkspaceUsersFast,
} from '@/lib/auth/user-store';

import {
  getGrowthOSWorkspaceSubscriptionSnapshot,
  upsertGrowthOSUserModulePermission,
  type GrowthOSUserModulePermission,
} from '@/lib/admin/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// WORKSPACE USER MODULE ACCESS
//
// POST
//
// Assign module-level permissions to one membership.
//
// Tenant comes ONLY from authenticated session.
//
// Browser supplies:
//
// membershipId
// permissions[]
//
// Browser NEVER supplies:
//
// workspaceId
// brandId
//
// Owner / Admin only.
//
// IMPORTANT:
//
// This endpoint supports INACTIVE memberships so permissions
// can be configured BEFORE the user receives brand access.
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


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
    // 2. ACTIVE TENANT
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
            'ACTIVE_BRAND_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 3. LIVE USER / MEMBERSHIP STATE
    // ========================================================

    const workspaceUsers =
      await listGrowthOSWorkspaceUsersFast(
        workspaceId,
        brandId
      );


    const actor =
      workspaceUsers.find(
        user =>
          user.user_id ===
            identity.userId
      );


    if (
      !actor
      ||
      actor.user_status !==
        'active'
      ||
      actor.membership_status !==
        'active'
      ||
      (
        actor.role !==
          'owner'
        &&
        actor.role !==
          'admin'
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'USER_MANAGEMENT_ACCESS_REQUIRED',
        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 4. BODY
    //
    // Expected:
    //
    // {
    //   membershipId: "...",
    //   permissions: [
    //     {
    //       moduleId: "meta",
    //       permission: "viewer"
    //     }
    //   ]
    // }
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
            'INVALID_REQUEST_BODY',
        },
        {
          status:
            400,
        }
      );

    }


    const membershipId =
      String(
        body?.membershipId
        ||
        ''
      ).trim();


    if (!membershipId) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'MEMBERSHIP_ID_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    const permissionsInput =
      Array.isArray(
        body?.permissions
      )
        ? body.permissions
        : [];


    if (
      permissionsInput.length ===
        0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'MODULE_PERMISSIONS_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 5. TARGET MEMBERSHIP
    //
    // Critical tenant boundary:
    //
    // membershipId must belong to CURRENT workspace + brand.
    // ========================================================

    const target =
      workspaceUsers.find(
        user =>
          user.membership_id ===
            membershipId
      );


    if (!target) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'WORKSPACE_MEMBERSHIP_NOT_FOUND',
        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 6. SELF-PROTECTION
    // ========================================================

    if (
      target.user_id ===
        identity.userId
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'CANNOT_MODIFY_SELF_ACCESS',
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 7. ADMIN CANNOT MODIFY OWNER
    // ========================================================

    if (
      target.role ===
        'owner'
      &&
      actor.role !==
        'owner'
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'OWNER_ROLE_REQUIRED',
        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // 8. LOAD CURRENT BRAND MODULE ENTITLEMENT
    // ========================================================

    const subscription =
      await getGrowthOSWorkspaceSubscriptionSnapshot(
        workspaceId,
        brandId
      );


    if (
      !subscription.configured
      ||
      !subscription.plan
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'SUBSCRIPTION_REQUIRED',
        },
        {
          status:
            409,
        }
      );

    }


    const availableModules =
      subscription.modules
      ||
      [];


    // ========================================================
    // 9. NORMALIZE + VALIDATE PERMISSIONS
    // ========================================================

    const allowedPermissions:
      GrowthOSUserModulePermission[] =
        [
          'inherit',
          'viewer',
          'editor',
          'disabled',
        ];


    const normalizedPermissions:
      Array<{
        moduleId: string;
        permission: GrowthOSUserModulePermission;
      }> =
        [];


    const seenModuleIds =
      new Set<string>();


    for (
      const item
      of permissionsInput
    ) {

      const moduleId =
        String(
          item?.moduleId
          ||
          ''
        ).trim();


      const permission =
        String(
          item?.permission
          ||
          ''
        )
          .trim()
          .toLowerCase() as
            GrowthOSUserModulePermission;


      if (!moduleId) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'MODULE_ID_REQUIRED',
          },
          {
            status:
              400,
          }
        );

      }


      if (
        !allowedPermissions.includes(
          permission
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'INVALID_MODULE_PERMISSION',

            moduleId,
          },
          {
            status:
              400,
          }
        );

      }


      if (
        seenModuleIds.has(
          moduleId
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'DUPLICATE_MODULE_PERMISSION',

            moduleId,
          },
          {
            status:
              400,
          }
        );

      }


      seenModuleIds.add(
        moduleId
      );


      const moduleDefinition =
        availableModules.find(
          module =>
            module.moduleId ===
              moduleId
        );


      if (!moduleDefinition) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'MODULE_NOT_FOUND',

            moduleId,
          },
          {
            status:
              404,
          }
        );

      }


      if (
        moduleDefinition.status !==
          'active'
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'MODULE_NOT_ACTIVE',

            moduleId,
          },
          {
            status:
              409,
          }
        );

      }


      // ------------------------------------------------------
      // User permission cannot grant access to a module that
      // the current brand itself does not have.
      //
      // disabled is still allowed.
      //
      // inherit is also allowed because effective enforcement
      // remains downstream.
      // ------------------------------------------------------

      if (
        (
          permission ===
            'viewer'
          ||
          permission ===
            'editor'
        )
        &&
        !moduleDefinition.enabled
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'MODULE_NOT_AVAILABLE_FOR_BRAND',

            moduleId,
          },
          {
            status:
              409,
          }
        );

      }


      normalizedPermissions.push({

        moduleId,

        permission,

      });

    }


    // ========================================================
    // 10. WRITE PERMISSIONS
    //
    // Partial writes are safe here because the Add User flow
    // keeps the membership INACTIVE until configuration is
    // complete.
    // ========================================================

    const results =
      [];


    for (
      const permission
      of normalizedPermissions
    ) {

      const result =
        await upsertGrowthOSUserModulePermission({

          membershipId,

          moduleId:
            permission.moduleId,

          permission:
            permission.permission,

        });


      results.push(
        result
      );

    }


    // ========================================================
    // 11. SUCCESS
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      membershipId,

      userId:
        target.user_id,

      configured:
        results.length,

      permissions:
        results.map(
          result => ({

            moduleId:
              result.moduleId,

            permission:
              result.permission,

          })
        ),

      meta: {

        workspaceId,

        brandId,

        durationMs:
          Date.now()
          -
          startedAt,

      },

    });


  } catch (
    error:
      any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to update user module access'
      );


    console.error(
      'WORKSPACE_USER_MODULE_ACCESS_ERROR',
      {

        message,

        durationMs:
          Date.now()
          -
          startedAt,

      }
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to update user module access',

        meta: {

          durationMs:
            Date.now()
            -
            startedAt,

        },
      },
      {
        status:
          500,
      }
    );

  }

}