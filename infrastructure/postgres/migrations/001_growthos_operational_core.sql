BEGIN;

CREATE SCHEMA IF NOT EXISTS growthos_core;
CREATE SCHEMA IF NOT EXISTS integrations;
CREATE SCHEMA IF NOT EXISTS call_commerce;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS growthos_core.schema_migrations (
  migration_id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT
);

-- Shared tenant registry for modules migrated to the operational plane.
-- BigQuery growthos_control remains authoritative until each module is cut over.
CREATE TABLE IF NOT EXISTS growthos_core.tenants (
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, brand_id)
);

CREATE TABLE IF NOT EXISTS growthos_core.runtime_kv (
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (workspace_id, brand_id, namespace, key)
);

-- Transactional outbox for future Postgres -> Pub/Sub/BigQuery replication.
CREATE TABLE IF NOT EXISTS growthos_core.outbox_events (
  outbox_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  source_module TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_growthos_outbox_pending
  ON growthos_core.outbox_events (status, next_attempt_at, created_at)
  WHERE status IN ('PENDING', 'RETRY');

CREATE INDEX IF NOT EXISTS idx_growthos_outbox_tenant
  ON growthos_core.outbox_events (workspace_id, brand_id, source_module, created_at DESC);

CREATE OR REPLACE FUNCTION growthos_core.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMIT;
