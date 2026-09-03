import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';


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


function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Sync store requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }

  return PROJECT_ID;

}


// ============================================================
// CREATE RUN ID
// ============================================================

export function createSyncRunId() {

  return crypto.randomUUID();

}


// ============================================================
// START RUN
// ============================================================

export async function startSyncRun(
  input: {

    runId: string;

    workspaceId: string;

    brandId: string;

    connectionId: string;

    provider: string;

    entity: string;

    syncType: string;

    attempt?: number;

    sourceStartAt?: string | null;

    sourceEndAt?: string | null;

    cursorBefore?: string | null;

  }
) {

  const projectId =
    requireProjectId();


  const query = `

    INSERT INTO
      \`${projectId}.${DATASET_ID}.integration_sync_runs\`
    (

      run_id,

      workspace_id,

      brand_id,

      connection_id,

      provider,

      entity,

      sync_type,

      status,

      attempt,

      started_at,

      source_start_at,

      source_end_at,

      records_fetched,

      records_loaded,

      records_rejected,

      bytes_processed,

      cursor_before,

      cursor_after,

      error_code,

      error_message,

      created_at

    )

    VALUES
    (

      @run_id,

      @workspace_id,

      @brand_id,

      @connection_id,

      @provider,

      @entity,

      @sync_type,

      'running',

      @attempt,

      CURRENT_TIMESTAMP(),

      SAFE_CAST(
        NULLIF(
          @source_start_at,
          ''
        )
        AS TIMESTAMP
      ),

      SAFE_CAST(
        NULLIF(
          @source_end_at,
          ''
        )
        AS TIMESTAMP
      ),

      0,

      0,

      0,

      0,

      NULLIF(
        @cursor_before,
        ''
      ),

      NULL,

      NULL,

      NULL,

      CURRENT_TIMESTAMP()

    )

  `;


  await bigquery.query({

    query,

    params: {

      run_id:
        input.runId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      provider:
        input.provider,

      entity:
        input.entity,

      sync_type:
        input.syncType,

      attempt:
        input.attempt
        ??
        1,

      source_start_at:
        input.sourceStartAt
        ??
        '',

      source_end_at:
        input.sourceEndAt
        ??
        '',

      cursor_before:
        input.cursorBefore
        ??
        '',

    },

  });

}


// ============================================================
// COMPLETE RUN
// ============================================================

export async function completeSyncRun(
  input: {

    runId: string;

    status:
      | 'success'
      | 'partial';

    recordsFetched: number;

    recordsLoaded: number;

    recordsRejected: number;

    cursorAfter?: string | null;

    bytesProcessed?: number;

  }
) {

  const projectId =
    requireProjectId();


  const query = `

    UPDATE
      \`${projectId}.${DATASET_ID}.integration_sync_runs\`

    SET

      status =
        @status,

      completed_at =
        CURRENT_TIMESTAMP(),

      duration_ms =
        TIMESTAMP_DIFF(
          CURRENT_TIMESTAMP(),
          started_at,
          MILLISECOND
        ),

      records_fetched =
        @records_fetched,

      records_loaded =
        @records_loaded,

      records_rejected =
        @records_rejected,

      bytes_processed =
        @bytes_processed,

      cursor_after =
        NULLIF(
          @cursor_after,
          ''
        )

    WHERE
      run_id =
      @run_id

  `;


  await bigquery.query({

    query,

    params: {

      run_id:
        input.runId,

      status:
        input.status,

      records_fetched:
        input.recordsFetched,

      records_loaded:
        input.recordsLoaded,

      records_rejected:
        input.recordsRejected,

      bytes_processed:
        input.bytesProcessed
        ??
        0,

      cursor_after:
        input.cursorAfter
        ??
        '',

    },

  });

}


// ============================================================
// FAIL RUN
// ============================================================

export async function failSyncRun(
  input: {

    runId: string;

    errorCode?: string | null;

    errorMessage: string;

  }
) {

  const projectId =
    requireProjectId();


  const query = `

    UPDATE
      \`${projectId}.${DATASET_ID}.integration_sync_runs\`

    SET

      status =
        'failed',

      completed_at =
        CURRENT_TIMESTAMP(),

      duration_ms =
        TIMESTAMP_DIFF(
          CURRENT_TIMESTAMP(),
          started_at,
          MILLISECOND
        ),

      error_code =
        NULLIF(
          @error_code,
          ''
        ),

      error_message =
        @error_message

    WHERE
      run_id =
      @run_id

  `;


  await bigquery.query({

    query,

    params: {

      run_id:
        input.runId,

      error_code:
        input.errorCode
        ??
        '',

      error_message:
        input.errorMessage,

    },

  });

}


// ============================================================
// GET SYNC STATE
// ============================================================

