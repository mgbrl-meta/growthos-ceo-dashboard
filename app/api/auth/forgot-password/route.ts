import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getGrowthOSUserByEmail,
} from '@/lib/auth/user-store';

import {
  createGrowthOSAuthToken,
} from '@/lib/auth/security-store';

import {
  getGrowthOSPublicBaseUrl,
  sendGrowthOSPasswordResetEmail,
} from '@/lib/auth/email';


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

      body =
        {};

    }


    const email =
      String(
        body?.email
        ||
        ''
      )
        .trim()
        .toLowerCase();


    // Always return the same public response. Never reveal
    // whether the account exists.
    const publicResponse =
      NextResponse.json({

        ok:
          true,

        message:
          'If that email is registered, a reset link has been sent.',

      });


    if (
      !email
      ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
          email
        )
    ) {

      return publicResponse;

    }


    const user =
      await getGrowthOSUserByEmail(
        email
      );


    if (
      !user
      ||
      user.status !==
        'active'
    ) {

      return publicResponse;

    }


    const token =
      await createGrowthOSAuthToken({

        userId:
          user.user_id,

        email:
          user.email,

        purpose:
          'password_reset',

      });


    if (!token) {

      return publicResponse;

    }


    const baseUrl =
      getGrowthOSPublicBaseUrl(
        request.nextUrl.origin
      );


    if (!baseUrl) {

      console.error(
        'GROWTHOS_PASSWORD_RESET_BASE_URL_MISSING'
      );


      return publicResponse;

    }


    const resetUrl =
      `${baseUrl}/reset-password?token=${encodeURIComponent(
        token.rawToken
      )}`;


    try {

      await sendGrowthOSPasswordResetEmail({

        to:
          user.email,

        resetUrl,

        tokenId:
          token.tokenId,

      });

    } catch (
      error
    ) {

      // Do not disclose provider/configuration failures to the
      // public request. They remain visible in server logs.
      console.error(
        'GROWTHOS_PASSWORD_RESET_EMAIL_ERROR',
        error
      );

    }


    return publicResponse;

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_FORGOT_PASSWORD_ERROR',
      error
    );


    // Preserve enumeration-safe response even on unexpected
    // backend failures.
    return NextResponse.json({

      ok:
        true,

      message:
        'If that email is registered, a reset link has been sent.',

    });

  }

}
