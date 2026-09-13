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

export type GrowthOSAccountRequestType =
  | 'data_export'
  | 'workspace_deletion';

export type GrowthOSAccountRequestStatus =
  | 'requested'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type GrowthOSAccountRequest = {
  requestId: string;
  workspaceId: string;
  brandId: string;
  requestType: GrowthOSAccountRequestType;
  status: GrowthOSAccountRequestStatus;
  requestedBy: string;
  requestedByEmail: string | null;
  reason: string | null;
  metadata: unknown;
  requestedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
};


// ============================================================
// HELPERS
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS account store requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }

  return PROJECT_ID;

}


function parseJson(
  value:
    unknown
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return null;

  }


  if (
    typeof value ===
      'object'
  ) {

    return value;

  }


  try {

    return JSON.parse(
      String(value)
    );

  } catch {

    return value;

  }

}


// ============================================================
// BOOTSTRAP
// ============================================================

let accountStoreReady =
  false;

let accountStorePromise:
  Promise<void> | null =
    null;


export async function ensureGrowthOSAccountStore() {

  if (accountStoreReady) {

    return;

  }


  if (accountStorePromise) {

    return accountStorePromise;

  }


  accountStorePromise =
    (async () => {

      const projectId =
        requireProjectId();


      await bigquery.query({

        location:
          LOCATION,

        query: `

          CREATE TABLE IF NOT EXISTS
            \`${projectId}.${DATASET_ID}.workspace_account_requests\`
          (

            request_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            request_type STRING NOT NULL,
            status STRING NOT NULL,
            requested_by STRING NOT NULL,
            requested_by_email STRING,
            reason STRING,
            metadata JSON,
            requested_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            completed_at TIMESTAMP

          )

          PARTITION BY
            DATE(requested_at)

          CLUSTER BY
            workspace_id,
            brand_id,
            request_type,
            status

        `,

      });


      accountStoreReady =
        true;

    })();


  try {

    await accountStorePromise;

  } catch (
    error
  ) {

    accountStoreReady =
      false;

    accountStorePromise =
      null;

    throw error;

  }

}


// ============================================================
// LIST REQUESTS
// ============================================================

export async function listGrowthOSAccountRequests(
  workspaceId:
    string,
  brandId:
    string
):

  Promise<
    GrowthOSAccountRequest[]
  > {

  await ensureGrowthOSAccountStore();


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

          request_id,
          workspace_id,
          brand_id,
          request_type,
          status,
          requested_by,
          requested_by_email,
          reason,
          metadata,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            requested_at
          )
            AS requested_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            updated_at
          )
            AS updated_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            completed_at
          )
            AS completed_at

        FROM
          \`${projectId}.${DATASET_ID}.workspace_account_requests\`

        WHERE
          workspace_id = @workspace_id
          AND brand_id = @brand_id

        ORDER BY
          requested_at DESC

        LIMIT
          50

      `,

      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },

      types: {
        workspace_id:
          'STRING',
        brand_id:
          'STRING',
      },

    });


  return (
    rows
    ||
    []
  ).map(
    (
      row:
        any
    ) => ({

      requestId:
        String(
          row.request_id
        ),

      workspaceId:
        String(
          row.workspace_id
        ),

      brandId:
        String(
          row.brand_id
        ),

      requestType:
        String(
          row.request_type
        ) as GrowthOSAccountRequestType,

      status:
        String(
          row.status
        ) as GrowthOSAccountRequestStatus,

      requestedBy:
        String(
          row.requested_by
        ),

      requestedByEmail:
        row.requested_by_email
        ??
        null,

      reason:
        row.reason
        ??
        null,

      metadata:
        parseJson(
          row.metadata
        ),

      requestedAt:
        row.requested_at
        ??
        null,

      updatedAt:
        row.updated_at
        ??
        null,

      completedAt:
        row.completed_at
        ??
        null,

    })
  );

}


