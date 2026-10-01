BEGIN;

CREATE TABLE IF NOT EXISTS call_commerce.calling_connections (
  connection_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  connection_name TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  status TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  active_mapping_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_cc_connections_tenant
  ON call_commerce.calling_connections (workspace_id, brand_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS call_commerce.calling_mapping_versions (
  mapping_version_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES call_commerce.calling_connections(connection_id),
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  value_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE (connection_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cc_mapping_tenant
  ON call_commerce.calling_mapping_versions (workspace_id, brand_id, connection_id, version DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_active_mapping'
  ) THEN
    ALTER TABLE call_commerce.calling_connections
      ADD CONSTRAINT fk_cc_active_mapping
      FOREIGN KEY (active_mapping_version_id)
      REFERENCES call_commerce.calling_mapping_versions(mapping_version_id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS call_commerce.calling_test_events (
  test_event_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES call_commerce.calling_connections(connection_id),
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  provider_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovered_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_test_events_connection
  ON call_commerce.calling_test_events (connection_id, received_at DESC);

CREATE TABLE IF NOT EXISTS call_commerce.raw_call_events (
  raw_event_id TEXT PRIMARY KEY,
  delivery_id TEXT UNIQUE,
  pubsub_message_id TEXT,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  connection_id TEXT NOT NULL REFERENCES call_commerce.calling_connections(connection_id),
  provider_key TEXT NOT NULL,
  provider_call_id TEXT,
  provider_event_id TEXT,
  raw_event_type TEXT,
  raw_status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapping_version_id TEXT REFERENCES call_commerce.calling_mapping_versions(mapping_version_id),
  processing_status TEXT NOT NULL,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cc_raw_tenant_received
  ON call_commerce.raw_call_events (workspace_id, brand_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_raw_provider_call
  ON call_commerce.raw_call_events (connection_id, provider_call_id, received_at DESC);

CREATE TABLE IF NOT EXISTS call_commerce.call_leads (
  lead_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  customer_name TEXT,
  email TEXT,
  product TEXT,
  status TEXT NOT NULL,
  status_changed_at TIMESTAMPTZ,
  notes TEXT,
  unqualified_reason TEXT,
  closed_lost_reason TEXT,
  next_follow_up_at TIMESTAMPTZ,
  order_id TEXT,
  order_amount NUMERIC,
  currency TEXT,
  purchased_at TIMESTAMPTZ,
  first_call_at TIMESTAMPTZ,
  latest_call_at TIMESTAMPTZ,
  latest_call_status TEXT,
  latest_agent_name TEXT,
  latest_attempt_id TEXT,
  latest_provider_call_id TEXT,
  latest_business_number TEXT,
  latest_duration_seconds INTEGER,
  latest_disconnect_party TEXT,
  latest_end_reason TEXT,
  call_attempt_count INTEGER NOT NULL DEFAULT 0,
  answered_attempt_count INTEGER NOT NULL DEFAULT 0,
  unanswered_attempt_count INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_cc_leads_status
  ON call_commerce.call_leads (workspace_id, brand_id, is_archived, status, latest_call_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_leads_phone
  ON call_commerce.call_leads (workspace_id, brand_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_leads_followup
  ON call_commerce.call_leads (workspace_id, brand_id, next_follow_up_at)
  WHERE is_archived = FALSE AND status = 'FOLLOW_UP';
CREATE INDEX IF NOT EXISTS idx_cc_leads_order
  ON call_commerce.call_leads (workspace_id, brand_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS call_commerce.call_attempts (
  attempt_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  provider_call_id TEXT NOT NULL,
  lead_id TEXT REFERENCES call_commerce.call_leads(lead_id),
  phone TEXT NOT NULL,
  business_number TEXT,
  event_type TEXT,
  call_status TEXT,
  direction TEXT,
  agent_id TEXT,
  agent_name TEXT,
  agent_phone TEXT,
  call_started_at TIMESTAMPTZ,
  call_answered_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  provider_updated_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  disconnected_by TEXT,
  disconnect_party TEXT,
  end_reason TEXT,
  outcome_source TEXT,
  recording_url TEXT,
  reason TEXT,
  ivr_inputs JSONB,
  raw_event_type TEXT,
  raw_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, brand_id, connection_id, provider_call_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_attempts_lead
  ON call_commerce.call_attempts (workspace_id, brand_id, lead_id, COALESCE(call_started_at, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_cc_attempts_phone
  ON call_commerce.call_attempts (workspace_id, brand_id, phone, COALESCE(call_started_at, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_cc_attempts_direction
  ON call_commerce.call_attempts (workspace_id, brand_id, direction, created_at DESC);

CREATE TABLE IF NOT EXISTS call_commerce.activity_log (
  activity_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  lead_id TEXT NOT NULL REFERENCES call_commerce.call_leads(lead_id),
  activity_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_activity_lead
  ON call_commerce.activity_log (workspace_id, brand_id, lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS call_commerce.meta_event_queue (
  queue_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  lead_id TEXT NOT NULL REFERENCES call_commerce.call_leads(lead_id),
  call_id TEXT,
  event_key TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, brand_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_meta_queue_status
  ON call_commerce.meta_event_queue (workspace_id, brand_id, status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS call_commerce.meta_event_log (
  log_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  call_id TEXT,
  event_key TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  success BOOLEAN NOT NULL,
  http_status INTEGER,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_meta_log_tenant
  ON call_commerce.meta_event_log (workspace_id, brand_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS call_commerce.settings (
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  contact_min_duration_seconds INTEGER NOT NULL DEFAULT 20,
  reopen_grace_minutes INTEGER NOT NULL DEFAULT 30,
  auto_archive_terminal_leads BOOLEAN NOT NULL DEFAULT TRUE,
  terminal_archive_days INTEGER NOT NULL DEFAULT 3,
  require_unqualified_reason BOOLEAN NOT NULL DEFAULT FALSE,
  require_closed_lost_reason BOOLEAN NOT NULL DEFAULT FALSE,
  require_purchase_order_id BOOLEAN NOT NULL DEFAULT FALSE,
  require_purchase_amount BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, brand_id)
);

-- Future-friendly tenant registry seed from actual Call Commerce tenants.
INSERT INTO growthos_core.tenants (workspace_id, brand_id)
SELECT workspace_id, brand_id
FROM call_commerce.calling_connections
ON CONFLICT (workspace_id, brand_id) DO NOTHING;

COMMIT;
