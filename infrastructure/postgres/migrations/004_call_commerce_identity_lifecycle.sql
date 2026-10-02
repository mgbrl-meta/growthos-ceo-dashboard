BEGIN;

-- ============================================================
-- CALL COMMERCE V2 — IDENTITY + LIFECYCLE INVARIANTS
--
-- Customer/contact identity is normalized phone within one
-- workspace + brand. Connector and business number are call-leg
-- attributes and must not partition the CRM lead lifecycle.
-- ============================================================

COMMENT ON COLUMN call_commerce.settings.reopen_grace_minutes IS
  'DEPRECATED: retained for schema compatibility only. Terminal Call Commerce leads are never auto-reopened by new calls.';

-- Legacy rows may contain +, spaces or punctuation. New writes use digits-only,
-- while these expression indexes keep lookup semantics compatible with history.
CREATE INDEX IF NOT EXISTS idx_cc_leads_phone_identity
  ON call_commerce.call_leads (
    workspace_id,
    brand_id,
    (regexp_replace(COALESCE(phone,''),'[^0-9]','','g')),
    COALESCE(first_call_at,created_at) DESC,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_cc_attempts_connector_business_time
  ON call_commerce.call_attempts (
    workspace_id,
    brand_id,
    connection_id,
    business_number,
    COALESCE(call_started_at,created_at) DESC
  );

-- One customer may have unlimited historical terminal leads, but only one
-- active lifecycle in a brand. The application also serializes creation by
-- tenant + brand + normalized phone; this index is the final concurrency guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM call_commerce.call_leads
    WHERE is_archived=FALSE
      AND status IN ('NEW','QUALIFIED','FOLLOW_UP')
      AND regexp_replace(COALESCE(phone,''),'[^0-9]','','g') <> ''
    GROUP BY
      workspace_id,
      brand_id,
      regexp_replace(COALESCE(phone,''),'[^0-9]','','g')
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'CALL_COMMERCE_DUPLICATE_OPEN_LEADS: run scripts/call-commerce/audit-call-identity-v2.mjs and resolve duplicates before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_one_open_lead_per_phone
  ON call_commerce.call_leads (
    workspace_id,
    brand_id,
    (regexp_replace(COALESCE(phone,''),'[^0-9]','','g'))
  )
  WHERE is_archived=FALSE
    AND status IN ('NEW','QUALIFIED','FOLLOW_UP')
    AND regexp_replace(COALESCE(phone,''),'[^0-9]','','g') <> '';

COMMIT;
