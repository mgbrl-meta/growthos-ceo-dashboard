'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  RefreshCw,
  Save,
  Search,
  Users,
} from 'lucide-react';

type Audience = {
  workspaceId: string;
  brandId: string;
};

type AdminSubmodule = {
  moduleId: string;
  submoduleId: string;
  label: string;
  status: string;
  accessMode: string;
  releaseStage: string;
  enabledPlans: number;
  totalPlanRows: number;
  clientOverrides: number;
  enabledOverrides: number;
  disabledOverrides: number;
  releaseAudience: Audience[];
};

type AdminModule = {
  moduleId: string;
  moduleName: string;
  description: string | null;
  moduleType: string | null;
  accessMode: string;
  releaseStage: string;
  category: string | null;
  routeKey: string | null;
  status: string;
  setupRequired: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  enabledPlans: number;
  totalPlanRows: number;
  clientOverrides: number;
  enabledOverrides: number;
  disabledOverrides: number;
  releaseAudience: Audience[];
  submodules: AdminSubmodule[];
};

type ModulesResponse = {
  ok: boolean;
  summary?: {
    total: number;
    active: number;
    inactive: number;
    standard: number;
    planControlled: number;
    custom: number;
    beta: number;
    setupRequired: number;
    planAssignments: number;
    clientOverrides: number;
  };
  modules?: AdminModule[];
  error?: string;
};

type AdminClient = {
  workspaceId: string;
  brandId: string;
  workspaceName: string | null;
  brandName: string | null;
  planName: string | null;
};

type ClientsResponse = {
  ok: boolean;
  clients?: AdminClient[];
};

const ACCESS_MODES = [
  { value: 'standard', label: 'Standard', description: 'Available to every eligible client.' },
  { value: 'plan', label: 'Plan', description: 'Availability comes from plan entitlement.' },
  { value: 'custom', label: 'Custom', description: 'Only explicitly allowed clients receive it.' },
];

const RELEASE_STAGES = [
  { value: 'draft', label: 'Draft' },
  { value: 'internal', label: 'Internal' },
  { value: 'beta', label: 'Selected Clients' },
  { value: 'live', label: 'Live' },
  { value: 'archived', label: 'Archived' },
];

