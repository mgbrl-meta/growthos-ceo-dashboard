import {
  resolveTenantContext,
} from '@/lib/tenancy/context';

import {
  upsertIntegrationConnection,
} from '@/lib/integrations/store';


// ============================================================
// DEVELOPMENT CONNECTION BOOTSTRAP
//
// Current purpose:
//
// Register existing Brillare pipelines inside the generic
// Growth OS control plane.
//
// IMPORTANT:
//
// This does NOT mean the architecture is Brillare-specific.
//
// Later:
// legacy connection
//      ↓
// OAuth connection
//
// Everything downstream remains unchanged.
// ============================================================

export async function bootstrapDevelopmentConnections() {

  const tenant =
    await resolveTenantContext();


  // ==========================================================
  // SHOPIFY
  // ==========================================================

  const shopifyConnectionId =
  await upsertIntegrationConnection({

    workspaceId:
      tenant.workspaceId,

    brandId:
      tenant.brandId,

    provider:
      'shopify',

    connectionMode:
      'legacy',

    ingestionAdapter:
      'existing_bigquery_pipeline',

    status:
      'connected',

    providerAccountName:
      `${tenant.brandName} Shopify`,

    error:
      null,

  });


  // ==========================================================
  // META ADS
  // ==========================================================

  const metaConnectionId =
  await upsertIntegrationConnection({

    workspaceId:
      tenant.workspaceId,

    brandId:
      tenant.brandId,

    provider:
      'meta_ads',

    connectionMode:
      'legacy',

    ingestionAdapter:
      'google_sheets',

    status:
      'connected',

    providerAccountName:
      `${tenant.brandName} Meta Ads`,

    error:
      null,

  });

  // ==========================================================
  // GOOGLE ADS
  // ==========================================================

  const googleConnectionId =
  await upsertIntegrationConnection({

    workspaceId:
      tenant.workspaceId,

    brandId:
      tenant.brandId,

    provider:
      'google_ads',

    connectionMode:
      'legacy',

    ingestionAdapter:
      'existing_bigquery_pipeline',

    status:
      'connected',

    providerAccountName:
      `${tenant.brandName} Google Ads`,

    error:
      null,

  });

  // ==========================================================
  // BIGQUERY
  // ==========================================================

  const bigQueryConnectionId =
  await upsertIntegrationConnection({

    workspaceId:
      tenant.workspaceId,

    brandId:
      tenant.brandId,

    provider:
      'bigquery',

    connectionMode:
      'native',

    ingestionAdapter:
      'warehouse',

    status:
      'connected',

    providerAccountId:
      process.env.GCP_PROJECT_ID
      ||
      process.env.BQ_PROJECT_ID
      ||
      null,

    providerAccountName:
      'Growth OS Warehouse',

    error:
      null,

  });


  return {

    workspaceId:
      tenant.workspaceId,

    brandId:
      tenant.brandId,

    connections: [

      {
        provider:
          'shopify',

        connectionId:
          shopifyConnectionId,

        mode:
          'legacy',
      },

      {
        provider:
          'meta_ads',

        connectionId:
          metaConnectionId,

        mode:
          'legacy',
      },

      {
        provider:
          'google_ads',

        connectionId:
          googleConnectionId,

        mode:
          'legacy',
      },

      {
        provider:
          'bigquery',

        connectionId:
          bigQueryConnectionId,

        mode:
          'native',
      },

    ],

  };

}