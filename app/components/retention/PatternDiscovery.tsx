'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  PatternActionGroup,
  PatternDiscoveryApiResponse,
  PatternDiscoveryData,
  PatternDiscoveryPattern,
} from './patternDiscoveryTypes';

type SortOption =
  | 'Operator Rank'
  | 'Priority Score'
  | 'Observed Support'
  | 'Confidence';

type PatternWorkflowType =
  | 'ACTIVATE'
  | 'TEST'
  | 'FIX';

const numberFormat = new Intl.NumberFormat('en-IN');

const money = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return '—';
  }

  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

const percent = (
  value: number | null | undefined,
  decimals = 2
) => {
  if (value === null || value === undefined) {
    return '—';
  }

  return `${(value * 100).toFixed(decimals)}%`;
};

const percentagePoints = (
  value: number | null | undefined
) => {
  if (value === null || value === undefined) {
    return '—';
  }

  const formatted = (value * 100).toFixed(2);

  return `${value > 0 ? '+' : ''}${formatted} pp`;
};

const titleCase = (
  value: string | null | undefined
) => {
  if (!value) {
    return '—';
  }

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
};

const formatTimestamp = (
  value: string | null | undefined
) => {
  if (!value) {
    return 'Refresh unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Refresh unavailable';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const getActionLabel = (
  action: PatternActionGroup
) => {
  if (action === 'ACTIVATE') {
    return 'READY TO ACTIVATE';
  }

  if (action === 'TEST') {
    return 'RUN TEST';
  }

  if (action === 'FIX') {
    return 'FIX ISSUE';
  }

  return 'MONITOR';
};

const getWorkflowType = (
  action: PatternActionGroup
): PatternWorkflowType | null => {
  if (action === 'ACTIVATE') return 'ACTIVATE';
  if (action === 'TEST') return 'TEST';
  if (action === 'FIX') return 'FIX';
  return null;
};

const getWorkflowButtonLabel = (
  workflowType: PatternWorkflowType
) => {
  if (workflowType === 'ACTIVATE') {
    return 'Add to Daily Planner';
  }

  if (workflowType === 'TEST') {
    return 'Create Test Brief';
  }

  return 'Open Investigation';
};

const getWindowLabel = (
  pattern: PatternDiscoveryPattern
) => {
  const start =
    pattern.recommended_window_start_day;

  const end =
    pattern.recommended_window_end_day;

  if (start === null || end === null) {
    return '—';
  }

  return `Day ${start}–${end}`;
};

export default function PatternDiscovery() {
  const [data, setData] =
    useState<PatternDiscoveryData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [reloadKey, setReloadKey] =
    useState(0);

  const [search, setSearch] =
    useState('');

  const [family, setFamily] =
    useState('All');

  const [actionGroup, setActionGroup] =
    useState<'All' | PatternActionGroup>('All');

  const [priority, setPriority] =
    useState('All');

  const [sortBy, setSortBy] =
    useState<SortOption>('Operator Rank');

  const [
    defaultVisibleOnly,
    setDefaultVisibleOnly,
  ] = useState(true);

  const [
    expandedPatternId,
    setExpandedPatternId,
  ] = useState<string | null>(null);

  const [
    creatingWorkflowKey,
    setCreatingWorkflowKey,
  ] = useState('');

  const [
    workflowMessage,
    setWorkflowMessage,
  ] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPatterns() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          '/api/retention-os/patterns',
          {
            cache: 'no-store',
            signal: controller.signal,
          }
        );

        const json =
          (await response.json()) as PatternDiscoveryApiResponse;

        if (
          !response.ok ||
          !json.ok ||
          !json.data
        ) {
          throw new Error(
            json.error?.message ||
              'Failed to load Pattern Discovery'
          );
        }

        setData(json.data);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        ) {
          return;
        }

        console.error(
          'Pattern Discovery fetch error',
          loadError
        );

        setData(null);

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load Pattern Discovery'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPatterns();

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const quality = data?.quality ?? null;
  const families = data?.families ?? [];
  const patterns = data?.patterns ?? [];

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = patterns.filter(
      (pattern) => {
        const searchableText = [
          pattern.pattern_family,
          pattern.pattern_subtype,
          pattern.operator_status,
          pattern.frontend_action_group,
          pattern.source_sku,
          pattern.source_product_title,
          pattern.source_category,
          pattern.source_routine,
          pattern.source_role,
          pattern.target_sku,
          pattern.target_product_title,
          pattern.target_category,
          pattern.target_routine,
          pattern.operator_headline,
          pattern.operator_action,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          !query ||
          searchableText.includes(query);

        const matchesFamily =
          family === 'All' ||
          pattern.pattern_family === family;

        const matchesAction =
          actionGroup === 'All' ||
          pattern.frontend_action_group ===
            actionGroup;

        const matchesPriority =
          priority === 'All' ||
          pattern.priority_band === priority;

        const matchesVisibility =
          !defaultVisibleOnly ||
          pattern.default_visible;

        return (
          matchesSearch &&
          matchesFamily &&
          matchesAction &&
          matchesPriority &&
          matchesVisibility
        );
      }
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === 'Priority Score') {
        return (
          b.operator_priority_score -
          a.operator_priority_score
        );
      }

      if (sortBy === 'Observed Support') {
        return (
          b.observed_support -
          a.observed_support
        );
      }

      if (sortBy === 'Confidence') {
        return (
          b.confidence_score -
          a.confidence_score
        );
      }

      return a.global_rank - b.global_rank;
    });
  }, [
    patterns,
    search,
    family,
    actionGroup,
    priority,
    sortBy,
    defaultVisibleOnly,
  ]);

  const defaultVisibleCount =
    patterns.filter(
      (pattern) => pattern.default_visible
    ).length;

  const highPriorityCount =
    Number(quality?.p1_patterns || 0) +
    Number(quality?.p2_patterns || 0);

  const activateNowCount =
    patterns.filter(
      (pattern) =>
        pattern.frontend_action_group ===
        'ACTIVATE'
    ).length;

  const testsReadyCount =
    patterns.filter(
      (pattern) =>
        pattern.frontend_action_group ===
        'TEST'
    ).length;

  const issuesToFixCount =
    patterns.filter(
      (pattern) =>
        pattern.frontend_action_group ===
        'FIX'
    ).length;

  const createWorkflow = async (
    pattern: PatternDiscoveryPattern,
    workflowType: PatternWorkflowType
  ) => {
    const workflowKey =
      `${pattern.pattern_id}:${workflowType}`;

    setCreatingWorkflowKey(workflowKey);
    setWorkflowMessage(null);

    try {
      const response = await fetch(
        '/api/retention-os/pattern-actions',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            patternId: pattern.pattern_id,
            workflowType,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(
          json.error ||
            'Failed to create workflow'
        );
      }

      setWorkflowMessage({
        type: 'success',
        text:
          workflowType === 'ACTIVATE'
            ? 'Added to Daily Planner handoffs.'
            : workflowType === 'TEST'
              ? 'Test brief created in Hypothesis Lab.'
              : 'Investigation opened in Action Tracker.',
      });
    } catch (workflowError) {
      console.error(
        'Pattern workflow creation error',
        workflowError
      );

      setWorkflowMessage({
        type: 'error',
        text:
          workflowError instanceof Error
            ? workflowError.message
            : 'Failed to create workflow.',
      });
    } finally {
      setCreatingWorkflowKey('');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-3.5">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600">
            Pattern Discovery
          </p>

          <h2 className="mt-2 text-[15px] font-semibold tracking-[-0.04em] text-slate-950">
            What Should the Operator Act On?
          </h2>

          <p className="mt-2 max-w-4xl text-[11px] leading-6 text-slate-500">
            Validated retention drivers, next-product sequences, routine
            completion, replenishment windows and controlled affinity tests
            from the frozen backend engines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500">
            Updated{' '}
            {formatTimestamp(
              quality?.latest_source_refresh
            )}
          </span>

          <button
            type="button"
            onClick={() =>
              setReloadKey((value) => value + 1)
            }
            disabled={loading}
            className="rounded-full border border-slate-900 bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-[11px] font-semibold text-red-700">
            Pattern Discovery failed to load
          </p>

          <p className="mt-1 text-[11px] text-red-600">
            {error}
          </p>
        </div>
      )}

      {workflowMessage && (
        <div
          className={`mt-3 flex items-center justify-between gap-3 rounded-lg border p-4 ${
            workflowMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className="text-[11px] font-semibold">
            {workflowMessage.text}
          </p>

          <button
            type="button"
            onClick={() =>
              setWorkflowMessage(null)
            }
            className="text-[10px] font-semibold uppercase tracking-wide"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Activate Now"
          value={numberFormat.format(
            activateNowCount
          )}
          subtext="Patterns ready for operator use"
        />

        <MetricCard
          label="Top Priority"
          value={numberFormat.format(
            highPriorityCount
          )}
          subtext="P1 and P2 opportunities"
        />

        <MetricCard
          label="Tests Ready"
          value={numberFormat.format(
            testsReadyCount
          )}
          subtext="Controlled experiments with evidence"
        />

        <MetricCard
          label="Issues to Fix"
          value={numberFormat.format(
            issuesToFixCount
          )}
          subtext={`${quality?.mapping_issue_patterns || 0} mapping issues identified`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-1 text-[10px] font-medium text-slate-500">
        <span>
          {numberFormat.format(
            quality?.total_master_patterns || 0
          )}{' '}
          total patterns
        </span>

        <span>
          {numberFormat.format(
            quality?.high_confidence_patterns || 0
          )}{' '}
          high-confidence patterns
        </span>

        <span>
          {numberFormat.format(
            quality?.source_products || 0
          )}{' '}
          source products
        </span>

        <span>
          {quality?.routines_covered || 0} routines
        </span>

        <span>
          {defaultVisibleCount} in default queue
        </span>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <FamilyButton
          active={family === 'All'}
          label="All Patterns"
          count={
            quality?.total_master_patterns || 0
          }
          onClick={() => setFamily('All')}
        />

        {families.map((item) => (
          <FamilyButton
            key={item.pattern_family}
            active={
              family === item.pattern_family
            }
            label={titleCase(
              item.pattern_family
            )}
            count={item.pattern_count}
            onClick={() =>
              setFamily(item.pattern_family)
            }
          />
        ))}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(260px,1fr)_190px_140px_170px_auto]">
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search SKU, product, routine or action…"
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-900 outline-none transition focus:border-slate-400"
        />

        <select
          value={actionGroup}
          onChange={(event) =>
            setActionGroup(
              event.target.value as
                | 'All'
                | PatternActionGroup
            )
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 outline-none"
        >
          <option value="All">
            All Actions
          </option>
          <option value="ACTIVATE">
            Ready to Activate
          </option>
          <option value="TEST">
            Run Test
          </option>
          <option value="FIX">
            Fix Issue
          </option>
          <option value="MONITOR">
            Monitor
          </option>
        </select>

        <select
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value)
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 outline-none"
        >
          <option value="All">
            All Priority
          </option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
          <option value="P4">P4</option>
        </select>

        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(
              event.target.value as SortOption
            )
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 outline-none"
        >
          <option>Operator Rank</option>
          <option>Priority Score</option>
          <option>Observed Support</option>
          <option>Confidence</option>
        </select>

        <label className="flex h-9 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3">
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Default Queue
          </span>

          <input
            type="checkbox"
            checked={defaultVisibleOnly}
            onChange={(event) =>
              setDefaultVisibleOnly(
                event.target.checked
              )
            }
            className="h-4 w-4"
          />
        </label>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-500">
          Showing{' '}
          <span className="text-slate-950">
            {numberFormat.format(rows.length)}
          </span>{' '}
          patterns
        </p>

        <p className="text-[10px] text-slate-400">
          Click a pattern to inspect evidence
        </p>
      </div>

      <div className="mt-3 max-h-[720px] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1480px] text-left">
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <th className="p-4">Rank</th>
              <th className="p-4">Action</th>
              <th className="p-4">Pattern</th>
              <th className="p-4">
                Source → Target
              </th>
              <th className="p-4">Evidence</th>
              <th className="p-4">Impact</th>
              <th className="p-4">Window</th>
              <th className="p-4">
                Confidence
              </th>
              <th className="p-4">
                Operator Action
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && !data && (
              <LoadingRows />
            )}

            {!loading &&
              rows.map((pattern) => {
                const expanded =
                  expandedPatternId ===
                  pattern.pattern_id;

                return (
                  <PatternRows
                    key={pattern.pattern_id}
                    pattern={pattern}
                    expanded={expanded}
                    creatingWorkflowKey={
                      creatingWorkflowKey
                    }
                    onCreateWorkflow={
                      createWorkflow
                    }
                    onToggle={() =>
                      setExpandedPatternId(
                        expanded
                          ? null
                          : pattern.pattern_id
                      )
                    }
                  />
                );
              })}

            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-3 text-center"
                >
                  <p className="text-[11px] font-semibold text-slate-700">
                    No patterns match these
                    filters.
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Clear the search or disable
                    Default Queue.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PatternRows({
  pattern,
  expanded,
  creatingWorkflowKey,
  onCreateWorkflow,
  onToggle,
}: {
  pattern: PatternDiscoveryPattern;
  expanded: boolean;
  creatingWorkflowKey: string;
  onCreateWorkflow: (
    pattern: PatternDiscoveryPattern,
    workflowType: PatternWorkflowType
  ) => Promise<void>;
  onToggle: () => void;
}) {
  const workflowType = getWorkflowType(
    pattern.frontend_action_group
  );

  const workflowKey = workflowType
    ? `${pattern.pattern_id}:${workflowType}`
    : '';

  const creatingWorkflow =
    Boolean(workflowKey) &&
    workflowKey === creatingWorkflowKey;

  return (
    <>
      <tr className="border-t border-slate-100 align-top transition hover:bg-slate-50">
        <td className="p-4">
          <div className="flex items-center gap-2">
            <PriorityBadge
              priority={pattern.priority_band}
            />

            <span className="whitespace-nowrap text-[10px] font-semibold text-slate-500">
              Queue #{pattern.global_rank}
            </span>
          </div>

          <p className="mt-2 text-[10px] font-bold text-slate-400">
            Score{' '}
            {pattern.operator_priority_score.toFixed(
              1
            )}
          </p>
        </td>

        <td className="p-4">
          <ActionBadge
            action={
              pattern.frontend_action_group
            }
          />

          <p className="mt-2 text-[10px] text-slate-500">
            {titleCase(
              pattern.operator_status
            )}
          </p>
        </td>

        <td className="p-4">
          <button
            type="button"
            onClick={onToggle}
            className="max-w-[260px] text-left"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
              {titleCase(
                pattern.pattern_family
              )}
            </p>

            <p className="mt-1 font-semibold leading-5 text-slate-950 hover:text-blue-700">
              {pattern.operator_headline}
            </p>

            <p className="mt-1 text-[10px] text-slate-500">
              {titleCase(
                pattern.pattern_subtype
              )}
            </p>
          </button>
        </td>

        <td className="p-4">
          <p className="max-w-[260px] font-bold text-slate-900">
            {pattern.source_product_title ||
              pattern.source_sku}
          </p>

          <p className="mt-1 text-[10px] font-bold text-slate-500">
            {pattern.source_sku}
          </p>

          {pattern.target_sku && (
            <>
              <p className="my-2 text-[10px] font-semibold text-blue-500">
                ↓
              </p>

              <p className="max-w-[260px] font-bold text-slate-900">
                {pattern.target_product_title ||
                  pattern.target_sku}
              </p>

              <p className="mt-1 text-[10px] font-bold text-slate-500">
                {pattern.target_sku}
              </p>
            </>
          )}
        </td>

        <td className="p-4">
          <p className="font-semibold text-slate-950">
            {numberFormat.format(
              pattern.observed_support
            )}
          </p>

          <p className="mt-1 max-w-[170px] text-[10px] leading-5 text-slate-500">
            {pattern.primary_metric_name}
          </p>

          <p className="mt-1 text-[11px] font-semibold text-blue-700">
            {percent(
              pattern.primary_metric_value
            )}
          </p>

          {pattern.benchmark_metric_value !==
            null && (
            <p className="mt-1 text-[10px] text-slate-500">
              Benchmark{' '}
              {percent(
                pattern.benchmark_metric_value
              )}
            </p>
          )}
        </td>

        <td className="p-4">
          <p className="text-[11px] font-semibold text-slate-950">
            {percentagePoints(
              pattern.absolute_lift
            )}
          </p>

          <p className="mt-2 text-[10px] text-slate-500">
            Downstream repeat
          </p>

          <p className="font-bold text-slate-800">
            {percentagePoints(
              pattern.downstream_repeat_lift
            )}
          </p>

          <p className="mt-2 max-w-[150px] text-[10px] leading-4 text-slate-500">
            Downstream revenue lift/customer
          </p>

          <p className="font-bold text-slate-800">
            {money(
              pattern.downstream_revenue_lift
            )}
          </p>
        </td>

        <td className="p-4">
          <p className="font-semibold text-slate-950">
            {getWindowLabel(pattern)}
          </p>

          {pattern.requires_holdout && (
            <p className="mt-2 max-w-[150px] text-[10px] leading-5 text-slate-500">
              {pattern.recommended_test_split ||
                'Holdout required'}
            </p>
          )}
        </td>

        <td className="p-4">
          <p className="font-semibold text-slate-950">
            {titleCase(
              pattern.confidence_band
            )}
          </p>

          <p className="mt-1 text-[11px] font-bold text-blue-700">
            {Math.round(
              pattern.confidence_score * 100
            )}
            %
          </p>

          <p className="mt-2 max-w-[170px] text-[10px] leading-5 text-slate-500">
            {titleCase(
              pattern.evidence_status
            )}
          </p>
        </td>

        <td className="p-4">
          <p className="max-w-[300px] text-[11px] font-bold leading-5 text-slate-800">
            {pattern.operator_action.length > 150
              ? `${pattern.operator_action.slice(
                  0,
                  150
                )}…`
              : pattern.operator_action}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {workflowType && (
              <button
                type="button"
                onClick={() =>
                  onCreateWorkflow(
                    pattern,
                    workflowType
                  )
                }
                disabled={creatingWorkflow}
                className="rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingWorkflow
                  ? 'Saving...'
                  : getWorkflowButtonLabel(
                      workflowType
                    )}
              </button>
            )}

            <button
              type="button"
              onClick={onToggle}
              className="px-1 text-[10px] font-semibold text-blue-700 hover:underline"
            >
              {expanded
                ? 'Hide evidence'
                : 'View evidence'}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={9} className="p-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <EvidenceCard
                label="Observed Support"
                value={numberFormat.format(
                  pattern.observed_support
                )}
              />

              <EvidenceCard
                label="Control Support"
                value={
                  pattern.control_support ===
                  null
                    ? '—'
                    : numberFormat.format(
                        pattern.control_support
                      )
                }
              />

              <EvidenceCard
                label="Engine Priority"
                value={pattern.engine_priority_score.toFixed(
                  2
                )}
              />

              <EvidenceCard
                label="Mapping"
                value={titleCase(
                  pattern.mapping_status
                )}
              />
            </div>

            <div className="mt-2.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <DetailBlock
                label="Full Operator Action"
                value={pattern.operator_action}
              />

              <DetailBlock
                label="Operator Insight"
                value={pattern.operator_insight}
              />

              <DetailBlock
                label="Decision Reason"
                value={pattern.decision_reason}
              />

              <DetailBlock
                label="Source Lineage"
                value={`${pattern.source_table} · ${pattern.source_version}`}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MetricCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-[14px] font-semibold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-slate-500">
        {subtext}
      </p>
    </div>
  );
}

function FamilyButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-2 text-[10px] font-semibold transition ${
        active
          ? 'border-slate-950 bg-slate-950 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
      }`}
    >
      {label}{' '}
      <span
        className={
          active
            ? 'text-slate-300'
            : 'text-slate-400'
        }
      >
        {numberFormat.format(count)}
      </span>
    </button>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: string;
}) {
  const classes: Record<string, string> = {
    P1: 'border-red-200 bg-red-50 text-red-700',
    P2: 'border-amber-200 bg-amber-50 text-amber-700',
    P3: 'border-blue-200 bg-blue-50 text-blue-700',
    P4: 'border-slate-200 bg-slate-100 text-slate-600',
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
        classes[priority] ||
        classes.P4
      }`}
    >
      {priority}
    </span>
  );
}

function ActionBadge({
  action,
}: {
  action: PatternActionGroup;
}) {
  const classes: Record<
    PatternActionGroup,
    string
  > = {
    ACTIVATE:
      'border-green-200 bg-green-50 text-green-700',

    TEST:
      'border-blue-200 bg-blue-50 text-blue-700',

    FIX:
      'border-red-200 bg-red-50 text-red-700',

    MONITOR:
      'border-slate-200 bg-slate-100 text-slate-600',
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold ${
        classes[action]
      }`}
    >
      {getActionLabel(action)}
    </span>
  );
}

function EvidenceCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-[11px] font-medium leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((row) => (
        <tr
          key={row}
          className="border-t border-slate-100"
        >
          <td colSpan={9} className="p-4">
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}
