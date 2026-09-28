import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireGrowthOSApiAccess,
  runtimeAccessErrorResponse,
} from '@/lib/auth/runtime-guard';

import {
  deleteMetaEventRule,
  listMetaEventRules,
  setMetaEventRuleEnabled,
  upsertMetaEventRule,
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
      await listMetaEventRules(
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
            : 'META_EVENTS_RULES_ERROR',
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
        'upsert'
      ).trim();

    if (
      action ===
      'toggle'
    ) {
      await setMetaEventRuleEnabled(
        access.workspaceId,
        access.brandId,
        String(
          body?.ruleId
          ||
          ''
        ).trim(),
        Boolean(
          body?.enabled
        )
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      action ===
      'delete'
    ) {
      await deleteMetaEventRule(
        access.workspaceId,
        access.brandId,
        String(
          body?.ruleId
          ||
          ''
        ).trim()
      );

      return NextResponse.json({
        ok: true,
      });
    }

    const ruleId =
      await upsertMetaEventRule(
        access.workspaceId,
        access.brandId,
        {
          ruleId:
            body?.ruleId,
          name:
            body?.name,
          source:
            body?.source,
          sourceEvent:
            body?.sourceEvent,
          metaEventName:
            body?.metaEventName,
          destinationId:
            body?.destinationId,
          actionSource:
            body?.actionSource,
          condition:
            body?.condition
            &&
            typeof body.condition ===
            'object'
              ? body.condition
              : {},
          enabled:
            body?.enabled,
          priority:
            body?.priority,
        }
      );

    return NextResponse.json({
      ok: true,
      data: {
        ruleId,
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
      'META_EVENTS_RULES_WRITE_ERROR',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'META_EVENTS_RULES_WRITE_ERROR',
      },
      { status: 500 }
    );
  }
}
