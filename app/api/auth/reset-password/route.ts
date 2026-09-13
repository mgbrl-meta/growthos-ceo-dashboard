import {
  NextRequest,
  NextResponse,
} from 'next/server';

import bcrypt from 'bcryptjs';

import {
  getDefaultBrandMembership,
} from '@/lib/auth/user-store';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

import {
  consumeGrowthOSAuthToken,
  resolveGrowthOSAuthToken,
  revokeGrowthOSAuthTokens,
  revokeGrowthOSSecuritySessions,
  updateGrowthOSPasswordHash,
} from '@/lib/auth/security-store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function POST(
  request:
    NextRequest
) {

  try {

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


    const token =
      String(
        body?.token
        ||
        ''
      ).trim();


    const password =
      String(
        body?.password
        ||
        ''
      );


    if (
      !token
      ||
      password.length <
        10
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'TOKEN_AND_VALID_PASSWORD_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    const resolved =
      await resolveGrowthOSAuthToken(
        token,
        'password_reset'
      );


    if (!resolved) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'RESET_TOKEN_INVALID_OR_EXPIRED',
        },
        {
          status:
            400,
        }
      );

    }


    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );


    await updateGrowthOSPasswordHash(
      resolved.user_id,
      passwordHash
    );


    await revokeGrowthOSSecuritySessions({
      userId:
        resolved.user_id,
    });


    await consumeGrowthOSAuthToken(
      resolved.token_id
    );


    await revokeGrowthOSAuthTokens(
      resolved.user_id
    );


    try {

      const membership =
        await getDefaultBrandMembership(
          resolved.user_id
        );


      if (membership) {

        await writeGrowthOSAuditEventSafe({
          request,
          workspaceId:
            membership.workspace_id,
          brandId:
            membership.brand_id,
          category:
            'security',
          action:
            'security.password_reset',
          actorUserId:
            resolved.user_id,
          actorEmail:
            resolved.email,
          actorRole:
            membership.role,
          targetType:
            'user',
          targetId:
            resolved.user_id,
          targetLabel:
            resolved.email,
        });

      }

    } catch (auditContextError) {

      console.warn(
        'GROWTHOS_SECURITY_AUDIT_CONTEXT_SKIPPED',
        auditContextError
      );

    }


    return NextResponse.json({
      ok:
        true,
    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_RESET_PASSWORD_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to reset password',
      },
      {
        status:
          500,
      }
    );

  }

}
