import {
  bigquery,
} from '@/lib/bigquery';

import type {
  IntegrationProvider,
} from '../provider';


// ============================================================
// BIGQUERY PROVIDER
//
// BigQuery is infrastructure rather than a normal marketing
// data source.
//
// Current connection mode = native.
// ============================================================

export const bigQueryProvider:
  IntegrationProvider = {

  id:
    'bigquery',

  name:
    'Google BigQuery',

  connectionModes: [
    'native',
    'service_account',
  ],

  entities: [
    'warehouse',
  ],


  // ==========================================================
  // HEALTH
  // ==========================================================

  async testConnection() {

    try {

      const [
        rows,
      ] =
        await bigquery.query({

          query: `

            SELECT
              CURRENT_TIMESTAMP()
              AS checked_at

          `,

        });


      return {

        provider:
          'bigquery',

        status:
          'healthy' as const,

        message:
          'BigQuery connection healthy',

        details: {

          checkedAt:
            rows?.[0]
              ?.checked_at
            ||
            null,

        },

      };


    } catch (
      error: any
    ) {

      return {

        provider:
          'bigquery',

        status:
          'failed' as const,

        message:
          error?.message
          ||
          'BigQuery connection failed',

      };

    }

  },


  // ==========================================================
  // ACCOUNT DISCOVERY
  // ==========================================================

  async discoverAccounts() {

    return [];

  },


  // ==========================================================
  // BIGQUERY DOES NOT INGEST ITSELF
  // ==========================================================

  async sync() {

    return {

      status:
        'success' as const,

      recordsFetched:
        0,

      recordsLoaded:
        0,

      recordsRejected:
        0,

    };

  },


  async backfill() {

    return {

      status:
        'success' as const,

      recordsFetched:
        0,

      recordsLoaded:
        0,

      recordsRejected:
        0,

    };

  },

};