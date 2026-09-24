'use client';

import {
  Archive,
  CheckCircle2,
  Clock3,
  Link2,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  TimerReset,
  Workflow,
} from 'lucide-react';

import type {
  ReactNode,
} from 'react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';


type Settings = {

  contactMinDurationSeconds:
    number;

  reopenGraceMinutes:
    number;

  autoArchiveTerminalLeads:
    boolean;

  terminalArchiveDays:
    number;

  requireUnqualifiedReason:
    boolean;

  requireClosedLostReason:
    boolean;

  requirePurchaseOrderId:
    boolean;

  requirePurchaseAmount:
    boolean;

  updatedAt:
    string |
    null;

  updatedBy:
    string |
    null;

};


const EMPTY:
  Settings = {

  contactMinDurationSeconds:
    20,

  reopenGraceMinutes:
    30,

  autoArchiveTerminalLeads:
    true,

  terminalArchiveDays:
    3,

  requireUnqualifiedReason:
    false,

  requireClosedLostReason:
    false,

  requirePurchaseOrderId:
    false,

  requirePurchaseAmount:
    false,

  updatedAt:
    null,

  updatedBy:
    null,

};


export default function CallCommerceSettings() {

  const [
    settings,
    setSettings,
  ] =
    useState<Settings>(
      EMPTY
    );


  const [
    saved,
    setSaved,
  ] =
    useState<Settings>(
      EMPTY
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
    useState(
      false
    );


  const [
    archiving,
    setArchiving,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ''
    );


  const [
    message,
    setMessage,
  ] =
    useState(
      ''
    );


  const dirty =
    useMemo(
      () =>
        JSON.stringify(
          comparable(
            settings
          )
        )
        !==
        JSON.stringify(
          comparable(
            saved
          )
        ),
      [
        settings,
        saved,
      ]
    );


  const load =
    useCallback(
      async () => {

        setLoading(
          true
        );

        setError(
          ''
        );


        try {

          const response =
            await fetch(
              '/api/call-commerce/settings',
              {
                cache:
                  'no-store',
              }
            );


          const body =
            await response.json();


          if (
            !response.ok ||
            !body?.ok
          ) {

            throw new Error(
              body?.error ||
              'Unable to load Call Commerce settings'
            );
          }


          const next =
            {
              ...EMPTY,
              ...body.data,
            };


          setSettings(
            next
          );

          setSaved(
            next
          );

        } catch (
          error: any
        ) {

          setError(
            error?.message ||
            'Unable to load Call Commerce settings'
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
      void load();
    },
    [
      load,
    ]
  );


  async function save() {

    setSaving(
      true
    );

    setError(
      ''
    );

    setMessage(
      ''
    );


    try {

      const response =
        await fetch(
          '/api/call-commerce/settings',
          {
            method:
              'PUT',

            headers: {
              'content-type':
                'application/json',
            },

            body:
              JSON.stringify(
                comparable(
                  settings
                )
              ),
          }
        );


      const body =
        await response.json();


      if (
        !response.ok ||
        !body?.ok
      ) {

        throw new Error(
          friendlyError(
            body?.error
          )
        );
      }


      const next =
        {
          ...EMPTY,
          ...body.data,
        };


      setSettings(
        next
      );

      setSaved(
        next
      );

      setMessage(
        'Settings saved.'
      );

    } catch (
      error: any
    ) {

      setError(
        friendlyError(
          error?.message
        )
      );

    } finally {

      setSaving(
        false
      );
    }
  }


  async function runArchive() {

    setArchiving(
      true
    );

    setError(
      ''
    );

    setMessage(
      ''
    );


    try {

      const response =
        await fetch(
          '/api/call-commerce/archive',
          {
            method:
              'POST',
          }
        );


      const body =
        await response.json();


      if (
        !response.ok ||
        !body?.ok
      ) {

        throw new Error(
          body?.error ||
          'Unable to apply archive policy'
        );
      }


      setMessage(
        settings
          .autoArchiveTerminalLeads
          ? 'Archive policy applied to all currently eligible leads.'
          : 'Archive policy is disabled; no leads were archived.'
      );

    } catch (
      error: any
    ) {

      setError(
        friendlyError(
          error?.message
        )
      );

    } finally {

      setArchiving(
        false
      );
    }
  }


  if (
    loading
  ) {

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-[10px] text-slate-400 shadow-sm">
        Loading Call Commerce settings…
      </div>
    );
  }


  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">

        <div>

          <div className="flex items-center gap-2">

            <Settings2
              size={15}
              className="text-slate-500"
            />

            <h3 className="text-[12px] font-semibold text-slate-950">
              Call Commerce settings
            </h3>

          </div>

          <p className="mt-1 max-w-2xl text-[9px] leading-4 text-slate-400">
            Brand-level operating rules for call qualification, lead threading,
            workflow validation and archive lifecycle.
          </p>

        </div>


        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={
              () =>
                void load()
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
          >

            <RefreshCw
              size={12}
            />

            Reload

          </button>


          <button
            type="button"
            disabled={
              saving ||
              !dirty
            }
            onClick={
              () =>
                void save()
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >

            <Save
              size={12}
            />

            {saving
              ? 'Saving…'
              : 'Save Changes'}

          </button>

        </div>

      </div>


      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[9px] text-red-700">
          {error}
        </div>
      )}


      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[9px] text-emerald-700">
          {message}
        </div>
      )}


      <div className="grid gap-4 xl:grid-cols-2">

        <SettingSection
          icon={
            <CheckCircle2
              size={14}
            />
          }
          title="Call qualification"
          helper="Controls when an answered call is considered a quality connected call for downstream Call Commerce events."
        >

          <NumberSetting
            label="Quality connected minimum duration"
            helper="Answered calls at or above this duration can generate the connected-call event."
            value={
              settings
                .contactMinDurationSeconds
            }
            suffix="seconds"
            min={1}
            max={600}
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    contactMinDurationSeconds:
                      value,
                  })
                )
            }
          />

        </SettingSection>


        <SettingSection
          icon={
            <Link2
              size={14}
            />
          }
          title="Lead threading"
          helper="Controls how repeat calls attach to an existing non-archived customer thread."
        >

          <NumberSetting
            label="Terminal lead reopen grace"
            helper="A new call can still attach to a recently finalized non-archived lead inside this grace period."
            value={
              settings
                .reopenGraceMinutes
            }
            suffix="minutes"
            min={0}
            max={10080}
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    reopenGraceMinutes:
                      value,
                  })
                )
            }
          />


          <ReadOnlyRule
            label="Repeated-call identity"
            value="Normalized customer phone"
          />


          <ReadOnlyRule
            label="Default new-lead status"
            value="NEW"
          />

        </SettingSection>


        <SettingSection
          icon={
            <Workflow
              size={14}
            />
          }
          title="Workflow validation"
          helper="Choose which business fields agents must provide before finalizing a lead."
        >

          <ToggleSetting
            label="Require reason when Unqualified"
            helper="Blocks Unqualified until the agent provides a reason."
            checked={
              settings
                .requireUnqualifiedReason
            }
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    requireUnqualifiedReason:
                      value,
                  })
                )
            }
          />


          <ToggleSetting
            label="Require reason when Closed Lost"
            helper="Blocks Closed Lost until the agent provides a reason."
            checked={
              settings
                .requireClosedLostReason
            }
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    requireClosedLostReason:
                      value,
                  })
                )
            }
          />


          <ToggleSetting
            label="Require order ID on Purchase"
            helper="When disabled, agents can mark Purchased without an order reference."
            checked={
              settings
                .requirePurchaseOrderId
            }
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    requirePurchaseOrderId:
                      value,
                  })
                )
            }
          />


          <ToggleSetting
            label="Require purchase value"
            helper="When disabled, purchase value can remain empty or zero."
            checked={
              settings
                .requirePurchaseAmount
            }
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    requirePurchaseAmount:
                      value,
                  })
                )
            }
          />

        </SettingSection>


        <SettingSection
          icon={
            <Archive
              size={14}
            />
          }
          title="Archive lifecycle"
          helper="Archive removes completed dead-end leads from the active Calls queue without deleting history."
        >

          <ToggleSetting
            label="Enable terminal-lead archive policy"
            helper="Applies only to Unqualified and Closed Lost leads."
            checked={
              settings
                .autoArchiveTerminalLeads
            }
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    autoArchiveTerminalLeads:
                      value,
                  })
                )
            }
          />


          <NumberSetting
            label="Archive after"
            helper="Time since the terminal workflow status was set."
            value={
              settings
                .terminalArchiveDays
            }
            suffix="days"
            min={1}
            max={365}
            disabled={
              !settings
                .autoArchiveTerminalLeads
            }
            onChange={
              value =>
                setSettings(
                  current => ({
                    ...current,
                    terminalArchiveDays:
                      value,
                  })
                )
            }
          />


          <ReadOnlyRule
            label="Auto-archive statuses"
            value="UNQUALIFIED · CLOSED_LOST"
          />


          <ReadOnlyRule
            label="Purchased"
            value="Never auto-archive"
          />


          <button
            type="button"
            disabled={
              archiving ||
              dirty
            }
            onClick={
              () =>
                void runArchive()
            }
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[8px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >

            <TimerReset
              size={11}
            />

            {archiving
              ? 'Applying…'
              : 'Apply Archive Policy Now'}

          </button>


          {dirty && (
            <p className="mt-1 text-[7px] text-amber-600">
              Save changes before running the archive policy.
            </p>
          )}

        </SettingSection>

      </div>


      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex items-start gap-3">

          <ShieldCheck
            size={15}
            className="mt-0.5 text-slate-400"
          />

          <div>

            <h3 className="text-[10px] font-semibold text-slate-800">
              Scope and integrations
            </h3>

            <p className="mt-1 text-[8px] leading-4 text-slate-400">
              These settings apply only to the currently authenticated workspace and brand.
              Calling-provider credentials, Meta, WhatsApp, email, SMS and future event routes
              remain under Growth OS Settings → Integrations.
            </p>

          </div>

        </div>

      </div>


      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[7px] text-slate-400">

        <span>
          Runtime settings are cached briefly for call-processing speed.
        </span>

        <span>
          {settings.updatedAt
            ? `Last saved ${formatDateTime(
                settings.updatedAt
              )}`
            : 'Using platform defaults until first save'}
        </span>

      </div>

    </div>
  );
}


