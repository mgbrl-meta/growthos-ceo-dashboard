import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  updateLeadWorkflow,
} from '@/lib/call-commerce/repository';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


type RouteContext = {
  params: Promise<{
    leadId: string;
  }>;
};


export async function POST(
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

    let body: any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_REQUEST_BODY',
        },
        {
          status: 400,
        }
      );
    }

    const action =
      String(
        body?.action || ''
      ).trim();

    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          error: 'CALL_WORKFLOW_ACTION_REQUIRED',
        },
        {
          status: 400,
        }
      );
    }

    const data =
      await updateLeadWorkflow({
        workspaceId:
          access.workspaceId,

        brandId:
          access.brandId,

        leadId,

        actorUserId:
          access.identity.userId,

        action,

        data:
          body?.data &&
          typeof body.data === 'object'
            ? body.data
            : {},
      });

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
      'CALL_COMMERCE_WORKFLOW_ERROR',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_WORKFLOW_ERROR',
      },
      {
        status: 500,
      }
    );
  }
}