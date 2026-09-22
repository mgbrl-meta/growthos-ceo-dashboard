import 'server-only';

import { bigquery } from '@/lib/bigquery';
import { CALL_COMMERCE_DATASET, CALL_COMMERCE_LOCATION } from './config';

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || '';
let ready = false;
let pending: Promise<void> | null = null;

function projectId() {
  if (!PROJECT_ID) throw new Error('Call Commerce requires GCP_PROJECT_ID or BQ_PROJECT_ID');
  return PROJECT_ID;
}

export async function ensureCallCommerceSchema() {
  if (ready) return;
  if (pending) return pending;

  pending = (async () => {
    const project = projectId();

    try {
      await bigquery.createDataset(CALL_COMMERCE_DATASET, { location: CALL_COMMERCE_LOCATION });
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if (!(error?.code === 409 || message.includes('already exists'))) throw error;
    }

    const ddl = [
      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.calling_connections\` (
        connection_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        connection_name STRING NOT NULL,
        provider_key STRING NOT NULL,
        status STRING NOT NULL,
        webhook_secret STRING NOT NULL,
        active_mapping_version_id STRING,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        last_event_at TIMESTAMP,
        last_success_at TIMESTAMP,
        last_error STRING
      ) CLUSTER BY workspace_id, brand_id, provider_key`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.calling_mapping_versions\` (
        mapping_version_id STRING NOT NULL,
        connection_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        version INT64 NOT NULL,
        status STRING NOT NULL,
        field_mappings JSON,
        value_mappings JSON,
        created_at TIMESTAMP,
        activated_at TIMESTAMP
      ) CLUSTER BY workspace_id, brand_id, connection_id`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.calling_test_events\` (
        test_event_id STRING NOT NULL,
        connection_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        provider_key STRING,
        payload JSON,
        discovered_fields JSON,
        received_at TIMESTAMP
      ) PARTITION BY DATE(received_at) CLUSTER BY workspace_id, brand_id, connection_id`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.raw_call_events\` (
        raw_event_id STRING NOT NULL,
        delivery_id STRING,
        pubsub_message_id STRING,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        connection_id STRING NOT NULL,
        provider_key STRING NOT NULL,
        provider_call_id STRING,
        provider_event_id STRING,
        raw_event_type STRING,
        raw_status STRING,
        payload JSON,
        mapping_version_id STRING,
        processing_status STRING NOT NULL,
        processing_error STRING,
        received_at TIMESTAMP NOT NULL,
        processed_at TIMESTAMP
      ) PARTITION BY DATE(received_at) CLUSTER BY workspace_id, brand_id, connection_id, provider_call_id`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.call_attempts\` (
        attempt_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        connection_id STRING NOT NULL,
        provider_key STRING NOT NULL,
        provider_call_id STRING NOT NULL,
        lead_id STRING,
        phone STRING NOT NULL,
        business_number STRING,
        event_type STRING,
        call_status STRING,
        direction STRING,
        agent_id STRING,
        agent_name STRING,
        agent_phone STRING,
        call_started_at TIMESTAMP,
        call_answered_at TIMESTAMP,
        call_ended_at TIMESTAMP,
        provider_updated_at TIMESTAMP,
        duration_seconds INT64,
        disconnected_by STRING,
        disconnect_party STRING,
        end_reason STRING,
        outcome_source STRING,
        recording_url STRING,
        reason STRING,
        ivr_inputs JSON,
        raw_event_type STRING,
        raw_status STRING,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      ) PARTITION BY DATE(created_at) CLUSTER BY workspace_id, brand_id, lead_id, provider_call_id`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` (
        lead_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        phone STRING NOT NULL,
        customer_name STRING,
        email STRING,
        product STRING,
        status STRING NOT NULL,
        status_changed_at TIMESTAMP,
        notes STRING,
        unqualified_reason STRING,
        closed_lost_reason STRING,
        next_follow_up_at TIMESTAMP,
        order_id STRING,
        order_amount NUMERIC,
        currency STRING,
        purchased_at TIMESTAMP,
        first_call_at TIMESTAMP,
        latest_call_at TIMESTAMP,
        latest_call_status STRING,
        latest_agent_name STRING,
        latest_attempt_id STRING,
        latest_provider_call_id STRING,
        latest_business_number STRING,
        latest_duration_seconds INT64,
        latest_disconnect_party STRING,
        latest_end_reason STRING,
        call_attempt_count INT64,
        answered_attempt_count INT64,
        unanswered_attempt_count INT64,
        is_archived BOOL,
        archived_at TIMESTAMP,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        created_by STRING,
        updated_by STRING
      ) PARTITION BY DATE(created_at) CLUSTER BY workspace_id, brand_id, status, phone`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.activity_log\` (
        activity_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        lead_id STRING NOT NULL,
        activity_type STRING NOT NULL,
        from_status STRING,
        to_status STRING,
        details JSON,
        actor_user_id STRING,
        created_at TIMESTAMP NOT NULL
      ) PARTITION BY DATE(created_at) CLUSTER BY workspace_id, brand_id, lead_id`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.meta_event_queue\` (
        queue_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        lead_id STRING NOT NULL,
        call_id STRING,
        event_key STRING NOT NULL,
        event_name STRING NOT NULL,
        event_id STRING NOT NULL,
        payload JSON,
        status STRING NOT NULL,
        attempts INT64 NOT NULL,
        next_attempt_at TIMESTAMP,
        last_error STRING,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      ) PARTITION BY DATE(created_at) CLUSTER BY workspace_id, brand_id, status, event_name`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.meta_event_log\` (
        log_id STRING NOT NULL,
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        lead_id STRING NOT NULL,
        call_id STRING,
        event_key STRING NOT NULL,
        event_name STRING NOT NULL,
        event_id STRING NOT NULL,
        request_payload JSON,
        response_payload JSON,
        success BOOL NOT NULL,
        http_status INT64,
        error STRING,
        sent_at TIMESTAMP NOT NULL
      ) PARTITION BY DATE(sent_at) CLUSTER BY workspace_id, brand_id, event_name, success`,

      `CREATE TABLE IF NOT EXISTS \`${project}.${CALL_COMMERCE_DATASET}.module_settings\` (
        workspace_id STRING NOT NULL,
        brand_id STRING NOT NULL,
        contact_min_duration_seconds INT64,
        general_archive_days INT64,
        terminal_archive_days INT64,
        reopen_grace_minutes INT64,
        meta_event_names JSON,
        updated_at TIMESTAMP
      ) CLUSTER BY workspace_id, brand_id`,
    ];

    for (const query of ddl) {
      await bigquery.query({ query, location: CALL_COMMERCE_LOCATION });
    }

    // Additive schema upgrades for warehouses where Call Commerce already exists.
    const upgrades = [
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.raw_call_events\` ADD COLUMN IF NOT EXISTS delivery_id STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.raw_call_events\` ADD COLUMN IF NOT EXISTS pubsub_message_id STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_attempts\` ADD COLUMN IF NOT EXISTS business_number STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_attempts\` ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMP`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_attempts\` ADD COLUMN IF NOT EXISTS disconnect_party STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_attempts\` ADD COLUMN IF NOT EXISTS end_reason STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_attempts\` ADD COLUMN IF NOT EXISTS outcome_source STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` ADD COLUMN IF NOT EXISTS latest_attempt_id STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` ADD COLUMN IF NOT EXISTS latest_provider_call_id STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` ADD COLUMN IF NOT EXISTS latest_business_number STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` ADD COLUMN IF NOT EXISTS latest_duration_seconds INT64`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` ADD COLUMN IF NOT EXISTS latest_disconnect_party STRING`,
      `ALTER TABLE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` ADD COLUMN IF NOT EXISTS latest_end_reason STRING`,
      `UPDATE \`${project}.${CALL_COMMERCE_DATASET}.call_leads\` SET status_changed_at=COALESCE(status_changed_at,updated_at,created_at) WHERE status_changed_at IS NULL`,
    ];
    for (const query of upgrades) {
      await bigquery.query({ query, location: CALL_COMMERCE_LOCATION });
    }

    ready = true;
  })();

  try { await pending; }
  finally { pending = null; }
}