function SettingSection({
  icon,
  title,
  helper,
  children,
}: {
  icon:
    ReactNode;

  title:
    string;

  helper:
    string;

  children:
    ReactNode;
}) {

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

      <div className="flex items-start gap-2.5">

        <div className="mt-0.5 text-slate-400">
          {icon}
        </div>

        <div>

          <h3 className="text-[10px] font-semibold text-slate-900">
            {title}
          </h3>

          <p className="mt-1 text-[8px] leading-4 text-slate-400">
            {helper}
          </p>

        </div>

      </div>


      <div className="mt-4 divide-y divide-slate-100">
        {children}
      </div>

    </section>
  );
}


function NumberSetting({
  label,
  helper,
  value,
  suffix,
  min,
  max,
  disabled = false,
  onChange,
}: {
  label:
    string;

  helper:
    string;

  value:
    number;

  suffix:
    string;

  min:
    number;

  max:
    number;

  disabled?:
    boolean;

  onChange:
    (
      value:
        number
    ) => void;
}) {

  return (
    <div className="flex items-center justify-between gap-4 py-3">

      <div>

        <div className="text-[9px] font-semibold text-slate-700">
          {label}
        </div>

        <div className="mt-0.5 max-w-md text-[7px] leading-3 text-slate-400">
          {helper}
        </div>

      </div>


      <div className="flex shrink-0 items-center gap-2">

        <input
          type="number"
          min={min}
          max={max}
          disabled={
            disabled
          }
          value={
            value
          }
          onChange={
            event =>
              onChange(
                Number(
                  event.target
                    .value
                )
              )
          }
          className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-right text-[9px] font-semibold text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-300"
        />

        <span className="w-12 text-[7px] text-slate-400">
          {suffix}
        </span>

      </div>

    </div>
  );
}


