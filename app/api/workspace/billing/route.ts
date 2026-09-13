import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

import {
  cancelCurrentBilling,
  getBillingSnapshot,
  getShopifyManageUrl,
  GrowthOSBillingError,
  refreshDirectInvoices,
  requireBillingManager,
  requireBillingRead,
  startDirectCheckout,
  verifyDirectSubscriptionAndMaybeActivate,
} from '@/lib/billing/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(error: unknown) {
  if (error instanceof GrowthOSBillingError) {
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }
  console.error('WORKSPACE_BILLING_ERROR', error);
  return NextResponse.json({ ok: false, error: 'BILLING_ERROR' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, brandId } = await requireBillingRead(request);
    const snapshot = await getBillingSnapshot(workspaceId, brandId);
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { identity, workspaceId, brandId } = await requireBillingManager(request);
    const body = await request.json();
    const action = String(body?.action || '').trim();

    if (action === 'start_direct_checkout') {
      const result = await startDirectCheckout({
        workspaceId,
        brandId,
        userId: identity.userId,
        planId: body?.planId ? String(body.planId) : null,
      });

      await writeGrowthOSAuditEventSafe({
        request,
        workspaceId,
        brandId,
        category:
          'billing',
        action:
          'billing.direct_checkout_started',
        actorUserId:
          identity.userId,
        actorEmail:
          identity.email
          ?? null,
        actorRole:
          identity.role
          ?? null,
        targetType:
          'subscription',
        targetId:
          body?.planId
            ? String(body.planId)
            : null,
        targetLabel:
          'Direct billing checkout',
        metadata:
          result,
      });

      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'shopify_manage_url') {
      const result = await getShopifyManageUrl(workspaceId, brandId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'cancel') {
      const result = await cancelCurrentBilling({
        workspaceId,
        brandId,
        defer: body?.defer !== false,
      });

      await writeGrowthOSAuditEventSafe({
        request,
        workspaceId,
        brandId,
        category:
          'billing',
        action:
          'billing.cancellation_requested',
        actorUserId:
          identity.userId,
        actorEmail:
          identity.email
          ?? null,
        actorRole:
          identity.role
          ?? null,
        targetType:
          'subscription',
        targetId:
          brandId,
        targetLabel:
          brandId,
        metadata: {
          defer:
            body?.defer !== false,
          result,
        },
      });

      return NextResponse.json({ result });
    }

    if (action === 'refresh_invoices') {
      const invoices = await refreshDirectInvoices(workspaceId, brandId);
      return NextResponse.json({ ok: true, invoices });
    }

    if (action === 'verify_direct') {
      const billingAccount = await verifyDirectSubscriptionAndMaybeActivate(workspaceId, brandId);

      await writeGrowthOSAuditEventSafe({
        request,
        workspaceId,
        brandId,
        category:
          'billing',
        action:
          'billing.direct_subscription_verified',
        actorUserId:
          identity.userId,
        actorEmail:
          identity.email
          ?? null,
        actorRole:
          identity.role
          ?? null,
        targetType:
          'billing_account',
        targetId:
          billingAccount?.billingAccountId
          ?? brandId,
        targetLabel:
          'Direct billing',
        after:
          billingAccount,
      });

      return NextResponse.json({ ok: true, billingAccount });
    }

    return NextResponse.json({ ok: false, error: 'INVALID_BILLING_ACTION' }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
