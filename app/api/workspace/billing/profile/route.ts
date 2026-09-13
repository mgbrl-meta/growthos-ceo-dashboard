import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  GrowthOSBillingError,
  requireBillingManager,
  requireBillingRead,
} from '@/lib/billing/service';

import {
  getBillingProfile,
  upsertBillingProfile,
} from '@/lib/billing/store';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(error: unknown) {
  if (error instanceof GrowthOSBillingError) {
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }
  console.error('BILLING_PROFILE_ERROR', error);
  return NextResponse.json({ ok: false, error: 'BILLING_PROFILE_ERROR' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, brandId } = await requireBillingRead(request);
    const profile = await getBillingProfile(workspaceId, brandId);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { identity, workspaceId, brandId } = await requireBillingManager(request);
    const body = await request.json();

    const gstin = String(body?.gstin || '').trim().toUpperCase() || null;
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      return NextResponse.json({ ok: false, error: 'INVALID_GSTIN' }, { status: 400 });
    }

    const invoiceEmail = String(body?.invoiceEmail || '').trim().toLowerCase() || null;
    if (invoiceEmail && !/^\S+@\S+\.\S+$/.test(invoiceEmail)) {
      return NextResponse.json({ ok: false, error: 'INVALID_INVOICE_EMAIL' }, { status: 400 });
    }

    const beforeProfile =
      await getBillingProfile(
        workspaceId,
        brandId
      );

    const profile = await upsertBillingProfile({
      workspaceId,
      brandId,
      legalBusinessName: String(body?.legalBusinessName || '').trim() || null,
      gstin,
      addressLine1: String(body?.addressLine1 || '').trim() || null,
      addressLine2: String(body?.addressLine2 || '').trim() || null,
      city: String(body?.city || '').trim() || null,
      state: String(body?.state || '').trim() || null,
      postalCode: String(body?.postalCode || '').trim() || null,
      country: String(body?.country || 'IN').trim().toUpperCase() || 'IN',
      invoiceEmail,
    });

    if (!profile) {

  return NextResponse.json(
    {
      ok:
        false,

      error:
        'BILLING_PROFILE_UPDATE_FAILED',
    },
    {
      status:
        500,
    }
  );

}

    await writeGrowthOSAuditEventSafe({
      request,
      workspaceId,
      brandId,
      category:
        'billing',
      action:
        'billing.profile_updated',
      actorUserId:
        identity.userId,
      actorEmail:
        identity.email
        ?? null,
      actorRole:
        identity.role
        ?? null,
      targetType:
        'billing_profile',
      targetId:
        profile.profileId,
      targetLabel:
        profile.legalBusinessName
        ?? profile.invoiceEmail
        ?? brandId,
      before:
        beforeProfile,
      after:
        profile,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return errorResponse(error);
  }
}
