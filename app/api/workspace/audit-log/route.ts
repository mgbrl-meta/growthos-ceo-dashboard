import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  listGrowthOSWorkspaceUsersFast,
} from '@/lib/auth/user-store';

import {
  listGrowthOSAuditEvents,
} from '@/lib/audit';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// WORKSPACE AUDIT LOG
//
// OWNER / ADMIN ONLY.
//
// Shopify synthetic admin sessions are also allowed because
// they represent the verified store-admin launch path.
// ============================================================

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


    const workspaceId =
      String(
        identity.workspaceId
        ||
        ''
      ).trim();


    const brandId =
      String(
        identity.brandId
        ||
        ''
      ).trim();


    if (
      !workspaceId
      ||
      !brandId
    ) {

      return NextResponse.json(
        {
          ok:
            false,
          error:
            'ACTIVE_BRAND_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    let canView =
      false;


    if (
      identity.authMethod ===
        'shopify'
      &&
      (
        identity.role ===
          'owner'
        ||
        identity.role ===
          'admin'
      )
    ) {

      canView =
        true;

    } else {

      const users =
        await listGrowthOSWorkspaceUsersFast(
          workspaceId,
          brandId
        );


      const actor =
        users.find(
          user =>
            user.user_id ===
              identity.userId
        );


      canView =
        Boolean(
          actor
          &&
          actor.user_status ===
            'active'
          &&
          actor.membership_status ===
            'active'
          &&
          (
            actor.role ===
              'owner'
            ||
            actor.role ===
              'admin'
          )
        );

    }


    if (!canView) {

      return NextResponse.json(
        {
          ok:
            false,
          error:
            'AUDIT_LOG_ACCESS_REQUIRED',
        },
        {
          status:
            403,
        }
      );

    }


    const {
      searchParams,
    } =
      new URL(
        request.url
      );


    const page =
      Number(
        searchParams.get(
          'page'
        )
        ||
        1
      );


    const pageSize =
      Number(
        searchParams.get(
          'pageSize'
        )
        ||
        50
      );


    const result =
      await listGrowthOSAuditEvents({

        workspaceId,

        brandId,

        startDate:
          searchParams.get(
            'start'
          ),

        endDate:
          searchParams.get(
            'end'
          ),

        actorUserId:
          searchParams.get(
            'actorUserId'
          ),

        category:
          searchParams.get(
            'category'
          ),

        action:
          searchParams.get(
            'action'
          ),

        page,

        pageSize,

      });


    return NextResponse.json({
      ok:
        true,
      ...result,
    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_AUDIT_LOG_READ_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,
        error:
          'Unable to load audit log',
      },
      {
        status:
          500,
      }
    );

  }

}
