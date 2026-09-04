'use client';

import {
  useState,
} from 'react';

import {
  CheckCircle2,
  LoaderCircle,
} from 'lucide-react';


// ============================================================
// PROPS
// ============================================================

type Props = {

  connectionId:
    string;

};


// ============================================================
// SHOPIFY SETUP COMPLETE
// ============================================================

export default function ShopifySetupCompleteButton({

  connectionId,

}: Props) {

  const [
    loading,
    setLoading,
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


  async function completeSetup() {

    try {

      setLoading(
        true
      );


      setError(
        ''
      );


      const response =
        await fetch(
          '/api/integrations/setup/complete',
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
              JSON.stringify({

                connectionId,

              }),

          }
        );


      const data =
        await response.json();


      if (
        !response.ok
        ||
        !data?.ok
      ) {

        throw new Error(
          data?.error
          ||
          'Unable to complete Shopify setup'
        );

      }


      // ======================================================
      // SETUP IS NOW READY
      // ======================================================

      window.location.href =
        '/';


    } catch (
      completeError: any
    ) {

      setError(
        completeError?.message
        ||
        'Unable to complete Shopify setup'
      );


    } finally {

      setLoading(
        false
      );

    }

  }


  return (

    <div className="mt-4">

      <button

        type="button"

        onClick={
          completeSetup
        }

        disabled={
          loading
        }

        className="
          flex
          w-full
          items-center
          justify-center
          gap-2

          rounded-xl

          bg-emerald-600

          px-5
          py-3

          text-sm
          font-black
          text-white

          transition

          hover:bg-emerald-700

          disabled:cursor-not-allowed
          disabled:opacity-60
        "
      >

        {loading ? (

          <>
            <LoaderCircle
              size={16}
              className="animate-spin"
            />

            Completing setup...
          </>

        ) : (

          <>
            <CheckCircle2
              size={16}
            />

            I&apos;ve Enabled &amp; Saved It
          </>

        )}

      </button>


      {error && (

        <div
          className="
            mt-3

            rounded-xl

            bg-red-50

            px-4
            py-3

            text-xs
            font-semibold
            text-red-700
          "
        >
          {error}
        </div>

      )}

    </div>

  );

}