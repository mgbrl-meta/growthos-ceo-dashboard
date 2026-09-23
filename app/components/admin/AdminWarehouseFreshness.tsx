"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DatabaseZap,
  RefreshCcw,
  Save,
} from "lucide-react";


type Policy = {
  workspaceId: string;
  brandId: string;
  brandName: string;
  brandStatus: string;
  refreshIntervalMinutes: number;
  enabled: boolean;
  lastRefreshAt: string | null;
  nextRefreshAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  updatedAt: string | null;
  pendingRecords: number;
  pendingOrders: number;
  pendingCustomers: number;
  pendingProducts: number;
  oldestPendingAt: string | null;
};


const INTERVALS = [
  [15, "15 min"],
  [30, "30 min"],
  [60, "1 hour"],
  [120, "2 hours"],
  [180, "3 hours"],
  [360, "6 hours"],
  [720, "12 hours"],
  [1440, "24 hours"],
] as const;


export default function AdminWarehouseFreshness() {

  const [
    policies,
    setPolicies,
  ] =
    useState<Policy[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    saving,
    setSaving,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  const load =
    useCallback(
      async () => {

        setLoading(
          true
        );

        setError(
          ""
        );


        try {

          const response =
            await fetch(
              "/api/admin/warehouse-refresh-policies",
              {
                cache:
                  "no-store",
              }
            );


          const json =
            await response.json();


          if (
            !response.ok
            ||
            !json.ok
          ) {

            throw new Error(
              json.error
              ||
              "Unable to load warehouse refresh policies"
            );

          }


          setPolicies(
            Array.isArray(
              json.policies
            )
              ? json.policies
              : []
          );

        } catch (
          loadError: any
        ) {

          setError(
            String(
              loadError?.message
              ||
              "Unable to load warehouse refresh policies"
            )
          );

        } finally {

          setLoading(
            false
          );

        }

      },
      []
    );


  useEffect(
    () => {

      load();

    },
    [
      load,
    ]
  );


  function updateLocal(
    brandId:
      string,
    patch:
      Partial<Policy>
  ) {

    setPolicies(
      current =>
        current.map(
          item =>
            item.brandId ===
              brandId
              ? {
                  ...item,
                  ...patch,
                }
              : item
        )
    );

  }


  async function save(
    policy:
      Policy
  ) {

    const key =
      `${policy.workspaceId}:${policy.brandId}`;


    setSaving(
      key
    );

    setError(
      ""
    );


    try {

      const response =
        await fetch(
          "/api/admin/warehouse-refresh-policies",
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                workspaceId:
                  policy.workspaceId,
                brandId:
                  policy.brandId,
                refreshIntervalMinutes:
                  policy.refreshIntervalMinutes,
                enabled:
                  policy.enabled,
                action:
                  "save",
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          "Unable to save policy"
        );

      }


      await load();

    } catch (
      saveError: any
    ) {

      setError(
        String(
          saveError?.message
          ||
          "Unable to save policy"
        )
      );

    } finally {

      setSaving(
        null
      );

    }

  }


  async function refreshNow(
    policy:
      Policy
  ) {

    const key =
      `refresh:${policy.workspaceId}:${policy.brandId}`;


    setSaving(
      key
    );

    setError(
      ""
    );


    try {

      const response =
        await fetch(
          "/api/admin/warehouse-refresh-policies",
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                workspaceId:
                  policy.workspaceId,
                brandId:
                  policy.brandId,
                action:
                  "refresh_now",
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          "Unable to queue refresh"
        );

      }


      await load();

    } catch (
      refreshError: any
    ) {

      setError(
        String(
          refreshError?.message
          ||
          "Unable to queue refresh"
        )
      );

    } finally {

      setSaving(
        null
      );

    }

  }


  return (
    <div className="space-y-3">

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex flex-wrap items-start justify-between gap-3">

          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-600">
              Data Freshness
            </p>

            <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-slate-950">
              Brand Warehouse Refresh
            </h2>

            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">
              Shopify webhooks continue landing immediately. This setting controls only when canonical RAW / STATE / CURRENT data is consolidated for analytics and dashboards.
            </p>
          </div>


          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 disabled:opacity-50"
          >
            <RefreshCcw
              size={13}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Reload
          </button>

        </div>

      </section>


      {error ? (

        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] text-red-700">
          {error}
        </div>

      ) : null}


      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1180px] border-collapse">

            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                <Th>Brand</Th>
                <Th>Refresh cadence</Th>
                <Th>Enabled</Th>
                <Th numeric>Pending</Th>
                <Th numeric>Orders</Th>
                <Th numeric>Customers</Th>
                <Th numeric>Products</Th>
                <Th>Last refresh</Th>
                <Th>Next refresh</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>

              {policies.map(
                policy => {

                  const saveKey =
                    `${policy.workspaceId}:${policy.brandId}`;

                  const refreshKey =
                    `refresh:${policy.workspaceId}:${policy.brandId}`;


                  return (
                    <tr
                      key={saveKey}
                      className="border-b border-slate-100 last:border-b-0"
                    >

                      <Td>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-900">
                            {policy.brandName}
                          </p>

                          <p className="mt-0.5 font-mono text-[8px] text-slate-400">
                            {policy.workspaceId} / {policy.brandId}
                          </p>
                        </div>
                      </Td>


                      <Td>
                        <select
                          value={
                            policy.refreshIntervalMinutes
                          }
                          onChange={
                            event =>
                              updateLocal(
                                policy.brandId,
                                {
                                  refreshIntervalMinutes:
                                    Number(
                                      event.target.value
                                    ),
                                }
                              )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700 outline-none"
                        >
                          {INTERVALS.map(
                            ([value, label]) => (
                              <option
                                key={value}
                                value={value}
                              >
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </Td>


                      <Td>
                        <label className="inline-flex items-center gap-2 text-[10px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={
                              policy.enabled
                            }
                            onChange={
                              event =>
                                updateLocal(
                                  policy.brandId,
                                  {
                                    enabled:
                                      event.target.checked,
                                  }
                                )
                            }
                          />
                          {policy.enabled
                            ? "On"
                            : "Off"}
                        </label>
                      </Td>


                      <Td numeric>
                        {policy.pendingRecords.toLocaleString()}
                      </Td>

                      <Td numeric>
                        {policy.pendingOrders.toLocaleString()}
                      </Td>

                      <Td numeric>
                        {policy.pendingCustomers.toLocaleString()}
                      </Td>

                      <Td numeric>
                        {policy.pendingProducts.toLocaleString()}
                      </Td>


                      <Td>
                        {formatTimestamp(
                          policy.lastRefreshAt
                        )}
                      </Td>

                      <Td>
                        {formatTimestamp(
                          policy.nextRefreshAt
                        )}
                      </Td>


                      <Td>
                        <StatusBadge
                          status={
                            policy.lastStatus
                          }
                          error={
                            policy.lastError
                          }
                        />
                      </Td>


                      <Td>
                        <div className="flex items-center gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              save(
                                policy
                              )
                            }
                            disabled={
                              saving ===
                              saveKey
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 py-2 text-[9px] font-semibold text-white disabled:opacity-50"
                          >
                            <Save
                              size={11}
                            />
                            Save
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              refreshNow(
                                policy
                              )
                            }
                            disabled={
                              saving ===
                              refreshKey
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[9px] font-semibold text-slate-700 disabled:opacity-50"
                          >
                            <DatabaseZap
                              size={11}
                            />
                            Refresh now
                          </button>

                        </div>
                      </Td>

                    </tr>
                  );

                }
              )}


              {!loading
              &&
              policies.length ===
                0 ? (

                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-[11px] text-slate-400"
                  >
                    No brands found.
                  </td>
                </tr>

              ) : null}

            </tbody>

          </table>

        </div>

      </section>


      <p className="px-1 text-[9px] leading-4 text-slate-400">
        Scheduler checks every 5 minutes, but BigQuery canonical refresh runs only for brands whose configured cadence is due and which have pending Shopify changes.
      </p>

    </div>
  );

}


