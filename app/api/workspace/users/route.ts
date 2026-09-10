import {
  NextRequest,
  NextResponse,
} from 'next/server';

import bcrypt from 'bcryptjs';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSUserByEmail,
  listGrowthOSWorkspaceUsersFast,
  upsertBrandMembership,
  upsertGrowthOSUser,
  type GrowthOSBrandRole,
} from '@/lib/auth/user-store';

import {
  getGrowthOSWorkspaceSubscriptionSnapshot,
} from '@/lib/admin/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// CURRENT WORKSPACE USERS
//
// GET
//   Read current workspace / brand users.
//
// POST
//   Add a user to the current workspace / brand.
//
// PATCH
//   Change a user's role in the current workspace / brand.
//
// IMPORTANT:
//
// Tenant identity always comes from authenticated session.
//
// Browser does NOT provide:
//
// workspaceId
// brandId
//
// User-management writes require a LIVE active owner/admin
// membership in growthos_control.brand_memberships.
// ============================================================


// ============================================================
// GET WORKSPACE USERS
// ============================================================

export async function GET(
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

        readOnly:
          true,

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


// ============================================================
// ADD WORKSPACE USER
//
// OWNER / ADMIN ONLY.
//
// New Growth OS user:
//
// email
// fullName
// password
// role
//
// Existing Growth OS user:
//
// email
// role
//
// Existing password is preserved.
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
    // 3. LOAD CURRENT USERS
    // ========================================================

    const currentUsers =
      await listGrowthOSWorkspaceUsersFast(
        workspaceId,
        brandId
      );


    // ========================================================
    // 4. LIVE WRITE AUTHORIZATION
    // ========================================================

    const actor =
      currentUsers.find(
        user =>
          user.user_id ===
            identity.userId
      );


    const actorCanManageUsers =
      Boolean(
        actor
        &&
        actor.user_status ===
          'active'
        &&
        actor.membership_status ===
          'active'
        &&
        (
          actor.role ===
            'owner'
          ||
          actor.role ===
            'admin'
        )
      );


    if (!actorCanManageUsers) {

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
    // 5. REQUEST BODY
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


    const email =
      String(
        body?.email
        ||
        ''
      )
        .trim()
        .toLowerCase();


    const fullName =
      String(
        body?.fullName
        ||
        ''
      ).trim();


    const password =
      String(
        body?.password
        ||
        ''
      );


    const role =
      String(
        body?.role
        ||
        ''
      )
        .trim()
        .toLowerCase();


    // ========================================================
    // 6. EMAIL VALIDATION
    // ========================================================

    if (
      !email
      ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
          email
        )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'VALID_EMAIL_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 7. ROLE VALIDATION
    // ========================================================

    const allowedRoles:
      GrowthOSBrandRole[] =
        [
          'owner',
          'admin',
          'analyst',
          'viewer',
        ];


    if (
      !allowedRoles.includes(
        role as GrowthOSBrandRole
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'VALID_ROLE_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    const targetRole =
      role as
        GrowthOSBrandRole;


    // ========================================================
    // 8. ONLY OWNER CAN CREATE ANOTHER OWNER
    // ========================================================

    if (
      targetRole ===
        'owner'
      &&
      actor?.role !==
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
    // 9. FIND EXISTING GROWTH OS USER
    // ========================================================

    const existingUser =
      await getGrowthOSUserByEmail(
        email
      );


    if (
      existingUser
      &&
      existingUser.status !==
        'active'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'USER_NOT_ACTIVE',

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 10. ALREADY HAS ACCESS
    // ========================================================

    const alreadyMember =
      currentUsers.some(
        user => {

          if (
            existingUser
            &&
            user.user_id ===
              existingUser.user_id
          ) {

            return true;

          }


          return (
            String(
              user.email
              ||
              ''
            )
              .trim()
              .toLowerCase()
            ===
            email
          );

        }
      );


    if (alreadyMember) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'USER_ALREADY_HAS_ACCESS',

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 11. PLAN USER LIMIT
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


    const maxUsers =
      subscription.plan.maxUsers;


    const activeUsers =
      currentUsers.filter(
        user =>
          user.user_status ===
            'active'
          &&
          user.membership_status ===
            'active'
      ).length;


    if (
      maxUsers !==
        null
      &&
      activeUsers >=
        maxUsers
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'USER_LIMIT_REACHED',

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 12. PASSWORD
    // ========================================================

    let passwordHash:
      string |
      null =
        null;


    if (!existingUser) {

      if (
        password.length <
          10
      ) {

        return NextResponse.json(
          {

            ok:
              false,

            error:
              'PASSWORD_MINIMUM_10_CHARACTERS',

          },
          {
            status:
              400,
          }
        );

      }


      passwordHash =
        await bcrypt.hash(
          password,
          12
        );

    }


    // ========================================================
    // 13. CREATE / RESOLVE USER
    // ========================================================

    const user =
      await upsertGrowthOSUser({

        email,

        passwordHash,

        fullName:
          fullName
          ||
          existingUser?.full_name
          ||
          null,

        status:
          'active',

      });


    // ========================================================
    // 14. GRANT BRAND MEMBERSHIP
    // ========================================================

    await upsertBrandMembership({

      userId:
        user.userId,

      workspaceId,

      brandId,

      role:
        targetRole,

      status:
        'active',

      isDefault:
        false,

    });


    // ========================================================
    // 15. SUCCESS
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        user: {

          userId:
            user.userId,

          email:
            user.email,

          fullName:
            user.fullName,

          role:
            targetRole,

          status:
            'active',

        },

        meta: {

          durationMs:
            Date.now()
            -
            startedAt,

        },

      },
      {
        status:
          201,
      }
    );


  } catch (
    error:
      any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to add workspace user'
      );


    console.error(
      'WORKSPACE_USER_CREATE_ERROR',
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
          'Unable to add workspace user',

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


// ============================================================
// CHANGE WORKSPACE USER ROLE
//
// OWNER / ADMIN ONLY.
//
// Rules:
//
// - tenant comes from authenticated session
// - caller must have live owner/admin membership
// - only Owner can grant Owner
// - Admin cannot modify an Owner
// - final active Owner cannot be demoted
// - membership status is preserved
// - default membership state is preserved
// ============================================================

export async function PATCH(
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
    // 3. LIVE MEMBERSHIP STATE
    // ========================================================

    const currentUsers =
      await listGrowthOSWorkspaceUsersFast(
        workspaceId,
        brandId
      );


    // ========================================================
    // 4. LIVE ACTOR AUTHORIZATION
    // ========================================================

    const actor =
      currentUsers.find(
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
    // 5. REQUEST BODY
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


    const userId =
      String(
        body?.userId
        ||
        ''
      ).trim();


    const role =
      String(
        body?.role
        ||
        ''
      )
        .trim()
        .toLowerCase();


    if (!userId) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'USER_ID_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 6. ROLE VALIDATION
    // ========================================================

    const allowedRoles:
      GrowthOSBrandRole[] =
        [
          'owner',
          'admin',
          'analyst',
          'viewer',
        ];


    if (
      !allowedRoles.includes(
        role as GrowthOSBrandRole
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'VALID_ROLE_REQUIRED',

        },
        {
          status:
            400,
        }
      );

    }


    const targetRole =
      role as
        GrowthOSBrandRole;


    // ========================================================
    // 7. TARGET USER
    // ========================================================

    const target =
      currentUsers.find(
        user =>
          user.user_id ===
            userId
      );


    if (!target) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'WORKSPACE_USER_NOT_FOUND',

        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 8. OWNER SECURITY
    // ========================================================

    // Only Owner can grant Owner.

    if (
      targetRole ===
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


    // Admin cannot modify an existing Owner.

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
    // 9. PROTECT LAST ACTIVE OWNER
    // ========================================================

    const targetIsActiveOwner =
      target.role ===
        'owner'
      &&
      target.user_status ===
        'active'
      &&
      target.membership_status ===
        'active';


    if (
      targetIsActiveOwner
      &&
      targetRole !==
        'owner'
    ) {

      const activeOwners =
        currentUsers.filter(
          user =>
            user.role ===
              'owner'
            &&
            user.user_status ===
              'active'
            &&
            user.membership_status ===
              'active'
        ).length;


      if (
        activeOwners <=
          1
      ) {

        return NextResponse.json(
          {

            ok:
              false,

            error:
              'LAST_OWNER_REQUIRED',

          },
          {
            status:
              409,
          }
        );

      }

    }


    // ========================================================
    // 10. NO CHANGE
    // ========================================================

    if (
      target.role ===
        targetRole
    ) {

      return NextResponse.json({

        ok:
          true,

        changed:
          false,

        user: {

          userId:
            target.user_id,

          email:
            target.email,

          role:
            target.role,

        },

        meta: {

          durationMs:
            Date.now()
            -
            startedAt,

        },

      });

    }


    // ========================================================
    // 11. UPDATE MEMBERSHIP
    //
    // Preserve:
    //
    // membership status
    // is_default
    // ========================================================

    await upsertBrandMembership({

      userId:
        target.user_id,

      workspaceId,

      brandId,

      role:
        targetRole,

      status:
        target.membership_status,

      isDefault:
        Boolean(
          target.is_default
        ),

    });


    // ========================================================
    // 12. SUCCESS
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      changed:
        true,

      user: {

        userId:
          target.user_id,

        email:
          target.email,

        role:
          targetRole,

      },

      meta: {

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
        'Unable to update workspace user role'
      );


    console.error(
      'WORKSPACE_USER_ROLE_UPDATE_ERROR',
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
          'Unable to update workspace user role',

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