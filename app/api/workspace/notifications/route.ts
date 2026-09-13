import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSNotificationPreferences,
  upsertGrowthOSNotificationPreferences,
} from '@/lib/notifications/store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


function resolveTenant(
  identity:
    NonNullable<
      Awaited<
        ReturnType<
          typeof authenticateRequest
        >
      >
    >
) {

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

    return null;

  }


  return {
    workspaceId,
    brandId,
  };

}


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


    const tenant =
      resolveTenant(
        identity
      );


    if (!tenant) {

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


    const preferences =
      await getGrowthOSNotificationPreferences({

        userId:
          identity.userId,

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

      });


    return NextResponse.json({

      ok:
        true,

      preferences,

      delivery: {

        inAppPreferenceModel:
          true,

        emailDeliveryActive:
          false,

        note:
          'Notification preferences are stored now. External email delivery can be connected later without changing this model.',

      },

    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_NOTIFICATION_READ_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,
        error:
          'NOTIFICATION_READ_FAILED',
      },
      {
        status:
          500,
      }
    );

  }

}


export async function PATCH(
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


    const tenant =
      resolveTenant(
        identity
      );


    if (!tenant) {

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


    const body =
      await request.json();


    const before =
      await getGrowthOSNotificationPreferences({

        userId:
          identity.userId,

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

      });


    const after =
      await upsertGrowthOSNotificationPreferences({

        userId:
          identity.userId,

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        preferences: {

          integrationHealth:
            typeof body?.integrationHealth ===
              'boolean'
              ? body.integrationHealth
              : before.integrationHealth,

          billing:
            typeof body?.billing ===
              'boolean'
              ? body.billing
              : before.billing,

          security:
            typeof body?.security ===
              'boolean'
              ? body.security
              : before.security,

          accessChanges:
            typeof body?.accessChanges ===
              'boolean'
              ? body.accessChanges
              : before.accessChanges,

          dataQuality:
            typeof body?.dataQuality ===
              'boolean'
              ? body.dataQuality
              : before.dataQuality,

          usageThresholds:
            typeof body?.usageThresholds ===
              'boolean'
              ? body.usageThresholds
              : before.usageThresholds,

          weeklyDigest:
            typeof body?.weeklyDigest ===
              'boolean'
              ? body.weeklyDigest
              : before.weeklyDigest,

        },

      });


    await writeGrowthOSAuditEventSafe({

      request,

      workspaceId:
        tenant.workspaceId,

      brandId:
        tenant.brandId,

      category:
        'workspace',

      action:
        'notifications.preferences_updated',

      actorUserId:
        identity.userId,

      actorEmail:
        identity.email
        ??
        null,

      actorRole:
        identity.role
        ??
        null,

      targetType:
        'user_notification_preferences',

      targetId:
        identity.userId,

      targetLabel:
        identity.email
        ??
        identity.userId,

      before,

      after,

    });


    return NextResponse.json({

      ok:
        true,

      preferences:
        after,

    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_NOTIFICATION_UPDATE_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,
        error:
          'NOTIFICATION_UPDATE_FAILED',
      },
      {
        status:
          500,
      }
    );

  }

}
