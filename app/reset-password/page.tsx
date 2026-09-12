'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';


export default function ResetPasswordPage() {

  const [token, setToken] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState('');


  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token') || '';
    setToken(value);
  }, []);


  async function submit(event: FormEvent) {

    event.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is invalid.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error === 'RESET_TOKEN_INVALID_OR_EXPIRED'
            ? 'This reset link is invalid or has expired.'
            : json?.error || 'Unable to reset password'
        );
      }

      setSuccess(true);

    } catch (resetError: any) {
      setError(resetError?.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }

  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-5 py-10">
      <section className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-lg font-black text-white shadow-lg shadow-violet-200">G</div>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">Growth OS</h1>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          {success ? (
            <>
              <h2 className="text-lg font-black tracking-[-0.03em] text-slate-950">Password updated</h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">Your old Growth OS sessions have been signed out. Sign in with your new password.</p>
              <a href="/login" className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">Sign in</a>
            </>
          ) : (
            <>
              <h2 className="text-lg font-black tracking-[-0.03em] text-slate-950">Choose a new password</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Use at least 10 characters.</p>

              <PasswordField label="New Password" value={password} onChange={setPassword} />
              <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} />

              {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">{error}</p>}

              <button type="submit" disabled={loading} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-black text-white disabled:opacity-60">
                {loading && <LoaderCircle size={16} className="animate-spin" />}
                {loading ? 'Updating...' : 'Reset password'}
              </button>
            </>
          )}
        </form>
      </section>
    </main>
  );
}


function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-4">
      <label className="mb-2 block text-[11px] font-bold text-slate-600">{label}</label>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
        <LockKeyhole size={16} className="text-slate-400" />
        <input
          type="password"
          value={value}
          onChange={event => onChange(event.target.value)}
          autoComplete="new-password"
          required
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"
        />
      </div>
    </div>
  );
}
