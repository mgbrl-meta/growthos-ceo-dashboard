import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  SESSION_COOKIE_NAME,
} from '@/lib/auth/config';

import {
  clearGrowthOsSessionCookie,
  verifyGrowthOsSession,
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


// ============================================================
// LOGOUT CURRENT SESSION
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  try {

    const token =
      request.cookies.get(
        SESSION_COOKIE_NAME
      )?.value;


    if (token) {

      try {

        const session =
          await verifyGrowthOsSession(
            token
          );


        if (
          session.authMethod ===
            'password'
          &&
          session.sessionId
        ) {

          await revokeGrowthOSSecuritySession(
            session.userId,
            session.sessionId
          );

        }


        if (
          session.workspaceId
          &&
          session.brandId
        ) {

          await writeGrowthOSAuditEventSafe({
            request,
            workspaceId:
              session.workspaceId,
            brandId:
              session.brandId,
            category:
              'security',
            action:
              'security.logout',
            actorUserId:
              session.userId,
            actorEmail:
              session.email
              ?? null,
            actorRole:
              session.role
              ?? null,
            targetType:
              'session',
            targetId:
              session.sessionId
              ?? null,
            targetLabel:
              session.email
              ?? session.userId,
            metadata: {
              authMethod:
                session.authMethod,
            },
          });

        }

      } catch (
        error
      ) {

        // Invalid/expired cookie should never prevent local
        // logout. We still clear the browser cookie below.
        console.warn(
          'GROWTHOS_LOGOUT_SESSION_REVOKE_SKIPPED',
          error
        );

      }

    }


    await clearGrowthOsSessionCookie();


    return NextResponse.json({
      ok:
        true,
    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_LOGOUT_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Logout failed',
      },
      {
        status:
          500,
      }
    );

  }

}
