import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  archiveEligibleLeads,
  listLeads,
} from '@/lib/call-commerce/repository';

import {
  getArchiveFacets,
} from '@/lib/call-commerce/reporting';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function GET(
  request: NextRequest
) {

  try {

    const access =
      await requireGrowthOSApiAccess(
        request
      );

    const url =
      new URL(
        request.url
      );

    const pageSize =
      Math.min(
        Math.max(
          Number(
            url.searchParams.get(
              'limit'
            ) || 50
          ),
          1
        ),
        500
      );

    const page =
      Math.max(
        Number(
          url.searchParams.get(
            'page'
          ) || 1
        ),
        1
      );

    const [
      data,
      facets,
    ] =
      await Promise.all([

        listLeads({
          workspaceId:
            access.workspaceId,

          brandId:
            access.brandId,

          archived:
            true,

          status:
            url.searchParams.get(
              'status'
            ) || '',

          search:
            url.searchParams.get(
              'search'
            ) || '',

          callStatus:
            url.searchParams.get(
              'callStatus'
            ) || '',

          agent:
            url.searchParams.get(
              'agent'
            ) || '',

          businessNumber:
            url.searchParams.get(
              'businessNumber'
            ) || '',

          limit:
            pageSize,

          offset:
            (
              page - 1
            ) * pageSize,
        }),

        getArchiveFacets(
          access.workspaceId,
          access.brandId
        ),

      ]);

    return NextResponse.json({
      ok:
        true,

      data: {
        ...data,
        facets,
      },

      meta: {
        page,
        pageSize,
      },
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
      'CALL_COMMERCE_ARCHIVE_ERROR',
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_ERROR',
      },
      {
        status:
          500,
      }
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


    const result =
      await archiveEligibleLeads(
        access.workspaceId,
        access.brandId
      );


    return NextResponse.json({
      ok:
        true,

      data:
        result || null,
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
      'CALL_COMMERCE_ARCHIVE_RUN_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'CALL_COMMERCE_ARCHIVE_ERROR',
      },
      {
        status:
          500,
      }
    );
  }
}
