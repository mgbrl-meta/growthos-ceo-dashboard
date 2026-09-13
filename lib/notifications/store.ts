import 'server-only';

import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';

const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET
  ||
  'growthos_control';

const LOCATION =
  process.env.GCP_BQ_LOCATION
  ||
  'asia-south1';


// ============================================================
// TYPES
// ============================================================

export type GrowthOSNotificationPreferences = {

  integrationHealth:
    boolean;

  billing:
    boolean;

  security:
    boolean;

  accessChanges:
    boolean;

  dataQuality:
    boolean;

  usageThresholds:
    boolean;

  weeklyDigest:
    boolean;

};


export const DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES:
  GrowthOSNotificationPreferences = {

  integrationHealth:
    true,

  billing:
    true,

  security:
    true,

  accessChanges:
    true,

  dataQuality:
    true,

  usageThresholds:
    true,

  weeklyDigest:
    false,

};


// ============================================================
// HELPERS
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS notification store requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }

  return PROJECT_ID;

}


function normalizePreferences(
  input:
    Partial<
      GrowthOSNotificationPreferences
    >
):

  GrowthOSNotificationPreferences {

  return {

    integrationHealth:
      input.integrationHealth
      ??
      DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES.integrationHealth,

    billing:
      input.billing
      ??
      DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES.billing,

    security:
      input.security
      ??
      DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES.security,

    accessChanges:
      input.accessChanges
      ??
      DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES.accessChanges,

    dataQuality:
      input.dataQuality
      ??
      DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES.dataQuality,

    usageThresholds:
      input.usageThresholds
      ??
      DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES.usageThresholds,

    weeklyDigest:
      input.weeklyDigest
      ??
      DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES.weeklyDigest,

  };

}


// ============================================================
// BOOTSTRAP
// ============================================================

let notificationStoreReady =
  false;

let notificationStorePromise:
  Promise<void> | null =
    null;


export async function ensureGrowthOSNotificationStore() {

  if (notificationStoreReady) {

    return;

  }


  if (notificationStorePromise) {

    return notificationStorePromise;

  }


  notificationStorePromise =
    (async () => {

      const projectId =
        requireProjectId();


      await bigquery.query({

        location:
          LOCATION,

        query: `

          CREATE TABLE IF NOT EXISTS
            \`${projectId}.${DATASET_ID}.notification_preferences\`
          (

            preference_id STRING NOT NULL,
            user_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            integration_health BOOL NOT NULL,
            billing BOOL NOT NULL,
            security BOOL NOT NULL,
            access_changes BOOL NOT NULL,
            data_quality BOOL NOT NULL,
            usage_thresholds BOOL NOT NULL,
            weekly_digest BOOL NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL

          )

          CLUSTER BY
            workspace_id,
            brand_id,
            user_id

        `,

      });


      notificationStoreReady =
        true;

    })();


  try {

    await notificationStorePromise;

  } catch (
    error
  ) {

    notificationStoreReady =
      false;

    notificationStorePromise =
      null;

    throw error;

  }

}


// ============================================================
// READ
// ============================================================

export async function getGrowthOSNotificationPreferences(
  input: {

    userId:
      string;

    workspaceId:
      string;

    brandId:
      string;

  }
):

  Promise<
    GrowthOSNotificationPreferences
  > {

  await ensureGrowthOSNotificationStore();


  const projectId =
    requireProjectId();


  const [
    rows,
  ] =
    await bigquery.query({

      location:
        LOCATION,

      query: `

        SELECT

          integration_health,
          billing,
          security,
          access_changes,
          data_quality,
          usage_thresholds,
          weekly_digest

        FROM
          \`${projectId}.${DATASET_ID}.notification_preferences\`

        WHERE
          user_id = @user_id
          AND workspace_id = @workspace_id
          AND brand_id = @brand_id

        ORDER BY
          updated_at DESC

        LIMIT 1

      `,

      params: {
        user_id:
          input.userId,
        workspace_id:
          input.workspaceId,
        brand_id:
          input.brandId,
      },

      types: {
        user_id:
          'STRING',
        workspace_id:
          'STRING',
        brand_id:
          'STRING',
      },

    });


  const row:
    any =
      rows?.[0];


  if (!row) {

    return {
      ...DEFAULT_GROWTHOS_NOTIFICATION_PREFERENCES,
    };

  }


  return normalizePreferences({

    integrationHealth:
      Boolean(
        row.integration_health
      ),

    billing:
      Boolean(
        row.billing
      ),

    security:
      Boolean(
        row.security
      ),

    accessChanges:
      Boolean(
        row.access_changes
      ),

    dataQuality:
      Boolean(
        row.data_quality
      ),

    usageThresholds:
      Boolean(
        row.usage_thresholds
      ),

    weeklyDigest:
      Boolean(
        row.weekly_digest
      ),

  });

}


