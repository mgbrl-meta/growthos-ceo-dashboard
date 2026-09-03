'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  XCircle,
} from 'lucide-react';


type ShopInfo = {

  id: string;

  domain: string;

  name: string;

};


export default function ShopifyEntryPage() {

  const [
    status,
    setStatus,
  ] = useState<
    'loading'
    |
    'success'
    |
    'error'
  >(
    'loading'
  );


  const [
    shop,
    setShop,
  ] = useState<ShopInfo | null>(
    null
  );


  const [
    error,
    setError,
  ] = useState(
    ''
  );


  useEffect(
    () => {

      resolveShop();

    },
    []
  );


  async function resolveShop() {

    try {

      setStatus(
        'loading'
      );


      setError(
        ''
      );


      /*
       * IMPORTANT:
       *
       * Do not manually obtain/store the Shopify token here.
       *
       * App Bridge intercepts same-origin fetch requests and
       * attaches a fresh Shopify ID token automatically.
       */
      const response =
        await fetch(
          '/api/auth/shopify/resolve-shop',
          {

            method:
              'GET',

            cache:
              'no-store',

            credentials:
              'include',

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
          `Shopify authentication returned HTTP ${response.status} instead of JSON`
        );

      }


      if (
        !response.ok ||
        !json?.ok
      ) {

        throw new Error(
          json?.error ||
          `Shopify authentication failed (${response.status})`
        );

      }


      setShop(
        json.shop
      );


      setStatus(
        'success'
      );


    } catch (
      loadError: any
    ) {

      console.error(
        'SHOPIFY_ENTRY_ERROR',
        loadError
      );


      setError(
        loadError?.message ||
        'Unable to authenticate Shopify'
      );


      setStatus(
        'error'
      );

    }

  }


  return (

    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-6">

      <section className="w-full max-w-[540px] rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">


        {/* ==================================================
            BRAND
        ================================================== */}

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-base font-black text-white">
            G
          </div>


          <div>

            <h1 className="text-lg font-black tracking-[-0.035em] text-slate-950">
              Growth OS
            </h1>

            <p className="text-xs text-slate-400">
              Shopify authentication
            </p>

          </div>

        </div>


        {/* ==================================================
            LOADING
        ================================================== */}

        {status ===
          'loading' && (

          <div className="py-14 text-center">

            <LoaderCircle
              size={34}
              className="mx-auto animate-spin text-violet-600"
            />

            <h2 className="mt-5 text-lg font-black text-slate-950">
              Verifying Shopify
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Confirming your Shopify Admin session and resolving this store.
            </p>

          </div>

        )}


        {/* ==================================================
            SUCCESS
        ================================================== */}

        {status ===
          'success' &&
          shop && (

          <div className="py-8">

            <div className="flex items-center gap-2 text-emerald-600">

              <CheckCircle2
                size={20}
              />

              <span className="text-xs font-black uppercase tracking-wide">
                Shopify verified
              </span>

            </div>


            <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">
              {shop.name}
            </h2>


            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">


              <InfoRow
                label="Shopify Shop ID"
                value={
                  shop.id
                }
              />


              <InfoRow
                label="Shop domain"
                value={
                  shop.domain
                }
              />


              <InfoRow
                label="Authentication"
                value="Shopify Admin"
                last
              />


            </div>


            <div className="mt-5 rounded-2xl bg-violet-50 p-4">

              <div className="flex gap-3">

                <ShieldCheck
                  size={18}
                  className="mt-0.5 shrink-0 text-violet-600"
                />

                <p className="text-xs leading-5 text-violet-900">
                  Copy the Shopify Shop ID shown above. We will add it to the Growth OS tenant configuration and permanently bind this installation to Brillare.
                </p>

              </div>

            </div>

          </div>

        )}


        {/* ==================================================
            ERROR
        ================================================== */}

        {status ===
          'error' && (

          <div className="py-10">

            <XCircle
              size={32}
              className="text-red-600"
            />


            <h2 className="mt-4 text-lg font-black text-slate-950">
              Shopify authentication failed
            </h2>


            <p className="mt-2 break-words text-sm leading-6 text-red-700">
              {error}
            </p>


            <button
              type="button"

              onClick={
                resolveShop
              }

              className="mt-6 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white"
            >
              Retry
            </button>

          </div>

        )}


      </section>

    </main>

  );

}


function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {

  return (

    <div
      className={
        last

          ? 'flex items-start justify-between gap-5 px-4 py-3'

          : 'flex items-start justify-between gap-5 border-b border-slate-100 px-4 py-3'
      }
    >

      <span className="shrink-0 text-xs font-semibold text-slate-400">
        {label}
      </span>


      <strong className="break-all text-right text-xs text-slate-800">
        {value}
      </strong>

    </div>

  );

}