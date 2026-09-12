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
  revokeGrowthOSSecuritySessions,
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
        'password'
    ) {

      await revokeGrowthOSSecuritySessions({
        userId:
          identity.userId,
      });

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
      'GROWTHOS_LOGOUT_ALL_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to sign out all sessions',
      },
      {
        status:
          500,
      }
    );

  }

}
