import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  getLeadHistory,
} from '@/lib/call-commerce/repository';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


type RouteContext = {
  params: Promise<{
    leadId: string;
  }>;
};


export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const access =
      await requireGrowthOSApiAccess(
        request
      );

    const params =
      await context.params;

    const leadId =
      String(
        params?.leadId || ''
      ).trim();

    if (!leadId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'CALL_LEAD_ID_REQUIRED',
        },
        {
          status: 400,
        }
      );
    }


    const data =
      await getLeadHistory(
        access.workspaceId,
        access.brandId,
        leadId
      );


    return NextResponse.json({
      ok: true,
      data,
    });

  } catch (error: unknown) {

    const accessResponse =
      runtimeAccessErrorResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }


    console.error(
      'CALL_COMMERCE_LEAD_HISTORY_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_LEAD_HISTORY_ERROR',
      },
      {
        status: 500,
      }
    );
  }
}