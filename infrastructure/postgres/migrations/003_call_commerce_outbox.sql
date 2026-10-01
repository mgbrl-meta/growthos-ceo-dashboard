BEGIN;

-- App and worker can append operational domain events here without forcing
-- BigQuery DML into the synchronous request path.
CREATE TABLE IF NOT EXISTS call_commerce.analytics_outbox (
  analytics_event_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cc_analytics_outbox_pending
  ON call_commerce.analytics_outbox (status, next_attempt_at, created_at)
  WHERE status IN ('PENDING','RETRY');

CREATE INDEX IF NOT EXISTS idx_cc_analytics_outbox_tenant
  ON call_commerce.analytics_outbox (workspace_id, brand_id, occurred_at DESC);

COMMIT;