export default function AdminModules() {
  const [data, setData] = useState<ModulesResponse | null>(null);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  async function load(fresh = false) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/modules${fresh ? '?fresh=1' : ''}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );

      const json: ModulesResponse = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error || 'Unable to load modules');
      }

      setData(json);
    } catch (err: any) {
      setError(String(err?.message || 'Unable to load modules'));
    } finally {
      setLoading(false);
    }
  }

  async function loadClients(fresh = false) {
    if (clientsLoading) return;
    if (!fresh && clients.length > 0) return;

    setClientsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/clients?mode=options${fresh ? '&fresh=1' : ''}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const json: ClientsResponse = await response.json();
      if (response.ok && json.ok) {
        setClients(json.clients || []);
      }
    } finally {
      setClientsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedModuleId) {
      void loadClients();
    }
  }, [selectedModuleId]);

  const modules = data?.modules || [];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter(module =>
      [
        module.moduleName,
        module.moduleId,
        module.category,
        module.accessMode,
        module.releaseStage,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    );
  }, [modules, search]);

  const selected = modules.find(module => module.moduleId === selectedModuleId) || null;

  if (selected) {
    return (
      <ModuleDetail
        module={selected}
        clients={clients}
        clientsLoading={clientsLoading}
        onBack={() => setSelectedModuleId(null)}
        onSaved={async () => {
          await load(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-3 p-3">
      <section className="gos-panel !p-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Boxes size={16} className="text-violet-600" />
              <h1 className="text-[16px] font-semibold text-slate-950">Modules & Release Control</h1>
            </div>
            <p className="mt-1 text-[9px] text-slate-500">
              Control what exists, who receives it and when a capability becomes public.
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
        <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <Summary label="Modules" value={data.summary.total} />
          <Summary label="Standard" value={data.summary.standard} tone="green" />
          <Summary label="Plan" value={data.summary.planControlled} tone="violet" />
          <Summary label="Custom" value={data.summary.custom} tone="amber" />
          <Summary label="Selected Client" value={data.summary.beta} tone="blue" />
          <Summary label="Plan Assignments" value={data.summary.planAssignments} />
          <Summary label="Client Overrides" value={data.summary.clientOverrides} />
        </section>
      )}

      <section className="gos-panel !p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="gos-section-title">Capability Catalogue</h2>
            <p className="mt-0.5 text-[9px] text-slate-500">
              Standard = everyone, Plan = plan entitlement, Custom = explicit client access.
            </p>
          </div>
          <div className="relative w-[240px] max-w-full">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search modules"
              className="h-8 w-full rounded-[8px] border border-slate-200 bg-white pl-8 pr-3 text-[9px] outline-none focus:border-violet-300"
            />
          </div>
        </div>

        {error && <ErrorBox message={error} />}

        <div className="mt-3 overflow-hidden rounded-[10px] border border-slate-200">
          <div className="grid grid-cols-[minmax(180px,1.4fr)_90px_110px_90px_90px_34px] bg-slate-50 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span>Module</span>
            <span>Access</span>
            <span>Release</span>
            <span>Plans</span>
            <span>Submodules</span>
            <span />
          </div>
          {loading ? (
            <div className="p-6 text-center text-[9px] text-slate-500">Loading capability catalogue…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-[9px] text-slate-500">No modules found.</div>
          ) : (
            filtered.map(module => (
              <button
                type="button"
                key={module.moduleId}
                onClick={() => setSelectedModuleId(module.moduleId)}
                className="grid w-full grid-cols-[minmax(180px,1.4fr)_90px_110px_90px_90px_34px] items-center border-t border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-slate-900">{module.moduleName}</div>
                  <div className="mt-0.5 truncate text-[8px] text-slate-400">{module.moduleId}</div>
                </div>
                <Badge value={module.accessMode} />
                <Badge value={module.releaseStage} />
                <span className="text-[9px] font-semibold text-slate-700">{module.enabledPlans}/{module.totalPlanRows}</span>
                <span className="text-[9px] font-semibold text-slate-700">{module.submodules.length}</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ModuleDetail({
  module,
  clients,
  clientsLoading,
  onBack,
  onSaved,
}: {
  module: AdminModule;
  clients: AdminClient[];
  clientsLoading: boolean;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const [accessMode, setAccessMode] = useState(module.accessMode || 'plan');
  const [releaseStage, setReleaseStage] = useState(module.releaseStage || 'live');
  const [status, setStatus] = useState(module.status || 'active');
  const [setupRequired, setSetupRequired] = useState(module.setupRequired);
  const [audience, setAudience] = useState<string[]>(
    module.releaseAudience.map(item => `${item.workspaceId}:${item.brandId}`)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const protectedSettingsParent =
    module.moduleId === 'settings';

  useEffect(() => {
    setAccessMode(module.accessMode || 'plan');
    setReleaseStage(module.releaseStage || 'live');
    setStatus(module.status || 'active');
    setSetupRequired(module.setupRequired);
    setAudience(module.releaseAudience.map(item => `${item.workspaceId}:${item.brandId}`));
  }, [module]);

  async function saveModule() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/modules', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'module',
          moduleId: module.moduleId,
          accessMode,
          releaseStage,
          status,
          setupRequired,
          audience: audience.map(key => {
            const [workspaceId, brandId] = splitClientKey(key);
            return { workspaceId, brandId };
          }),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Unable to save module');
      setMessage('Module control saved.');
      await onSaved();
    } catch (err: any) {
      setMessage(String(err?.message || 'Unable to save module'));
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
                <h2 className="text-[15px] font-semibold text-slate-950">{module.moduleName}</h2>
                <Badge value={accessMode} />
                <Badge value={releaseStage} />
              </div>
              <p className="mt-0.5 max-w-3xl text-[9px] text-slate-500">{module.description || module.moduleId}</p>
            </div>
          </div>
          {protectedSettingsParent ? (
            <span className="inline-flex h-8 items-center rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 text-[8px] font-semibold text-emerald-700">
              Protected Parent
            </span>
          ) : (
            <button
              type="button"
              onClick={saveModule}
              disabled={saving}
              className="inline-flex h-8 items-center gap-2 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Save size={12} />
              {saving ? 'Saving…' : 'Save Module'}
            </button>
          )}
        </div>
        {message && <p className="mt-2 text-[9px] text-slate-600">{message}</p>}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="gos-panel !p-3.5">
          <h3 className="gos-section-title">Module Control</h3>
          {protectedSettingsParent ? (
            <div className="mt-2 rounded-[9px] border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="text-[9px] font-semibold text-emerald-800">Settings parent is system-protected.</div>
              <p className="mt-1 text-[8px] leading-4 text-emerald-700">
                Settings remains Active, Standard and Live so clients always retain a safe account destination. Control Workspace, Billing, Integrations, Notifications, Data & Account and the other Settings sections individually below.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-0.5 text-[9px] text-slate-500">Operational state, commercial entitlement and release audience are independent controls.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <SelectField label="Operational Status" value={status} onChange={setStatus} options={[
                  ['active', 'Active'], ['draft', 'Draft'], ['suspended', 'Suspended'],
                ]} />
                <SelectField label="Access Mode" value={accessMode} onChange={setAccessMode} options={ACCESS_MODES.map(item => [item.value, item.label])} />
                <SelectField label="Release" value={releaseStage} onChange={setReleaseStage} options={RELEASE_STAGES.map(item => [item.value, item.label])} />
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-[9px] text-slate-700">
                <input type="checkbox" checked={setupRequired} onChange={event => setSetupRequired(event.target.checked)} />
                Integration/setup is required before this module is usable.
              </label>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                {ACCESS_MODES.map(item => (
                  <div key={item.value} className={`rounded-[8px] border p-2.5 ${accessMode === item.value ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                    <div className="text-[9px] font-semibold text-slate-800">{item.label}</div>
                    <div className="mt-0.5 text-[8px] leading-4 text-slate-500">{item.description}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="gos-panel !p-3.5">
          <h3 className="gos-section-title">Release Audience</h3>
          <p className="mt-0.5 text-[9px] text-slate-500">
            {protectedSettingsParent
              ? 'The Settings parent is always available. Release individual Settings sections from the Submodules list.'
              : 'Used when Release is Selected Clients. Draft/Internal never reach clients; Live follows the access mode.'}
          </p>
          {protectedSettingsParent ? (
            <div className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-[9px] text-slate-500">
              Parent audience control is intentionally disabled for Settings.
            </div>
          ) : releaseStage === 'beta' ? (
            <AudiencePicker clients={clients} selected={audience} onChange={setAudience} loading={clientsLoading} />
          ) : (
            <div className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-[9px] text-slate-500">
              {releaseStage === 'live'
                ? 'Live: audience is resolved by Standard / Plan / Custom access.'
                : 'No client audience is active at this release stage.'}
            </div>
          )}
        </section>
      </section>

      <section className="gos-panel !p-3.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="gos-section-title">Submodules</h3>
            <p className="mt-0.5 text-[9px] text-slate-500">Each screen can have its own access mode and release stage. Plan inclusion is edited under Admin → Plans.</p>
          </div>
          <div className="text-[8px] text-slate-400">{module.submodules.length} registered</div>
        </div>

        <div className="mt-3 space-y-2">
          {module.submodules.length === 0 ? (
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-center text-[9px] text-slate-500">No registered submodules.</div>
          ) : (
            module.submodules.map(submodule => (
              <SubmoduleControl
                key={`${submodule.moduleId}:${submodule.submoduleId}`}
                submodule={submodule}
                clients={clients}
                clientsLoading={clientsLoading}
                onSaved={onSaved}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SubmoduleControl({
  submodule,
  clients,
  clientsLoading,
  onSaved,
}: {
  submodule: AdminSubmodule;
  clients: AdminClient[];
  clientsLoading: boolean;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState(submodule.status || 'active');
  const [accessMode, setAccessMode] = useState(submodule.accessMode || 'plan');
  const [releaseStage, setReleaseStage] = useState(submodule.releaseStage || 'live');
  const [audience, setAudience] = useState<string[]>(
    submodule.releaseAudience.map(item => `${item.workspaceId}:${item.brandId}`)
  );
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus(submodule.status || 'active');
    setAccessMode(submodule.accessMode || 'plan');
    setReleaseStage(submodule.releaseStage || 'live');
    setAudience(submodule.releaseAudience.map(item => `${item.workspaceId}:${item.brandId}`));
  }, [submodule]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/modules', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'submodule',
          moduleId: submodule.moduleId,
          submoduleId: submodule.submoduleId,
          status,
          accessMode,
          releaseStage,
          audience: audience.map(key => {
            const [workspaceId, brandId] = splitClientKey(key);
            return { workspaceId, brandId };
          }),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Unable to save submodule');
      setMessage('Saved');
      await onSaved();
    } catch (err: any) {
      setMessage(String(err?.message || 'Unable to save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="grid w-full grid-cols-[minmax(160px,1fr)_90px_110px_110px_70px_24px] items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
      >
        <div>
          <div className="text-[9px] font-semibold text-slate-900">{submodule.label}</div>
          <div className="mt-0.5 text-[8px] text-slate-400">{submodule.submoduleId}</div>
        </div>
        <Badge value={accessMode} />
        <Badge value={releaseStage} />
        <span className="text-[8px] text-slate-500">{submodule.enabledPlans}/{submodule.totalPlanRows} plans</span>
        <span className="text-[8px] text-slate-500">{submodule.clientOverrides} overrides</span>
        <ChevronRight size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SelectField label="Status" value={status} onChange={setStatus} options={[
              ['active', 'Active'], ['draft', 'Draft'], ['suspended', 'Suspended'],
            ]} />
            <SelectField label="Access Mode" value={accessMode} onChange={setAccessMode} options={ACCESS_MODES.map(item => [item.value, item.label])} />
            <SelectField label="Release" value={releaseStage} onChange={setReleaseStage} options={RELEASE_STAGES.map(item => [item.value, item.label])} />
          </div>
          {releaseStage === 'beta' && (
            <div className="mt-3">
              <AudiencePicker clients={clients} selected={audience} onChange={setAudience} compact loading={clientsLoading} />
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[8px] text-slate-500">{message || 'Changes apply to client UI and runtime access after save.'}</span>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-8 items-center gap-2 rounded-[8px] bg-slate-950 px-3 text-[9px] font-semibold text-white disabled:opacity-50"
            >
              <Save size={11} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AudiencePicker({
  clients,
  selected,
  onChange,
  compact = false,
  loading = false,
}: {
  clients: AdminClient[];
  selected: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
  loading?: boolean;
}) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(client =>
      [client.workspaceName, client.brandName, client.planName, client.brandId]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q))
    );
  }, [clients, query]);

  return (
    <div className={compact ? '' : 'mt-3'}>
      <div className="relative">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Find client"
          className="h-8 w-full rounded-[8px] border border-slate-200 pl-8 pr-3 text-[9px] outline-none focus:border-violet-300"
        />
      </div>
      <div className="mt-2 max-h-[220px] space-y-1 overflow-y-auto rounded-[8px] border border-slate-200 p-1.5">
        {loading ? (
          <div className="p-3 text-center text-[8px] text-slate-400">Loading clients…</div>
        ) : visible.length === 0 ? (
          <div className="p-3 text-center text-[8px] text-slate-400">No clients found.</div>
        ) : visible.map(client => {
          const key = `${client.workspaceId}:${client.brandId}`;
          const checked = selected.includes(key);
          return (
            <label key={key} className="flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={checked}
                onChange={event => {
                  onChange(
                    event.target.checked
                      ? Array.from(new Set([...selected, key]))
                      : selected.filter(item => item !== key)
                  );
                }}
              />
              <Users size={11} className="text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-[8px] font-medium text-slate-700">
                {client.brandName || client.workspaceName || client.brandId}
              </span>
              <span className="text-[7px] text-slate-400">{client.planName || 'No plan'}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-1 text-[8px] text-slate-400">{selected.length} selected</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label>
      <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-9 w-full rounded-[8px] border border-slate-200 bg-white px-2.5 text-[9px] font-medium text-slate-700 outline-none focus:border-violet-300"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function Summary({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  tone?: 'slate' | 'green' | 'violet' | 'amber' | 'blue';
}) {
  const toneClass = {
    slate: 'border-slate-200 bg-white',
    green: 'border-emerald-200 bg-emerald-50/50',
    violet: 'border-violet-200 bg-violet-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    blue: 'border-blue-200 bg-blue-50/50',
  }[tone];

  return (
    <div className={`rounded-[10px] border p-3 ${toneClass}`}>
      <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Badge({ value }: { value: string }) {
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
    : normalized
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());

  return (
    <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[7px] font-semibold ${className}`}>
      {label || '—'}
    </span>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 p-3 text-[9px] text-rose-700">
      {message}
    </div>
  );
}

function splitClientKey(key: string): [string, string] {
  const index = key.indexOf(':');
  if (index < 0) return [key, ''];
  return [key.slice(0, index), key.slice(index + 1)];
}
