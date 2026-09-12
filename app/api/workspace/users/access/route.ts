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
  listGrowthOSUserModulePermissionsFast,
  listGrowthOSUserSubmodulePermissionsFast,
} from '@/lib/admin/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// READ ONE USER'S ACCESS CONFIGURATION
//
// GET:
//
// /api/workspace/users/access?membershipId=...
//
// Returns:
//
// module permissions
// submodule permissions
//
// Tenant always comes from authenticated session.
// ============================================================

export async function GET(
  request:
    NextRequest
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

          error:
            'UNAUTHENTICATED',
        },
        {
          status:
            401,
        }
      );

    }


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


    const membershipId =
      String(
        request.nextUrl.searchParams.get(
          'membershipId'
        )
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


    const users =
      await listGrowthOSWorkspaceUsersFast(
        workspaceId,
        brandId
      );


    const actor =
      users.find(
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


    const target =
      users.find(
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


    const [
      modulePermissions,
      submodulePermissions,
    ] =
      await Promise.all([

        listGrowthOSUserModulePermissionsFast(
          membershipId
        ),

        listGrowthOSUserSubmodulePermissionsFast(
          membershipId
        ),

      ]);


    return NextResponse.json({

      ok:
        true,

      user: {

        userId:
          target.user_id,

        membershipId:
          target.membership_id,

        email:
          target.email,

        fullName:
          target.full_name,

        role:
          target.role,

        membershipStatus:
          target.membership_status,

      },

      modulePermissions:
        modulePermissions.map(
          permission => ({

            moduleId:
              permission.module_id,

            permission:
              permission.permission,

          })
        ),

      submodulePermissions:
        submodulePermissions.map(
          permission => ({

            moduleId:
              permission.module_id,

            submoduleId:
              permission.submodule_id,

            permission:
              permission.permission,

          })
        ),

    });

  } catch (
    error:
      any
  ) {

    console.error(
      'WORKSPACE_USER_ACCESS_READ_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to load user access',
      },
      {
        status:
          500,
      }
    );

  }

}