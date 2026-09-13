import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getClientPlanCatalogue,
} from '@/lib/plans/catalogue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const identity = await authenticateRequest(request);

    if (!identity) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    if (!identity.workspaceId || !identity.brandId) {
      return NextResponse.json(
        { ok: false, error: 'ACTIVE_BRAND_REQUIRED' },
        { status: 400 },
      );
    }

    const plans = await getClientPlanCatalogue();

    return NextResponse.json({
      ok: true,
      plans,
    });
  } catch (error: any) {
    console.error('WORKSPACE_PLAN_CATALOGUE_ERROR', {
      message: String(error?.message || 'Unable to load plan catalogue'),
    });

    return NextResponse.json(
      { ok: false, error: 'Unable to load plans' },
      { status: 500 },
    );
  }
}
