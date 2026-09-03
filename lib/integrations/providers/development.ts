import type {
  IntegrationProvider,
  ProviderHealth,
  SyncContext,
  SyncResult,
} from '../provider';


// ============================================================
// BASE DEVELOPMENT PROVIDER
//
// Temporary adapter around existing Brillare infrastructure.
//
// Later:
// legacy -> OAuth/native provider
//
// Growth OS consumers do not change.
// ============================================================

function createDevelopmentProvider(
  input: {

    id: string;

    name: string;

    entities: string[];

  }
): IntegrationProvider {

  return {

    id:
      input.id,

    name:
      input.name,

    connectionModes: [
      'legacy',
    ],

    entities:
      input.entities,


    // ========================================================
    // HEALTH
    //
    // We will connect this to actual existing BigQuery
    // freshness checks next.
    // ========================================================

    async testConnection(
      workspaceId,
      brandId,
      connectionId
    ): Promise<ProviderHealth> {

      return {

        provider:
          input.id,

        status:
          'healthy',

        message:
          'Existing development pipeline registered',

        details: {

          workspaceId,

          brandId,

          connectionId,

          connectionMode:
            'legacy',

        },

      };

    },


    // ========================================================
    // ACCOUNT DISCOVERY
    //
    // Existing Brillare setup does not require discovery yet.
    // ========================================================

    async discoverAccounts() {

      return [];

    },


    // ========================================================
    // SYNC
    //
    // Existing Cloud Run / Scheduler jobs currently perform
    // ingestion. Orchestration will be connected later.
    // ========================================================

    async sync(
      context: SyncContext
    ): Promise<SyncResult> {

      return {

        status:
          'success',

        recordsFetched:
          0,

        recordsLoaded:
          0,

        recordsRejected:
          0,

        cursorBefore:
          context.cursor
          ||
          null,

        cursorAfter:
          context.cursor
          ||
          null,

        metadata: {

          delegatedTo:
            'existing-development-pipeline',

        },

      };

    },


    async backfill(
      context: SyncContext
    ): Promise<SyncResult> {

      return {

        status:
          'success',

        recordsFetched:
          0,

        recordsLoaded:
          0,

        recordsRejected:
          0,

        metadata: {

          delegatedTo:
            'existing-development-pipeline',

          startDate:
            context.startDate
            ||
            null,

          endDate:
            context.endDate
            ||
            null,

        },

      };

    },

  };

}


// ============================================================
// META
// ============================================================

export const metaDevelopmentProvider =
  createDevelopmentProvider({

    id:
      'meta_ads',

    name:
      'Meta Ads',

    entities: [

      'campaigns',

      'adsets',

      'ads',

      'creatives',

      'insights',

    ],

  });


// ============================================================
// GOOGLE ADS
// ============================================================

export const googleDevelopmentProvider =
  createDevelopmentProvider({

    id:
      'google_ads',

    name:
      'Google Ads',

    entities: [

      'campaigns',

      'ad_groups',

      'keywords',

      'search_terms',

      'shopping_products',

      'conversions',

    ],

  });


// ============================================================
// SHOPIFY
// ============================================================

export const shopifyDevelopmentProvider =
  createDevelopmentProvider({

    id:
      'shopify',

    name:
      'Shopify',

    entities: [

      'orders',

      'customers',

      'products',

      'transactions',

      'events',

    ],

  });