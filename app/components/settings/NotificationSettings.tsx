'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  Bell,
  RefreshCw,
  Save,
} from 'lucide-react';


type NotificationPreferences = {
  integrationHealth: boolean;
  billing: boolean;
  security: boolean;
  accessChanges: boolean;
  dataQuality: boolean;
  usageThresholds: boolean;
  weeklyDigest: boolean;
};


const DEFAULTS:
  NotificationPreferences = {
  integrationHealth: true,
  billing: true,
  security: true,
  accessChanges: true,
  dataQuality: true,
  usageThresholds: true,
  weeklyDigest: false,
};


const ITEMS:
  Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [

  {
    key: 'integrationHealth',
    label: 'Integration Health',
    description: 'Connection, authentication and sync-health events.',
  },

  {
    key: 'billing',
    label: 'Billing',
    description: 'Subscription or payment-state issues.',
  },

  {
    key: 'usageThresholds',
    label: 'Usage Thresholds',
    description: 'Important plan or order-usage thresholds.',
  },

  {
    key: 'security',
    label: 'Security',
    description: 'Security-sensitive account events.',
  },

  {
    key: 'accessChanges',
    label: 'Access Changes',
    description: 'Role, user and permission changes.',
  },

  {
    key: 'dataQuality',
    label: 'Data Quality',
    description: 'Critical data-quality and system-data warnings.',
  },

  {
    key: 'weeklyDigest',
    label: 'Weekly Digest',
    description: 'Preference reserved for a future scheduled Growth OS digest.',
  },

];


export default function NotificationSettings() {

  const [
    preferences,
    setPreferences,
  ] =
    useState<NotificationPreferences>(
      DEFAULTS
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    saved,
    setSaved,
  ] =
    useState(false);


  async function load() {

    try {

      setLoading(true);
      setError('');

      const response =
        await fetch(
          '/api/workspace/notifications',
          {
            cache:
              'no-store',
            credentials:
              'same-origin',
          }
        );

      const json =
        await response.json();

      if (
        !response.ok
        ||
        !json?.ok
      ) {

        throw new Error(
          json?.error
          ||
          'Unable to load notification preferences'
        );

      }

      setPreferences({
        ...DEFAULTS,
        ...(json.preferences || {}),
      });

    } catch (
      error:
        any
    ) {

      setError(
        String(
          error?.message
          ||
          'Unable to load notification preferences'
        )
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(
    () => {
      load();
    },
    []
  );


  async function save() {

    if (saving) {
      return;
    }


    try {

      setSaving(true);
      setError('');
      setSaved(false);

      const response =
        await fetch(
          '/api/workspace/notifications',
          {
            method:
              'PATCH',
            credentials:
              'same-origin',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify(
                preferences
              ),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok
        ||
        !json?.ok
      ) {

        throw new Error(
          json?.error
          ||
          'Unable to save notification preferences'
        );

      }

      setPreferences({
        ...DEFAULTS,
        ...(json.preferences || {}),
      });

      setSaved(true);

      window.setTimeout(
        () =>
          setSaved(false),
        1800
      );

    } catch (
      error:
        any
    ) {

      setError(
        String(
          error?.message
          ||
          'Unable to save notification preferences'
        )
      );

    } finally {

      setSaving(false);

    }

  }


  if (loading) {

    return (
      <div className="gos-panel p-5 text-sm text-slate-500">
        Loading notification preferences...
      </div>
    );

  }


  return (

    <div className="space-y-3">

      <section className="gos-panel !p-4">

        <div className="flex items-start justify-between gap-3">

          <div className="flex items-start gap-3">

            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
              <Bell size={16} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-slate-950">
                  Notifications
                </h2>              </div>
              <p className="mt-0.5 text-[9px] text-slate-500">
                Choose which Growth OS events you want to be informed about as notification delivery is rolled out.
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>

        </div>

      </section>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-800">
          {error}
        </div>
      )}


      <section className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-[9px] font-semibold text-amber-800">Notification delivery is still being rolled out.</p>
        <p className="mt-1 text-[8px] leading-4 text-amber-700">
          You can save your preferences now. Some notification types may not be delivered until this section is fully enabled.
        </p>
      </section>


      <section className="gos-panel !p-4">

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">

          {ITEMS.map(
            item => (

              <label
                key={item.key}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
              >

                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-900">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-slate-500">
                    {item.description}
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={
                    preferences[
                      item.key
                    ]
                  }
                  onChange={
                    event =>
                      setPreferences(
                        previous => ({
                          ...previous,
                          [item.key]:
                            event.target.checked,
                        })
                      )
                  }
                  className="mt-1 h-4 w-4 accent-slate-950"
                />

              </label>

            )
          )}

        </div>


        <div className="mt-4 flex items-center justify-between gap-3">

          <p className="text-[8px] leading-4 text-slate-500">
            Preferences are saved for this workspace.
          </p>

          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            <Save size={13} />
            {saving
              ? 'Saving...'
              : saved
                ? 'Saved'
                : 'Save Preferences'}
          </button>

        </div>

      </section>

    </div>

  );

}
