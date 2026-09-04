import {
  redirect,
} from 'next/navigation';

import {
  readGrowthOsSessionCookie,
} from '@/lib/auth/session';

import {
  getIntegrationAccountByProviderAccountId,
  getIntegrationConnectionById,
} from '@/lib/integrations/store';

import ShopifySetup from '@/app/components/integrations/setup/ShopifySetup';

import CustomWebSetup from '@/app/components/integrations/setup/CustomWebSetup';


// ============================================================
// TYPES
// ============================================================

type Props = {

  searchParams:
    Promise<{

      connectionId?:
        string;

    }>;

};


// ============================================================
// SAFE METADATA
// ============================================================

function normalizeMetadata(
  value: unknown
):

  Record<
    string,
    any
  > {

  if (
    value
    &&
    typeof value ===
      'object'
    &&
    !Array.isArray(
      value
    )
  ) {

    return value as
      Record<
        string,
        any
      >;

  }


  if (
    typeof value ===
    'string'
  ) {

    try {

      const parsed =
        JSON.parse(
          value
        );


      if (
        parsed
        &&
        typeof parsed ===
          'object'
      ) {

        return parsed;

      }

    } catch {

      // Ignore invalid compatibility metadata.

    }

  }


  return {};

}


// ============================================================
// GENERIC INTEGRATION SETUP ROUTER
//
// Browser sends ONLY:
//
// connectionId
//
// Server resolves:
//
// connection
//      ↓
// provider
//      ↓
// provider-specific setup UI
//
// SECURITY:
//
// Workspace + brand MUST match the authenticated Growth OS
// session before any provider setup is rendered.
// ============================================================

export default async function IntegrationSetupPage({

  searchParams,

}: Props) {

  const params =
    await searchParams;


  const connectionId =
    String(
      params.connectionId
      ||
      ''
    ).trim();


  // ==========================================================
  // SESSION
  // ==========================================================

  const session =
    await readGrowthOsSessionCookie();


  if (!session) {

    redirect(
      '/login'
    );

  }


  // ==========================================================
  // CONNECTION ID
  // ==========================================================

  if (!connectionId) {

    return (

      <SetupError
        title="Connection not specified"
        message="Growth OS could not determine which integration should be configured."
      />

    );

  }


  // ==========================================================
  // LOAD CONNECTION
  // ==========================================================

  const connection =
    await getIntegrationConnectionById(
      connectionId
    );


  if (!connection) {

    return (

      <SetupError
        title="Connection not found"
        message="This Growth OS integration connection does not exist."
      />

    );

  }


  // ==========================================================
  // TENANT AUTHORIZATION
  //
  // Critical:
  //
  // A user must never be able to change connectionId in the
  // browser and view another brand's connector configuration.
  // ==========================================================

  if (
    connection.workspace_id !==
      session.workspaceId
    ||
    connection.brand_id !==
      session.brandId
  ) {

    return (

      <SetupError
        title="Access denied"
        message="This integration does not belong to your active Growth OS brand."
      />

    );

  }


  // ==========================================================
  // PROVIDER ACCOUNT
  // ==========================================================

  const account =
    connection.provider_account_id

      ? await getIntegrationAccountByProviderAccountId(

          connection.provider,

          connection.provider_account_id

        )

      : null;


  // ==========================================================
  // PROVIDER SELECTOR
  // ==========================================================

  switch (
    connection.provider
  ) {


    // ========================================================
    // SHOPIFY
    // ========================================================

    case 'shopify': {

      const metadata =
        normalizeMetadata(
          account?.metadata
        );


      const shopDomain =
        String(
          metadata.shop_domain
          ||
          metadata.shopDomain
          ||
          ''
        )
          .trim()
          .toLowerCase();


      const clientId =
        String(
          process.env.SHOPIFY_CLIENT_ID
          ||
          ''
        ).trim();


      if (!shopDomain) {

        return (

          <SetupError
            title="Shopify store identity missing"
            message="Growth OS connected the Shopify account but could not resolve the stored myshopify.com domain."
          />

        );

      }


      return (

        <ShopifySetup

           connectionId={
    connection.connection_id
  }

  shopDomain={
    shopDomain
  }

  shopName={
    connection.provider_account_name
    ||
    account?.provider_account_name
    ||
    null
  }

  clientId={
    clientId
  }
        />

      );

    }


    // ========================================================
    // CUSTOM WEBSITE
    // ========================================================

    case 'custom_web':

      return (

        <CustomWebSetup

          accountName={
            connection.provider_account_name
            ||
            null
          }

        />

      );


    // ========================================================
    // FUTURE PROVIDERS
    // ========================================================

    default:

      return (

        <SetupError

          title="Setup experience not available"

          message={
            `Growth OS connected ${connection.provider}, but a setup adapter has not been implemented for this provider yet.`
          }

        />

      );

  }

}


// ============================================================
// ERROR UI
// ============================================================

function SetupError({

  title,

  message,

}: {

  title:
    string;

  message:
    string;

}) {

  return (

    <main
      className="
        flex
        min-h-screen
        items-center
        justify-center

        bg-[#f5f6f8]

        px-5
      "
    >

      <section
        className="
          w-full
          max-w-[520px]

          rounded-3xl

          border
          border-slate-200

          bg-white

          p-8

          shadow-sm
        "
      >

        <div className="text-lg font-black text-slate-950">
          {title}
        </div>


        <p className="mt-3 text-sm leading-6 text-slate-500">
          {message}
        </p>


        <a
          href="/"

          className="
            mt-6

            inline-flex

            rounded-xl

            bg-slate-950

            px-5
            py-3

            text-sm
            font-black
            text-white
          "
        >
          Open Growth OS
        </a>

      </section>

    </main>

  );

}