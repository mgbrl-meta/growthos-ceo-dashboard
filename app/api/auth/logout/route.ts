import {
  NextResponse,
} from 'next/server';

import {
  clearGrowthOsSessionCookie,
} from '@/lib/auth/session';


export const dynamic =
  'force-dynamic';


// ============================================================
// LOGOUT
// ============================================================

export async function POST() {

  try {

    await clearGrowthOsSessionCookie();


    return NextResponse.json(
      {
        ok:
          true,
      }
    );


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