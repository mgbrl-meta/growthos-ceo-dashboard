'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from 'lucide-react';

import {
  useRouter,
} from 'next/navigation';


export default function LoginPage() {

  const router =
    useRouter();


  const [
    email,
    setEmail,
  ] = useState('');


  const [
    password,
    setPassword,
  ] = useState('');


  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState('');


  // ==========================================================
  // IF ALREADY AUTHENTICATED, DO NOT SHOW LOGIN AGAIN
  // ==========================================================

  useEffect(
    () => {

      checkExistingSession();

    },
    []
  );


  async function checkExistingSession() {

    try {

      const response =
        await fetch(
          '/api/auth/me',
          {
            cache:
              'no-store',

            credentials:
              'include',
          }
        );


      if (
        response.ok
      ) {

        const json =
          await response.json();


        if (
          json?.authenticated
        ) {

          router.replace(
            '/'
          );


          return;

        }

      }


    } catch {

      // No active session.
    }


    setCheckingSession(
      false
    );

  }


  // ==========================================================
  // LOGIN
  // ==========================================================

  async function submit(
    event: FormEvent
  ) {

    event.preventDefault();


    if (
      loading
    ) {

      return;

    }


    setLoading(
      true
    );


    setError(
      ''
    );


    try {

      const response =
        await fetch(
          '/api/auth/login',
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json',

            },

            credentials:
              'include',

            body:
              JSON.stringify(
                {
                  email,
                  password,
                }
              ),

          }
        );


      const raw =
        await response.text();


      let json:
        any;


      try {

        json =
          JSON.parse(
            raw
          );

      } catch {

        throw new Error(
          `Login returned HTTP ${response.status}`
        );

      }


      if (
        !response.ok ||
        !json?.ok
      ) {

        throw new Error(
          json?.error ||
          'Unable to sign in'
        );

      }


      router.replace(
        '/'
      );


      router.refresh();


    } catch (
      loginError: any
    ) {

      setError(
        loginError?.message ||
        'Unable to sign in'
      );


    } finally {

      setLoading(
        false
      );

    }

  }


  // ==========================================================
  // SESSION CHECK
  // ==========================================================

  if (
    checkingSession
  ) {

    return (

      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">

        <LoaderCircle
          size={28}
          className="animate-spin text-slate-500"
        />

      </main>

    );

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-5 py-10">


      <section className="w-full max-w-[420px]">


        {/* ====================================================
            BRAND
        ==================================================== */}

        <div className="mb-8 text-center">

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-lg font-black text-white shadow-lg shadow-violet-200">
            G
          </div>


          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">
            Growth OS
          </h1>


          <p className="mt-1 text-sm text-slate-400">
            Business Intelligence
          </p>

        </div>


        {/* ====================================================
            LOGIN CARD
        ==================================================== */}

        <form
          onSubmit={
            submit
          }
          className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
        >


          <div>

            <h2 className="text-lg font-black tracking-[-0.03em] text-slate-950">
              Sign in
            </h2>


            <p className="mt-1 text-xs leading-5 text-slate-400">
              Access your Growth OS workspace.
            </p>

          </div>


          {/* ==================================================
              EMAIL
          ================================================== */}

          <div className="mt-6">

            <label
              htmlFor="email"
              className="mb-2 block text-[11px] font-bold text-slate-600"
            >
              Email
            </label>


            <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">

              <Mail
                size={16}
                className="shrink-0 text-slate-400"
              />


              <input
                id="email"
                type="email"
                autoComplete="username"

                value={
                  email
                }

                onChange={
                  event =>
                    setEmail(
                      event.target.value
                    )
                }

                placeholder="name@company.com"

                required

                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"
              />

            </div>

          </div>


          {/* ==================================================
              PASSWORD
          ================================================== */}

          <div className="mt-4">

            <label
              htmlFor="password"
              className="mb-2 block text-[11px] font-bold text-slate-600"
            >
              Password
            </label>


            <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">

              <LockKeyhole
                size={16}
                className="shrink-0 text-slate-400"
              />


              <input
                id="password"

                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }

                autoComplete="current-password"

                value={
                  password
                }

                onChange={
                  event =>
                    setPassword(
                      event.target.value
                    )
                }

                placeholder="Enter password"

                required

                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"
              />


              <button
                type="button"

                onClick={() =>
                  setShowPassword(
                    previous =>
                      !previous
                  )
                }

                className="text-slate-400 transition hover:text-slate-700"
              >

                {showPassword ? (

                  <EyeOff
                    size={16}
                  />

                ) : (

                  <Eye
                    size={16}
                  />

                )}

              </button>

            </div>

          </div>


          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (

            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">

              <p className="text-xs font-semibold leading-5 text-red-700">
                {error}
              </p>

            </div>

          )}


          {/* ==================================================
              LOGIN BUTTON
          ================================================== */}

          <button
            type="submit"

            disabled={
              loading
            }

            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >

            {loading && (

              <LoaderCircle
                size={16}
                className="animate-spin"
              />

            )}


            {loading
              ? 'Signing in...'
              : 'Sign in'}

          </button>


        </form>


        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
          Shopify users should open Growth OS through the installed Shopify app.
        </p>


      </section>

    </main>

  );

}