// ============================================================
// CREATE REQUEST
//
// Duplicate open requests are collapsed so repeated button
// clicks cannot create an unbounded queue.
// ============================================================

export async function createGrowthOSAccountRequest(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    requestType:
      GrowthOSAccountRequestType;

    requestedBy:
      string;

    requestedByEmail?:
      string | null;

    reason?:
      string | null;

    metadata?:
      unknown;

  }
) {

  await ensureGrowthOSAccountStore();


  const projectId =
    requireProjectId();


  const requestId =
    `acctreq_${crypto.randomBytes(16).toString('hex')}`;


  const metadataJson =
    JSON.stringify(
      input.metadata
      ??
      {}
    );


  const [
    rows,
  ] =
    await bigquery.query({

      location:
        LOCATION,

      query: `

        DECLARE existing_request_id STRING;

        SET existing_request_id = (

          SELECT
            request_id

          FROM
            \`${projectId}.${DATASET_ID}.workspace_account_requests\`

          WHERE
            workspace_id = @workspace_id
            AND brand_id = @brand_id
            AND request_type = @request_type
            AND status IN (
              'requested',
              'in_progress'
            )

          ORDER BY
            requested_at DESC

          LIMIT 1

        );


        IF existing_request_id IS NULL THEN

          INSERT INTO
            \`${projectId}.${DATASET_ID}.workspace_account_requests\`
          (

            request_id,
            workspace_id,
            brand_id,
            request_type,
            status,
            requested_by,
            requested_by_email,
            reason,
            metadata,
            requested_at,
            updated_at,
            completed_at

          )

          VALUES
          (

            @request_id,
            @workspace_id,
            @brand_id,
            @request_type,
            'requested',
            @requested_by,
            NULLIF(@requested_by_email, ''),
            NULLIF(@reason, ''),
            PARSE_JSON(@metadata_json),
            CURRENT_TIMESTAMP(),
            CURRENT_TIMESTAMP(),
            NULL

          );

        END IF;


        SELECT

          request_id,
          workspace_id,
          brand_id,
          request_type,
          status,
          requested_by,
          requested_by_email,
          reason,
          metadata,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            requested_at
          )
            AS requested_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            updated_at
          )
            AS updated_at,

          FORMAT_TIMESTAMP(
            '%Y-%m-%dT%H:%M:%SZ',
            completed_at
          )
            AS completed_at

        FROM
          \`${projectId}.${DATASET_ID}.workspace_account_requests\`

        WHERE
          request_id = COALESCE(
            existing_request_id,
            @request_id
          )

        LIMIT 1

      `,

      params: {

        request_id:
          requestId,

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        request_type:
          input.requestType,

        requested_by:
          input.requestedBy,

        requested_by_email:
          input.requestedByEmail
          ??
          '',

        reason:
          input.reason
          ??
          '',

        metadata_json:
          metadataJson,

      },

      types: {

        request_id:
          'STRING',

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        request_type:
          'STRING',

        requested_by:
          'STRING',

        requested_by_email:
          'STRING',

        reason:
          'STRING',

        metadata_json:
          'STRING',

      },

    });


  const row:
    any =
      rows?.[0];


  if (!row) {

    throw new Error(
      'Unable to create account request'
    );

  }


  return {

    requestId:
      String(
        row.request_id
      ),

    workspaceId:
      String(
        row.workspace_id
      ),

    brandId:
      String(
        row.brand_id
      ),

    requestType:
      String(
        row.request_type
      ) as GrowthOSAccountRequestType,

    status:
      String(
        row.status
      ) as GrowthOSAccountRequestStatus,

    requestedBy:
      String(
        row.requested_by
      ),

    requestedByEmail:
      row.requested_by_email
      ??
      null,

    reason:
      row.reason
      ??
      null,

    metadata:
      parseJson(
        row.metadata
      ),

    requestedAt:
      row.requested_at
      ??
      null,

    updatedAt:
      row.updated_at
      ??
      null,

    completedAt:
      row.completed_at
      ??
      null,

  };

}