function ToggleSetting({
  label,
  helper,
  checked,
  onChange,
}: {
  label:
    string;

  helper:
    string;

  checked:
    boolean;

  onChange:
    (
      value:
        boolean
    ) => void;
}) {

  return (
    <div className="flex items-center justify-between gap-4 py-3">

      <div>

        <div className="text-[9px] font-semibold text-slate-700">
          {label}
        </div>

        <div className="mt-0.5 max-w-md text-[7px] leading-3 text-slate-400">
          {helper}
        </div>

      </div>


      <button
        type="button"
        aria-pressed={
          checked
        }
        onClick={
          () =>
            onChange(
              !checked
            )
        }
        className={[
          'relative h-5 w-9 shrink-0 rounded-full transition',
          checked
            ? 'bg-slate-950'
            : 'bg-slate-200',
        ].join(
          ' '
        )}
      >

        <span
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition',
            checked
              ? 'left-[18px]'
              : 'left-0.5',
          ].join(
            ' '
          )}
        />

      </button>

    </div>
  );
}


function ReadOnlyRule({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {

  return (
    <div className="flex items-center justify-between gap-4 py-3">

      <span className="text-[8px] text-slate-500">
        {label}
      </span>

      <span className="rounded-md bg-slate-50 px-2 py-1 text-[7px] font-semibold text-slate-600">
        {value}
      </span>

    </div>
  );
}


function comparable(
  settings:
    Settings
) {

  return {

    contactMinDurationSeconds:
      settings
        .contactMinDurationSeconds,

    reopenGraceMinutes:
      settings
        .reopenGraceMinutes,

    autoArchiveTerminalLeads:
      settings
        .autoArchiveTerminalLeads,

    terminalArchiveDays:
      settings
        .terminalArchiveDays,

    requireUnqualifiedReason:
      settings
        .requireUnqualifiedReason,

    requireClosedLostReason:
      settings
        .requireClosedLostReason,

    requirePurchaseOrderId:
      settings
        .requirePurchaseOrderId,

    requirePurchaseAmount:
      settings
        .requirePurchaseAmount,
  };
}


function friendlyError(
  error:
    any
) {

  const code =
    String(
      error ||
      ''
    );


  const map:
    Record<
      string,
      string
    > = {

    CALL_COMMERCE_CONTACT_DURATION_INVALID:
      'Quality connected duration must be a whole number between 1 and 600 seconds.',

    CALL_COMMERCE_REOPEN_GRACE_INVALID:
      'Reopen grace must be a whole number between 0 and 10,080 minutes.',

    CALL_COMMERCE_ARCHIVE_DAYS_INVALID:
      'Archive days must be a whole number between 1 and 365.',

  };


  return map[
    code
  ] ||
  code ||
  'Unable to save Call Commerce settings';
}


function formatDateTime(
  value:
    any
) {

  if (
    !value
  ) {
    return '—';
  }


  const raw =
    value?.value ||
    value;


  const date =
    new Date(
      raw
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      raw
    );
  }


  return date.toLocaleString(
    'en-IN',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    }
  );
}
