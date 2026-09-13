import 'server-only';

import crypto from 'crypto';

function requireRazorpayCredentials() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_SETUP_REQUIRED');
  }
  return { keyId, keySecret };
}

function authHeader() {
  const { keyId, keySecret } = requireRazorpayCredentials();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function razorpayRequest(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const raw = await response.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = { raw };
  }

  if (!response.ok) {
    const detail = json?.error?.description || json?.error?.reason || json?.error || `HTTP ${response.status}`;
    throw new Error(`RAZORPAY_API_ERROR:${String(detail)}`);
  }

  return json;
}

export async function createRazorpaySubscription(input: {
  planId: string;
  totalCount?: number;
  customerNotify?: boolean;
  notes?: Record<string, string>;
}) {
  const result = await razorpayRequest('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: input.planId,
      total_count: input.totalCount ?? 120,
      customer_notify: input.customerNotify === false ? 0 : 1,
      notes: input.notes ?? {},
    }),
  });

  return {
    id: String(result.id || ''),
    status: String(result.status || ''),
    shortUrl: result.short_url ? String(result.short_url) : null,
    currentStart: result.current_start ? new Date(Number(result.current_start) * 1000).toISOString() : null,
    currentEnd: result.current_end ? new Date(Number(result.current_end) * 1000).toISOString() : null,
    planId: result.plan_id ? String(result.plan_id) : input.planId,
    raw: result,
  };
}

export async function fetchRazorpaySubscription(subscriptionId: string) {
  const result = await razorpayRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return {
    id: String(result.id || subscriptionId),
    status: String(result.status || ''),
    planId: result.plan_id ? String(result.plan_id) : null,
    currentStart: result.current_start ? new Date(Number(result.current_start) * 1000).toISOString() : null,
    currentEnd: result.current_end ? new Date(Number(result.current_end) * 1000).toISOString() : null,
    endedAt: result.ended_at ? new Date(Number(result.ended_at) * 1000).toISOString() : null,
    raw: result,
  };
}

export async function cancelRazorpaySubscription(subscriptionId: string, cancelAtCycleEnd = true) {
  const result = await razorpayRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
  });
  return result;
}

export async function fetchRazorpaySubscriptionInvoices(subscriptionId: string) {
  const result = await razorpayRequest(`/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=100`);
  return Array.isArray(result?.items) ? result.items : [];
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET_REQUIRED');
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
