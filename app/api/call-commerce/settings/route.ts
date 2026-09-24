import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  CALL_COMMERCE_SETTINGS_DEFAULTS,
  getCallCommerceSettings,
  updateCallCommerceSettings,
} from '@/lib/call-commerce/settings-store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function GET(
  request:
    NextRequest
) {

  try {

    const access =
      await requireGrowthOSApiAccess(
        request
      );


    const data =
      await getCallCommerceSettings(
        access.workspaceId,
        access.brandId
      );


    return NextResponse.json({
      ok:
        true,

      data,

      defaults:
        CALL_COMMERCE_SETTINGS_DEFAULTS,
    });

  } catch (
    error: unknown
  ) {

    const accessResponse =
      runtimeAccessErrorResponse(
        error
      );


    if (
      accessResponse
    ) {
      return accessResponse;
    }


    console.error(
      'CALL_COMMERCE_SETTINGS_GET_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_SETTINGS_ERROR',
      },
      {
        status:
          500,
      }
    );
  }
}


export async function PUT(
  request:
    NextRequest
) {

  try {

    const access =
      await requireGrowthOSApiAccess(
        request
      );


    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const data =
      await updateCallCommerceSettings({

        workspaceId:
          access.workspaceId,

        brandId:
          access.brandId,

        actorUserId:
          access.identity.userId,

        settings: {

          contactMinDurationSeconds:
            body?.contactMinDurationSeconds,

          reopenGraceMinutes:
            body?.reopenGraceMinutes,

          autoArchiveTerminalLeads:
            body?.autoArchiveTerminalLeads,

          terminalArchiveDays:
            body?.terminalArchiveDays,

          requireUnqualifiedReason:
            body?.requireUnqualifiedReason,

          requireClosedLostReason:
            body?.requireClosedLostReason,

          requirePurchaseOrderId:
            body?.requirePurchaseOrderId,

          requirePurchaseAmount:
            body?.requirePurchaseAmount,
        },
      });


    return NextResponse.json({
      ok:
        true,

      data,
    });

  } catch (
    error: unknown
  ) {

    const accessResponse =
      runtimeAccessErrorResponse(
        error
      );


    if (
      accessResponse
    ) {
      return accessResponse;
    }


    console.error(
      'CALL_COMMERCE_SETTINGS_PUT_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_SETTINGS_ERROR',
      },
      {
        status:
          500,
      }
    );
  }
}
