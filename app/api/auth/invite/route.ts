import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSUserById,
  listGrowthOSWorkspaceUsersFast,
} from '@/lib/auth/user-store';

import {
  createGrowthOSAuthToken,
} from '@/lib/auth/security-store';

import {
  getGrowthOSPublicBaseUrl,
  sendGrowthOSInviteEmail,
} from '@/lib/auth/email';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function POST(
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


    const targetUserId =
      String(
        body?.userId
        ||
        ''
      ).trim();


    if (!targetUserId) {

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


    const actorCanManage =
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


    if (!actorCanManage) {

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
      workspaceUsers.find(
        user =>
          user.user_id ===
            targetUserId
      );


    if (
      !target
      ||
      target.membership_status !==
        'active'
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'ACTIVE_WORKSPACE_USER_REQUIRED',
        },
        {
          status:
            404,
        }
      );

    }


    const user =
      await getGrowthOSUserById(
        targetUserId
      );


    if (
      !user
      ||
      user.status !==
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


    if (user.password_hash) {

      return NextResponse.json({

        ok:
          true,

        sent:
          false,

        reason:
          'PASSWORD_ALREADY_SET',

      });

    }


    const token =
      await createGrowthOSAuthToken({

        userId:
          user.user_id,

        email:
          user.email,

        purpose:
          'invite',

        createdByUserId:
          identity.userId,

      });


    if (!token) {

      return NextResponse.json({

        ok:
          true,

        sent:
          false,

        reason:
          'INVITE_RECENTLY_SENT',

      });

    }


    const tenant =
      await resolveTenantContextById(
        workspaceId,
        brandId
      );


    const baseUrl =
      getGrowthOSPublicBaseUrl(
        request.nextUrl.origin
      );


    if (!baseUrl) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'PUBLIC_BASE_URL_REQUIRED',
        },
        {
          status:
            500,
        }
      );

    }


    const inviteUrl =
      `${baseUrl}/invite?token=${encodeURIComponent(
        token.rawToken
      )}`;


    await sendGrowthOSInviteEmail({

      to:
        user.email,

      inviteUrl,

      tokenId:
        token.tokenId,

      workspaceName:
        tenant.workspaceName,

    });


    return NextResponse.json({

      ok:
        true,

      sent:
        true,

    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_INVITE_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'INVITE_EMAIL_FAILED',
      },
      {
        status:
          503,
      }
    );

  }

}
