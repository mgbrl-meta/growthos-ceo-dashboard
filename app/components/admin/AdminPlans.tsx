'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react';

type AdminPlanSubmodule = {
  submoduleId: string;
  label: string;
  status: string;
  accessMode: string;
  releaseStage: string;
  enabled: boolean;
};

type AdminPlanModule = {
  moduleId: string;
  moduleName: string | null;
  description: string | null;
  category: string | null;
  routeKey: string | null;
  moduleStatus: string | null;
  accessMode: string;
  releaseStage: string;
  setupRequired: boolean;
  enabled: boolean;
  submodules: AdminPlanSubmodule[];
};

type AdminPlan = {
  planId: string;
  planName: string;
  description: string | null;
  status: string;
  monthlyOrderLimit: number | null;
  maxUsers: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  assignedClients: number;
  enabledModules: number;
  totalModules: number;
  enabledSubmodules: number;
  totalSubmodules: number;
  modules: AdminPlanModule[];
};

type PlansResponse = {
  ok: boolean;
  summary?: {
    total: number;
    active: number;
    inactive: number;
    assignedClients: number;
    unassignedPlans: number;
  };
  plans?: AdminPlan[];
  error?: string;
};

export default function AdminPlans() {
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  async function load(fresh = false) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/plans${fresh ? '?fresh=1' : ''}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const json: PlansResponse = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error || 'Unable to load plans');
      }
      setData(json);
    } catch (err: any) {
      setError(String(err?.message || 'Unable to load plans'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const plans = data?.plans || [];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return plans;
    return plans.filter(plan =>
      [plan.planName, plan.planId, plan.description]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    );
  }, [plans, search]);

  const selected = plans.find(plan => plan.planId === selectedPlanId) || null;

  if (selected) {
    return (
      <PlanDetail
        plan={selected}
        onBack={() => setSelectedPlanId(null)}
        onSaved={() => load(true)}
      />
    );
  }

  return (
    <div className="space-y-3 p-3">
      <section className="gos-panel !p-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-violet-600" />
              <h1 className="text-[16px] font-semibold text-slate-950">Plans</h1>
            </div>
            <p className="mt-1 text-[9px] text-slate-500">
              Define which plan-controlled modules and submodules each commercial plan contains.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </section>

      {data?.summary && (
        <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Summary label="Plans" value={data.summary.total} />
          <Summary label="Active" value={data.summary.active} tone="green" />
          <Summary label="Inactive" value={data.summary.inactive} />
          <Summary label="Assigned Clients" value={data.summary.assignedClients} tone="violet" />
          <Summary label="Unassigned" value={data.summary.unassignedPlans} tone="amber" />
        </section>
      )}

      <section className="gos-panel !p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="gos-section-title">Plan Catalogue</h2>
            <p className="mt-0.5 text-[9px] text-slate-500">Pricing and billing mapping remain separate. This screen controls product entitlement.</p>
          </div>
          <div className="relative w-[240px] max-w-full">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search plans"
              className="h-8 w-full rounded-[8px] border border-slate-200 bg-white pl-8 pr-3 text-[9px] outline-none focus:border-violet-300"
            />
          </div>
        </div>

        {error && <div className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 p-3 text-[9px] text-rose-700">{error}</div>}

        <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
          {loading ? (
            <div className="col-span-full p-6 text-center text-[9px] text-slate-500">Loading plans…</div>
          ) : filtered.map(plan => (
            <button
              type="button"
              key={plan.planId}
              onClick={() => setSelectedPlanId(plan.planId)}
              className="rounded-[10px] border border-slate-200 bg-white p-3 text-left hover:border-violet-200 hover:bg-violet-50/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-semibold text-slate-950">{plan.planName}</div>
                    <Badge value={plan.status} />
                  </div>
                  <div className="mt-1 text-[8px] leading-4 text-slate-500">{plan.description || plan.planId}</div>
                </div>
                <ChevronRight size={14} className="mt-0.5 text-slate-400" />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                <Metric label="Orders" value={plan.monthlyOrderLimit === null ? 'Unlimited' : formatNumber(plan.monthlyOrderLimit)} />
                <Metric label="Users" value={plan.maxUsers === null ? 'Unlimited' : formatNumber(plan.maxUsers)} />
                <Metric label="Modules" value={`${plan.enabledModules}/${plan.totalModules}`} />
                <Metric label="Clients" value={formatNumber(plan.assignedClients)} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanDetail({
  plan,
  onBack,
  onSaved,
}: {
  plan: AdminPlan;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<AdminPlanModule[]>(() => cloneModules(plan.modules));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(cloneModules(plan.modules));
  }, [plan]);

  function setModuleEnabled(moduleId: string, enabled: boolean) {
    setDraft(current => current.map(module => {
      if (module.moduleId !== moduleId) return module;

      // Keep submodule selections intact when the parent module is toggled.
      // The runtime parent gate still hides them while the module is off,
      // but Admin does not lose the plan's finer-grained configuration.
      return {
        ...module,
        enabled,
      };
    }));
  }

  function setSubmoduleEnabled(moduleId: string, submoduleId: string, enabled: boolean) {
    setDraft(current => current.map(module => {
      if (module.moduleId !== moduleId) return module;
      return {
        ...module,
        submodules: module.submodules.map(submodule =>
          submodule.submoduleId === submoduleId
            ? { ...submodule, enabled }
            : submodule
        ),
      };
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/plans', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planId: plan.planId,
          modules: draft.map(module => ({
            moduleId: module.moduleId,
            enabled: module.enabled,
            submodules: module.submodules.map(submodule => ({
              submoduleId: submodule.submoduleId,
              enabled: submodule.enabled,
            })),
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Unable to save plan entitlement');
      setMessage('Plan entitlement saved.');
      await onSaved();
    } catch (err: any) {
      setMessage(String(err?.message || 'Unable to save plan entitlement'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 p-3">
      <section className="gos-panel !p-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-slate-200 bg-white hover:bg-slate-50">
              <ArrowLeft size={14} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-slate-950">{plan.planName}</h2>
                <Badge value={plan.status} />
              </div>
              <p className="mt-0.5 text-[9px] text-slate-500">{plan.description || plan.planId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-8 items-center gap-2 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save Entitlements'}
          </button>
        </div>
        {message && <p className="mt-2 text-[9px] text-slate-600">{message}</p>}
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Summary label="Monthly Orders" value={plan.monthlyOrderLimit === null ? 'Unlimited' : formatNumber(plan.monthlyOrderLimit)} />
        <Summary label="Users" value={plan.maxUsers === null ? 'Unlimited' : formatNumber(plan.maxUsers)} />
        <Summary label="Clients" value={plan.assignedClients} tone="violet" />
        <Summary label="Modules" value={`${draft.filter(moduleIncludedForPlan).length}/${draft.length}`} />
        <Summary label="Submodules" value={`${countIncludedSubmodules(draft)}/${draft.reduce((count, module) => count + module.submodules.length, 0)}`} />
      </section>

      <section className="gos-panel !p-3.5">
        <h3 className="gos-section-title">What this plan contains</h3>
        <p className="mt-0.5 text-[9px] text-slate-500">
          Only capabilities with Access Mode = Plan are controlled here. Standard is automatically available; Custom is assigned at client level.
        </p>

        <div className="mt-3 space-y-2">
          {draft.map(module => {
            const planControlled = module.accessMode === 'plan';
            return (
              <div key={module.moduleId} className="rounded-[10px] border border-slate-200 bg-white">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <label className={`flex min-w-0 flex-1 items-start gap-2 ${planControlled ? 'cursor-pointer' : 'cursor-default'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={planControlled ? module.enabled : module.accessMode === 'standard'}
                      disabled={!planControlled}
                      onChange={event => setModuleEnabled(module.moduleId, event.target.checked)}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-900">{module.moduleName || module.moduleId}</span>
                        <Badge value={module.accessMode} />
                        <Badge value={module.releaseStage} />
                      </div>
                      <div className="mt-0.5 text-[8px] text-slate-500">{module.description || module.moduleId}</div>
                    </div>
                  </label>
                  <div className="text-right text-[8px] text-slate-400">
                    {module.accessMode === 'standard'
                      ? 'Included for all clients'
                      : module.accessMode === 'custom'
                        ? 'Controlled per client'
                        : module.enabled
                          ? 'Included'
                          : 'Not included'}
                  </div>
                </div>

                {module.submodules.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-2.5">
                    <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                      {module.submodules.map(submodule => {
                        const submodulePlanControlled = submodule.accessMode === 'plan';
                        const parentAvailable =
                          module.accessMode === 'standard' ||
                          (module.accessMode === 'plan' && module.enabled) ||
                          module.accessMode === 'custom';
                        const checked = submodulePlanControlled
                          ? submodule.enabled && parentAvailable
                          : submodule.accessMode === 'standard' && parentAvailable;

                        const submoduleEditable =
                          submodulePlanControlled
                          &&
                          parentAvailable;

                        return (
                          <label
                            key={submodule.submoduleId}
                            className={`flex items-start gap-2 rounded-[8px] border px-2.5 py-2 ${submoduleEditable ? 'cursor-pointer border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              disabled={!submoduleEditable}
                              onChange={event => setSubmoduleEnabled(module.moduleId, submodule.submoduleId, event.target.checked)}
                            />
                            <div className="min-w-0">
                              <div className="text-[8px] font-semibold text-slate-700">{submodule.label}</div>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                <Badge value={submodule.accessMode} small />
                                {submodule.releaseStage !== 'live' && <Badge value={submodule.releaseStage} small />}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function moduleIncludedForPlan(module: AdminPlanModule) {
  return (
    module.accessMode === 'standard'
    ||
    (module.accessMode === 'plan' && module.enabled)
  );
}

function countIncludedSubmodules(modules: AdminPlanModule[]) {
  return modules.reduce((count, module) => {
    if (!moduleIncludedForPlan(module)) {
      return count;
    }

    return count + module.submodules.filter(submodule => (
      submodule.accessMode === 'standard'
      ||
      (submodule.accessMode === 'plan' && submodule.enabled)
    )).length;
  }, 0);
}

function cloneModules(modules: AdminPlanModule[]): AdminPlanModule[] {
  return modules.map(module => ({
    ...module,
    submodules: module.submodules.map(submodule => ({ ...submodule })),
  }));
}

function Summary({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  tone?: 'slate' | 'green' | 'violet' | 'amber';
}) {
  const toneClass = {
    slate: 'border-slate-200 bg-white',
    green: 'border-emerald-200 bg-emerald-50/50',
    violet: 'border-violet-200 bg-violet-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
  }[tone];

  return (
    <div className={`rounded-[10px] border p-3 ${toneClass}`}>
      <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[7px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-1 text-[9px] font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function Badge({ value, small = false }: { value: string; small?: boolean }) {
  const normalized = String(value || '').toLowerCase();
  const className =
    normalized === 'standard' || normalized === 'live' || normalized === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized === 'plan'
        ? 'border-violet-200 bg-violet-50 text-violet-700'
        : normalized === 'beta'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : normalized === 'custom' || normalized === 'internal'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-slate-50 text-slate-600';
  const label = normalized === 'beta'
    ? 'Selected'
    : normalized.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

  return (
    <span className={`inline-flex w-fit rounded-full border font-semibold ${small ? 'px-1.5 py-0 text-[6px]' : 'px-2 py-0.5 text-[7px]'} ${className}`}>
      {label || '—'}
    </span>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}
