import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  resolveGrowthOSEffectiveAccess,
  GrowthOSEffectiveAccessError,
} from '@/lib/auth/effective-access';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function GET(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  try {

    const identity =
      await authenticateRequest(
        request
      );


    if (!identity) {

      return NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHENTICATED',
        },
        {
          status: 401,
        }
      );

    }


    const access =
      await resolveGrowthOSEffectiveAccess(
        identity
      );


    return NextResponse.json({

      ok: true,

      access,

      meta: {
        durationMs:
          Date.now() -
          startedAt,
      },

    });

  } catch (
    error:
      unknown
  ) {

    if (
      error instanceof
        GrowthOSEffectiveAccessError
    ) {

      const status =
        error.code ===
          'ACTIVE_MEMBERSHIP_REQUIRED'

          ? 403

          : error.code ===
              'ACTIVE_BRAND_REQUIRED'

            ? 400

            : 409;


      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
          meta: {
            durationMs:
              Date.now() -
              startedAt,
          },
        },
        {
          status,
        }
      );

    }


    console.error(
      'GROWTH_OS_EFFECTIVE_ACCESS_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok: false,
        error: 'EFFECTIVE_ACCESS_RESOLUTION_FAILED',
        meta: {
          durationMs:
            Date.now() -
            startedAt,
        },
      },
      {
        status: 500,
      }
    );

  }

}
