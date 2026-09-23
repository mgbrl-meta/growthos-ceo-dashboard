'use client';

import { Phone, X } from 'lucide-react';
import { useState } from 'react';

export default function ManualCallModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    phone: '',
    customerName: '',
    email: '',
    product: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function submit() {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/call-commerce/calls/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to create manual call');
      }
      setForm({
        phone: '',
        customerName: '',
        email: '',
        product: '',
        notes: '',
      });
      onCreated();
      onClose();
    } catch (error: any) {
      setError(error?.message || 'Unable to create manual call');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Phone size={15} />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-slate-950">Manual call record</div>
              <div className="text-[9px] text-slate-400">Create or attach a lead before agent follow-up</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50">
            <X size={15} />
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Phone *" value={form.phone} onChange={(phone) => setForm((prev) => ({ ...prev, phone }))} placeholder="919876543210" />
          <Field label="Customer name" value={form.customerName} onChange={(customerName) => setForm((prev) => ({ ...prev, customerName }))} />
          <Field label="Email" value={form.email} onChange={(email) => setForm((prev) => ({ ...prev, email }))} />
          <Field label="Product" value={form.product} onChange={(product) => setForm((prev) => ({ ...prev, product }))} />

          <label className="sm:col-span-2">
            <span className="text-[9px] font-semibold text-slate-500">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-slate-400"
            />
          </label>

          {error && (
            <div className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-[9px] text-red-700">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600">
            Cancel
          </button>
          <button
            disabled={saving || !form.phone.trim()}
            onClick={submit}
            className="rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Call'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="text-[9px] font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-slate-400"
      />
    </label>
  );
}
