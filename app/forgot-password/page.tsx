'use client';

import {
  FormEvent,
  useState,
} from 'react';

import {
  LoaderCircle,
  Mail,
} from 'lucide-react';


export default function ForgotPasswordPage() {

  const [
    email,
    setEmail,
  ] =
    useState('');


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    sent,
    setSent,
  ] =
    useState(false);


  async function submit(
    event:
      FormEvent
  ) {

    event.preventDefault();


    if (loading) {
      return;
    }


    try {

      setLoading(
        true
      );


      await fetch(
        '/api/auth/forgot-password',
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              email,
            }),
        }
      );


      setSent(
        true
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  return (

    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-5 py-10">

      <section className="w-full max-w-[420px]">

        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-lg font-black text-white shadow-lg shadow-violet-200">
            G
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">
            Reset password
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Growth OS
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
        >

          {sent ? (
            <>
              <h2 className="text-lg font-black tracking-[-0.03em] text-slate-950">
                Check your email
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                If that email is registered, a secure password-reset link has been sent. The link expires in 30 minutes.
              </p>
              <a
                href="/login"
                className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Back to sign in
              </a>
            </>
          ) : (
            <>
              <h2 className="text-lg font-black tracking-[-0.03em] text-slate-950">
                Forgot your password?
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Enter your Growth OS email address.
              </p>

              <div className="mt-6">
                <label
                  htmlFor="email"
                  className="mb-2 block text-[11px] font-bold text-slate-600"
                >
                  Email
                </label>
                <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
                  <Mail size={16} className="shrink-0 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading && <LoaderCircle size={16} className="animate-spin" />}
                {loading ? 'Sending...' : 'Send reset link'}
              </button>

              <a
                href="/login"
                className="mt-4 block text-center text-[11px] font-semibold text-violet-600"
              >
                Back to sign in
              </a>
            </>
          )}

        </form>

      </section>

    </main>

  );

}
