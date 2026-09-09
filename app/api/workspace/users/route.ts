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


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// CURRENT WORKSPACE USERS
//
// READ ONLY.
//
// Tenant identity comes only from the authenticated session.
//
// Browser does NOT provide workspaceId / brandId.
//
// This endpoint intentionally uses the fast runtime read and
// does not perform schema/bootstrap work.
// ============================================================

export async function GET(
  request: NextRequest
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
    // 3. FAST RUNTIME READ
    // ========================================================

    const users =
      await listGrowthOSWorkspaceUsersFast(
        workspaceId,
        brandId
      );


    // ========================================================
    // 4. SUMMARY
    // ========================================================

    const activeUsers =
      users.filter(
        user =>
          user.user_status ===
            'active'
          &&
          user.membership_status ===
            'active'
      ).length;


    const owners =
      users.filter(
        user =>
          user.role ===
            'owner'
      ).length;


    const admins =
      users.filter(
        user =>
          user.role ===
            'admin'
      ).length;


    // ========================================================
    // 5. SAFE RESPONSE
    //
    // NEVER return:
    //
    // password_hash
    // session secrets
    // auth tokens
    // ========================================================

    return NextResponse.json({

      ok:
        true,


      workspace: {

        workspaceId,

        brandId,

      },


      summary: {

        totalUsers:
          users.length,

        activeUsers,

        owners,

        admins,

      },


      users:
        users.map(
          user => ({

            membershipId:
              user.membership_id,

            userId:
              user.user_id,

            email:
              user.email,

            fullName:
              user.full_name,

            role:
              user.role,

            userStatus:
              user.user_status,

            membershipStatus:
              user.membership_status,

            isDefault:
              user.is_default,

            membershipCreatedAt:
              user.membership_created_at,

            membershipUpdatedAt:
              user.membership_updated_at,

            lastLoginAt:
              user.last_login_at,

          })
        ),


      meta: {

        durationMs:
          Date.now()
          -
          startedAt,

      },

    });

  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load workspace users'
      );


    console.error(
      'WORKSPACE_USERS_ERROR',
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
          'Unable to load workspace users',

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