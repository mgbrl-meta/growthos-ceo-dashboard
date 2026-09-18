'use client';

import { useState } from 'react';

export default function ManualCallModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [product, setProduct] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!phone.trim()) {
      alert('Phone is required');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/call-commerce/calls/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone,
          customerName: name,
          product,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Unable to add call');
      }
      onSaved();
    } catch (error: any) {
      alert(error?.message || 'Unable to add call');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/35 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4">
        <div className="flex justify-between">
          <h3 className="text-[13px] font-semibold">Add Manual Call</h3>
          <button onClick={onClose}>×</button>
        </div>

        <div className="mt-4 space-y-2">
          <input
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="Phone *"
            className="h-9 w-full rounded border border-slate-200 px-2 text-[10px]"
          />
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Customer name"
            className="h-9 w-full rounded border border-slate-200 px-2 text-[10px]"
          />
          <input
            value={product}
            onChange={event => setProduct(event.target.value)}
            placeholder="Product / Service (free text)"
            className="h-9 w-full rounded border border-slate-200 px-2 text-[10px]"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-slate-200 px-3 py-2 text-[9px]"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={save}
            className="rounded bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-50"
          >
            Save Call
          </button>
        </div>
      </div>
    </div>
  );
}
