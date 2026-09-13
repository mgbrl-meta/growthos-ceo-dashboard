'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  CreditCard,
  ExternalLink,
  RefreshCw,
  Save,
} from 'lucide-react';

type SubscriptionContext = any;

type BillingSnapshot = {
  ok: boolean;
  billingAccount: any | null;
  billingProfile: any | null;
  invoices: any[];
  latestMigration: any | null;
  providerSetup: {
    razorpay: boolean;
    shopify: boolean;
  };
  shopify: {
    installed: boolean;
    shopDomain: string | null;
    shopId: string | null;
  };
  error?: string;
};

type PlanFeature = {
  moduleId: string;
  name: string;
  description: string | null;
};

type PlanOption = {
  planId: string;
  name: string;
  description: string | null;
  status: string;
  monthlyOrderLimit: number | null;
  maxUsers: number | null;
  priceLabel: string | null;
  features: PlanFeature[];
};

type ProfileDraft = {
  legalBusinessName: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  invoiceEmail: string;
};

const EMPTY_PROFILE: ProfileDraft = {
  legalBusinessName: '',
  gstin: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'IN',
  invoiceEmail: '',
};

function pretty(value: unknown) {
  return String(value || '—')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatLimit(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Unlimited';
  return Number(value).toLocaleString('en-IN');
}

function planRank(plan: PlanOption) {
  if (plan.monthlyOrderLimit === null || plan.monthlyOrderLimit === undefined) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(plan.monthlyOrderLimit);
}

export default function BillingSettingsV1({
  subscriptionContext,
  loading,
  error,
  reload,
}: {
  subscriptionContext: SubscriptionContext | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState('');
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [notice, setNotice] = useState('');

  async function loadBilling() {
    setBillingLoading(true);
    setBillingError('');

    try {
      const response = await fetch('/api/workspace/billing', {
        cache: 'no-store', credentials: 'same-origin',
      });
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || 'Unable to load billing');
      }

      setBilling(json);
      const p = json.billingProfile || {};
      setProfile({
        legalBusinessName: p.legalBusinessName || '',
        gstin: p.gstin || '',
        addressLine1: p.addressLine1 || '',
        addressLine2: p.addressLine2 || '',
        city: p.city || '',
        state: p.state || '',
        postalCode: p.postalCode || '',
        country: p.country || 'IN',
        invoiceEmail: p.invoiceEmail || '',
      });
    } catch (err: any) {
      setBillingError(String(err?.message || 'Unable to load billing'));
    } finally {
      setBillingLoading(false);
    }
  }

  async function loadPlans() {
    setPlansLoading(true);
    setPlansError('');

    try {
      const response = await fetch('/api/workspace/plans', {
        cache: 'no-store', credentials: 'same-origin',
      });
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || 'Unable to load plans');
      }

      setPlanOptions(Array.isArray(json.plans) ? json.plans : []);
    } catch (err: any) {
      setPlansError(String(err?.message || 'Unable to load plans'));
    } finally {
      setPlansLoading(false);
    }
  }

  async function refreshPage() {
    await Promise.all([
      loadBilling(),
      loadPlans(),
    ]);
    reload();
  }

  useEffect(() => {
    void Promise.all([
      loadBilling(),
      loadPlans(),
    ]);
  }, []);

  async function billingAction(action: string) {
    setActionSaving(true);
    setNotice('');
    setBillingError('');

    try {
      const response = await fetch('/api/workspace/billing', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, planId: subscriptionContext?.plan?.planId }),
      });
      const json = await response.json();

      if (!response.ok || json?.ok === false) {
        throw new Error(json?.message || json?.error || 'Billing action failed');
      }

      if (json.checkoutUrl || json.url) {
        window.location.assign(json.checkoutUrl || json.url);
        return;
      }

      setNotice(
        action === 'cancel'
          ? 'Cancellation scheduled with the billing provider.'
          : action === 'refresh_invoices'
            ? 'Invoice history refreshed.'
            : 'Billing updated.'
      );
      await loadBilling();
      reload();
    } catch (err: any) {
      setBillingError(String(err?.message || 'Billing action failed'));
    } finally {
      setActionSaving(false);
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    setNotice('');
    setBillingError('');

    try {
      const response = await fetch('/api/workspace/billing/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to save billing profile');
      }

      setNotice('Billing profile saved.');
      await loadBilling();
    } catch (err: any) {
      setBillingError(String(err?.message || 'Unable to save billing profile'));
    } finally {
      setProfileSaving(false);
    }
  }

  if (loading || billingLoading || plansLoading) {
    return <section className="gos-panel !p-4 text-[10px] text-slate-500">Loading Plan & Billing...</section>;
  }

  if (error || !subscriptionContext?.configured || !subscriptionContext?.plan || !subscriptionContext?.subscription) {
    return (
      <section className="gos-panel !p-4">
        <h3 className="gos-section-title">Plan & Billing</h3>
        <p className="mt-2 text-[10px] text-slate-500">
          {error || 'A Growth OS plan has not been assigned to this workspace yet.'}
        </p>
      </section>
    );
  }

  const account = billing?.billingAccount;
  const currentPlan = subscriptionContext.plan;
  const subscription = subscriptionContext.subscription;
  const channel = account?.channel || 'unconfigured';
  const billingMethod = channel === 'unconfigured' ? 'Not Configured' : pretty(channel);

  const catalogueCurrentPlan = planOptions.find(
    option => option.planId === String(currentPlan.planId)
  );

  const currentPlanOption: PlanOption = {
    planId: String(currentPlan.planId),
    name: String(currentPlan.name),
    description: currentPlan.description ?? catalogueCurrentPlan?.description ?? null,
    status: currentPlan.status || 'active',
    monthlyOrderLimit: currentPlan.monthlyOrderLimit ?? null,
    maxUsers: currentPlan.maxUsers ?? null,
    priceLabel: catalogueCurrentPlan?.priceLabel ?? null,
    features: catalogueCurrentPlan?.features ?? [],
  };

  const mergedPlans = new Map<string, PlanOption>();
  for (const option of planOptions) {
    mergedPlans.set(option.planId, option);
  }
  mergedPlans.set(currentPlanOption.planId, {
    ...(mergedPlans.get(currentPlanOption.planId) || {}),
    ...currentPlanOption,
  });

  const plans = Array.from(mergedPlans.values()).sort((a, b) => {
    const rankDifference = planRank(a) - planRank(b);
    if (rankDifference !== 0) return rankDifference;
    return a.name.localeCompare(b.name);
  });

  const currentPlanIndex = plans.findIndex(option => option.planId === currentPlan.planId);

  function planAction(option: PlanOption, index: number) {
    if (option.planId === currentPlan.planId) return 'current';

    if (currentPlanIndex >= 0) {
      return index < currentPlanIndex ? 'downgrade' : 'upgrade';
    }

    return planRank(option) < planRank(currentPlanOption) ? 'downgrade' : 'upgrade';
  }

  function showPlanChangeIntent(option: PlanOption, action: 'upgrade' | 'downgrade') {
    setBillingError('');
    setNotice(
      `${action === 'upgrade' ? 'Upgrade' : 'Downgrade'} to ${option.name} will be available here once self-service plan changes are enabled.`
    );
  }

  return (
    <div className="space-y-3">
      <section className="gos-panel !p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-violet-600" />
              <h2 className="gos-section-title">Plan & Billing</h2>
            </div>
            <p className="mt-1 text-[9px] leading-4 text-slate-500">
              Compare plans, review your current subscription and manage billing details.
            </p>
          </div>
          <button type="button" onClick={refreshPage} disabled={billingLoading || plansLoading} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </section>

      {(billingError || notice) && (
        <section className={`rounded-[9px] border p-3 text-[9px] ${billingError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {billingError || notice}
        </section>
      )}

      <section className="gos-panel !p-3.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="gos-section-title">Plans</h3>
            <p className="mt-1 text-[9px] text-slate-500">
              Your current plan and the other plans available to your workspace.
            </p>
          </div>
          <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {pretty(subscription.status)} access
          </span>
        </div>

        {plansError ? (
          <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-[9px] text-amber-800">
            Your current plan is available, but the full plan list could not be loaded right now.
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
          {plans.map((option, index) => {
            const action = planAction(option, index);
            const isCurrent = action === 'current';
            const orderLimit = isCurrent
              ? currentPlan.effectiveMonthlyOrderLimit
              : option.monthlyOrderLimit;

            return (
              <article
                key={option.planId}
                className={`flex min-h-[205px] flex-col rounded-[10px] border p-3.5 ${
                  isCurrent
                    ? 'border-violet-300 bg-violet-50/50 shadow-[0_0_0_1px_rgba(124,58,237,0.04)]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-[13px] font-semibold text-slate-950">{option.name}</h4>
                    {option.priceLabel ? (
                      <p className="mt-1 text-[12px] font-semibold text-slate-800">{option.priceLabel}</p>
                    ) : null}
                  </div>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-[7px] font-bold uppercase tracking-[0.1em] text-violet-700">
                      Current Plan
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 min-h-[32px] text-[8.5px] leading-4 text-slate-500">
                  {option.description || 'Growth OS access for your business.'}
                </p>

                <div className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-3 text-[9px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Monthly orders</span>
                    <span className="font-semibold text-slate-800">{formatLimit(orderLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Users</span>
                    <span className="font-semibold text-slate-800">{formatLimit(option.maxUsers)}</span>
                  </div>
                </div>

                <details className="group mt-3 border-t border-slate-200/80 pt-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 text-[9px] font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                    <span>View features ({option.features?.length || 0})</span>
                    <span className="text-[11px] text-slate-400 transition-transform group-open:rotate-180">⌄</span>
                  </summary>

                  <div className="mt-1.5 space-y-1.5 rounded-[8px] bg-slate-50 p-2.5">
                    {(option.features || []).length > 0 ? (
                      option.features.map(feature => (
                        <div key={feature.moduleId} className="flex items-start gap-2">
                          <span className="mt-[1px] text-[9px] font-bold text-emerald-600">✓</span>
                          <div className="min-w-0">
                            <div className="text-[8.5px] font-semibold text-slate-700">{feature.name}</div>
                            {feature.description ? (
                              <div className="mt-0.5 text-[8px] leading-3.5 text-slate-500">{feature.description}</div>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[8.5px] leading-4 text-slate-500">
                        Included features are not available for this plan yet.
                      </p>
                    )}
                  </div>
                </details>

                <div className="mt-auto pt-3">
                  {isCurrent ? (
                    <button type="button" disabled className="h-8 w-full rounded-[8px] bg-slate-100 px-3 text-[9px] font-semibold text-slate-500">
                      Current Plan
                    </button>
                  ) : action === 'downgrade' ? (
                    <button type="button" onClick={() => showPlanChangeIntent(option, 'downgrade')} className="h-8 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-700 hover:bg-slate-50">
                      Downgrade
                    </button>
                  ) : (
                    <button type="button" onClick={() => showPlanChangeIntent(option, 'upgrade')} className="h-8 w-full rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white hover:bg-slate-800">
                      Upgrade
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-3 text-[8.5px] leading-4 text-slate-500">
          Plan switching will become self-service here when enabled. Until then, your existing plan remains unchanged.
        </p>
      </section>

      <section className="gos-panel !p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="gos-section-title">Billing</h3>
            <p className="mt-1 text-[9px] text-slate-500">
              {account
                ? `Billing is ${pretty(account.status).toLowerCase()} via ${billingMethod}.`
                : 'Billing has not been configured for this workspace yet.'}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[8px] font-semibold ${account?.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {account ? pretty(account.status) : 'Not Configured'}
          </span>
        </div>

        {account ? (
          <>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Value label="Billing Method" value={billingMethod} />
              <Value label="Billing Cycle" value={account.billingCycle ? pretty(account.billingCycle) : '—'} />
              <Value label="Current Period End" value={formatDate(account.currentPeriodEnd)} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {channel === 'shopify' && (
                <button type="button" disabled={actionSaving || !billing?.providerSetup.shopify} onClick={() => billingAction('shopify_manage_url')} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white disabled:opacity-40">
                  Manage Billing <ExternalLink size={11} />
                </button>
              )}

              {account?.provider === 'razorpay' && account?.externalSubscriptionId && (
                <button type="button" disabled={actionSaving} onClick={() => billingAction('refresh_invoices')} className="h-8 rounded-[8px] border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-700 disabled:opacity-40">
                  Refresh Invoices
                </button>
              )}

              {account?.status === 'active' && !account?.cancelAtPeriodEnd && (
                <button type="button" disabled={actionSaving} onClick={() => {
                  if (window.confirm('Cancel this subscription at the end of the current billing cycle?')) billingAction('cancel');
                }} className="h-8 rounded-[8px] border border-red-200 bg-white px-3 text-[9px] font-semibold text-red-700 disabled:opacity-40">
                  Cancel Subscription
                </button>
              )}
            </div>

            {account?.cancelAtPeriodEnd && (
              <p className="mt-3 text-[9px] font-semibold text-amber-700">
                Cancellation is scheduled for the end of the current billing period.
              </p>
            )}
          </>
        ) : (
          <div className="mt-3 flex flex-col gap-3 rounded-[9px] border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-[9px] leading-4 text-slate-600">
              Your Growth OS access remains active independently of billing setup.
            </p>

            {(channel === 'unconfigured' || channel === 'direct') && !account?.externalSubscriptionId && billing?.providerSetup.razorpay ? (
              <button type="button" disabled={actionSaving} onClick={() => billingAction('start_direct_checkout')} className="h-8 shrink-0 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white disabled:opacity-40">
                Set Up Billing
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className="gos-panel !p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="gos-section-title">Billing Profile</h3>
            <p className="mt-1 text-[9px] text-slate-500">Used for billing records and invoices. Shopify-billed subscriptions continue to appear on your Shopify invoice.</p>
          </div>
          <button type="button" onClick={saveProfile} disabled={profileSaving} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white disabled:opacity-40">
            <Save size={11} /> {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <Field label="Legal Business Name" value={profile.legalBusinessName} onChange={value => setProfile(p => ({ ...p, legalBusinessName: value }))} />
          <Field label="GSTIN" value={profile.gstin} onChange={value => setProfile(p => ({ ...p, gstin: value.toUpperCase() }))} />
          <Field label="Invoice Email" value={profile.invoiceEmail} onChange={value => setProfile(p => ({ ...p, invoiceEmail: value }))} />
          <Field label="Country" value={profile.country} onChange={value => setProfile(p => ({ ...p, country: value.toUpperCase() }))} />
          <Field label="Address Line 1" value={profile.addressLine1} onChange={value => setProfile(p => ({ ...p, addressLine1: value }))} />
          <Field label="Address Line 2" value={profile.addressLine2} onChange={value => setProfile(p => ({ ...p, addressLine2: value }))} />
          <Field label="City" value={profile.city} onChange={value => setProfile(p => ({ ...p, city: value }))} />
          <Field label="State" value={profile.state} onChange={value => setProfile(p => ({ ...p, state: value }))} />
          <Field label="Postal Code" value={profile.postalCode} onChange={value => setProfile(p => ({ ...p, postalCode: value }))} />
        </div>
      </section>

      <section className="gos-panel !p-3.5">
        <div className="flex items-center justify-between">
          <h3 className="gos-section-title">Invoices</h3>
          <span className="text-[8px] text-slate-400">{billing?.invoices?.length || 0} invoices</span>
        </div>
        <div className="mt-3 space-y-2">
          {(billing?.invoices || []).length === 0 ? (
            <p className="text-[9px] text-slate-500">No invoices are available here yet. Shopify-billed charges continue to appear on your Shopify invoice.</p>
          ) : billing!.invoices.map(invoice => (
            <div key={invoice.invoiceId} className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-white p-2.5 text-[9px]">
              <div>
                <div className="font-semibold text-slate-800">{invoice.externalInvoiceId}</div>
                <div className="mt-0.5 text-slate-500">{formatDate(invoice.invoiceDate)} · {pretty(invoice.status)}</div>
              </div>
              {invoice.invoiceUrl && <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer" className="font-semibold text-violet-600">Open</a>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-2.5">
      <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-1 text-[9px] font-semibold text-slate-700">{value || '—'}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} className="gos-input w-full" />
    </label>
  );
}