function Th({
  children,
  numeric =
    false,
}: {
  children:
    ReactNode;
  numeric?:
    boolean;
}) {

  return (
    <th
      className={`px-3 py-3 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${
        numeric
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );

}


function Td({
  children,
  numeric =
    false,
}: {
  children:
    ReactNode;
  numeric?:
    boolean;
}) {

  return (
    <td
      className={`px-3 py-3 text-[10px] text-slate-600 ${
        numeric
          ? "text-right font-medium text-slate-800"
          : "text-left"
      }`}
    >
      {children}
    </td>
  );

}


function formatTimestamp(
  value:
    string |
    null
) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(
    date
  );

}


function StatusBadge({
  status,
  error,
}: {
  status:
    string |
    null;
  error:
    string |
    null;
}) {

  if (!status) {

    return (
      <span className="text-[9px] text-slate-400">
        Not refreshed
      </span>
    );

  }


  const normalized =
    status.toLowerCase();


  const className =
    normalized ===
    "success"
      ? "bg-emerald-50 text-emerald-700"
      : normalized ===
        "failed"
        ? "bg-red-50 text-red-700"
        : "bg-slate-100 text-slate-600";


  return (
    <span
      title={
        error
        ||
        undefined
      }
      className={`inline-flex rounded-full px-2 py-1 text-[8px] font-semibold uppercase ${className}`}
    >
      {status}
    </span>
  );

}
