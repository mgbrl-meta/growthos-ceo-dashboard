'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowRightLeft,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

type ClientRef = {
  workspaceId: string;
  brandId: string;
  planId: string | null;
  planName: string | null;
};

type BillingResponse = {
  ok: boolean;
  billingAccount?: any | null;
  latestMigration?: any | null;
  providerSetup?: { razorpay: boolean; shopify: boolean };
  shopify?: { installed: boolean; shopDomain: string | null };
  error?: string;
  message?: string;
};

function pretty(value: unknown) {
  return String(value || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AdminBillingPanel({ client }: { client: ClientRef }) {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [externalPlanId, setExternalPlanId] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ workspaceId: client.workspaceId, brandId: client.brandId });
      const response = await fetch(`/api/admin/billing/brand?${params.toString()}`, {
        cache: 'no-store', credentials: 'same-origin',
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.message || json?.error || 'Unable to load billing');
      setData(json);
    } catch (err: any) {
      setError(String(err?.message || 'Unable to load billing'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [client.workspaceId, client.brandId]);

  async function migrate(targetChannel: 'shopify' | 'direct') {
    if (!client.planId) {
      setError('Assign a Growth OS plan before changing billing provider.');
      return;
    }
    if (!externalPlanId.trim()) {
      setError(targetChannel === 'shopify' ? 'Enter the Shopify plan handle.' : 'Enter the Razorpay plan ID.');
      return;
    }

    const confirmed = window.confirm(
      `Start billing migration to ${targetChannel === 'shopify' ? 'Shopify' : 'Direct / Razorpay'}?\n\n` +
      'The old provider is not cancelled until the new provider is confirmed active.'
    );
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/billing/brand', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: client.workspaceId,
          brandId: client.brandId,
          targetChannel,
          targetPlanId: client.planId,
          targetExternalPlanId: externalPlanId.trim(),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.message || json?.error || 'Unable to start migration');

      setNotice('Migration started. Customer/provider confirmation is now required before Growth OS switches the billing owner.');
      if (json.checkoutUrl) {
        window.open(json.checkoutUrl, '_blank', 'noopener,noreferrer');
      }
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Unable to start migration'));
    } finally {
      setSaving(false);
    }
  }

  const account = data?.billingAccount;
  const currentChannel = account?.channel || 'unconfigured';

  return (
    <section className="gos-panel !p-3.5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={14} className="text-violet-600" />
            <h3 className="gos-section-title">Billing Owner & Migration</h3>
          </div>
          <p className="mt-1 text-[9px] text-slate-500">
            Exactly one active billing rail per brand. Growth OS entitlements remain provider-independent.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-700 disabled:opacity-40">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {(error || notice) && (
        <div className={`mt-3 rounded-[8px] border p-2.5 text-[9px] ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      {loading ? (
        <p className="mt-3 text-[9px] text-slate-500">Loading billing owner...</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Cell label="Channel" value={pretty(currentChannel)} />
            <Cell label="Provider" value={pretty(account?.provider)} />
            <Cell label="Status" value={pretty(account?.status)} />
            <Cell label="External Plan" value={account?.externalPlanId || '—'} mono />
          </div>

          {data?.latestMigration && (
            <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 p-2.5 text-[9px] text-amber-800">
              Latest migration: {pretty(data.latestMigration.fromChannel)} → {pretty(data.latestMigration.toChannel)} · {pretty(data.latestMigration.status)}
              {data.latestMigration.failureReason ? ` · ${data.latestMigration.failureReason}` : ''}
            </div>
          )}

          <div className="mt-3">
            <label className="block text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Target provider plan ID / handle
            </label>
            <input
              value={externalPlanId}
              onChange={event => setExternalPlanId(event.target.value)}
              placeholder={currentChannel === 'shopify' ? 'Razorpay plan_xxx' : 'Shopify plan handle'}
              className="gos-input mt-1 w-full max-w-xl"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {currentChannel !== 'direct' && (
              <button type="button" disabled={saving || !data?.providerSetup?.razorpay} onClick={() => migrate('direct')} className="h-8 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white disabled:opacity-40">
                Move to Direct Billing
              </button>
            )}

            {currentChannel !== 'shopify' && (
              <button type="button" disabled={saving || !data?.providerSetup?.shopify || !data?.shopify?.installed} onClick={() => migrate('shopify')} className="h-8 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white disabled:opacity-40">
                Move to Shopify Billing
              </button>
            )}
          </div>

          <div className="mt-3 text-[8px] leading-4 text-slate-500">
            Shopify → Direct is intentionally disabled by default. Enable <span className="font-mono">GROWTHOS_ALLOW_SHOPIFY_TO_DIRECT_MIGRATION=true</span> only after confirming the merchant is eligible to be billed outside Shopify.
          </div>
        </>
      )}
    </section>
  );
}

function Cell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-2.5"><div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div><div className={`mt-1 text-[9px] font-semibold text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</div></div>;
}
