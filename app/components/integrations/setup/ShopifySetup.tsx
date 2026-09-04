import {
  Check,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

import IntegrationSetupShell from './IntegrationSetupShell';


// ============================================================
// PROPS
// ============================================================

type Props = {

  shopDomain:
    string;

  shopName?:
    string | null;

  clientId:
    string;

};


// ============================================================
// CONFIG
//
// Filename of:
//
// extensions/attribution-cart-bridge/blocks/cart-bridge.liquid
//
// becomes the app-embed block handle.
// ============================================================

const CART_BRIDGE_HANDLE =
  'cart-bridge';


// ============================================================
// SHOPIFY SETUP
// ============================================================

export default function ShopifySetup({

  shopDomain,

  shopName,

  clientId,

}: Props) {


  const activationUrl =
    (
      shopDomain
      &&
      clientId
    )
      ? (
          `https://${shopDomain}` +
          `/admin/themes/current/editor` +
          `?context=apps` +
          `&activateAppId=${encodeURIComponent(
            clientId
          )}/${encodeURIComponent(
            CART_BRIDGE_HANDLE
          )}`
        )
      : '';


  return (

    <IntegrationSetupShell

      providerLabel="Shopify"

      accountName={
        shopName
        ||
        shopDomain
      }

    >


      {/* ====================================================
          COMPLETED
      ==================================================== */}

      <div
        className="
          overflow-hidden

          rounded-2xl

          border
          border-slate-200
        "
      >

        <SetupRow
          label="Shopify authorization"
          completed
        />

        <SetupRow
          label="Store identity verified"
          completed
        />

        <SetupRow
          label="Growth OS connection registered"
          completed
        />

        <SetupRow
          label="Credential secured"
          completed
          last
        />

      </div>


      {/* ====================================================
          REQUIRED APP EMBED
      ==================================================== */}

      <div
        className="
          mt-6

          rounded-2xl

          border
          border-violet-100

          bg-violet-50

          p-5
        "
      >

        <div className="flex gap-3">

          <ShieldCheck
            size={21}
            className="mt-0.5 shrink-0 text-violet-600"
          />


          <div>

            <div className="text-sm font-black text-slate-950">
              1 required setup step remaining
            </div>


            <p className="mt-2 text-xs leading-5 text-slate-600">

              Enable the Attribution Cart app embed. Growth OS
              uses it to capture Shopify&apos;s native cart token
              and connect storefront journeys with orders
              deterministically.

            </p>


            <p className="mt-3 text-xs font-semibold text-slate-700">

              Shopify Theme Editor will open. Enable
              <strong> Attribution Cart </strong>
              and click
              <strong> Save</strong>.

            </p>

          </div>

        </div>


        {activationUrl ? (

          <a

            href={
              activationUrl
            }

            target="_blank"

            rel="noopener noreferrer"

            className="
              mt-5

              flex
              w-full
              items-center
              justify-center
              gap-2

              rounded-xl

              bg-slate-950

              px-5
              py-3

              text-sm
              font-black
              text-white

              transition

              hover:bg-slate-800
            "
          >

            Activate Attribution Cart

            <ExternalLink
              size={15}
            />

          </a>

        ) : (

          <div
            className="
              mt-5

              rounded-xl

              bg-red-50

              px-4
              py-3

              text-xs
              font-semibold
              text-red-700
            "
          >
            Shopify activation link could not be generated.
          </div>

        )}

      </div>


      {/* ====================================================
          DASHBOARD
      ==================================================== */}

      <a

        href="/"

        className="
          mt-4

          flex
          w-full
          items-center
          justify-center

          rounded-xl

          border
          border-slate-200

          px-5
          py-3

          text-sm
          font-black
          text-slate-800

          transition

          hover:bg-slate-50
        "
      >
        Open Growth OS
      </a>


      <div className="mt-5 text-center text-[11px] text-slate-400">
        Connected store: {shopDomain}
      </div>


    </IntegrationSetupShell>

  );

}


// ============================================================
// SETUP ROW
// ============================================================

function SetupRow({

  label,

  completed,

  last = false,

}: {

  label:
    string;

  completed:
    boolean;

  last?:
    boolean;

}) {

  return (

    <div
      className={`
        flex
        items-center
        gap-3

        px-4
        py-3

        ${
          last
            ? ''
            : 'border-b border-slate-100'
        }
      `}
    >

      <div
        className="
          flex
          h-6
          w-6
          shrink-0
          items-center
          justify-center

          rounded-full

          bg-emerald-50

          text-emerald-600
        "
      >

        {completed && (

          <Check
            size={14}
            strokeWidth={3}
          />

        )}

      </div>


      <span className="text-xs font-semibold text-slate-700">
        {label}
      </span>

    </div>

  );

}