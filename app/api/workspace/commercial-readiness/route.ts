import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSCommercialReadiness,
} from '@/lib/readiness/service';


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
      identity.role !==
        'owner'
      &&
      identity.role !==
        'admin'
    ) {

      return NextResponse.json(
        {
          ok:
            false,
          error:
            'COMMERCIAL_READINESS_ACCESS_REQUIRED',
        },
        {
          status:
            403,
        }
      );

    }


    const readiness =
      await getGrowthOSCommercialReadiness(
        identity
      );


    return NextResponse.json({

      ok:
        true,

      readiness,

    });

  } catch (
    error:
      any
  ) {

    console.error(
      'GROWTHOS_COMMERCIAL_READINESS_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,
        error:
          'COMMERCIAL_READINESS_FAILED',
        message:
          String(
            error?.message
            ||
            'Unable to evaluate commercial readiness'
          ),
      },
      {
        status:
          500,
      }
    );

  }

}
