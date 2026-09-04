import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';


// ============================================================
// CONFIG
// ============================================================

const SHOPIFY_CLIENT_ID =
  process.env.SHOPIFY_CLIENT_ID
  ||
  '';

const CART_BRIDGE_HANDLE =
  'cart-bridge';


// ============================================================
// TYPES
// ============================================================

type Props = {

  searchParams:
    Promise<{
      shop?: string;
    }>;

};


// ============================================================
// VALIDATE SHOP DOMAIN
// ============================================================

function normalizeShop(
  value: string
) {

  const shop =
    String(
      value
      ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/
      .test(
        shop
      )
  ) {

    return '';

  }


  return shop;

}


// ============================================================
// INSTALLED PAGE
// ============================================================

export default async function ShopifyInstalledPage({
  searchParams,
}: Props) {

  const params =
    await searchParams;


  const shop =
    normalizeShop(
      params.shop
      ||
      ''
    );


  const activationUrl =
    shop &&
    SHOPIFY_CLIENT_ID

      ? (
          `https://${shop}` +
          `/admin/themes/current/editor` +
          `?context=apps` +
          `&activateAppId=${encodeURIComponent(
            SHOPIFY_CLIENT_ID
          )}/${encodeURIComponent(
            CART_BRIDGE_HANDLE
          )}`
        )

      : '';


  return (

    <main
      className="
        flex
        min-h-screen
        items-center
        justify-center

        bg-[#f5f6f8]

        px-5
        py-10
      "
    >

      <section
        className="
          w-full
          max-w-[620px]

          rounded-[28px]

          border
          border-slate-200

          bg-white

          p-8

          shadow-sm
        "
      >


        {/* ==================================================
            BRAND
        ================================================== */}

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center

              rounded-xl

              bg-gradient-to-br
              from-violet-500
              to-blue-500

              text-base
              font-black
              text-white
            "
          >
            G
          </div>


          <div>

            <div className="text-lg font-black tracking-[-0.035em] text-slate-950">
              Growth OS
            </div>

            <div className="text-xs text-slate-400">
              Shopify Connector
            </div>

          </div>

        </div>


        {/* ==================================================
            SUCCESS
        ================================================== */}

        <div className="mt-10">

          <div className="flex items-center gap-2 text-emerald-600">

            <CheckCircle2
              size={22}
            />

            <span className="text-xs font-black uppercase tracking-[0.12em]">
              Installation successful
            </span>

          </div>


          <h1
            className="
              mt-4

              text-[30px]
              font-black
              tracking-[-0.05em]

              text-slate-950
            "
          >
            Growth OS is connected
          </h1>


          <p
            className="
              mt-3

              text-sm
              leading-6

              text-slate-500
            "
          >
            Your Shopify store has been securely connected to
            Growth OS.
          </p>

        </div>


        {/* ==================================================
            FINAL REQUIRED STEP
        ================================================== */}

        <div
          className="
            mt-8

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
                One final setup step
              </div>


              <p className="mt-2 text-xs leading-5 text-slate-600">
                Enable the Attribution Cart app embed. This
                allows Growth OS to capture Shopify cart identity
                required for accurate customer-journey
                attribution.
              </p>


              <p className="mt-3 text-xs font-semibold text-slate-700">
                Shopify Theme Editor will open with Attribution
                Cart selected. Turn it on and click Save.
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
              Unable to generate the Shopify Theme Editor link.
            </div>

          )}

        </div>


        {/* ==================================================
            OPEN GROWTH OS
        ================================================== */}

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


        {/* ==================================================
            SHOP
        ================================================== */}

        {shop && (

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Connected store: {shop}
          </div>

        )}

      </section>

    </main>

  );

}