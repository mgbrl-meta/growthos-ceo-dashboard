import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  createMetaEventDestination,
  deleteMetaEventDestination,
  listMetaEventDestinations,
  setMetaEventDestinationStatus,
} from '@/lib/meta-events/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest
) {
  try {
    const access =
      await requireGrowthOSApiAccess(
        request
      );

    const data =
      await listMetaEventDestinations(
        access.workspaceId,
        access.brandId
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

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'META_EVENTS_DESTINATIONS_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
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

    const action =
      String(
        body?.action
        ||
        'create'
      ).trim();

    if (
      action ===
      'delete'
    ) {
      await deleteMetaEventDestination(
        access.workspaceId,
        access.brandId,
        String(
          body?.destinationId
          ||
          ''
        ).trim()
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      action ===
      'update'
    ) {
      await setMetaEventDestinationStatus(
        access.workspaceId,
        access.brandId,
        String(
          body?.destinationId
          ||
          ''
        ).trim(),
        {
          enabled:
            body?.enabled,
          isDefault:
            body?.isDefault,
          name:
            body?.name,
          testEventCode:
            body?.testEventCode,
        }
      );

      return NextResponse.json({
        ok: true,
      });
    }

    const destinationId =
      await createMetaEventDestination(
        access.workspaceId,
        access.brandId,
        {
          name:
            body?.name,
          datasetId:
            String(
              body?.datasetId
              ||
              ''
            ),
          accessToken:
            String(
              body?.accessToken
              ||
              ''
            ),
          isDefault:
            body?.isDefault,
          testEventCode:
            body?.testEventCode,
        }
      );

    return NextResponse.json({
      ok: true,
      data: {
        destinationId,
      },
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
      'META_EVENTS_DESTINATION_WRITE_ERROR',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'META_EVENTS_DESTINATION_WRITE_ERROR',
      },
      { status: 500 }
    );
  }
}
