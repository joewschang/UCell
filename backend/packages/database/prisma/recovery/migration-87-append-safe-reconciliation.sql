-- Governed recovery procedure for a database where migration 87 failed and rolled back
-- because pre-existing audit.audit_event rows are append-only.
--
-- Preconditions:
-- 1. 20260926110000_g8_audit_event_core is recorded as failed and has been resolved
--    as rolled back through Prisma's supported migrate resolve command.
-- 2. This script is executed only against an isolated verified copy before any Stage use.
-- 3. No historical audit row is updated, deleted, recreated, or trigger-bypassed.
--
-- This reproduces migration 87's approved schema/runtime postcondition except its
-- prohibited historical UPDATE. New rows receive event_code/trace_id at INSERT time.

ALTER TABLE audit.audit_event
  ADD COLUMN IF NOT EXISTS event_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS actor_role_snapshot text,
  ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS changed_field_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS before_hash text,
  ADD COLUMN IF NOT EXISTS after_hash text,
  ADD COLUMN IF NOT EXISTS evidence_ref text,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS privacy_class text NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS retention_class text NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS created_at timestamptz(6) NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ix_audit_event_trace_occurred ON audit.audit_event(trace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_event_environment_code_occurred ON audit.audit_event(environment, event_code, occurred_at DESC);

CREATE OR REPLACE FUNCTION audit.ucell_audit_event_before_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.event_code := COALESCE(NULLIF(NEW.event_code, ''), NEW.action);
  NEW.trace_id := COALESCE(NULLIF(NEW.trace_id, ''), NEW.correlation_id::text);
  NEW.created_at := COALESCE(NEW.created_at, NEW.occurred_at, now());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_event_before_insert ON audit.audit_event;
CREATE TRIGGER trg_audit_event_before_insert
BEFORE INSERT ON audit.audit_event
FOR EACH ROW EXECUTE FUNCTION audit.ucell_audit_event_before_insert();

CREATE OR REPLACE FUNCTION audit.ucell_audit_event_prevent_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit.audit_event is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_audit_event_no_update ON audit.audit_event;
DROP TRIGGER IF EXISTS trg_audit_event_no_delete ON audit.audit_event;
CREATE TRIGGER trg_audit_event_no_update BEFORE UPDATE ON audit.audit_event
FOR EACH ROW EXECUTE FUNCTION audit.ucell_audit_event_prevent_mutation();
CREATE TRIGGER trg_audit_event_no_delete BEFORE DELETE ON audit.audit_event
FOR EACH ROW EXECUTE FUNCTION audit.ucell_audit_event_prevent_mutation();
