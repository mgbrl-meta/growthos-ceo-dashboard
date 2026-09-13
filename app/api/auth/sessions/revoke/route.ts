import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  clearGrowthOsSessionCookie,
} from '@/lib/auth/session';

import {
  revokeGrowthOSSecuritySession,
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


    const sessionId =
      String(
        body?.sessionId
        ||
        ''
      ).trim();


    if (!sessionId) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'SESSION_ID_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    await revokeGrowthOSSecuritySession(
      identity.userId,
      sessionId
    );


    const currentRevoked =
      Boolean(
        identity.authSessionId
        &&
        identity.authSessionId ===
          sessionId
      );


    await writeGrowthOSAuditEventSafe({
      request,
      workspaceId:
        String(identity.workspaceId || ''),
      brandId:
        String(identity.brandId || ''),
      category:
        'security',
      action:
        'security.session_revoked',
      actorUserId:
        identity.userId,
      actorEmail:
        identity.email
        ?? null,
      actorRole:
        identity.role
        ?? null,
      targetType:
        'session',
      targetId:
        sessionId,
      targetLabel:
        currentRevoked
          ? 'Current session'
          : 'Session',
      metadata: {
        currentRevoked,
      },
    });


    if (currentRevoked) {

      await clearGrowthOsSessionCookie();

    }


    return NextResponse.json({

      ok:
        true,

      currentRevoked,

    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_SESSION_REVOKE_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to revoke session',
      },
      {
        status:
          500,
      }
    );

  }

}
