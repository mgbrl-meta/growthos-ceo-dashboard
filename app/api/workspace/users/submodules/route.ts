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
  listGrowthOSUserModulePermissionsFast,
  upsertGrowthOSUserSubmodulePermission,
  type GrowthOSUserSubmodulePermission,
} from '@/lib/admin/control-plane';

import {
  getGrowthOSSubmodule,
  isGrowthOSSubmodule,
} from '@/lib/auth/submodule-registry';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// WORKSPACE USER SUBMODULE ACCESS
//
// POST
//
// Assign submodule-level permissions to one membership.
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
// OWNER / ADMIN ONLY.
//
// Permission hierarchy:
//
// brand module entitlement
//        ↓
// user module permission
//        ↓
// user submodule permission
//
// A submodule can NEVER bypass a disabled parent module.
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
    // 3. LIVE WORKSPACE MEMBERSHIPS
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
    // 4. REQUEST BODY
    //
    // {
    //   membershipId: "...",
    //
    //   permissions: [
    //     {
    //       moduleId: "meta",
    //       submoduleId: "campaign-analysis",
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
            'SUBMODULE_PERMISSIONS_REQUIRED',
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
    // membershipId must belong to current workspace + brand.
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
    // 8. CURRENT BRAND MODULE ENTITLEMENT
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


    const brandModules =
      subscription.modules
      ||
      [];


    // ========================================================
    // 9. USER PARENT MODULE PERMISSIONS
    // ========================================================

    const modulePermissions =
      await listGrowthOSUserModulePermissionsFast(
        membershipId
      );


    const modulePermissionMap =
      new Map(
        modulePermissions.map(
          permission => [

            permission.module_id,

            permission.permission,

          ]
        )
      );


    // ========================================================
    // 10. VALIDATE ENTIRE REQUEST BEFORE WRITING
    // ========================================================

    const allowedPermissions:
      GrowthOSUserSubmodulePermission[] =
        [
          'inherit',
          'viewer',
          'editor',
          'disabled',
        ];


    const normalizedPermissions:
      Array<{

        moduleId:
          string;

        submoduleId:
          string;

        permission:
          GrowthOSUserSubmodulePermission;

      }> =
        [];


    const seen =
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
        )
          .trim()
          .toLowerCase();


      const submoduleId =
        String(
          item?.submoduleId
          ||
          ''
        )
          .trim()
          .toLowerCase();


      const permission =
        String(
          item?.permission
          ||
          ''
        )
          .trim()
          .toLowerCase() as
            GrowthOSUserSubmodulePermission;


      // ------------------------------------------------------
      // REQUIRED VALUES
      // ------------------------------------------------------

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


      if (!submoduleId) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'SUBMODULE_ID_REQUIRED',

            moduleId,
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
              'INVALID_SUBMODULE_PERMISSION',

            moduleId,

            submoduleId,
          },
          {
            status:
              400,
          }
        );

      }


      // ------------------------------------------------------
      // DUPLICATE
      // ------------------------------------------------------

      const key =
        `${moduleId}:${submoduleId}`;


      if (
        seen.has(
          key
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'DUPLICATE_SUBMODULE_PERMISSION',

            moduleId,

            submoduleId,
          },
          {
            status:
              400,
          }
        );

      }


      seen.add(
        key
      );


      // ------------------------------------------------------
      // CANONICAL SUBMODULE REGISTRY
      // ------------------------------------------------------

      if (
        !isGrowthOSSubmodule(
          moduleId,
          submoduleId
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'SUBMODULE_NOT_FOUND',

            moduleId,

            submoduleId,
          },
          {
            status:
              404,
          }
        );

      }


      // ------------------------------------------------------
      // BRAND MODULE
      // ------------------------------------------------------

      const brandModule =
        brandModules.find(
          module =>
            module.moduleId ===
              moduleId
        );


      if (!brandModule) {

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
        brandModule.status !==
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
      // PARENT USER MODULE PERMISSION MUST EXIST
      // ------------------------------------------------------

      const parentPermission =
        modulePermissionMap.get(
          moduleId
        );


      if (!parentPermission) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'USER_MODULE_ACCESS_REQUIRED',

            moduleId,
          },
          {
            status:
              409,
          }
        );

      }


      // ------------------------------------------------------
      // BRAND DISABLED MODULE CANNOT BE BYPASSED
      // ------------------------------------------------------

      if (
        !brandModule.enabled
        &&
        (
          permission ===
            'viewer'
          ||
          permission ===
            'editor'
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'MODULE_NOT_AVAILABLE_FOR_BRAND',

            moduleId,

            submoduleId,
          },
          {
            status:
              409,
          }
        );

      }


      // ------------------------------------------------------
      // DISABLED PARENT CANNOT BE BYPASSED
      // ------------------------------------------------------

      if (
        parentPermission ===
          'disabled'
        &&
        (
          permission ===
            'viewer'
          ||
          permission ===
            'editor'
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'PARENT_MODULE_DISABLED',

            moduleId,

            submoduleId,
          },
          {
            status:
              409,
          }
        );

      }


      // ------------------------------------------------------
      // VIEWER PARENT CANNOT GRANT EDITOR BELOW IT
      // ------------------------------------------------------

      if (
        parentPermission ===
          'viewer'
        &&
        permission ===
          'editor'
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              'SUBMODULE_PERMISSION_EXCEEDS_MODULE',

            moduleId,

            submoduleId,
          },
          {
            status:
              409,
          }
        );

      }


      normalizedPermissions.push({

        moduleId,

        submoduleId,

        permission,

      });

    }


    // ========================================================
    // 11. WRITE
    // ========================================================

    const results =
      [];


    for (
      const permission
      of normalizedPermissions
    ) {

      const result =
        await upsertGrowthOSUserSubmodulePermission({

          membershipId,

          moduleId:
            permission.moduleId,

          submoduleId:
            permission.submoduleId,

          permission:
            permission.permission,

        });


      results.push(
        result
      );

    }


    // ========================================================
    // 12. RESPONSE
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
          result => {

            const definition =
              getGrowthOSSubmodule(
                result.moduleId,
                result.submoduleId
              );


            return {

              moduleId:
                result.moduleId,

              submoduleId:
                result.submoduleId,

              label:
                definition?.label
                ??
                null,

              permission:
                result.permission,

            };

          }
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
        'Unable to update user submodule access'
      );


    console.error(
      'WORKSPACE_USER_SUBMODULE_ACCESS_ERROR',
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
          'Unable to update user submodule access',

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