import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  verifyRazorpayWebhookSignature,
} from '@/lib/billing/providers/razorpay';

import {
  syncDirectSubscriptionFromWebhook,
} from '@/lib/billing/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  try {
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ ok: false, error: 'INVALID_WEBHOOK_SIGNATURE' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = String(payload?.event || '').trim();
    const eventId = String(request.headers.get('x-razorpay-event-id') || payload?.created_at || cryptoFallback(rawBody));
    const subscription = payload?.payload?.subscription?.entity;

    if (!eventType.startsWith('subscription.') || !subscription) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await syncDirectSubscriptionFromWebhook({
      eventId,
      eventType,
      subscription,
      payload,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error('RAZORPAY_BILLING_WEBHOOK_ERROR', error);
    return NextResponse.json({ ok: false, error: 'WEBHOOK_PROCESSING_FAILED' }, { status: 500 });
  }
}

function cryptoFallback(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return `fallback_${Math.abs(hash)}`;
}