// ============================================================
// WRITE
// ============================================================

export async function upsertGrowthOSNotificationPreferences(
  input: {

    userId:
      string;

    workspaceId:
      string;

    brandId:
      string;

    preferences:
      Partial<
        GrowthOSNotificationPreferences
      >;

  }
) {

  await ensureGrowthOSNotificationStore();


  const projectId =
    requireProjectId();


  const preferences =
    normalizePreferences(
      input.preferences
    );


  const preferenceId =
    `notifpref_${crypto.createHash('sha256')
      .update(
        [
          input.userId,
          input.workspaceId,
          input.brandId,
        ].join('|')
      )
      .digest('hex')
      .slice(0, 24)}`;


  await bigquery.query({

    location:
      LOCATION,

    query: `

      MERGE
        \`${projectId}.${DATASET_ID}.notification_preferences\`
        AS target

      USING
      (

        SELECT

          @preference_id AS preference_id,
          @user_id AS user_id,
          @workspace_id AS workspace_id,
          @brand_id AS brand_id,
          @integration_health AS integration_health,
          @billing AS billing,
          @security AS security,
          @access_changes AS access_changes,
          @data_quality AS data_quality,
          @usage_thresholds AS usage_thresholds,
          @weekly_digest AS weekly_digest

      )
      AS source

      ON
        target.user_id = source.user_id
        AND target.workspace_id = source.workspace_id
        AND target.brand_id = source.brand_id

      WHEN MATCHED THEN

        UPDATE SET

          preference_id = source.preference_id,
          integration_health = source.integration_health,
          billing = source.billing,
          security = source.security,
          access_changes = source.access_changes,
          data_quality = source.data_quality,
          usage_thresholds = source.usage_thresholds,
          weekly_digest = source.weekly_digest,
          updated_at = CURRENT_TIMESTAMP()

      WHEN NOT MATCHED THEN

        INSERT
        (
          preference_id,
          user_id,
          workspace_id,
          brand_id,
          integration_health,
          billing,
          security,
          access_changes,
          data_quality,
          usage_thresholds,
          weekly_digest,
          created_at,
          updated_at
        )

        VALUES
        (
          source.preference_id,
          source.user_id,
          source.workspace_id,
          source.brand_id,
          source.integration_health,
          source.billing,
          source.security,
          source.access_changes,
          source.data_quality,
          source.usage_thresholds,
          source.weekly_digest,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )

    `,

    params: {

      preference_id:
        preferenceId,

      user_id:
        input.userId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      integration_health:
        preferences.integrationHealth,

      billing:
        preferences.billing,

      security:
        preferences.security,

      access_changes:
        preferences.accessChanges,

      data_quality:
        preferences.dataQuality,

      usage_thresholds:
        preferences.usageThresholds,

      weekly_digest:
        preferences.weeklyDigest,

    },

    types: {

      preference_id:
        'STRING',

      user_id:
        'STRING',

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      integration_health:
        'BOOL',

      billing:
        'BOOL',

      security:
        'BOOL',

      access_changes:
        'BOOL',

      data_quality:
        'BOOL',

      usage_thresholds:
        'BOOL',

      weekly_digest:
        'BOOL',

    },

  });


  return preferences;

}