export async function getSyncState(
  input: {

    workspaceId: string;

    brandId: string;

    connectionId: string;

    provider: string;

    entity: string;

  }
) {

  const projectId =
    requireProjectId();


  const query = `

    SELECT

      sync_state_id,

      workspace_id,

      brand_id,

      connection_id,

      provider,

      entity,

      cursor,

      last_source_timestamp,

      last_synced_at,

      next_sync_at,

      backfill_status,

      incremental_status,

      consecutive_failures,

      last_error

    FROM
      \`${projectId}.${DATASET_ID}.integration_sync_state\`

    WHERE

      workspace_id =
        @workspace_id

      AND brand_id =
        @brand_id

      AND connection_id =
        @connection_id

      AND provider =
        @provider

      AND entity =
        @entity

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        connection_id:
          input.connectionId,

        provider:
          input.provider,

        entity:
          input.entity,

      },

    });


  return (
    rows?.[0]
    ||
    null
  );

}


// ============================================================
// UPDATE SUCCESS STATE
// ============================================================

export async function markSyncStateSuccess(
  input: {

    workspaceId: string;

    brandId: string;

    connectionId: string;

    provider: string;

    entity: string;

    syncType: string;

    cursor?: string | null;

    latestSourceTimestamp?: string | null;

  }
) {

  const projectId =
    requireProjectId();


  const syncStateId =
    [
      input.workspaceId,
      input.brandId,
      input.provider,
      input.entity,
    ].join(
      ':'
    );


  const query = `

    MERGE
      \`${projectId}.${DATASET_ID}.integration_sync_state\`
      AS target


    USING
    (

      SELECT

        @sync_state_id
          AS sync_state_id,

        @workspace_id
          AS workspace_id,

        @brand_id
          AS brand_id,

        @connection_id
          AS connection_id,

        @provider
          AS provider,

        @entity
          AS entity,

        NULLIF(
          @cursor,
          ''
        )
          AS cursor,

        SAFE_CAST(
          NULLIF(
            @latest_source_timestamp,
            ''
          )
          AS TIMESTAMP
        )
          AS latest_source_timestamp

    )
    AS source


    ON
      target.sync_state_id =
      source.sync_state_id


    WHEN MATCHED THEN

      UPDATE SET

        connection_id =
          source.connection_id,

        cursor =
          COALESCE(
            source.cursor,
            target.cursor
          ),

        last_source_timestamp =
          COALESCE(
            source.latest_source_timestamp,
            target.last_source_timestamp
          ),

        last_synced_at =
          CURRENT_TIMESTAMP(),

        backfill_status =
          IF(
            @sync_type = 'backfill',
            'success',
            target.backfill_status
          ),

        incremental_status =
          IF(
            @sync_type != 'backfill',
            'success',
            target.incremental_status
          ),

        consecutive_failures =
          0,

        last_error =
          NULL,

        updated_at =
          CURRENT_TIMESTAMP()


    WHEN NOT MATCHED THEN

      INSERT
      (

        sync_state_id,

        workspace_id,

        brand_id,

        connection_id,

        provider,

        entity,

        cursor,

        last_source_timestamp,

        last_synced_at,

        backfill_status,

        incremental_status,

        consecutive_failures,

        created_at,

        updated_at

      )

      VALUES
      (

        source.sync_state_id,

        source.workspace_id,

        source.brand_id,

        source.connection_id,

        source.provider,

        source.entity,

        source.cursor,

        source.latest_source_timestamp,

        CURRENT_TIMESTAMP(),

        IF(
          @sync_type = 'backfill',
          'success',
          NULL
        ),

        IF(
          @sync_type != 'backfill',
          'success',
          NULL
        ),

        0,

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP()

      )

  `;


  await bigquery.query({

    query,

    params: {

      sync_state_id:
        syncStateId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      provider:
        input.provider,

      entity:
        input.entity,

      sync_type:
        input.syncType,

      cursor:
        input.cursor
        ??
        '',

      latest_source_timestamp:
        input.latestSourceTimestamp
        ??
        '',

    },

  });

}


// ============================================================
// UPDATE FAILURE STATE
// ============================================================

export async function markSyncStateFailure(
  input: {

    workspaceId: string;

    brandId: string;

    connectionId: string;

    provider: string;

    entity: string;

    errorMessage: string;

  }
) {

  const projectId =
    requireProjectId();


  const syncStateId =
    [
      input.workspaceId,
      input.brandId,
      input.provider,
      input.entity,
    ].join(
      ':'
    );


  const query = `

    MERGE
      \`${projectId}.${DATASET_ID}.integration_sync_state\`
      AS target

    USING
    (

      SELECT

        @sync_state_id
          AS sync_state_id,

        @workspace_id
          AS workspace_id,

        @brand_id
          AS brand_id,

        @connection_id
          AS connection_id,

        @provider
          AS provider,

        @entity
          AS entity,

        @error_message
          AS error_message

    )
    AS source


    ON
      target.sync_state_id =
      source.sync_state_id


    WHEN MATCHED THEN

      UPDATE SET

        incremental_status =
          'failed',

        consecutive_failures =
          IFNULL(
            target.consecutive_failures,
            0
          )
          +
          1,

        last_error =
          source.error_message,

        updated_at =
          CURRENT_TIMESTAMP()


    WHEN NOT MATCHED THEN

      INSERT
      (

        sync_state_id,

        workspace_id,

        brand_id,

        connection_id,

        provider,

        entity,

        incremental_status,

        consecutive_failures,

        last_error,

        created_at,

        updated_at

      )

      VALUES
      (

        source.sync_state_id,

        source.workspace_id,

        source.brand_id,

        source.connection_id,

        source.provider,

        source.entity,

        'failed',

        1,

        source.error_message,

        CURRENT_TIMESTAMP(),

        CURRENT_TIMESTAMP()

      )

  `;


  await bigquery.query({

    query,

    params: {

      sync_state_id:
        syncStateId,

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      connection_id:
        input.connectionId,

      provider:
        input.provider,

      entity:
        input.entity,

      error_message:
        input.errorMessage,

    },

  });

}