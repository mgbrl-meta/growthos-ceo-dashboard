import {
  Check,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

import IntegrationSetupShell
  from './IntegrationSetupShell';

import ShopifySetupCompleteButton
  from './ShopifySetupCompleteButton';


// ============================================================
// PROPS
// ============================================================

type Props = {

  connectionId:
    string;

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
// Theme App Extension:
//
// extensions/
//   attribution-cart-bridge/
//     blocks/
//       cart-bridge.liquid
//
// Shopify app-embed block handle:
//
// cart-bridge
// ============================================================

const CART_BRIDGE_HANDLE =
  'cart-bridge';


// ============================================================
// SHOPIFY SETUP
//
// Generic Growth OS connector setup:
//
// integration_connection
//        ↓
// provider = shopify
//        ↓
// THIS COMPONENT
//
// Shopify-specific responsibility:
//
// ✓ OAuth completed
// ✓ Store identity verified
// ✓ Credential secured
// ✓ Growth OS connection registered
//
// Remaining merchant action:
//
// Attribution Cart App Embed
//        ↓
// Theme Editor
//        ↓
// Enable
//        ↓
// Save
//        ↓
// Confirm completion
//
// After confirmation:
//
// setup_status = ready
//        ↓
// dashboard
// ============================================================

export default function ShopifySetup({

  connectionId,

  shopDomain,

  shopName,

  clientId,

}: Props) {


  // ==========================================================
  // SHOPIFY APP EMBED ACTIVATION URL
  //
  // Opens:
  //
  // Shopify Admin
  //      ↓
  // current theme
  //      ↓
  // App embeds
  //      ↓
  // Attribution Cart
  //
  // Merchant must still:
  //
  // 1. Enable the embed
  // 2. Click Save
  //
  // Shopify does not allow us to silently activate it.
  // ==========================================================

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
          COMPLETED CONNECTION STEPS
      ==================================================== */}

      <div
        className="
          overflow-hidden

          rounded-lg

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
          REQUIRED SHOPIFY SETUP
      ==================================================== */}

      <div
        className="
          mt-3

          rounded-lg

          border
          border-violet-100

          bg-violet-50

          p-3
        "
      >


        {/* ==================================================
            INSTRUCTION
        ================================================== */}

        <div className="flex gap-3">

          <ShieldCheck
            size={21}
            className="
              mt-0.5
              shrink-0
              text-violet-600
            "
          />


          <div>

            <div
              className="
                text-[11px]
                font-semibold
                text-slate-950
              "
            >
              1 required setup step remaining
            </div>


            <p
              className="
                mt-2

                text-[10px]
                leading-5

                text-slate-600
              "
            >

              Enable the Attribution Cart app embed.

              Growth OS uses it to capture Shopify&apos;s
              native cart identity and connect storefront
              journeys with orders deterministically.

            </p>


            <p
              className="
                mt-3

                text-[10px]
                font-semibold
                leading-5

                text-slate-700
              "
            >

              Shopify Theme Editor will open.

              Enable
              <strong>
                {' '}Attribution Cart{' '}
              </strong>

              and then click
              <strong>
                {' '}Save
              </strong>.

            </p>

          </div>

        </div>


        {/* ==================================================
            STEP 1 — OPEN SHOPIFY THEME EDITOR
        ================================================== */}

        {activationUrl ? (

          <a

            href={
              activationUrl
            }

            target="_blank"

            rel="noopener noreferrer"

            className="
              mt-3

              flex
              w-full

              items-center
              justify-center
              gap-2

              rounded-xl

              bg-slate-950

              px-3
              py-2

              text-[11px]
              font-semibold
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
              mt-3

              rounded-xl

              bg-red-50

              px-3
              py-2

              text-[10px]
              font-semibold
              text-red-700
            "
          >
            Shopify activation link could not be generated.
            Check the Shopify Client ID configuration.
          </div>

        )}


        {/* ==================================================
            STEP 2 — CONFIRM SETUP
        ================================================== */}

        <div
          className="
            mt-3

            border-t
            border-violet-100

            pt-5
          "
        >

          <div
            className="
              text-[10px]
              font-semibold
              text-slate-800
            "
          >
            Already enabled and saved?
          </div>


          <p
            className="
              mt-1

              text-[10px]
              leading-5

              text-slate-500
            "
          >

            After saving the Attribution Cart embed in Shopify,
            return here and confirm the setup.

          </p>


          <ShopifySetupCompleteButton

            connectionId={
              connectionId
            }

          />

        </div>


      </div>


      {/* ====================================================
          CONNECTED STORE
      ==================================================== */}

      <div
        className="
          mt-3

          text-center

          text-[11px]
          text-slate-400
        "
      >
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

        px-3
        py-2

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


      <span
        className="
          text-[10px]
          font-semibold
          text-slate-700
        "
      >
        {label}
      </span>

    </div>

  );

}
