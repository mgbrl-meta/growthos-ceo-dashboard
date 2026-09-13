import {
  NextRequest,
  NextResponse,
} from 'next/server';

import bcrypt from 'bcryptjs';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSUserById,
} from '@/lib/auth/user-store';

import {
  revokeGrowthOSAuthTokens,
  revokeGrowthOSSecuritySessions,
  updateGrowthOSPasswordHash,
} from '@/lib/auth/security-store';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';


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


    if (
      identity.authMethod !==
        'password'
      ||
      !identity.authSessionId
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'PASSWORD_SESSION_REQUIRED',
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


    const currentPassword =
      String(
        body?.currentPassword
        ||
        ''
      );


    const newPassword =
      String(
        body?.newPassword
        ||
        ''
      );


    if (
      !currentPassword
      ||
      newPassword.length <
        10
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'PASSWORD_REQUIREMENTS_NOT_MET',
        },
        {
          status:
            400,
        }
      );

    }


    const user =
      await getGrowthOSUserById(
        identity.userId
      );


    if (
      !user
      ||
      user.status !==
        'active'
      ||
      !user.password_hash
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'PASSWORD_LOGIN_NOT_CONFIGURED',
        },
        {
          status:
            409,
        }
      );

    }


    const currentValid =
      await bcrypt.compare(
        currentPassword,
        user.password_hash
      );


    if (!currentValid) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'CURRENT_PASSWORD_INVALID',
        },
        {
          status:
            401,
        }
      );

    }


    const samePassword =
      await bcrypt.compare(
        newPassword,
        user.password_hash
      );


    if (samePassword) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'NEW_PASSWORD_MUST_BE_DIFFERENT',
        },
        {
          status:
            400,
        }
      );

    }


    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12
      );


    await updateGrowthOSPasswordHash(
      identity.userId,
      passwordHash
    );


    await revokeGrowthOSAuthTokens(
      identity.userId
    );


    // Keep the current device signed in; revoke every other
    // password session immediately.
    await revokeGrowthOSSecuritySessions({

      userId:
        identity.userId,

      exceptSessionId:
        identity.authSessionId,

    });


    await writeGrowthOSAuditEventSafe({
      request,
      workspaceId:
        String(identity.workspaceId || ''),
      brandId:
        String(identity.brandId || ''),
      category:
        'security',
      action:
        'security.password_changed',
      actorUserId:
        identity.userId,
      actorEmail:
        identity.email
        ?? null,
      actorRole:
        identity.role
        ?? null,
      targetType:
        'user',
      targetId:
        identity.userId,
      targetLabel:
        identity.email
        ?? identity.userId,
      metadata: {
        otherSessionsRevoked:
          true,
      },
    });


    return NextResponse.json({
      ok:
        true,
    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_CHANGE_PASSWORD_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to change password',
      },
      {
        status:
          500,
      }
    );

  }

}
