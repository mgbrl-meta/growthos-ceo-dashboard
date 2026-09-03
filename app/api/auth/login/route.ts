import {
  NextRequest,
  NextResponse,
} from 'next/server';

import bcrypt from 'bcryptjs';

import {
  getPublicAdminEmail,
  getPublicAdminPasswordHash,
  getPublicAdminTenantId,
} from '@/lib/auth/config';

import {
  setGrowthOsSessionCookie,
} from '@/lib/auth/session';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// PUBLIC GROWTH OS LOGIN
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. READ BODY
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
            'Invalid request body',
        },
        {
          status:
            400,
        }
      );

    }


    const email =
      String(
        body?.email || ''
      )
        .trim()
        .toLowerCase();


    const password =
      String(
        body?.password || ''
      );


    if (
      !email ||
      !password
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'Email and password are required',
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 2. LOAD CONFIGURED ADMIN
    // ========================================================

    const expectedEmail =
      getPublicAdminEmail();


    const passwordHash =
      getPublicAdminPasswordHash();


    // ========================================================
    // 3. VERIFY PASSWORD
    //
    // Always run bcrypt comparison even if email is wrong.
    // This avoids making the email check unnecessarily obvious
    // through response timing.
    // ========================================================

    const passwordValid =
      await bcrypt.compare(
        password,
        passwordHash
      );


    const emailValid =
      email ===
      expectedEmail;


    if (
      !emailValid ||
      !passwordValid
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            'Invalid email or password',
        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // 4. CREATE GROWTH OS SESSION
    // ========================================================

    const tenantId =
      getPublicAdminTenantId();


    await setGrowthOsSessionCookie(
      {
        userId:
          `public:${email}`,

        email,

        tenantId,

        authSource:
          'public',
      }
    );


    // ========================================================
    // 5. SUCCESS
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        user: {
          email,
          tenantId,
          authSource:
            'public',
        },
      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'GROWTHOS_LOGIN_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Login failed',
      },
      {
        status:
          500,
      }
    );

  }

}