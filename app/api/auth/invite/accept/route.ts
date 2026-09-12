import {
  NextRequest,
  NextResponse,
} from 'next/server';

import bcrypt from 'bcryptjs';

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
        'invite'
      );


    if (!resolved) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'INVITE_TOKEN_INVALID_OR_EXPIRED',
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


    return NextResponse.json({
      ok:
        true,
    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_INVITE_ACCEPT_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unable to set password',
      },
      {
        status:
          500,
      }
    );

  }

}
