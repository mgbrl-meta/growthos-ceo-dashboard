import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  listGrowthOSSecuritySessions,
} from '@/lib/auth/security-store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


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


    if (
      identity.authMethod ===
        'shopify'
    ) {

      return NextResponse.json({

        ok:
          true,

        authMethod:
          'shopify',

        sessions:
          [],

      });

    }


    const sessions =
      await listGrowthOSSecuritySessions(
        identity.userId
      );


    return NextResponse.json({

      ok:
        true,

      authMethod:
        'password',

      sessions:
        sessions.map(
          session => ({

            sessionId:
              session.session_id,

            workspaceId:
              session.workspace_id,

            brandId:
              session.brand_id,

            createdAt:
              session.created_at,

            lastSeenAt:
              session.last_seen_at,

            expiresAt:
              session.expires_at,

            ipAddress:
              session.ip_address,

            userAgent:
              session.user_agent,

            current:
              Boolean(
                identity.authSessionId
                &&
                identity.authSessionId ===
                  session.session_id
              ),

          })
        ),

    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_SESSIONS_LIST_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to load active sessions',
      },
      {
        status:
          500,
      }
    );

  }

}
