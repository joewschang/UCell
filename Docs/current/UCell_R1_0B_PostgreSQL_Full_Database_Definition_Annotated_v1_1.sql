-- =============================================================================
-- UCell R1.0B PostgreSQL Full Database Definition v1.0
-- Date: 2026-09-04
-- Purpose:
--   Database baseline for UCell Core / Admin MVP / LINE OA / Pre-ERP Bridge.
--   Design principles:
--     Parameter-driven + Event-driven + Append-only + Versioned + Traceable
--     Qualification-first, Sponsor/Binary separation, no physical delete
--     Pre-ERP operational bridge only; do NOT recreate WMS/AR/AP/GL.
--
-- IMPORTANT SOURCE-OF-TRUTH:
--   Filed documents / formally approved rules override this technical schema.
--   This SQL structures the current engineering baseline and MUST NOT be treated
--   as a replacement for legal filing documents.
--
-- Target PostgreSQL: 16+ recommended.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 00. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 01. Schemas
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS membership;
CREATE SCHEMA IF NOT EXISTS organization;
CREATE SCHEMA IF NOT EXISTS rules;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS subscription;
CREATE SCHEMA IF NOT EXISTS ledger;
CREATE SCHEMA IF NOT EXISTS attribution;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS reporting;

-- -----------------------------------------------------------------------------
-- 02. Generic utility functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.utc_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$ SELECT clock_timestamp(); $$;

CREATE OR REPLACE FUNCTION public.gen_uuid()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$ SELECT gen_random_uuid(); $$;

CREATE OR REPLACE FUNCTION public.sha256_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT encode(digest(coalesce(p_text,''), 'sha256'), 'hex'); $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Physical DELETE is prohibited on %. Use VOID/REVERSAL/SUPERSEDE workflow.', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Mutation is prohibited on append-only table %. Use reversal/correction event.', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

-- -----------------------------------------------------------------------------
-- 03. Shared enum-like domains/types
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_status') THEN
    CREATE TYPE public.record_status AS ENUM ('DRAFT','PENDING','APPROVED','EFFECTIVE','SUSPENDED','VOIDED','CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'side_code') THEN
    CREATE TYPE public.side_code AS ENUM ('LEFT','RIGHT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'actor_type') THEN
    CREATE TYPE public.actor_type AS ENUM ('USER','SYSTEM','JOB','INTEGRATION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_status') THEN
    CREATE TYPE public.rule_status AS ENUM ('DRAFT','REVIEW','APPROVED','PUBLISHED','RETIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('DRAFT','CONFIRMED','PAID','FULFILLED','PARTIAL_RETURN','RETURNED','VOIDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'award_status') THEN
    CREATE TYPE public.award_status AS ENUM ('CALCULATED','PENDING_45D','EFFECTIVE','PAYABLE','PAID','REVERSED','CLAWBACK');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parameter_data_type') THEN
    CREATE TYPE public.parameter_data_type AS ENUM ('INTEGER','DECIMAL','BOOLEAN','TEXT','ENUM','DATE','TIMESTAMP','JSON');
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- 04. AUDIT / CHANGE GOVERNANCE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.change_request (
  change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  change_type text NOT NULL,
  reason_code text NOT NULL,
  reason_text text,
  requested_payload jsonb,
  status public.record_status NOT NULL DEFAULT 'DRAFT',
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS audit.approval_record (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id uuid NOT NULL REFERENCES audit.change_request(change_request_id),
  approval_stage text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT','RETURN')),
  decided_by uuid,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  note text
);

CREATE TABLE IF NOT EXISTS audit.audit_event (
  audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type public.actor_type NOT NULL,
  actor_id uuid,
  action_code text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_snapshot jsonb,
  after_snapshot jsonb,
  reason_code text,
  reason_text text,
  request_id text,
  trace_id text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address inet,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ix_audit_entity_time
  ON audit.audit_event(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_actor_time
  ON audit.audit_event(actor_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION audit.fn_write_audit_event(
  p_actor_type public.actor_type,
  p_actor_id uuid,
  p_action_code text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb,
  p_reason_code text DEFAULT NULL,
  p_reason_text text DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO audit.audit_event(
    audit_event_id, actor_type, actor_id, action_code, entity_type, entity_id,
    before_snapshot, after_snapshot, reason_code, reason_text, correlation_id
  )
  VALUES(
    v_id, p_actor_type, p_actor_id, p_action_code, p_entity_type, p_entity_id,
    p_before, p_after, p_reason_code, p_reason_text, coalesce(p_correlation_id, gen_random_uuid())
  );
  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 05. IDENTITY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity.person (
  person_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_no bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  legal_name text NOT NULL,
  preferred_name text,
  national_id_hash text,
  national_id_ciphertext bytea,
  birth_date date,
  adulthood_verified boolean NOT NULL DEFAULT false,
  mobile text,
  email text,
  line_user_id_hash text,
  line_user_id_ciphertext bytea,
  status public.record_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  CONSTRAINT uq_person_national_id_hash UNIQUE NULLS NOT DISTINCT (national_id_hash)
);

CREATE INDEX IF NOT EXISTS ix_person_name ON identity.person(legal_name);
CREATE INDEX IF NOT EXISTS ix_person_mobile ON identity.person(mobile);

CREATE TRIGGER trg_person_updated_at
BEFORE UPDATE ON identity.person
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_person_no_delete
BEFORE DELETE ON identity.person
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE TABLE IF NOT EXISTS identity.person_bank_profile (
  bank_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(person_id),
  bank_code text NOT NULL,
  branch_code text,
  account_name text NOT NULL,
  account_no_hash text NOT NULL,
  account_no_ciphertext bytea NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_primary_bank
  ON identity.person_bank_profile(person_id)
  WHERE is_primary AND valid_to IS NULL;

CREATE TABLE IF NOT EXISTS identity.consent_record (
  consent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES identity.person(person_id),
  consent_type text NOT NULL,
  consent_version text NOT NULL,
  consented boolean NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source_channel text,
  ip_address inet,
  evidence jsonb
);

CREATE TRIGGER trg_consent_no_delete
BEFORE DELETE ON identity.consent_record
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

-- -----------------------------------------------------------------------------
-- 06. MEMBERSHIP / QUALIFICATION
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS membership.plan_level (
  plan_level_code text PRIMARY KEY,
  display_name text NOT NULL,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO membership.plan_level(plan_level_code, display_name, sort_order)
VALUES
  ('STARTER','啟航',10),
  ('ELITE','菁英',20),
  ('LEADER','領袖',30)
ON CONFLICT (plan_level_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS membership.qualification (
  qualification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_no bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  current_holder_person_id uuid NOT NULL REFERENCES identity.person(person_id),
  plan_level_code text NOT NULL REFERENCES membership.plan_level(plan_level_code),
  status public.record_status NOT NULL DEFAULT 'DRAFT',
  active_flag boolean NOT NULL DEFAULT false,
  effective_at timestamptz,
  closed_at timestamptz,
  source_application_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS ix_qualification_holder
  ON membership.qualification(current_holder_person_id, status);

CREATE TRIGGER trg_qualification_updated_at
BEFORE UPDATE ON membership.qualification
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_qualification_no_delete
BEFORE DELETE ON membership.qualification
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE TABLE IF NOT EXISTS membership.qualification_holder_history (
  holder_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  holder_person_id uuid NOT NULL REFERENCES identity.person(person_id),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  source_case_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_current_holder_per_qualification
  ON membership.qualification_holder_history(qualification_id)
  WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS membership.qualification_status_history (
  status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  status public.record_status NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source_event_id uuid,
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS membership.active_period (
  active_period_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  active_from timestamptz NOT NULL,
  active_to timestamptz,
  active_source text NOT NULL,
  source_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (active_to IS NULL OR active_to > active_from)
);

CREATE INDEX IF NOT EXISTS ix_active_period_lookup
  ON membership.active_period(qualification_id, active_from, active_to);

CREATE OR REPLACE FUNCTION membership.fn_is_active_at(
  p_qualification_id uuid,
  p_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
SELECT EXISTS (
  SELECT 1
  FROM membership.active_period ap
  WHERE ap.qualification_id = p_qualification_id
    AND ap.active_from <= p_at
    AND (ap.active_to IS NULL OR ap.active_to > p_at)
);
$$;

-- -----------------------------------------------------------------------------
-- 07. ORGANIZATION - Sponsor Tree
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization.sponsor_relationship (
  sponsor_relationship_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  sponsor_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  sponsor_sequence_no integer NOT NULL CHECK (sponsor_sequence_no > 0),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source_application_id uuid,
  source_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CHECK (child_qualification_id <> sponsor_qualification_id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sponsor_sequence_per_sponsor
  ON organization.sponsor_relationship(sponsor_qualification_id, sponsor_sequence_no);

CREATE UNIQUE INDEX IF NOT EXISTS uq_current_sponsor_per_child
  ON organization.sponsor_relationship(child_qualification_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS ix_sponsor_children
  ON organization.sponsor_relationship(sponsor_qualification_id, effective_from);

CREATE TRIGGER trg_sponsor_no_delete
BEFORE DELETE ON organization.sponsor_relationship
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE OR REPLACE FUNCTION organization.fn_current_sponsor(p_child_qualification_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
SELECT sr.sponsor_qualification_id
FROM organization.sponsor_relationship sr
WHERE sr.child_qualification_id = p_child_qualification_id
  AND sr.effective_to IS NULL
ORDER BY sr.effective_from DESC
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION organization.fn_sponsor_ancestor(
  p_qualification_id uuid,
  p_generation integer
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE chain AS (
  SELECT
    p_qualification_id AS child_id,
    organization.fn_current_sponsor(p_qualification_id) AS sponsor_id,
    1 AS generation
  UNION ALL
  SELECT
    c.sponsor_id,
    organization.fn_current_sponsor(c.sponsor_id),
    c.generation + 1
  FROM chain c
  WHERE c.sponsor_id IS NOT NULL
    AND c.generation < p_generation
)
SELECT sponsor_id
FROM chain
WHERE generation = p_generation
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION organization.fn_effective_direct_count_at(
  p_sponsor_qualification_id uuid,
  p_at timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
SELECT count(*)::integer
FROM organization.sponsor_relationship sr
JOIN membership.qualification q
  ON q.qualification_id = sr.child_qualification_id
WHERE sr.sponsor_qualification_id = p_sponsor_qualification_id
  AND sr.effective_from <= p_at
  AND (sr.effective_to IS NULL OR sr.effective_to > p_at)
  AND q.status NOT IN ('VOIDED','CLOSED');
$$;

-- -----------------------------------------------------------------------------
-- 08. ORGANIZATION - Binary Tree
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization.binary_placement (
  binary_placement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  parent_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  side public.side_code NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CHECK (qualification_id <> parent_qualification_id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_current_binary_position_for_child
  ON organization.binary_placement(qualification_id)
  WHERE effective_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_current_binary_slot
  ON organization.binary_placement(parent_qualification_id, side)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS ix_binary_parent
  ON organization.binary_placement(parent_qualification_id, effective_from);

CREATE TRIGGER trg_binary_no_delete
BEFORE DELETE ON organization.binary_placement
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE OR REPLACE FUNCTION organization.fn_binary_parent(p_qualification_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
SELECT bp.parent_qualification_id
FROM organization.binary_placement bp
WHERE bp.qualification_id = p_qualification_id
  AND bp.effective_to IS NULL
ORDER BY bp.effective_from DESC
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION organization.fn_binary_ancestor(
  p_qualification_id uuid,
  p_generation integer
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE chain AS (
  SELECT
    p_qualification_id AS child_id,
    organization.fn_binary_parent(p_qualification_id) AS parent_id,
    1 AS generation
  UNION ALL
  SELECT
    c.parent_id,
    organization.fn_binary_parent(c.parent_id),
    c.generation + 1
  FROM chain c
  WHERE c.parent_id IS NOT NULL
    AND c.generation < p_generation
)
SELECT parent_id
FROM chain
WHERE generation = p_generation
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION organization.fn_is_in_binary_subtree(
  p_root_qualification_id uuid,
  p_candidate_qualification_id uuid,
  p_side public.side_code
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE descendants AS (
  SELECT bp.qualification_id
  FROM organization.binary_placement bp
  WHERE bp.parent_qualification_id = p_root_qualification_id
    AND bp.side = p_side
    AND bp.effective_to IS NULL
  UNION ALL
  SELECT bp2.qualification_id
  FROM organization.binary_placement bp2
  JOIN descendants d ON bp2.parent_qualification_id = d.qualification_id
  WHERE bp2.effective_to IS NULL
)
SELECT EXISTS(SELECT 1 FROM descendants WHERE qualification_id = p_candidate_qualification_id);
$$;

CREATE OR REPLACE FUNCTION organization.fn_validate_binary_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_cycle boolean;
BEGIN
  WITH RECURSIVE ancestors AS (
    SELECT NEW.parent_qualification_id AS qid
    UNION ALL
    SELECT bp.parent_qualification_id
    FROM organization.binary_placement bp
    JOIN ancestors a ON bp.qualification_id = a.qid
    WHERE bp.effective_to IS NULL
  )
  SELECT EXISTS(SELECT 1 FROM ancestors WHERE qid = NEW.qualification_id)
  INTO v_has_cycle;

  IF v_has_cycle THEN
    RAISE EXCEPTION 'Binary placement would create a cycle.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_binary_cycle_guard ON organization.binary_placement;
CREATE TRIGGER trg_binary_cycle_guard
BEFORE INSERT OR UPDATE OF parent_qualification_id ON organization.binary_placement
FOR EACH ROW EXECUTE FUNCTION organization.fn_validate_binary_cycle();

-- -----------------------------------------------------------------------------
-- 09. RULE ENGINE / HIERARCHICAL PARAMETER REGISTRY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rules.rule_set (
  rule_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status public.rule_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS rules.rule_group (
  rule_group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES rules.rule_set(rule_set_id),
  parent_rule_group_id uuid REFERENCES rules.rule_group(rule_group_id),
  rule_group_code text NOT NULL,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(rule_set_id, rule_group_code)
);

CREATE TABLE IF NOT EXISTS rules.rule_definition (
  rule_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_group_id uuid NOT NULL REFERENCES rules.rule_group(rule_group_id),
  rule_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  algorithm_code text NOT NULL,
  description text,
  is_system_invariant boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS rules.rule_version (
  rule_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES rules.rule_set(rule_set_id),
  version_code text NOT NULL,
  status public.rule_status NOT NULL DEFAULT 'DRAFT',
  effective_from timestamptz,
  effective_to timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  published_at timestamptz,
  parameter_snapshot_hash text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  UNIQUE(rule_set_id, version_code),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS rules.parameter_definition (
  parameter_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  data_type public.parameter_data_type NOT NULL,
  unit_code text,
  default_value jsonb,
  validation_schema jsonb,
  allowed_scope_types text[] NOT NULL DEFAULT ARRAY['RULE_SET'],
  runtime_editable boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT true,
  description text
);

CREATE TABLE IF NOT EXISTS rules.parameter_set (
  parameter_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id uuid NOT NULL REFERENCES rules.rule_version(rule_version_id),
  parameter_set_code text NOT NULL,
  scope_type text NOT NULL,
  scope_key text,
  priority integer NOT NULL DEFAULT 0,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  status public.rule_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  UNIQUE(rule_version_id, parameter_set_code),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS rules.parameter_value (
  parameter_value_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_set_id uuid NOT NULL REFERENCES rules.parameter_set(parameter_set_id),
  parameter_definition_id uuid NOT NULL REFERENCES rules.parameter_definition(parameter_definition_id),
  value_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  UNIQUE(parameter_set_id, parameter_definition_id)
);

CREATE TABLE IF NOT EXISTS rules.decision_table (
  decision_table_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id uuid NOT NULL REFERENCES rules.rule_version(rule_version_id),
  table_code text NOT NULL,
  display_name text NOT NULL,
  description text,
  status public.rule_status NOT NULL DEFAULT 'DRAFT',
  UNIQUE(rule_version_id, table_code)
);

CREATE TABLE IF NOT EXISTS rules.decision_row (
  decision_row_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_table_id uuid NOT NULL REFERENCES rules.decision_table(decision_table_id),
  sort_order integer NOT NULL,
  conditions jsonb NOT NULL,
  result jsonb NOT NULL,
  effective_from timestamptz,
  effective_to timestamptz,
  UNIQUE(decision_table_id, sort_order)
);

CREATE INDEX IF NOT EXISTS ix_parameter_scope
  ON rules.parameter_set(rule_version_id, scope_type, scope_key, priority DESC);

CREATE TRIGGER trg_rule_version_no_delete
BEFORE DELETE ON rules.rule_version
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE TRIGGER trg_parameter_value_no_delete
BEFORE DELETE ON rules.parameter_value
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE OR REPLACE FUNCTION rules.fn_guard_published_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status public.rule_status;
BEGIN
  IF TG_TABLE_NAME = 'rule_version' THEN
    v_status := OLD.status;
  ELSE
    SELECT rv.status INTO v_status
    FROM rules.parameter_set ps
    JOIN rules.rule_version rv ON rv.rule_version_id = ps.rule_version_id
    WHERE ps.parameter_set_id = COALESCE(NEW.parameter_set_id, OLD.parameter_set_id);
  END IF;

  IF v_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published rule data is immutable. Create a new rule version.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rule_version_immutable ON rules.rule_version;
CREATE TRIGGER trg_rule_version_immutable
BEFORE UPDATE ON rules.rule_version
FOR EACH ROW
WHEN (OLD.status = 'PUBLISHED')
EXECUTE FUNCTION rules.fn_guard_published_mutation();

DROP TRIGGER IF EXISTS trg_parameter_value_immutable ON rules.parameter_value;
CREATE TRIGGER trg_parameter_value_immutable
BEFORE UPDATE ON rules.parameter_value
FOR EACH ROW EXECUTE FUNCTION rules.fn_guard_published_mutation();

CREATE OR REPLACE FUNCTION rules.fn_active_rule_version(
  p_rule_set_code text,
  p_at timestamptz DEFAULT clock_timestamp()
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
SELECT rv.rule_version_id
FROM rules.rule_version rv
JOIN rules.rule_set rs ON rs.rule_set_id = rv.rule_set_id
WHERE rs.rule_set_code = p_rule_set_code
  AND rv.status = 'PUBLISHED'
  AND rv.effective_from <= p_at
  AND (rv.effective_to IS NULL OR rv.effective_to > p_at)
ORDER BY rv.effective_from DESC
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION rules.fn_resolve_parameter(
  p_rule_version_id uuid,
  p_parameter_code text,
  p_at timestamptz,
  p_scope_candidates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_value jsonb;
BEGIN
  -- Priority-driven lookup. Caller passes scope candidates, e.g.
  -- {"SKU":"TIP580","PLAN":"LEADER","RULE_SET":"UCELL_R1_0B"}
  SELECT pv.value_json
  INTO v_value
  FROM rules.parameter_value pv
  JOIN rules.parameter_definition pd
    ON pd.parameter_definition_id = pv.parameter_definition_id
  JOIN rules.parameter_set ps
    ON ps.parameter_set_id = pv.parameter_set_id
  WHERE ps.rule_version_id = p_rule_version_id
    AND pd.parameter_code = p_parameter_code
    AND ps.status = 'PUBLISHED'
    AND ps.effective_from <= p_at
    AND (ps.effective_to IS NULL OR ps.effective_to > p_at)
    AND (
      ps.scope_key IS NULL
      OR p_scope_candidates ->> ps.scope_type = ps.scope_key
    )
  ORDER BY ps.priority DESC
  LIMIT 1;

  IF v_value IS NULL THEN
    SELECT default_value INTO v_value
    FROM rules.parameter_definition
    WHERE parameter_code = p_parameter_code;
  END IF;

  RETURN v_value;
END;
$$;

CREATE OR REPLACE PROCEDURE rules.sp_publish_rule_version(
  p_rule_version_id uuid,
  p_effective_from timestamptz,
  p_approved_by uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM rules.rule_version
    WHERE rule_version_id = p_rule_version_id
      AND status = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'Rule version already published.';
  END IF;

  SELECT encode(
           digest(
             coalesce(string_agg(
               pd.parameter_code || '=' || pv.value_json::text,
               '|' ORDER BY pd.parameter_code, ps.parameter_set_code
             ), ''),
             'sha256'
           ),
           'hex'
         )
  INTO v_hash
  FROM rules.parameter_set ps
  JOIN rules.parameter_value pv ON pv.parameter_set_id = ps.parameter_set_id
  JOIN rules.parameter_definition pd ON pd.parameter_definition_id = pv.parameter_definition_id
  WHERE ps.rule_version_id = p_rule_version_id;

  UPDATE rules.rule_version
  SET status = 'PUBLISHED',
      effective_from = p_effective_from,
      approved_by = p_approved_by,
      approved_at = clock_timestamp(),
      published_at = clock_timestamp(),
      parameter_snapshot_hash = v_hash
  WHERE rule_version_id = p_rule_version_id;

  UPDATE rules.parameter_set
  SET status = 'PUBLISHED'
  WHERE rule_version_id = p_rule_version_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. RULE CONSTANTS / CURRENT R1.0B SEED
-- -----------------------------------------------------------------------------
INSERT INTO rules.rule_set(rule_set_code, display_name, description, status)
VALUES ('UCELL_R1_0B','UCell R1.0B','Current engineering baseline', 'APPROVED')
ON CONFLICT (rule_set_code) DO NOTHING;

INSERT INTO rules.parameter_definition(parameter_code, display_name, data_type, unit_code, default_value, allowed_scope_types, runtime_editable, requires_approval, description)
VALUES
('gpv.rate','GPV conversion rate','DECIMAL','PERCENT','0.60'::jsonb,ARRAY['RULE_SET','SKU'],false,true,'Qualifying sales to GPV conversion'),
('referral.pool.rate','Referral pool rate','DECIMAL','PERCENT','0.42'::jsonb,ARRAY['RULE_SET'],false,true,'Referral + referral equalization pool'),
('binary.pool.rate','Binary pool rate','DECIMAL','PERCENT','0.36'::jsonb,ARRAY['RULE_SET'],false,true,'Binary pairing pool'),
('matching.pool.rate','Binary matching pool rate','DECIMAL','PERCENT','0.15'::jsonb,ARRAY['RULE_SET'],false,true,'Binary matching pool'),
('global.pool.rate','Global pool rate','DECIMAL','PERCENT','0.05'::jsonb,ARRAY['RULE_SET'],false,true,'Global pool'),
('welfare.pool.rate','Welfare pool rate','DECIMAL','PERCENT','0.02'::jsonb,ARRAY['RULE_SET'],false,true,'Welfare pool'),
('binary.pairing.rate','Binary pairing rate','DECIMAL','PERCENT','0.12'::jsonb,ARRAY['RULE_SET'],false,true,'Weak-side pairing rate'),
('award.pending.days','Award pending days','INTEGER','DAY','45'::jsonb,ARRAY['RULE_SET'],true,true,'Pending period due to return risk'),
('repurchase.monthly.amount','Monthly repurchase amount','DECIMAL','NTD','2000'::jsonb,ARRAY['RULE_SET'],false,true,'Monthly qualifying repurchase'),
('repurchase.monthly.rpv','Monthly RPV','DECIMAL','RPV','1200'::jsonb,ARRAY['RULE_SET'],false,true,'RPV generated monthly'),
('repurchase.generation.reward','Repurchase generation reward','DECIMAL','NTD','100'::jsonb,ARRAY['RULE_SET'],false,true,'R1.0B per-generation reward')
ON CONFLICT (parameter_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. COMMERCE - PRE-ERP BRIDGE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.product_reference (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  product_type text,
  status public.record_status NOT NULL DEFAULT 'EFFECTIVE',
  external_system_code text,
  external_item_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_product_updated_at
BEFORE UPDATE ON commerce.product_reference
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS commerce.product_rule_profile (
  product_rule_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
  rule_version_id uuid REFERENCES rules.rule_version(rule_version_id),
  gpv_rate numeric(18,8),
  pv_rate numeric(18,8),
  rpv_eligible boolean NOT NULL DEFAULT false,
  epv_eligible boolean NOT NULL DEFAULT false,
  bonus_eligible boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS commerce."order" (
  order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  person_id uuid NOT NULL REFERENCES identity.person(person_id),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  source_referral_token text,
  source_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  campaign_id text,
  rule_version_id uuid REFERENCES rules.rule_version(rule_version_id),
  parameter_snapshot_hash text,
  status public.order_status NOT NULL DEFAULT 'DRAFT',
  currency_code char(3) NOT NULL DEFAULT 'TWD',
  gross_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  discount_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  net_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  external_system_code text NOT NULL DEFAULT 'MANUAL',
  external_order_id text,
  external_order_no text,
  sync_status text,
  confirmed_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS ix_order_qualification_time
  ON commerce."order"(qualification_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_order_status_time
  ON commerce."order"(status, created_at DESC);

CREATE TRIGGER trg_order_updated_at
BEFORE UPDATE ON commerce."order"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_order_no_delete
BEFORE DELETE ON commerce."order"
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE TABLE IF NOT EXISTS commerce.order_line (
  order_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  line_no integer NOT NULL,
  product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
  sku_code_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  line_amount numeric(18,2) NOT NULL CHECK (line_amount >= 0),
  gpv_rate_snapshot numeric(18,8),
  gpv_amount_snapshot numeric(18,4),
  pv_rate_snapshot numeric(18,8),
  rule_profile_snapshot jsonb,
  UNIQUE(order_id, line_no)
);

CREATE TABLE IF NOT EXISTS commerce.payment_event (
  payment_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  event_type text NOT NULL CHECK (event_type IN ('PAYMENT_CONFIRMED','PAYMENT_REVERSED','REFUND_CONFIRMED')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  payment_method text,
  reference_no text,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_type public.actor_type NOT NULL,
  actor_id uuid,
  source_system text NOT NULL DEFAULT 'MANUAL',
  external_event_id text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reversal_of_event_id uuid REFERENCES commerce.payment_event(payment_event_id),
  evidence_attachment_id uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_external_event
  ON commerce.payment_event(source_system, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE TRIGGER trg_payment_append_only_update
BEFORE UPDATE OR DELETE ON commerce.payment_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE TABLE IF NOT EXISTS commerce.fulfillment_event (
  fulfillment_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  event_type text NOT NULL CHECK (event_type IN ('FULFILLMENT_CONFIRMED','FULFILLMENT_REVERSED')),
  carrier text,
  tracking_no text,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_type public.actor_type NOT NULL,
  actor_id uuid,
  source_system text NOT NULL DEFAULT 'MANUAL',
  external_event_id text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reversal_of_event_id uuid REFERENCES commerce.fulfillment_event(fulfillment_event_id)
);

CREATE TRIGGER trg_fulfillment_append_only_update
BEFORE UPDATE OR DELETE ON commerce.fulfillment_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE TABLE IF NOT EXISTS commerce.return_event (
  return_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  order_line_id uuid REFERENCES commerce.order_line(order_line_id),
  event_type text NOT NULL CHECK (event_type IN ('RETURN_REQUESTED','RETURN_CONFIRMED','RETURN_REVERSED')),
  quantity numeric(18,4),
  amount numeric(18,2),
  reason_code text,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_type public.actor_type NOT NULL,
  actor_id uuid,
  source_system text NOT NULL DEFAULT 'MANUAL',
  external_event_id text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reversal_of_event_id uuid REFERENCES commerce.return_event(return_event_id)
);

CREATE TRIGGER trg_return_append_only_update
BEFORE UPDATE OR DELETE ON commerce.return_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

-- Lightweight trace only; NOT a WMS inventory ledger.
CREATE TABLE IF NOT EXISTS commerce.lot_trace (
  lot_trace_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
  lot_no text NOT NULL,
  manufactured_at date,
  expiry_at date,
  external_lot_id text,
  UNIQUE(product_id, lot_no)
);

CREATE TABLE IF NOT EXISTS commerce.serial_trace (
  serial_trace_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
  lot_trace_id uuid REFERENCES commerce.lot_trace(lot_trace_id),
  serial_no text NOT NULL,
  external_serial_id text,
  UNIQUE(product_id, serial_no)
);

CREATE TABLE IF NOT EXISTS commerce.shipment_trace (
  shipment_trace_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_event_id uuid NOT NULL REFERENCES commerce.fulfillment_event(fulfillment_event_id),
  order_line_id uuid NOT NULL REFERENCES commerce.order_line(order_line_id),
  lot_trace_id uuid REFERENCES commerce.lot_trace(lot_trace_id),
  serial_trace_id uuid REFERENCES commerce.serial_trace(serial_trace_id),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- -----------------------------------------------------------------------------
-- 12. SUBSCRIPTION / REPURCHASE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription.subscription_plan (
  subscription_plan_code text PRIMARY KEY,
  display_name text NOT NULL,
  months integer NOT NULL CHECK (months > 0),
  paid_amount numeric(18,2) NOT NULL CHECK (paid_amount > 0),
  product_box_count integer NOT NULL CHECK (product_box_count >= 0),
  monthly_recognized_amount numeric(18,2) NOT NULL CHECK (monthly_recognized_amount > 0),
  monthly_rpv numeric(18,4) NOT NULL CHECK (monthly_rpv >= 0),
  active boolean NOT NULL DEFAULT true
);

INSERT INTO subscription.subscription_plan(subscription_plan_code, display_name, months, paid_amount, product_box_count, monthly_recognized_amount, monthly_rpv)
VALUES
  ('QUARTER','重銷（三個月）',3,6000,2,2000,1200),
  ('HALF_YEAR','重銷（六個月）',6,12000,4,2000,1200),
  ('YEAR','重銷（十二個月）',12,24000,8,2000,1200)
ON CONFLICT (subscription_plan_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscription.subscription (
  subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  subscription_plan_code text NOT NULL REFERENCES subscription.subscription_plan(subscription_plan_code),
  order_id uuid REFERENCES commerce."order"(order_id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.record_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS subscription.monthly_recognition_schedule (
  recognition_schedule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscription.subscription(subscription_id),
  installment_no integer NOT NULL CHECK (installment_no > 0),
  due_date date NOT NULL,
  recognized_amount numeric(18,2) NOT NULL,
  rpv_amount numeric(18,4) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RECOGNIZED','CANCELLED','REVERSED')),
  recognized_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(subscription_id, installment_no)
);

CREATE OR REPLACE PROCEDURE subscription.sp_create_schedule(
  p_subscription_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sub subscription.subscription%ROWTYPE;
  v_plan subscription.subscription_plan%ROWTYPE;
  i integer;
BEGIN
  SELECT * INTO v_sub FROM subscription.subscription WHERE subscription_id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;

  SELECT * INTO v_plan FROM subscription.subscription_plan WHERE subscription_plan_code = v_sub.subscription_plan_code;

  FOR i IN 1..v_plan.months LOOP
    INSERT INTO subscription.monthly_recognition_schedule(
      subscription_id, installment_no, due_date, recognized_amount, rpv_amount
    )
    VALUES(
      p_subscription_id,
      i,
      (v_sub.start_date + ((i - 1) || ' month')::interval)::date,
      v_plan.monthly_recognized_amount,
      v_plan.monthly_rpv
    )
    ON CONFLICT (subscription_id, installment_no) DO NOTHING;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. LEDGER / PV
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger.pv_ledger (
  pv_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  pv_type text NOT NULL CHECK (pv_type IN ('GPV','PV','RPV','EPV')),
  event_type text NOT NULL,
  amount numeric(20,6) NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  source_line_id uuid,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  rule_version_id uuid REFERENCES rules.rule_version(rule_version_id),
  parameter_snapshot_hash text,
  active_snapshot boolean,
  effective_direct_count_snapshot integer,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  causation_id uuid,
  reversal_of_event_id uuid REFERENCES ledger.pv_ledger(pv_event_id),
  payload_hash text
);

CREATE INDEX IF NOT EXISTS ix_pv_qualification_time
  ON ledger.pv_ledger(qualification_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_pv_source
  ON ledger.pv_ledger(source_type, source_id);
CREATE INDEX IF NOT EXISTS ix_pv_type_time
  ON ledger.pv_ledger(pv_type, occurred_at DESC);

CREATE TRIGGER trg_pv_append_only
BEFORE UPDATE OR DELETE ON ledger.pv_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE OR REPLACE FUNCTION ledger.fn_pv_balance(
  p_qualification_id uuid,
  p_pv_type text,
  p_as_of timestamptz DEFAULT clock_timestamp()
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
SELECT coalesce(sum(amount),0)
FROM ledger.pv_ledger
WHERE qualification_id = p_qualification_id
  AND pv_type = p_pv_type
  AND occurred_at <= p_as_of;
$$;

CREATE TABLE IF NOT EXISTS ledger.award_event (
  award_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  award_type text NOT NULL,
  source_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  source_event_id uuid,
  settlement_batch_id uuid,
  theory_amount numeric(20,6) NOT NULL DEFAULT 0,
  k_factor numeric(20,10),
  payable_amount numeric(20,6) NOT NULL DEFAULT 0,
  status public.award_status NOT NULL DEFAULT 'CALCULATED',
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  pending_until timestamptz,
  rule_version_id uuid REFERENCES rules.rule_version(rule_version_id),
  parameter_snapshot_hash text,
  active_snapshot boolean NOT NULL,
  effective_direct_count_snapshot integer,
  calculation_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reversal_of_award_event_id uuid REFERENCES ledger.award_event(award_event_id)
);

CREATE INDEX IF NOT EXISTS ix_award_recipient_status
  ON ledger.award_event(recipient_qualification_id, status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_award_source
  ON ledger.award_event(source_event_id);

CREATE TRIGGER trg_award_append_only_delete
BEFORE DELETE ON ledger.award_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE TABLE IF NOT EXISTS ledger.pool_snapshot (
  pool_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_code text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  pool_available numeric(20,6) NOT NULL,
  total_theory numeric(20,6) NOT NULL,
  k_factor numeric(20,10) NOT NULL,
  rule_version_id uuid REFERENCES rules.rule_version(rule_version_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(pool_code, period_start, period_end, rule_version_id),
  CHECK (period_end > period_start),
  CHECK (k_factor >= 0 AND k_factor <= 1)
);

CREATE TABLE IF NOT EXISTS ledger.settlement_batch (
  settlement_batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL UNIQUE,
  settlement_type text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  rule_version_id uuid REFERENCES rules.rule_version(rule_version_id),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CALCULATED','APPROVED','CLOSED','VOIDED')),
  calculation_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  closed_at timestamptz,
  CHECK (period_end > period_start)
);

ALTER TABLE ledger.award_event
  DROP CONSTRAINT IF EXISTS fk_award_settlement;
ALTER TABLE ledger.award_event
  ADD CONSTRAINT fk_award_settlement
  FOREIGN KEY (settlement_batch_id)
  REFERENCES ledger.settlement_batch(settlement_batch_id);

CREATE OR REPLACE FUNCTION ledger.fn_compute_k_factor(
  p_pool_available numeric,
  p_total_theory numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN coalesce(p_total_theory,0) <= 0 THEN 1
  ELSE LEAST(1::numeric, p_pool_available / p_total_theory)
END;
$$;

CREATE OR REPLACE FUNCTION ledger.fn_rpv_depth(
  p_effective_direct_count integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN p_effective_direct_count <= 0 THEN 5
  WHEN p_effective_direct_count = 1 THEN 8
  ELSE 12
END;
$$;

CREATE OR REPLACE PROCEDURE ledger.sp_reverse_pv_event(
  p_original_event_id uuid,
  p_actor_id uuid,
  p_reason_code text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v ledger.pv_ledger%ROWTYPE;
BEGIN
  SELECT * INTO v FROM ledger.pv_ledger WHERE pv_event_id = p_original_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PV event not found'; END IF;

  IF EXISTS (SELECT 1 FROM ledger.pv_ledger WHERE reversal_of_event_id = p_original_event_id) THEN
    RAISE EXCEPTION 'PV event already reversed';
  END IF;

  INSERT INTO ledger.pv_ledger(
    qualification_id,pv_type,event_type,amount,source_type,source_id,source_line_id,
    occurred_at,rule_version_id,parameter_snapshot_hash,active_snapshot,
    effective_direct_count_snapshot,correlation_id,causation_id,reversal_of_event_id,payload_hash
  )
  VALUES(
    v.qualification_id,v.pv_type,'REVERSAL',-v.amount,v.source_type,v.source_id,v.source_line_id,
    clock_timestamp(),v.rule_version_id,v.parameter_snapshot_hash,v.active_snapshot,
    v.effective_direct_count_snapshot,v.correlation_id,p_original_event_id,p_original_event_id,
    public.sha256_text(p_original_event_id::text || ':' || p_reason_code || ':' || clock_timestamp()::text)
  );

  PERFORM audit.fn_write_audit_event(
    'USER',p_actor_id,'PV_REVERSED','ledger.pv_ledger',p_original_event_id,
    to_jsonb(v),NULL,p_reason_code,NULL,v.correlation_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 14. MONTHLY REPURCHASE RECOGNITION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE subscription.sp_recognize_monthly_rpv(
  p_recognition_schedule_id uuid,
  p_actor_type public.actor_type DEFAULT 'JOB',
  p_actor_id uuid DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sched subscription.monthly_recognition_schedule%ROWTYPE;
  v_sub subscription.subscription%ROWTYPE;
  v_event_id uuid := gen_random_uuid();
  v_at timestamptz := clock_timestamp();
  v_active boolean;
  v_direct_count integer;
BEGIN
  SELECT * INTO v_sched
  FROM subscription.monthly_recognition_schedule
  WHERE recognition_schedule_id = p_recognition_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Recognition schedule not found'; END IF;
  IF v_sched.status = 'RECOGNIZED' THEN RETURN; END IF;
  IF v_sched.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Recognition schedule status is %, expected PENDING', v_sched.status;
  END IF;

  SELECT * INTO v_sub
  FROM subscription.subscription
  WHERE subscription_id = v_sched.subscription_id;

  v_active := membership.fn_is_active_at(v_sub.qualification_id, v_at);
  v_direct_count := organization.fn_effective_direct_count_at(v_sub.qualification_id, v_at);

  INSERT INTO ledger.pv_ledger(
    pv_event_id, qualification_id, pv_type, event_type, amount, source_type, source_id,
    occurred_at, active_snapshot, effective_direct_count_snapshot, payload_hash
  )
  VALUES(
    v_event_id, v_sub.qualification_id, 'RPV', 'MONTHLY_RECOGNITION',
    v_sched.rpv_amount, 'SUBSCRIPTION_RECOGNITION', p_recognition_schedule_id,
    v_at, v_active, v_direct_count,
    public.sha256_text(v_sub.subscription_id::text || ':' || v_sched.installment_no::text || ':' || v_sched.rpv_amount::text)
  );

  UPDATE subscription.monthly_recognition_schedule
  SET status='RECOGNIZED', recognized_event_id=v_event_id
  WHERE recognition_schedule_id=p_recognition_schedule_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 15. ATTRIBUTION / REFERRAL
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attribution.referral_code (
  referral_code_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  referral_code text NOT NULL UNIQUE,
  status public.record_status NOT NULL DEFAULT 'EFFECTIVE',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS attribution.referral_link (
  referral_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  token_hash text NOT NULL UNIQUE,
  campaign_id text,
  asset_id text,
  channel_code text,
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  status public.record_status NOT NULL DEFAULT 'EFFECTIVE',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS attribution.referral_session (
  referral_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id uuid NOT NULL REFERENCES attribution.referral_link(referral_link_id),
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  anonymous_visitor_id_hash text,
  landing_path text,
  user_agent text,
  ip_hash text
);

CREATE TABLE IF NOT EXISTS attribution.attribution_event (
  attribution_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_session_id uuid REFERENCES attribution.referral_session(referral_session_id),
  qualification_id uuid REFERENCES membership.qualification(qualification_id),
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  campaign_id text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE TRIGGER trg_attribution_append_only
BEFORE UPDATE OR DELETE ON attribution.attribution_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE TABLE IF NOT EXISTS attribution.lead (
  lead_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_session_id uuid REFERENCES attribution.referral_session(referral_session_id),
  source_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  lead_status text NOT NULL DEFAULT 'NEW',
  contact_name text,
  mobile_ciphertext bytea,
  mobile_hash text,
  email text,
  consent_id uuid REFERENCES identity.consent_record(consent_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  converted_person_id uuid REFERENCES identity.person(person_id),
  converted_qualification_id uuid REFERENCES membership.qualification(qualification_id)
);

CREATE TABLE IF NOT EXISTS attribution.referral_lock (
  referral_lock_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_qualification_id uuid NOT NULL UNIQUE REFERENCES membership.qualification(qualification_id),
  sponsor_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  source_referral_link_id uuid REFERENCES attribution.referral_link(referral_link_id),
  locked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  locked_by uuid,
  source_application_id uuid,
  lock_reason text NOT NULL DEFAULT 'FORMAL_SPONSOR_APPROVED'
);

CREATE TABLE IF NOT EXISTS attribution.referral_dispute (
  referral_dispute_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  claimed_sponsor_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  current_sponsor_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  status public.record_status NOT NULL DEFAULT 'PENDING',
  reason_text text,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  opened_by uuid,
  resolved_at timestamptz,
  resolved_by uuid
);

-- -----------------------------------------------------------------------------
-- 16. INTEGRATION / OUTBOX / INBOX
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration.external_system (
  external_system_code text PRIMARY KEY,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO integration.external_system(external_system_code, display_name)
VALUES
  ('MANUAL','Pre-ERP Manual Operations'),
  ('D365_BC','Microsoft Dynamics 365 Business Central'),
  ('LINE','LINE OA/LIFF'),
  ('PAYMENT','Payment Gateway'),
  ('LOGISTICS','Logistics Provider')
ON CONFLICT (external_system_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS integration.external_reference (
  external_reference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_system_code text NOT NULL REFERENCES integration.external_system(external_system_code),
  entity_type text NOT NULL,
  internal_entity_id uuid NOT NULL,
  external_entity_id text,
  external_document_no text,
  version_etag text,
  sync_status text NOT NULL DEFAULT 'PENDING',
  last_synced_at timestamptz,
  UNIQUE(external_system_code, entity_type, internal_entity_id)
);

CREATE TABLE IF NOT EXISTS integration.outbox_event (
  outbox_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS ix_outbox_unpublished
  ON integration.outbox_event(occurred_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS integration.inbox_event (
  inbox_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_system_code text NOT NULL REFERENCES integration.external_system(external_system_code),
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz,
  process_status text NOT NULL DEFAULT 'RECEIVED',
  last_error text,
  UNIQUE(external_system_code, external_event_id)
);

CREATE TRIGGER trg_outbox_no_delete
BEFORE DELETE ON integration.outbox_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

CREATE TRIGGER trg_inbox_no_delete
BEFORE DELETE ON integration.inbox_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_physical_delete();

-- -----------------------------------------------------------------------------
-- 17. PRE-ERP OPERATION PROCEDURES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE commerce.sp_confirm_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_no text,
  p_occurred_at timestamptz,
  p_actor_id uuid,
  p_correlation_id uuid DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_order commerce."order"%ROWTYPE;
  v_event_id uuid := gen_random_uuid();
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
BEGIN
  SELECT * INTO v_order FROM commerce."order" WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status IN ('VOIDED','RETURNED') THEN
    RAISE EXCEPTION 'Cannot pay order in status %', v_order.status;
  END IF;

  INSERT INTO commerce.payment_event(
    payment_event_id,order_id,event_type,amount,payment_method,reference_no,
    occurred_at,actor_type,actor_id,source_system,correlation_id
  )
  VALUES(
    v_event_id,p_order_id,'PAYMENT_CONFIRMED',p_amount,p_payment_method,p_reference_no,
    p_occurred_at,'USER',p_actor_id,'MANUAL',v_corr
  );

  UPDATE commerce."order"
  SET status='PAID', paid_at=p_occurred_at, updated_by=p_actor_id
  WHERE order_id=p_order_id;

  INSERT INTO integration.outbox_event(
    aggregate_type,aggregate_id,event_type,payload,correlation_id
  )
  VALUES(
    'ORDER',p_order_id,'SALE_CONFIRMED',
    jsonb_build_object(
      'order_id',p_order_id,
      'qualification_id',v_order.qualification_id,
      'payment_event_id',v_event_id,
      'amount',p_amount,
      'occurred_at',p_occurred_at
    ),
    v_corr
  );

  PERFORM audit.fn_write_audit_event(
    'USER',p_actor_id,'PAYMENT_CONFIRMED','commerce.order',p_order_id,
    to_jsonb(v_order),
    (SELECT to_jsonb(o) FROM commerce."order" o WHERE o.order_id=p_order_id),
    'MANUAL_CONFIRM',NULL,v_corr
  );
END;
$$;

CREATE OR REPLACE PROCEDURE commerce.sp_confirm_fulfillment(
  p_order_id uuid,
  p_carrier text,
  p_tracking_no text,
  p_occurred_at timestamptz,
  p_actor_id uuid,
  p_correlation_id uuid DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_order commerce."order"%ROWTYPE;
  v_event_id uuid := gen_random_uuid();
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
BEGIN
  SELECT * INTO v_order FROM commerce."order" WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status NOT IN ('PAID','FULFILLED') THEN
    RAISE EXCEPTION 'Order must be PAID before fulfillment. Current=%', v_order.status;
  END IF;

  INSERT INTO commerce.fulfillment_event(
    fulfillment_event_id,order_id,event_type,carrier,tracking_no,occurred_at,
    actor_type,actor_id,source_system,correlation_id
  )
  VALUES(
    v_event_id,p_order_id,'FULFILLMENT_CONFIRMED',p_carrier,p_tracking_no,p_occurred_at,
    'USER',p_actor_id,'MANUAL',v_corr
  );

  UPDATE commerce."order"
  SET status='FULFILLED', fulfilled_at=p_occurred_at, updated_by=p_actor_id
  WHERE order_id=p_order_id;

  INSERT INTO integration.outbox_event(
    aggregate_type,aggregate_id,event_type,payload,correlation_id
  )
  VALUES(
    'ORDER',p_order_id,'FULFILLMENT_CONFIRMED',
    jsonb_build_object(
      'order_id',p_order_id,
      'fulfillment_event_id',v_event_id,
      'carrier',p_carrier,
      'tracking_no',p_tracking_no
    ),
    v_corr
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 18. VIEWS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW reporting.v_person_qualifications AS
SELECT
  p.person_id,
  p.person_no,
  p.legal_name,
  q.qualification_id,
  q.qualification_no,
  q.plan_level_code,
  pl.display_name AS plan_level_name,
  q.status AS qualification_status,
  q.active_flag,
  q.effective_at
FROM identity.person p
JOIN membership.qualification q ON q.current_holder_person_id = p.person_id
JOIN membership.plan_level pl ON pl.plan_level_code = q.plan_level_code;

CREATE OR REPLACE VIEW reporting.v_current_sponsor_tree AS
SELECT
  sr.child_qualification_id,
  sr.sponsor_qualification_id,
  sr.sponsor_sequence_no,
  sr.effective_from
FROM organization.sponsor_relationship sr
WHERE sr.effective_to IS NULL;

CREATE OR REPLACE VIEW reporting.v_current_binary_tree AS
SELECT
  bp.qualification_id,
  bp.parent_qualification_id,
  bp.side,
  bp.effective_from
FROM organization.binary_placement bp
WHERE bp.effective_to IS NULL;

CREATE OR REPLACE VIEW reporting.v_pv_balance AS
SELECT
  qualification_id,
  pv_type,
  sum(amount) AS balance
FROM ledger.pv_ledger
GROUP BY qualification_id, pv_type;

CREATE OR REPLACE VIEW reporting.v_award_summary AS
SELECT
  recipient_qualification_id,
  award_type,
  status,
  sum(payable_amount) AS payable_amount,
  count(*) AS event_count
FROM ledger.award_event
GROUP BY recipient_qualification_id, award_type, status;

CREATE OR REPLACE VIEW reporting.v_order_status AS
SELECT
  o.order_id,
  o.order_no,
  o.person_id,
  o.qualification_id,
  o.status,
  o.net_amount,
  o.paid_at,
  o.fulfilled_at,
  o.external_system_code,
  o.external_order_no,
  max(pe.occurred_at) FILTER (WHERE pe.event_type='PAYMENT_CONFIRMED') AS last_payment_confirmed_at,
  max(fe.occurred_at) FILTER (WHERE fe.event_type='FULFILLMENT_CONFIRMED') AS last_fulfilled_at
FROM commerce."order" o
LEFT JOIN commerce.payment_event pe ON pe.order_id=o.order_id
LEFT JOIN commerce.fulfillment_event fe ON fe.order_id=o.order_id
GROUP BY o.order_id;

CREATE OR REPLACE VIEW reporting.v_referral_performance AS
SELECT
  rl.qualification_id,
  count(DISTINCT rs.referral_session_id) AS sessions,
  count(DISTINCT l.lead_id) AS leads,
  count(DISTINCT l.converted_qualification_id) FILTER (WHERE l.converted_qualification_id IS NOT NULL) AS converted_qualifications
FROM attribution.referral_link rl
LEFT JOIN attribution.referral_session rs ON rs.referral_link_id=rl.referral_link_id
LEFT JOIN attribution.lead l ON l.referral_session_id=rs.referral_session_id
GROUP BY rl.qualification_id;

CREATE OR REPLACE VIEW reporting.v_subscription_schedule AS
SELECT
  s.subscription_id,
  s.qualification_id,
  s.subscription_plan_code,
  s.status AS subscription_status,
  m.installment_no,
  m.due_date,
  m.recognized_amount,
  m.rpv_amount,
  m.status AS recognition_status,
  m.recognized_event_id
FROM subscription.subscription s
JOIN subscription.monthly_recognition_schedule m ON m.subscription_id=s.subscription_id;

-- -----------------------------------------------------------------------------
-- 19. Helpful functions for current rule matrices
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rules.fn_referral_rate_by_plan(p_plan_level_code text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE p_plan_level_code
  WHEN 'STARTER' THEN 0.15
  WHEN 'ELITE' THEN 0.20
  WHEN 'LEADER' THEN 0.25
  ELSE 0
END;
$$;

CREATE OR REPLACE FUNCTION rules.fn_matching_rate_by_generation(p_generation integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE p_generation
  WHEN 1 THEN 0.15
  WHEN 2 THEN 0.10
  WHEN 3 THEN 0.05
  WHEN 4 THEN 0.05
  WHEN 5 THEN 0.05
  ELSE 0
END;
$$;

CREATE OR REPLACE FUNCTION rules.fn_matching_unlock_depth(p_effective_direct_count integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN p_effective_direct_count <= 0 THEN 0
  WHEN p_effective_direct_count = 1 THEN 2
  WHEN p_effective_direct_count = 2 THEN 3
  WHEN p_effective_direct_count = 3 THEN 4
  ELSE 5
END;
$$;

CREATE OR REPLACE FUNCTION rules.fn_equalization_rate(
  p_plan_level_code text,
  p_generation integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE p_plan_level_code
  WHEN 'STARTER' THEN CASE p_generation WHEN 2 THEN 0.10 WHEN 3 THEN 0.10 WHEN 4 THEN 0.10 ELSE 0 END
  WHEN 'ELITE' THEN CASE p_generation WHEN 2 THEN 0.20 WHEN 3 THEN 0.10 WHEN 4 THEN 0.10 WHEN 5 THEN 0.05 WHEN 6 THEN 0.05 ELSE 0 END
  WHEN 'LEADER' THEN CASE p_generation WHEN 2 THEN 0.20 WHEN 3 THEN 0.15 WHEN 4 THEN 0.10 WHEN 5 THEN 0.10 WHEN 6 THEN 0.10 WHEN 7 THEN 0.05 ELSE 0 END
  ELSE 0
END;
$$;

CREATE OR REPLACE FUNCTION rules.fn_equalization_unlock_depth(
  p_plan_level_code text,
  p_effective_direct_count integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE p_plan_level_code
  WHEN 'STARTER' THEN CASE WHEN p_effective_direct_count >= 2 THEN 4 WHEN p_effective_direct_count >= 1 THEN 3 ELSE 0 END
  WHEN 'ELITE' THEN CASE WHEN p_effective_direct_count >= 4 THEN 6 WHEN p_effective_direct_count = 3 THEN 5 WHEN p_effective_direct_count = 2 THEN 4 WHEN p_effective_direct_count = 1 THEN 3 ELSE 0 END
  WHEN 'LEADER' THEN CASE WHEN p_effective_direct_count >= 4 THEN 7 WHEN p_effective_direct_count = 3 THEN 5 WHEN p_effective_direct_count = 2 THEN 4 WHEN p_effective_direct_count = 1 THEN 3 ELSE 0 END
  ELSE 0
END;
$$;

CREATE OR REPLACE FUNCTION rules.fn_binary_weekly_cap(p_plan_level_code text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE p_plan_level_code
  WHEN 'STARTER' THEN 450000
  WHEN 'ELITE' THEN 900000
  WHEN 'LEADER' THEN 1500000
  ELSE 0
END;
$$;

-- -----------------------------------------------------------------------------
-- 20. Trigger to validate sponsor 1st/3rd direct-left rule at placement time
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION organization.fn_validate_first_third_left_rule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sponsor uuid;
  v_seq integer;
  v_requires_left boolean;
  v_ok boolean;
BEGIN
  SELECT sponsor_qualification_id, sponsor_sequence_no
  INTO v_sponsor, v_seq
  FROM organization.sponsor_relationship
  WHERE child_qualification_id = NEW.qualification_id
    AND effective_to IS NULL
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_sponsor IS NULL THEN
    RETURN NEW;
  END IF;

  v_requires_left := v_seq IN (1,3);

  IF v_requires_left THEN
    -- Candidate is valid if its parent is sponsor's LEFT child or anywhere below it.
    IF NEW.parent_qualification_id = v_sponsor AND NEW.side = 'LEFT' THEN
      v_ok := true;
    ELSE
      v_ok := organization.fn_is_in_binary_subtree(v_sponsor, NEW.parent_qualification_id, 'LEFT');
    END IF;

    IF NOT coalesce(v_ok,false) THEN
      RAISE EXCEPTION 'BINARY_LEFT_SUBTREE_REQUIRED: sponsor sequence % must be placed in sponsor left subtree', v_seq
        USING ERRCODE='23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_binary_first_third_left ON organization.binary_placement;
CREATE TRIGGER trg_binary_first_third_left
BEFORE INSERT ON organization.binary_placement
FOR EACH ROW EXECUTE FUNCTION organization.fn_validate_first_third_left_rule();

-- -----------------------------------------------------------------------------
-- 21. Trigger to prohibit direct mutation of locked sponsor relationship
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION organization.fn_guard_sponsor_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.effective_to IS NULL AND
     (NEW.sponsor_qualification_id IS DISTINCT FROM OLD.sponsor_qualification_id
      OR NEW.sponsor_sequence_no IS DISTINCT FROM OLD.sponsor_sequence_no) THEN
    RAISE EXCEPTION 'Current sponsor relationship cannot be directly overwritten. Use supervised supersede procedure.'
      USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsor_update_guard ON organization.sponsor_relationship;
CREATE TRIGGER trg_sponsor_update_guard
BEFORE UPDATE ON organization.sponsor_relationship
FOR EACH ROW EXECUTE FUNCTION organization.fn_guard_sponsor_update();

-- -----------------------------------------------------------------------------
-- 22. Supervised relationship supersede procedure
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE organization.sp_supersede_sponsor(
  p_child_qualification_id uuid,
  p_new_sponsor_qualification_id uuid,
  p_new_sequence_no integer,
  p_effective_at timestamptz,
  p_change_request_id uuid,
  p_actor_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_old organization.sponsor_relationship%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.change_request
    WHERE change_request_id=p_change_request_id
      AND status='APPROVED'
  ) THEN
    RAISE EXCEPTION 'Approved change request required.';
  END IF;

  SELECT * INTO v_old
  FROM organization.sponsor_relationship
  WHERE child_qualification_id=p_child_qualification_id
    AND effective_to IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE organization.sponsor_relationship
    SET effective_to=p_effective_at
    WHERE sponsor_relationship_id=v_old.sponsor_relationship_id;
  END IF;

  INSERT INTO organization.sponsor_relationship(
    sponsor_relationship_id,child_qualification_id,sponsor_qualification_id,
    sponsor_sequence_no,effective_from,source_event_id,created_by
  )
  VALUES(
    v_new_id,p_child_qualification_id,p_new_sponsor_qualification_id,
    p_new_sequence_no,p_effective_at,p_change_request_id,p_actor_id
  );

  PERFORM audit.fn_write_audit_event(
    'USER',p_actor_id,'SPONSOR_SUPERSEDED','organization.sponsor_relationship',v_new_id,
    CASE WHEN v_old.sponsor_relationship_id IS NULL THEN NULL ELSE to_jsonb(v_old) END,
    (SELECT to_jsonb(x) FROM organization.sponsor_relationship x WHERE x.sponsor_relationship_id=v_new_id),
    'APPROVED_CORRECTION',NULL,p_change_request_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 23. Optional data integrity view
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW reporting.v_data_integrity_alerts AS
SELECT
  'QUALIFICATION_WITHOUT_CURRENT_HOLDER_HISTORY' AS alert_type,
  q.qualification_id::text AS entity_id,
  'Qualification has no current holder history' AS detail
FROM membership.qualification q
LEFT JOIN membership.qualification_holder_history h
  ON h.qualification_id=q.qualification_id AND h.valid_to IS NULL
WHERE h.holder_history_id IS NULL

UNION ALL

SELECT
  'EFFECTIVE_QUALIFICATION_WITHOUT_SPONSOR',
  q.qualification_id::text,
  'Effective qualification has no current sponsor'
FROM membership.qualification q
LEFT JOIN organization.sponsor_relationship s
  ON s.child_qualification_id=q.qualification_id AND s.effective_to IS NULL
WHERE q.status='EFFECTIVE'
  AND s.sponsor_relationship_id IS NULL

UNION ALL

SELECT
  'PAID_ORDER_WITHOUT_PAYMENT_EVENT',
  o.order_id::text,
  'Order status is PAID but no payment confirmation event exists'
FROM commerce."order" o
LEFT JOIN commerce.payment_event pe
  ON pe.order_id=o.order_id AND pe.event_type='PAYMENT_CONFIRMED'
WHERE o.status IN ('PAID','FULFILLED')
GROUP BY o.order_id
HAVING count(pe.payment_event_id)=0;

-- -----------------------------------------------------------------------------
-- 24. Security notes / grants placeholders
-- -----------------------------------------------------------------------------
-- Create separate roles outside this migration in deployment:
--   ucell_app_rw, ucell_app_ro, ucell_admin_migration, ucell_reporting_ro
-- Recommended:
--   REVOKE DELETE ON ALL TABLES IN SCHEMA ledger, audit, organization, attribution FROM ucell_app_rw;
--   GRANT SELECT, INSERT ON append-only event tables only;
--   Permit UPDATE only on mutable current-state tables and via procedures where possible.

-- -----------------------------------------------------------------------------
-- 25. Comments for architectural boundary
-- -----------------------------------------------------------------------------
COMMENT ON SCHEMA commerce IS
'Pre-ERP commerce bridge only. Do not evolve into WMS/procurement/AR/AP/GL.';
COMMENT ON TABLE commerce.lot_trace IS
'Lightweight outbound trace only. ERP/WMS becomes SoR after D365 BC introduction.';
COMMENT ON TABLE ledger.pv_ledger IS
'Append-only institutional value ledger for GPV/PV/RPV/EPV.';
COMMENT ON TABLE ledger.award_event IS
'Award lifecycle/event table. Source facts must remain traceable.';
COMMENT ON TABLE rules.parameter_value IS
'Versioned parameter value. Published data must not be mutated.';


-- =============================================================================
-- 26. Exhaustive database object descriptions (Data Dictionary embedded in DB)
--     Every core schema/table/column/view/function/procedure/trigger/index is
--     documented so tools such as pgAdmin/DBeaver can display the description.
-- =============================================================================

COMMENT ON SCHEMA identity IS '自然人身分、KYC、聯絡、銀行與同意紀錄。此Schema不承擔組織樹或獎金計算責任。';
COMMENT ON SCHEMA membership IS '會員資格／球（Qualification）、持有人歷史、資格狀態與Active期間。';
COMMENT ON SCHEMA organization IS 'Sponsor Tree、Binary Tree與其時間版本、序號、安置與組織查詢函數。';
COMMENT ON SCHEMA rules IS '制度版本、規則群組、階層式參數、Decision Table與發布治理。';
COMMENT ON SCHEMA commerce IS 'Pre-ERP會員交易橋接：商品Reference、會員訂單、付款/出貨/退貨事件與必要批號序號追溯；不作完整ERP/WMS。';
COMMENT ON SCHEMA subscription IS '重銷訂閱方案、月度認列排程與逐月RPV認列。';
COMMENT ON SCHEMA ledger IS 'GPV/PV/RPV/EPV不可變帳本、獎金事件、結算批次與獎池快照。';
COMMENT ON SCHEMA attribution IS '推薦碼、分享連結、Referral Session、Touchpoint、Lead、正式推薦鎖定與爭議。';
COMMENT ON SCHEMA audit IS 'Maker-Checker變更申請、核准紀錄及全系統稽核軌跡。';
COMMENT ON SCHEMA integration IS '外部系統Reference、Transactional Outbox/Inbox與未來D365 BC/LINE/金流/物流整合。';
COMMENT ON SCHEMA reporting IS '只讀查詢、營運投影與資料完整性檢查檢視表。';

COMMENT ON TABLE audit.change_request IS '高風險資料或制度異動的變更申請主檔；保存原因、申請內容、核准及執行時間，支援Maker-Checker。';
COMMENT ON COLUMN audit.change_request."change_request_id" IS 'change request之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.change_request."entity_type" IS 'entity type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.change_request."entity_id" IS 'entity之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.change_request."change_type" IS 'change type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.change_request."reason_code" IS 'reason的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN audit.change_request."reason_text" IS '人可讀說明文字，用於補充業務語意或稽核原因。';
COMMENT ON COLUMN audit.change_request."requested_payload" IS 'requested payload欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.change_request."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN audit.change_request."requested_by" IS 'requested by欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.change_request."requested_at" IS 'requested發生或記錄時間。';
COMMENT ON COLUMN audit.change_request."approved_by" IS '核准人識別碼。';
COMMENT ON COLUMN audit.change_request."approved_at" IS '核准時間。';
COMMENT ON COLUMN audit.change_request."executed_at" IS 'executed發生或記錄時間。';
COMMENT ON COLUMN audit.change_request."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';

COMMENT ON TABLE audit.approval_record IS '變更申請各核准階段之決策紀錄；一筆Change Request可有多筆Approval。';
COMMENT ON COLUMN audit.approval_record."approval_id" IS 'approval之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.approval_record."change_request_id" IS 'change request之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.approval_record."approval_stage" IS 'approval stage欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.approval_record."decision" IS 'decision欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.approval_record."decided_by" IS 'decided by欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.approval_record."decided_at" IS 'decided發生或記錄時間。';
COMMENT ON COLUMN audit.approval_record."note" IS '人可讀說明文字，用於補充業務語意或稽核原因。';

COMMENT ON TABLE audit.audit_event IS '跨Domain稽核事件；回答誰在何時對何資料做何操作及前後差異。與Domain Event分工，不作業務餘額真相。';
COMMENT ON COLUMN audit.audit_event."audit_event_id" IS 'audit event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.audit_event."actor_type" IS 'actor type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.audit_event."actor_id" IS 'actor之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.audit_event."action_code" IS 'action的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN audit.audit_event."entity_type" IS 'entity type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.audit_event."entity_id" IS 'entity之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.audit_event."before_snapshot" IS 'before在事件當下的快照，避免使用今日值回算歷史。';
COMMENT ON COLUMN audit.audit_event."after_snapshot" IS 'after在事件當下的快照，避免使用今日值回算歷史。';
COMMENT ON COLUMN audit.audit_event."reason_code" IS 'reason的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN audit.audit_event."reason_text" IS '人可讀說明文字，用於補充業務語意或稽核原因。';
COMMENT ON COLUMN audit.audit_event."request_id" IS 'request之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.audit_event."trace_id" IS 'trace之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN audit.audit_event."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';
COMMENT ON COLUMN audit.audit_event."ip_address" IS 'ip address欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN audit.audit_event."user_agent" IS 'user agent業務資訊；敏感資訊需遵守資料最小化與存取控制。';
COMMENT ON COLUMN audit.audit_event."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';

COMMENT ON TABLE identity.person IS '自然人主檔。Person與Qualification分離；一個自然人可持有多個Qualification。';
COMMENT ON COLUMN identity.person."person_id" IS '自然人唯一識別碼。';
COMMENT ON COLUMN identity.person."person_no" IS 'person的人可讀/流水編號。';
COMMENT ON COLUMN identity.person."legal_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN identity.person."preferred_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN identity.person."national_id_hash" IS '身分證/識別號不可逆Hash，用於唯一性/查找。';
COMMENT ON COLUMN identity.person."national_id_ciphertext" IS '身分證/識別號加密密文，僅授權流程可解密。';
COMMENT ON COLUMN identity.person."birth_date" IS 'birth日期。';
COMMENT ON COLUMN identity.person."adulthood_verified" IS 'adulthood verified欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN identity.person."mobile" IS 'mobile業務資訊；敏感資訊需遵守資料最小化與存取控制。';
COMMENT ON COLUMN identity.person."email" IS 'email業務資訊；敏感資訊需遵守資料最小化與存取控制。';
COMMENT ON COLUMN identity.person."line_user_id_hash" IS 'LINE User ID Hash，用於比對。';
COMMENT ON COLUMN identity.person."line_user_id_ciphertext" IS 'LINE User ID加密密文。';
COMMENT ON COLUMN identity.person."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN identity.person."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN identity.person."created_by" IS '建立此資料之使用者/系統Actor識別碼。';
COMMENT ON COLUMN identity.person."updated_at" IS '可變投影/主檔最後更新時間。';
COMMENT ON COLUMN identity.person."updated_by" IS '最後更新此可變資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE identity.person_bank_profile IS '自然人的銀行帳戶版本紀錄；帳號以Hash供比對、Ciphertext供授權使用。';
COMMENT ON COLUMN identity.person_bank_profile."bank_profile_id" IS 'bank profile之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN identity.person_bank_profile."person_id" IS '自然人唯一識別碼。';
COMMENT ON COLUMN identity.person_bank_profile."bank_code" IS 'bank的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN identity.person_bank_profile."branch_code" IS 'branch的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN identity.person_bank_profile."account_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN identity.person_bank_profile."account_no_hash" IS '銀行帳號Hash，用於比對與唯一性控制。';
COMMENT ON COLUMN identity.person_bank_profile."account_no_ciphertext" IS '銀行帳號加密密文。';
COMMENT ON COLUMN identity.person_bank_profile."is_primary" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';
COMMENT ON COLUMN identity.person_bank_profile."valid_from" IS 'valid from欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN identity.person_bank_profile."valid_to" IS 'valid to欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN identity.person_bank_profile."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN identity.person_bank_profile."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE identity.consent_record IS '個資、行銷、電子契約等同意之版本化證據。';
COMMENT ON COLUMN identity.consent_record."consent_id" IS 'consent之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN identity.consent_record."person_id" IS '自然人唯一識別碼。';
COMMENT ON COLUMN identity.consent_record."consent_type" IS 'consent type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN identity.consent_record."consent_version" IS 'consent version欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN identity.consent_record."consented" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';
COMMENT ON COLUMN identity.consent_record."consented_at" IS 'consented發生或記錄時間。';
COMMENT ON COLUMN identity.consent_record."source_channel" IS 'source channel欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN identity.consent_record."ip_address" IS 'ip address欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN identity.consent_record."evidence" IS 'evidence欄位；資料型別與限制請以SQL Definition為準。';

COMMENT ON TABLE membership.plan_level IS '會員商品方案／制度級別代碼表；目前含啟航、菁英、領袖。';
COMMENT ON COLUMN membership.plan_level."plan_level_code" IS '商品方案／制度級別代碼。';
COMMENT ON COLUMN membership.plan_level."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN membership.plan_level."sort_order" IS 'sort order欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN membership.plan_level."active" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';

COMMENT ON TABLE membership.qualification IS '會員資格／球主檔；UCell組織、Active、PV、重銷、獎金及分享的主要Aggregate Root。';
COMMENT ON COLUMN membership.qualification."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN membership.qualification."qualification_no" IS 'qualification的人可讀/流水編號。';
COMMENT ON COLUMN membership.qualification."current_holder_person_id" IS '目前持有此Qualification的Person。';
COMMENT ON COLUMN membership.qualification."plan_level_code" IS '商品方案／制度級別代碼。';
COMMENT ON COLUMN membership.qualification."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN membership.qualification."active_flag" IS '便於即時查詢的目前Active投影值；歷史判斷仍以active_period為準。';
COMMENT ON COLUMN membership.qualification."effective_at" IS 'effective發生或記錄時間。';
COMMENT ON COLUMN membership.qualification."closed_at" IS 'closed發生或記錄時間。';
COMMENT ON COLUMN membership.qualification."source_application_id" IS 'source application之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN membership.qualification."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN membership.qualification."created_by" IS '建立此資料之使用者/系統Actor識別碼。';
COMMENT ON COLUMN membership.qualification."updated_at" IS '可變投影/主檔最後更新時間。';
COMMENT ON COLUMN membership.qualification."updated_by" IS '最後更新此可變資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE membership.qualification_holder_history IS 'Qualification持有人有效期間歷史；轉讓時更換Holder，不移動組織節點。';
COMMENT ON COLUMN membership.qualification_holder_history."holder_history_id" IS 'holder history之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN membership.qualification_holder_history."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN membership.qualification_holder_history."holder_person_id" IS '該有效期間內的Qualification持有人。';
COMMENT ON COLUMN membership.qualification_holder_history."valid_from" IS 'valid from欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN membership.qualification_holder_history."valid_to" IS 'valid to欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN membership.qualification_holder_history."source_case_id" IS 'source case之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN membership.qualification_holder_history."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN membership.qualification_holder_history."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE membership.qualification_status_history IS 'Qualification狀態時間軸；保存每次狀態的有效期間與原因。';
COMMENT ON COLUMN membership.qualification_status_history."status_history_id" IS 'status history之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN membership.qualification_status_history."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN membership.qualification_status_history."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN membership.qualification_status_history."effective_from" IS '此資料版本/關係/參數的有效起始時間。';
COMMENT ON COLUMN membership.qualification_status_history."effective_to" IS '有效結束時間；NULL表示目前有效。';
COMMENT ON COLUMN membership.qualification_status_history."source_event_id" IS '造成本資料/關係的來源事件ID。';
COMMENT ON COLUMN membership.qualification_status_history."reason_code" IS 'reason的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN membership.qualification_status_history."created_at" IS '資料列建立時間。';

COMMENT ON TABLE membership.active_period IS 'Qualification Active有效期間；用於事件時點Active First判斷。';
COMMENT ON COLUMN membership.active_period."active_period_id" IS 'active period之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN membership.active_period."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN membership.active_period."active_from" IS 'Active有效起始時間。';
COMMENT ON COLUMN membership.active_period."active_to" IS 'Active有效結束時間；NULL表示尚有效。';
COMMENT ON COLUMN membership.active_period."active_source" IS 'active source欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN membership.active_period."source_event_id" IS '造成本資料/關係的來源事件ID。';
COMMENT ON COLUMN membership.active_period."created_at" IS '資料列建立時間。';

COMMENT ON TABLE organization.sponsor_relationship IS 'Sponsor Tree推薦關係與永久Sponsor Sequence歷史。';
COMMENT ON COLUMN organization.sponsor_relationship."sponsor_relationship_id" IS 'sponsor relationship之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN organization.sponsor_relationship."child_qualification_id" IS 'Sponsor Tree上的被推薦Qualification。';
COMMENT ON COLUMN organization.sponsor_relationship."sponsor_qualification_id" IS 'Sponsor Tree上的推薦人Qualification。';
COMMENT ON COLUMN organization.sponsor_relationship."sponsor_sequence_no" IS '該Sponsor的永久直推序號；退出/退貨不重新編號。';
COMMENT ON COLUMN organization.sponsor_relationship."effective_from" IS '此資料版本/關係/參數的有效起始時間。';
COMMENT ON COLUMN organization.sponsor_relationship."effective_to" IS '有效結束時間；NULL表示目前有效。';
COMMENT ON COLUMN organization.sponsor_relationship."source_application_id" IS 'source application之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN organization.sponsor_relationship."source_event_id" IS '造成本資料/關係的來源事件ID。';
COMMENT ON COLUMN organization.sponsor_relationship."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN organization.sponsor_relationship."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE organization.binary_placement IS 'Binary Tree左右安置關係與有效期間歷史。';
COMMENT ON COLUMN organization.binary_placement."binary_placement_id" IS 'binary placement之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN organization.binary_placement."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN organization.binary_placement."parent_qualification_id" IS 'Binary Tree直接上層Qualification。';
COMMENT ON COLUMN organization.binary_placement."side" IS 'Binary安置方向：LEFT或RIGHT。';
COMMENT ON COLUMN organization.binary_placement."effective_from" IS '此資料版本/關係/參數的有效起始時間。';
COMMENT ON COLUMN organization.binary_placement."effective_to" IS '有效結束時間；NULL表示目前有效。';
COMMENT ON COLUMN organization.binary_placement."source_event_id" IS '造成本資料/關係的來源事件ID。';
COMMENT ON COLUMN organization.binary_placement."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN organization.binary_placement."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE rules.rule_set IS '制度規則集主檔，例如UCELL_R1_0B。';
COMMENT ON COLUMN rules.rule_set."rule_set_id" IS 'rule set之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.rule_set."rule_set_code" IS 'rule set的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN rules.rule_set."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN rules.rule_set."description" IS '人可讀說明文字，用於補充業務語意或稽核原因。';
COMMENT ON COLUMN rules.rule_set."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN rules.rule_set."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN rules.rule_set."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE rules.rule_group IS 'Rule Set內的階層式規則群組，可建立父子結構。';
COMMENT ON COLUMN rules.rule_group."rule_group_id" IS 'rule group之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.rule_group."rule_set_id" IS 'rule set之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.rule_group."parent_rule_group_id" IS 'parent rule group之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.rule_group."rule_group_code" IS 'rule group的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN rules.rule_group."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN rules.rule_group."sort_order" IS 'sort order欄位；資料型別與限制請以SQL Definition為準。';

COMMENT ON TABLE rules.rule_definition IS '一個具穩定Rule Code的規則定義；描述演算法能力與是否屬系統不變量。';
COMMENT ON COLUMN rules.rule_definition."rule_definition_id" IS 'rule definition之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.rule_definition."rule_group_id" IS 'rule group之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.rule_definition."rule_code" IS 'rule的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN rules.rule_definition."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN rules.rule_definition."algorithm_code" IS 'algorithm的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN rules.rule_definition."description" IS '人可讀說明文字，用於補充業務語意或稽核原因。';
COMMENT ON COLUMN rules.rule_definition."is_system_invariant" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';

COMMENT ON TABLE rules.rule_version IS 'Rule Set的版本與生效期間；Published版本不可直接改寫。';
COMMENT ON COLUMN rules.rule_version."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN rules.rule_version."rule_set_id" IS 'rule set之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.rule_version."version_code" IS 'version的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN rules.rule_version."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN rules.rule_version."effective_from" IS '此資料版本/關係/參數的有效起始時間。';
COMMENT ON COLUMN rules.rule_version."effective_to" IS '有效結束時間；NULL表示目前有效。';
COMMENT ON COLUMN rules.rule_version."approved_by" IS '核准人識別碼。';
COMMENT ON COLUMN rules.rule_version."approved_at" IS '核准時間。';
COMMENT ON COLUMN rules.rule_version."published_at" IS 'published發生或記錄時間。';
COMMENT ON COLUMN rules.rule_version."parameter_snapshot_hash" IS '已發布Rule Version所有參數的整體Hash。';
COMMENT ON COLUMN rules.rule_version."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN rules.rule_version."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE rules.parameter_definition IS '參數主檔；定義Parameter Code、資料型別、單位、驗證、Scope與是否可後台調整。';
COMMENT ON COLUMN rules.parameter_definition."parameter_definition_id" IS 'parameter definition之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.parameter_definition."parameter_code" IS '穩定且全系統唯一的參數代碼。';
COMMENT ON COLUMN rules.parameter_definition."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN rules.parameter_definition."data_type" IS '參數值資料型別。';
COMMENT ON COLUMN rules.parameter_definition."unit_code" IS '參數單位，例如PERCENT、NTD、PV、DAY、GENERATION。';
COMMENT ON COLUMN rules.parameter_definition."default_value" IS 'default value欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN rules.parameter_definition."validation_schema" IS '參數值合法範圍/格式驗證規則。';
COMMENT ON COLUMN rules.parameter_definition."allowed_scope_types" IS '允許此參數套用的Scope種類。';
COMMENT ON COLUMN rules.parameter_definition."runtime_editable" IS '是否允許透過受控後台修改，而不需程式部署。';
COMMENT ON COLUMN rules.parameter_definition."requires_approval" IS '修改此參數是否必須走核准流程。';
COMMENT ON COLUMN rules.parameter_definition."description" IS '人可讀說明文字，用於補充業務語意或稽核原因。';

COMMENT ON TABLE rules.parameter_set IS '一組在特定Rule Version、Scope與有效期間下的參數集合。';
COMMENT ON COLUMN rules.parameter_set."parameter_set_id" IS 'parameter set之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.parameter_set."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN rules.parameter_set."parameter_set_code" IS 'parameter set的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN rules.parameter_set."scope_type" IS '參數適用層級，例如RULE_SET、PLAN、SKU、CAMPAIGN。';
COMMENT ON COLUMN rules.parameter_set."scope_key" IS '該Scope的實際識別值；NULL可代表通用預設。';
COMMENT ON COLUMN rules.parameter_set."priority" IS '參數解析優先權；數字越高越優先。';
COMMENT ON COLUMN rules.parameter_set."effective_from" IS '此資料版本/關係/參數的有效起始時間。';
COMMENT ON COLUMN rules.parameter_set."effective_to" IS '有效結束時間；NULL表示目前有效。';
COMMENT ON COLUMN rules.parameter_set."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN rules.parameter_set."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN rules.parameter_set."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE rules.parameter_value IS 'Parameter Set內的實際值；Published規則版本下不可直接修改。';
COMMENT ON COLUMN rules.parameter_value."parameter_value_id" IS 'parameter value之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.parameter_value."parameter_set_id" IS 'parameter set之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.parameter_value."parameter_definition_id" IS 'parameter definition之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.parameter_value."value_json" IS '實際參數值，使用JSONB以支援多種資料型別。';
COMMENT ON COLUMN rules.parameter_value."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN rules.parameter_value."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE rules.decision_table IS '可資料化的條件矩陣主檔，例如有效直推數對應可領代數。';
COMMENT ON COLUMN rules.decision_table."decision_table_id" IS 'decision table之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.decision_table."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN rules.decision_table."table_code" IS 'table的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN rules.decision_table."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN rules.decision_table."description" IS '人可讀說明文字，用於補充業務語意或稽核原因。';
COMMENT ON COLUMN rules.decision_table."status" IS '該Entity目前的業務狀態。';

COMMENT ON TABLE rules.decision_row IS 'Decision Table條件列；conditions與result以JSONB保存可擴充條件。';
COMMENT ON COLUMN rules.decision_row."decision_row_id" IS 'decision row之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.decision_row."decision_table_id" IS 'decision table之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN rules.decision_row."sort_order" IS 'sort order欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN rules.decision_row."conditions" IS 'Decision Row的條件集合JSON。';
COMMENT ON COLUMN rules.decision_row."result" IS '符合條件後的結果JSON。';
COMMENT ON COLUMN rules.decision_row."effective_from" IS '此資料版本/關係/參數的有效起始時間。';
COMMENT ON COLUMN rules.decision_row."effective_to" IS '有效結束時間；NULL表示目前有效。';

COMMENT ON TABLE commerce.product_reference IS 'UCell內的輕量商品/SKU Reference。ERP導入後由ERP作商品主檔SoR，本表保存對照與會員顯示資訊。';
COMMENT ON COLUMN commerce.product_reference."product_id" IS 'product之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.product_reference."sku_code" IS 'sku的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN commerce.product_reference."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN commerce.product_reference."product_type" IS 'product type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.product_reference."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN commerce.product_reference."external_system_code" IS '外部系統代碼，Pre-ERP通常為MANUAL，未來可為D365_BC等。';
COMMENT ON COLUMN commerce.product_reference."external_item_id" IS 'external item之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.product_reference."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN commerce.product_reference."updated_at" IS '可變投影/主檔最後更新時間。';

COMMENT ON TABLE commerce.product_rule_profile IS '商品在特定Rule Version下的制度屬性，例如GPV/PV比率、RPV/EPV與獎金資格。';
COMMENT ON COLUMN commerce.product_rule_profile."product_rule_profile_id" IS 'product rule profile之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.product_rule_profile."product_id" IS 'product之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.product_rule_profile."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN commerce.product_rule_profile."gpv_rate" IS 'gpv rate欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.product_rule_profile."pv_rate" IS 'pv rate欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.product_rule_profile."rpv_eligible" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';
COMMENT ON COLUMN commerce.product_rule_profile."epv_eligible" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';
COMMENT ON COLUMN commerce.product_rule_profile."bonus_eligible" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';
COMMENT ON COLUMN commerce.product_rule_profile."effective_from" IS '此資料版本/關係/參數的有效起始時間。';
COMMENT ON COLUMN commerce.product_rule_profile."effective_to" IS '有效結束時間；NULL表示目前有效。';
COMMENT ON COLUMN commerce.product_rule_profile."config" IS 'config欄位；資料型別與限制請以SQL Definition為準。';

COMMENT ON TABLE commerce."order" IS '會員訂購Context主檔；保存Person、Qualification、推薦歸因、Rule Snapshot與Pre-ERP/ERP對照。';
COMMENT ON COLUMN commerce."order"."order_id" IS 'order之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce."order"."order_no" IS 'order的人可讀/流水編號。';
COMMENT ON COLUMN commerce."order"."person_id" IS '自然人唯一識別碼。';
COMMENT ON COLUMN commerce."order"."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN commerce."order"."source_referral_token" IS 'source referral token欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce."order"."source_qualification_id" IS 'source qualification之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce."order"."campaign_id" IS 'campaign之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce."order"."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN commerce."order"."parameter_snapshot_hash" IS '已發布Rule Version所有參數的整體Hash。';
COMMENT ON COLUMN commerce."order"."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN commerce."order"."currency_code" IS 'currency的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN commerce."order"."gross_amount" IS '訂單折扣前總額。';
COMMENT ON COLUMN commerce."order"."discount_amount" IS '訂單折扣總額。';
COMMENT ON COLUMN commerce."order"."net_amount" IS '訂單折扣後應付金額。';
COMMENT ON COLUMN commerce."order"."external_system_code" IS '外部系統代碼，Pre-ERP通常為MANUAL，未來可為D365_BC等。';
COMMENT ON COLUMN commerce."order"."external_order_id" IS 'external order之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce."order"."external_order_no" IS 'external order的人可讀/流水編號。';
COMMENT ON COLUMN commerce."order"."sync_status" IS '與外部系統同步狀態。';
COMMENT ON COLUMN commerce."order"."confirmed_at" IS 'confirmed發生或記錄時間。';
COMMENT ON COLUMN commerce."order"."paid_at" IS 'paid發生或記錄時間。';
COMMENT ON COLUMN commerce."order"."fulfilled_at" IS 'fulfilled發生或記錄時間。';
COMMENT ON COLUMN commerce."order"."voided_at" IS 'voided發生或記錄時間。';
COMMENT ON COLUMN commerce."order"."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN commerce."order"."created_by" IS '建立此資料之使用者/系統Actor識別碼。';
COMMENT ON COLUMN commerce."order"."updated_at" IS '可變投影/主檔最後更新時間。';
COMMENT ON COLUMN commerce."order"."updated_by" IS '最後更新此可變資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE commerce.order_line IS '訂單明細及交易當時商品、價格、GPV/PV與Rule Profile快照，避免未來主檔修改後回算錯誤。';
COMMENT ON COLUMN commerce.order_line."order_line_id" IS 'order line之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.order_line."order_id" IS 'order之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.order_line."line_no" IS 'line的人可讀/流水編號。';
COMMENT ON COLUMN commerce.order_line."product_id" IS 'product之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.order_line."sku_code_snapshot" IS 'sku code在事件當下的快照，避免使用今日值回算歷史。';
COMMENT ON COLUMN commerce.order_line."product_name_snapshot" IS 'product name在事件當下的快照，避免使用今日值回算歷史。';
COMMENT ON COLUMN commerce.order_line."quantity" IS '商品或事件數量。';
COMMENT ON COLUMN commerce.order_line."unit_price" IS '交易當時單價快照。';
COMMENT ON COLUMN commerce.order_line."line_amount" IS '該訂單明細金額。';
COMMENT ON COLUMN commerce.order_line."gpv_rate_snapshot" IS '交易當時GPV轉換比例快照。';
COMMENT ON COLUMN commerce.order_line."gpv_amount_snapshot" IS '交易當時由此明細產生的GPV快照。';
COMMENT ON COLUMN commerce.order_line."pv_rate_snapshot" IS '交易當時PV轉換比例快照。';
COMMENT ON COLUMN commerce.order_line."rule_profile_snapshot" IS '交易當時商品制度Profile快照。';

COMMENT ON TABLE commerce.payment_event IS '付款確認、付款反轉、退款確認等Append-only事件。';
COMMENT ON COLUMN commerce.payment_event."payment_event_id" IS 'payment event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.payment_event."order_id" IS 'order之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.payment_event."event_type" IS '事件類型代碼；描述本筆Append-only事件代表的業務事實。';
COMMENT ON COLUMN commerce.payment_event."amount" IS '本筆事件/帳本變動金額或數值。';
COMMENT ON COLUMN commerce.payment_event."payment_method" IS 'payment method欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.payment_event."reference_no" IS 'reference的人可讀/流水編號。';
COMMENT ON COLUMN commerce.payment_event."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';
COMMENT ON COLUMN commerce.payment_event."recorded_at" IS '事件實際寫入UCell系統的時間。';
COMMENT ON COLUMN commerce.payment_event."actor_type" IS 'actor type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.payment_event."actor_id" IS 'actor之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.payment_event."source_system" IS 'source system欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.payment_event."external_event_id" IS '外部系統事件唯一碼，用於Idempotency。';
COMMENT ON COLUMN commerce.payment_event."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';
COMMENT ON COLUMN commerce.payment_event."reversal_of_event_id" IS '若本筆為反向事件，指向被反轉的原事件。';
COMMENT ON COLUMN commerce.payment_event."evidence_attachment_id" IS 'evidence attachment之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';

COMMENT ON TABLE commerce.fulfillment_event IS '出貨確認與反轉Append-only事件；MVP由人工建立，ERP導入後由Adapter建立。';
COMMENT ON COLUMN commerce.fulfillment_event."fulfillment_event_id" IS 'fulfillment event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.fulfillment_event."order_id" IS 'order之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.fulfillment_event."event_type" IS '事件類型代碼；描述本筆Append-only事件代表的業務事實。';
COMMENT ON COLUMN commerce.fulfillment_event."carrier" IS 'carrier業務資訊；敏感資訊需遵守資料最小化與存取控制。';
COMMENT ON COLUMN commerce.fulfillment_event."tracking_no" IS 'tracking的人可讀/流水編號。';
COMMENT ON COLUMN commerce.fulfillment_event."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';
COMMENT ON COLUMN commerce.fulfillment_event."recorded_at" IS '事件實際寫入UCell系統的時間。';
COMMENT ON COLUMN commerce.fulfillment_event."actor_type" IS 'actor type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.fulfillment_event."actor_id" IS 'actor之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.fulfillment_event."source_system" IS 'source system欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.fulfillment_event."external_event_id" IS '外部系統事件唯一碼，用於Idempotency。';
COMMENT ON COLUMN commerce.fulfillment_event."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';
COMMENT ON COLUMN commerce.fulfillment_event."reversal_of_event_id" IS '若本筆為反向事件，指向被反轉的原事件。';

COMMENT ON TABLE commerce.return_event IS '退貨申請/確認/反轉Append-only事件；對應原訂單/明細。';
COMMENT ON COLUMN commerce.return_event."return_event_id" IS 'return event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.return_event."order_id" IS 'order之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.return_event."order_line_id" IS 'order line之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.return_event."event_type" IS '事件類型代碼；描述本筆Append-only事件代表的業務事實。';
COMMENT ON COLUMN commerce.return_event."quantity" IS '商品或事件數量。';
COMMENT ON COLUMN commerce.return_event."amount" IS '本筆事件/帳本變動金額或數值。';
COMMENT ON COLUMN commerce.return_event."reason_code" IS 'reason的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN commerce.return_event."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';
COMMENT ON COLUMN commerce.return_event."recorded_at" IS '事件實際寫入UCell系統的時間。';
COMMENT ON COLUMN commerce.return_event."actor_type" IS 'actor type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.return_event."actor_id" IS 'actor之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.return_event."source_system" IS 'source system欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN commerce.return_event."external_event_id" IS '外部系統事件唯一碼，用於Idempotency。';
COMMENT ON COLUMN commerce.return_event."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';
COMMENT ON COLUMN commerce.return_event."reversal_of_event_id" IS '若本筆為反向事件，指向被反轉的原事件。';

COMMENT ON TABLE commerce.lot_trace IS 'Pre-ERP必要批號追溯主檔；僅作出貨追蹤，不作完整WMS庫存帳。';
COMMENT ON COLUMN commerce.lot_trace."lot_trace_id" IS 'lot trace之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.lot_trace."product_id" IS 'product之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.lot_trace."lot_no" IS 'lot的人可讀/流水編號。';
COMMENT ON COLUMN commerce.lot_trace."manufactured_at" IS 'manufactured發生或記錄時間。';
COMMENT ON COLUMN commerce.lot_trace."expiry_at" IS 'expiry發生或記錄時間。';
COMMENT ON COLUMN commerce.lot_trace."external_lot_id" IS 'external lot之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';

COMMENT ON TABLE commerce.serial_trace IS 'Pre-ERP必要序號追溯主檔；僅高價/特殊SKU啟用。';
COMMENT ON COLUMN commerce.serial_trace."serial_trace_id" IS 'serial trace之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.serial_trace."product_id" IS 'product之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.serial_trace."lot_trace_id" IS 'lot trace之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.serial_trace."serial_no" IS 'serial的人可讀/流水編號。';
COMMENT ON COLUMN commerce.serial_trace."external_serial_id" IS 'external serial之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';

COMMENT ON TABLE commerce.shipment_trace IS '訂單明細與批號/序號的實際出貨對應。';
COMMENT ON COLUMN commerce.shipment_trace."shipment_trace_id" IS 'shipment trace之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.shipment_trace."fulfillment_event_id" IS 'fulfillment event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.shipment_trace."order_line_id" IS 'order line之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.shipment_trace."lot_trace_id" IS 'lot trace之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.shipment_trace."serial_trace_id" IS 'serial trace之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN commerce.shipment_trace."quantity" IS '商品或事件數量。';
COMMENT ON COLUMN commerce.shipment_trace."recorded_at" IS '事件實際寫入UCell系統的時間。';

COMMENT ON TABLE subscription.subscription_plan IS '重銷預付方案參數，如季/半年/一年；保存月數、付款金額、盒數、月認列金額與月RPV。';
COMMENT ON COLUMN subscription.subscription_plan."subscription_plan_code" IS 'subscription plan的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN subscription.subscription_plan."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN subscription.subscription_plan."months" IS 'months欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN subscription.subscription_plan."paid_amount" IS 'paid amount欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN subscription.subscription_plan."product_box_count" IS 'product box count欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN subscription.subscription_plan."monthly_recognized_amount" IS 'monthly recognized amount欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN subscription.subscription_plan."monthly_rpv" IS 'monthly rpv欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN subscription.subscription_plan."active" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';

COMMENT ON TABLE subscription.subscription IS '某一Qualification購買之重銷訂閱實例。';
COMMENT ON COLUMN subscription.subscription."subscription_id" IS 'subscription之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN subscription.subscription."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN subscription.subscription."subscription_plan_code" IS 'subscription plan的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN subscription.subscription."order_id" IS 'order之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN subscription.subscription."start_date" IS 'start日期。';
COMMENT ON COLUMN subscription.subscription."end_date" IS 'end日期。';
COMMENT ON COLUMN subscription.subscription."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN subscription.subscription."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN subscription.subscription."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE subscription.monthly_recognition_schedule IS '預付重銷逐月認列排程；每月一列並以唯一鍵防止重複認列。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."recognition_schedule_id" IS 'recognition schedule之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."subscription_id" IS 'subscription之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."installment_no" IS 'installment的人可讀/流水編號。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."due_date" IS 'due日期。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."recognized_amount" IS 'recognized amount欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."rpv_amount" IS 'rpv amount欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."recognized_event_id" IS 'recognized event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN subscription.monthly_recognition_schedule."created_at" IS '資料列建立時間。';

COMMENT ON TABLE ledger.pv_ledger IS 'GPV/PV/RPV/EPV不可變帳本。所有更正以反向事件處理，不修改或刪除原事件。';
COMMENT ON COLUMN ledger.pv_ledger."pv_event_id" IS 'pv event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN ledger.pv_ledger."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN ledger.pv_ledger."pv_type" IS '制度價值類型：GPV/PV/RPV/EPV。';
COMMENT ON COLUMN ledger.pv_ledger."event_type" IS '事件類型代碼；描述本筆Append-only事件代表的業務事實。';
COMMENT ON COLUMN ledger.pv_ledger."amount" IS '本筆事件/帳本變動金額或數值。';
COMMENT ON COLUMN ledger.pv_ledger."source_type" IS '來源Entity/單據類型。';
COMMENT ON COLUMN ledger.pv_ledger."source_id" IS '原始來源Entity或單據ID。';
COMMENT ON COLUMN ledger.pv_ledger."source_line_id" IS '原始來源明細ID。';
COMMENT ON COLUMN ledger.pv_ledger."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';
COMMENT ON COLUMN ledger.pv_ledger."recorded_at" IS '事件實際寫入UCell系統的時間。';
COMMENT ON COLUMN ledger.pv_ledger."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN ledger.pv_ledger."parameter_snapshot_hash" IS '已發布Rule Version所有參數的整體Hash。';
COMMENT ON COLUMN ledger.pv_ledger."active_snapshot" IS '事件發生時收受者/Qualification的Active快照。';
COMMENT ON COLUMN ledger.pv_ledger."effective_direct_count_snapshot" IS '事件發生時有效直推數快照。';
COMMENT ON COLUMN ledger.pv_ledger."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';
COMMENT ON COLUMN ledger.pv_ledger."causation_id" IS '直接造成本事件的上一個事件ID。';
COMMENT ON COLUMN ledger.pv_ledger."reversal_of_event_id" IS '若本筆為反向事件，指向被反轉的原事件。';
COMMENT ON COLUMN ledger.pv_ledger."payload_hash" IS '事件Payload完整性Hash；可用於Tamper-evident驗證。';

COMMENT ON TABLE ledger.award_event IS '獎金事件與生命週期資料；保存Theory、K、Payable、Active/直推快照、Rule Version與計算細節。';
COMMENT ON COLUMN ledger.award_event."award_event_id" IS 'award event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN ledger.award_event."recipient_qualification_id" IS 'recipient qualification之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN ledger.award_event."award_type" IS 'award type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.award_event."source_qualification_id" IS 'source qualification之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN ledger.award_event."source_event_id" IS '造成本資料/關係的來源事件ID。';
COMMENT ON COLUMN ledger.award_event."settlement_batch_id" IS 'settlement batch之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN ledger.award_event."theory_amount" IS '獎金依規則計算的理論金額，尚未套用K值。';
COMMENT ON COLUMN ledger.award_event."k_factor" IS '該獎池結算批次的K縮減係數，範圍0~1。';
COMMENT ON COLUMN ledger.award_event."payable_amount" IS '套用K值及相關限制後的應付獎金金額。';
COMMENT ON COLUMN ledger.award_event."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN ledger.award_event."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';
COMMENT ON COLUMN ledger.award_event."recorded_at" IS '事件實際寫入UCell系統的時間。';
COMMENT ON COLUMN ledger.award_event."pending_until" IS 'pending until欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.award_event."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN ledger.award_event."parameter_snapshot_hash" IS '已發布Rule Version所有參數的整體Hash。';
COMMENT ON COLUMN ledger.award_event."active_snapshot" IS '事件發生時收受者/Qualification的Active快照。';
COMMENT ON COLUMN ledger.award_event."effective_direct_count_snapshot" IS '事件發生時有效直推數快照。';
COMMENT ON COLUMN ledger.award_event."calculation_detail" IS '獎金計算明細JSON；應可解釋來源、代數、率、K值與快照。';
COMMENT ON COLUMN ledger.award_event."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';
COMMENT ON COLUMN ledger.award_event."reversal_of_award_event_id" IS '若本筆為獎金反轉，指向原Award Event。';

COMMENT ON TABLE ledger.pool_snapshot IS '各獎池於結算期間的可用額、Theory總額與K值快照。';
COMMENT ON COLUMN ledger.pool_snapshot."pool_snapshot_id" IS 'pool snapshot之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN ledger.pool_snapshot."pool_code" IS 'pool的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN ledger.pool_snapshot."period_start" IS 'period start欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.pool_snapshot."period_end" IS 'period end欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.pool_snapshot."pool_available" IS 'pool available欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.pool_snapshot."total_theory" IS 'total theory欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.pool_snapshot."k_factor" IS '該獎池結算批次的K縮減係數，範圍0~1。';
COMMENT ON COLUMN ledger.pool_snapshot."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN ledger.pool_snapshot."created_at" IS '資料列建立時間。';

COMMENT ON TABLE ledger.settlement_batch IS '週/月等獎金結算批次主檔，保存期間、Rule Version、狀態及計算指紋。';
COMMENT ON COLUMN ledger.settlement_batch."settlement_batch_id" IS 'settlement batch之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN ledger.settlement_batch."batch_code" IS 'batch的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN ledger.settlement_batch."settlement_type" IS 'settlement type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.settlement_batch."period_start" IS 'period start欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.settlement_batch."period_end" IS 'period end欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.settlement_batch."rule_version_id" IS '本交易/事件採用的制度規則版本。';
COMMENT ON COLUMN ledger.settlement_batch."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN ledger.settlement_batch."calculation_fingerprint" IS 'calculation fingerprint欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN ledger.settlement_batch."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN ledger.settlement_batch."approved_at" IS '核准時間。';
COMMENT ON COLUMN ledger.settlement_batch."closed_at" IS 'closed發生或記錄時間。';

COMMENT ON TABLE attribution.referral_code IS '每個Qualification的固定推薦碼。';
COMMENT ON COLUMN attribution.referral_code."referral_code_id" IS 'referral code之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_code."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN attribution.referral_code."referral_code" IS 'referral的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN attribution.referral_code."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN attribution.referral_code."created_at" IS '資料列建立時間。';

COMMENT ON TABLE attribution.referral_link IS 'Qualification針對Campaign/Asset/Channel建立之分享連結Token。';
COMMENT ON COLUMN attribution.referral_link."referral_link_id" IS 'referral link之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_link."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN attribution.referral_link."token_hash" IS '分享連結Token的Hash；避免資料庫直接保存可使用的原始Token。';
COMMENT ON COLUMN attribution.referral_link."campaign_id" IS 'campaign之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_link."asset_id" IS 'asset之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_link."channel_code" IS 'channel的穩定代碼，供程式、報表與整合使用。';
COMMENT ON COLUMN attribution.referral_link."valid_from" IS 'valid from欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN attribution.referral_link."valid_to" IS 'valid to欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN attribution.referral_link."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN attribution.referral_link."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN attribution.referral_link."created_by" IS '建立此資料之使用者/系統Actor識別碼。';

COMMENT ON TABLE attribution.referral_session IS '訪客點入Referral Link形成的匿名Session與Landing資訊。';
COMMENT ON COLUMN attribution.referral_session."referral_session_id" IS 'referral session之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_session."referral_link_id" IS 'referral link之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_session."first_seen_at" IS 'first seen發生或記錄時間。';
COMMENT ON COLUMN attribution.referral_session."last_seen_at" IS 'last seen發生或記錄時間。';
COMMENT ON COLUMN attribution.referral_session."anonymous_visitor_id_hash" IS 'anonymous visitor id的不可逆Hash，用於比對、完整性或去識別。';
COMMENT ON COLUMN attribution.referral_session."landing_path" IS 'landing path業務資訊；敏感資訊需遵守資料最小化與存取控制。';
COMMENT ON COLUMN attribution.referral_session."user_agent" IS 'user agent業務資訊；敏感資訊需遵守資料最小化與存取控制。';
COMMENT ON COLUMN attribution.referral_session."ip_hash" IS 'ip的不可逆Hash，用於比對、完整性或去識別。';

COMMENT ON TABLE attribution.attribution_event IS '分享/瀏覽/留資/轉換等Marketing Touchpoint的Append-only歸因事件。';
COMMENT ON COLUMN attribution.attribution_event."attribution_event_id" IS 'attribution event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.attribution_event."referral_session_id" IS 'referral session之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.attribution_event."qualification_id" IS '會員資格／球唯一識別碼；組織、PV、獎金等核心業務的主要關聯鍵。';
COMMENT ON COLUMN attribution.attribution_event."event_type" IS '事件類型代碼；描述本筆Append-only事件代表的業務事實。';
COMMENT ON COLUMN attribution.attribution_event."entity_type" IS 'entity type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN attribution.attribution_event."entity_id" IS 'entity之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.attribution_event."campaign_id" IS 'campaign之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.attribution_event."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';
COMMENT ON COLUMN attribution.attribution_event."metadata" IS 'metadata欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN attribution.attribution_event."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';

COMMENT ON TABLE attribution.lead IS '訪客留資及轉換到Person/Qualification的Lead主檔。';
COMMENT ON COLUMN attribution.lead."lead_id" IS 'lead之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.lead."referral_session_id" IS 'referral session之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.lead."source_qualification_id" IS 'source qualification之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.lead."lead_status" IS '狀態欄位；合法值由Enum/Check Constraint或業務流程控制。';
COMMENT ON COLUMN attribution.lead."contact_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN attribution.lead."mobile_ciphertext" IS 'mobile的加密密文；僅授權流程可解密。';
COMMENT ON COLUMN attribution.lead."mobile_hash" IS 'mobile的不可逆Hash，用於比對、完整性或去識別。';
COMMENT ON COLUMN attribution.lead."email" IS 'email業務資訊；敏感資訊需遵守資料最小化與存取控制。';
COMMENT ON COLUMN attribution.lead."consent_id" IS 'consent之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.lead."created_at" IS '資料列建立時間。';
COMMENT ON COLUMN attribution.lead."converted_person_id" IS 'converted person之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.lead."converted_qualification_id" IS 'converted qualification之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';

COMMENT ON TABLE attribution.referral_lock IS '正式Sponsor核准後的歸因鎖定；後續點擊不得覆寫。';
COMMENT ON COLUMN attribution.referral_lock."referral_lock_id" IS 'referral lock之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_lock."child_qualification_id" IS 'Sponsor Tree上的被推薦Qualification。';
COMMENT ON COLUMN attribution.referral_lock."sponsor_qualification_id" IS 'Sponsor Tree上的推薦人Qualification。';
COMMENT ON COLUMN attribution.referral_lock."source_referral_link_id" IS 'source referral link之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_lock."locked_at" IS 'locked發生或記錄時間。';
COMMENT ON COLUMN attribution.referral_lock."locked_by" IS 'locked by欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN attribution.referral_lock."source_application_id" IS 'source application之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_lock."lock_reason" IS 'lock reason欄位；資料型別與限制請以SQL Definition為準。';

COMMENT ON TABLE attribution.referral_dispute IS '推薦歸因爭議案件；必須經案件流程處理，不直接改Sponsor。';
COMMENT ON COLUMN attribution.referral_dispute."referral_dispute_id" IS 'referral dispute之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_dispute."child_qualification_id" IS 'Sponsor Tree上的被推薦Qualification。';
COMMENT ON COLUMN attribution.referral_dispute."claimed_sponsor_qualification_id" IS 'claimed sponsor qualification之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_dispute."current_sponsor_qualification_id" IS 'current sponsor qualification之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN attribution.referral_dispute."status" IS '該Entity目前的業務狀態。';
COMMENT ON COLUMN attribution.referral_dispute."reason_text" IS '人可讀說明文字，用於補充業務語意或稽核原因。';
COMMENT ON COLUMN attribution.referral_dispute."opened_at" IS 'opened發生或記錄時間。';
COMMENT ON COLUMN attribution.referral_dispute."opened_by" IS 'opened by欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN attribution.referral_dispute."resolved_at" IS 'resolved發生或記錄時間。';
COMMENT ON COLUMN attribution.referral_dispute."resolved_by" IS 'resolved by欄位；資料型別與限制請以SQL Definition為準。';

COMMENT ON TABLE integration.external_system IS '可整合之外部系統代碼，例如MANUAL、D365_BC、LINE、PAYMENT、LOGISTICS。';
COMMENT ON COLUMN integration.external_system."external_system_code" IS '外部系統代碼，Pre-ERP通常為MANUAL，未來可為D365_BC等。';
COMMENT ON COLUMN integration.external_system."display_name" IS '人可讀名稱/顯示名稱。';
COMMENT ON COLUMN integration.external_system."active" IS '布林控制/資格旗標；True/False之業務意義依欄位名稱與所屬Entity定義。';

COMMENT ON TABLE integration.external_reference IS 'UCell Entity與外部系統Entity/Document之對照。';
COMMENT ON COLUMN integration.external_reference."external_reference_id" IS 'external reference之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN integration.external_reference."external_system_code" IS '外部系統代碼，Pre-ERP通常為MANUAL，未來可為D365_BC等。';
COMMENT ON COLUMN integration.external_reference."entity_type" IS 'entity type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN integration.external_reference."internal_entity_id" IS 'internal entity之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN integration.external_reference."external_entity_id" IS '外部系統Entity ID。';
COMMENT ON COLUMN integration.external_reference."external_document_no" IS '外部系統人可讀單據號碼。';
COMMENT ON COLUMN integration.external_reference."version_etag" IS '外部系統版本/ETag，用於併發與同步判斷。';
COMMENT ON COLUMN integration.external_reference."sync_status" IS '與外部系統同步狀態。';
COMMENT ON COLUMN integration.external_reference."last_synced_at" IS 'last synced發生或記錄時間。';

COMMENT ON TABLE integration.outbox_event IS 'Transactional Outbox；在UCell交易提交後可靠發布跨模組/外部事件。';
COMMENT ON COLUMN integration.outbox_event."outbox_event_id" IS 'outbox event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN integration.outbox_event."aggregate_type" IS 'aggregate type欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN integration.outbox_event."aggregate_id" IS 'aggregate之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN integration.outbox_event."event_type" IS '事件類型代碼；描述本筆Append-only事件代表的業務事實。';
COMMENT ON COLUMN integration.outbox_event."payload" IS 'payload欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN integration.outbox_event."occurred_at" IS '業務事實實際發生時間；不得與系統登錄時間混為一談。';
COMMENT ON COLUMN integration.outbox_event."published_at" IS 'published發生或記錄時間。';
COMMENT ON COLUMN integration.outbox_event."retry_count" IS 'retry count欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN integration.outbox_event."last_error" IS 'last error欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN integration.outbox_event."correlation_id" IS '串接同一業務流程的Correlation ID，供跨表/跨服務追查。';

COMMENT ON TABLE integration.inbox_event IS '外部事件Inbox與Idempotency Gate；external_system+external_event_id唯一。';
COMMENT ON COLUMN integration.inbox_event."inbox_event_id" IS 'inbox event之唯一識別碼或外鍵Reference；實際關聯依資料表FK定義。';
COMMENT ON COLUMN integration.inbox_event."external_system_code" IS '外部系統代碼，Pre-ERP通常為MANUAL，未來可為D365_BC等。';
COMMENT ON COLUMN integration.inbox_event."external_event_id" IS '外部系統事件唯一碼，用於Idempotency。';
COMMENT ON COLUMN integration.inbox_event."event_type" IS '事件類型代碼；描述本筆Append-only事件代表的業務事實。';
COMMENT ON COLUMN integration.inbox_event."payload" IS 'payload欄位；資料型別與限制請以SQL Definition為準。';
COMMENT ON COLUMN integration.inbox_event."received_at" IS 'received發生或記錄時間。';
COMMENT ON COLUMN integration.inbox_event."processed_at" IS 'processed發生或記錄時間。';
COMMENT ON COLUMN integration.inbox_event."process_status" IS '狀態欄位；合法值由Enum/Check Constraint或業務流程控制。';
COMMENT ON COLUMN integration.inbox_event."last_error" IS 'last error欄位；資料型別與限制請以SQL Definition為準。';

COMMENT ON VIEW reporting.v_person_qualifications IS '自然人與其目前持有Qualification的查詢檢視；提供方案、狀態與Active投影。';

COMMENT ON VIEW reporting.v_current_sponsor_tree IS '目前有效Sponsor Tree Edge檢視。';

COMMENT ON VIEW reporting.v_current_binary_tree IS '目前有效Binary Tree Edge檢視。';

COMMENT ON VIEW reporting.v_pv_balance IS '依Qualification及PV Type彙總Append-only PV Ledger之目前餘額。';

COMMENT ON VIEW reporting.v_award_summary IS '依Qualification、Award Type、Status彙總獎金事件。';

COMMENT ON VIEW reporting.v_order_status IS '會員訂單及最近付款/出貨確認時間的營運檢視。';

COMMENT ON VIEW reporting.v_referral_performance IS 'Qualification分享漏斗摘要：Session、Lead與轉換Qualification。';

COMMENT ON VIEW reporting.v_subscription_schedule IS '訂閱與逐月認列排程整合檢視。';

COMMENT ON VIEW reporting.v_data_integrity_alerts IS '資料完整性警示檢視，主動檢查Holder、Sponsor與付款事件等異常。';

COMMENT ON FUNCTION public.utc_now() IS '回傳資料庫目前時鐘時間；統一時間取得介面。';

COMMENT ON FUNCTION public.gen_uuid() IS '使用pgcrypto產生UUID。';

COMMENT ON FUNCTION public.sha256_text(text) IS '將文字計算SHA-256 Hex字串。';

COMMENT ON FUNCTION public.set_updated_at() IS '共用Trigger Function；在UPDATE時自動更新updated_at。';

COMMENT ON FUNCTION public.prevent_physical_delete() IS '共用Trigger Function；禁止核心資料Physical DELETE。';

COMMENT ON FUNCTION public.prevent_mutation() IS '共用Trigger Function；禁止Append-only表UPDATE/DELETE。';

COMMENT ON FUNCTION audit.fn_write_audit_event(public.actor_type, uuid, text, text, uuid, jsonb, jsonb, text, text, uuid) IS '新增一筆跨Domain Audit Event並回傳audit_event_id。';

COMMENT ON FUNCTION membership.fn_is_active_at(uuid, timestamptz) IS '判斷指定Qualification在指定時間點是否Active。';

COMMENT ON FUNCTION organization.fn_current_sponsor(uuid) IS '取得指定Qualification目前有效Sponsor。';

COMMENT ON FUNCTION organization.fn_sponsor_ancestor(uuid, integer) IS '依Sponsor Tree取得指定代數祖先Qualification。';

COMMENT ON FUNCTION organization.fn_effective_direct_count_at(uuid, timestamptz) IS '計算指定時間點Sponsor之有效直推數。';

COMMENT ON FUNCTION organization.fn_binary_parent(uuid) IS '取得指定Qualification目前Binary Parent。';

COMMENT ON FUNCTION organization.fn_binary_ancestor(uuid, integer) IS '依Binary Tree取得指定代數祖先Qualification。';

COMMENT ON FUNCTION organization.fn_is_in_binary_subtree(uuid, uuid, public.side_code) IS '判斷Candidate是否位於Root指定LEFT/RIGHT子樹內。';

COMMENT ON FUNCTION organization.fn_validate_binary_cycle() IS 'Binary Placement Trigger Function；避免形成循環樹。';

COMMENT ON FUNCTION rules.fn_guard_published_mutation() IS '阻止已Published的Rule Version/Parameter被直接修改。';

COMMENT ON FUNCTION rules.fn_active_rule_version(text, timestamptz) IS '依Rule Set及時間取得有效Published Rule Version。';

COMMENT ON FUNCTION rules.fn_resolve_parameter(uuid, text, timestamptz, jsonb) IS '依Rule Version、Parameter Code、時間與Scope候選解析最終參數值。';

COMMENT ON FUNCTION ledger.fn_pv_balance(uuid, text, timestamptz) IS '依Qualification/PV Type/時間點計算PV Ledger累計餘額。';

COMMENT ON FUNCTION ledger.fn_compute_k_factor(numeric, numeric) IS '依Pool Available與Theory總額計算K=min(1, available/theory)。';

COMMENT ON FUNCTION ledger.fn_rpv_depth(integer) IS 'R1.0B有效直推數對應可領RPV代數的便利函數；正式應與Decision Table/Rule Version一致。';

COMMENT ON FUNCTION rules.fn_referral_rate_by_plan(text) IS '依方案取得G1推薦率的便利函數；正式運行應以參數/Decision Table為SoR。';

COMMENT ON FUNCTION rules.fn_matching_rate_by_generation(integer) IS '依代數取得Matching比例的便利函數；正式運行應以參數/Decision Table為SoR。';

COMMENT ON FUNCTION rules.fn_matching_unlock_depth(integer) IS '依有效直推數取得Matching解鎖代數。';

COMMENT ON FUNCTION rules.fn_equalization_rate(text, integer) IS '依方案與G代數取得推薦對等比例；領袖G5=10%已保留。';

COMMENT ON FUNCTION rules.fn_equalization_unlock_depth(text, integer) IS '依方案與有效直推數取得推薦對等最大解鎖代數。';

COMMENT ON FUNCTION rules.fn_binary_weekly_cap(text) IS '依方案取得Binary每週Pair PV封頂便利函數。';

COMMENT ON FUNCTION organization.fn_validate_first_third_left_rule() IS 'Binary Placement Trigger Function；執行Sponsor永久序號第1/3直推必須位於左子樹規則。';

COMMENT ON FUNCTION organization.fn_guard_sponsor_update() IS '禁止直接覆寫Current Sponsor/Sequence，要求使用受控Supersede流程。';

COMMENT ON PROCEDURE rules.sp_publish_rule_version(uuid, timestamptz, uuid) IS '核准並發布Rule Version，計算Parameter Snapshot Hash並將參數集合標記為Published。';

COMMENT ON PROCEDURE subscription.sp_create_schedule(uuid) IS '依重銷方案月數建立3/6/12期Monthly Recognition Schedule，具唯一鍵防重。';

COMMENT ON PROCEDURE ledger.sp_reverse_pv_event(uuid, uuid, text) IS '對原PV Event建立等額負向Reversal Event並寫Audit，不修改原事件。';

COMMENT ON PROCEDURE subscription.sp_recognize_monthly_rpv(uuid, public.actor_type, uuid) IS '將一筆到期Monthly Recognition認列為RPV Event；使用FOR UPDATE及狀態控制避免重複。';

COMMENT ON PROCEDURE commerce.sp_confirm_payment(uuid, numeric, text, text, timestamptz, uuid, uuid) IS 'Pre-ERP人工確認付款；建立Payment Event、更新Order Projection並寫Outbox SALE_CONFIRMED。';

COMMENT ON PROCEDURE commerce.sp_confirm_fulfillment(uuid, text, text, timestamptz, uuid, uuid) IS 'Pre-ERP人工確認出貨；建立Fulfillment Event、更新Order Projection並寫Outbox。';

COMMENT ON PROCEDURE organization.sp_supersede_sponsor(uuid, uuid, integer, timestamptz, uuid, uuid) IS '在已核准Change Request前提下關閉舊Sponsor有效期間並建立新關係與Audit。';

COMMENT ON TRIGGER trg_person_updated_at ON identity.person IS 'Person主檔更新時自動刷新updated_at。';

COMMENT ON TRIGGER trg_person_no_delete ON identity.person IS '禁止Person實體刪除。';

COMMENT ON TRIGGER trg_consent_no_delete ON identity.consent_record IS '禁止同意證據實體刪除。';

COMMENT ON TRIGGER trg_qualification_updated_at ON membership.qualification IS 'Qualification更新時刷新updated_at。';

COMMENT ON TRIGGER trg_qualification_no_delete ON membership.qualification IS '禁止Qualification實體刪除。';

COMMENT ON TRIGGER trg_sponsor_no_delete ON organization.sponsor_relationship IS '禁止Sponsor關係實體刪除。';

COMMENT ON TRIGGER trg_binary_no_delete ON organization.binary_placement IS '禁止Binary Placement實體刪除。';

COMMENT ON TRIGGER trg_binary_cycle_guard ON organization.binary_placement IS '新增/改Binary Parent前檢查循環。';

COMMENT ON TRIGGER trg_rule_version_no_delete ON rules.rule_version IS '禁止Rule Version實體刪除。';

COMMENT ON TRIGGER trg_parameter_value_no_delete ON rules.parameter_value IS '禁止Parameter Value實體刪除。';

COMMENT ON TRIGGER trg_rule_version_immutable ON rules.rule_version IS '已Published Rule Version不得再直接修改。';

COMMENT ON TRIGGER trg_parameter_value_immutable ON rules.parameter_value IS 'Published Rule下Parameter Value不得直接修改。';

COMMENT ON TRIGGER trg_product_updated_at ON commerce.product_reference IS 'Product Reference更新時刷新updated_at。';

COMMENT ON TRIGGER trg_order_updated_at ON commerce."order" IS 'Order Projection更新時刷新updated_at。';

COMMENT ON TRIGGER trg_order_no_delete ON commerce."order" IS '禁止Order實體刪除。';

COMMENT ON TRIGGER trg_payment_append_only_update ON commerce.payment_event IS 'Payment Event禁止UPDATE/DELETE。';

COMMENT ON TRIGGER trg_fulfillment_append_only_update ON commerce.fulfillment_event IS 'Fulfillment Event禁止UPDATE/DELETE。';

COMMENT ON TRIGGER trg_return_append_only_update ON commerce.return_event IS 'Return Event禁止UPDATE/DELETE。';

COMMENT ON TRIGGER trg_pv_append_only ON ledger.pv_ledger IS 'PV Ledger禁止UPDATE/DELETE。';

COMMENT ON TRIGGER trg_award_append_only_delete ON ledger.award_event IS 'Award Event禁止DELETE；狀態生命週期更新仍可透過受控服務執行。';

COMMENT ON TRIGGER trg_attribution_append_only ON attribution.attribution_event IS 'Attribution Event禁止UPDATE/DELETE。';

COMMENT ON TRIGGER trg_outbox_no_delete ON integration.outbox_event IS 'Outbox保留事件歷史，不允許DELETE。';

COMMENT ON TRIGGER trg_inbox_no_delete ON integration.inbox_event IS 'Inbox保留外部事件歷史，不允許DELETE。';

COMMENT ON TRIGGER trg_binary_first_third_left ON organization.binary_placement IS '新增Binary Placement時驗證第1/3直推位於Sponsor左子樹。';

COMMENT ON TRIGGER trg_sponsor_update_guard ON organization.sponsor_relationship IS 'Current Sponsor/Sequence不可直接改寫，必須用Supersede流程。';

COMMENT ON INDEX ix_audit_entity_time IS '查詢效能索引；表=audit.audit_event；定義=(entity_type, entity_id, occurred_at DESC)。';

COMMENT ON INDEX ix_audit_actor_time IS '查詢效能索引；表=audit.audit_event；定義=(actor_id, occurred_at DESC)。';

COMMENT ON INDEX ix_person_name IS '查詢效能索引；表=identity.person；定義=(legal_name)。';

COMMENT ON INDEX ix_person_mobile IS '查詢效能索引；表=identity.person；定義=(mobile)。';

COMMENT ON INDEX uq_person_primary_bank IS '唯一索引；表=identity.person_bank_profile；定義=(person_id) WHERE is_primary AND valid_to IS NULL。';

COMMENT ON INDEX ix_qualification_holder IS '查詢效能索引；表=membership.qualification；定義=(current_holder_person_id, status)。';

COMMENT ON INDEX uq_current_holder_per_qualification IS '唯一索引；表=membership.qualification_holder_history；定義=(qualification_id) WHERE valid_to IS NULL。';

COMMENT ON INDEX ix_active_period_lookup IS '查詢效能索引；表=membership.active_period；定義=(qualification_id, active_from, active_to)。';

COMMENT ON INDEX uq_sponsor_sequence_per_sponsor IS '唯一索引；表=organization.sponsor_relationship；定義=(sponsor_qualification_id, sponsor_sequence_no)。';

COMMENT ON INDEX uq_current_sponsor_per_child IS '唯一索引；表=organization.sponsor_relationship；定義=(child_qualification_id) WHERE effective_to IS NULL。';

COMMENT ON INDEX ix_sponsor_children IS '查詢效能索引；表=organization.sponsor_relationship；定義=(sponsor_qualification_id, effective_from)。';

COMMENT ON INDEX uq_current_binary_position_for_child IS '唯一索引；表=organization.binary_placement；定義=(qualification_id) WHERE effective_to IS NULL。';

COMMENT ON INDEX uq_current_binary_slot IS '唯一索引；表=organization.binary_placement；定義=(parent_qualification_id, side) WHERE effective_to IS NULL。';

COMMENT ON INDEX ix_binary_parent IS '查詢效能索引；表=organization.binary_placement；定義=(parent_qualification_id, effective_from)。';

COMMENT ON INDEX ix_parameter_scope IS '查詢效能索引；表=rules.parameter_set；定義=(rule_version_id, scope_type, scope_key, priority DESC)。';

COMMENT ON INDEX ix_order_qualification_time IS '查詢效能索引；表=commerce."order"；定義=(qualification_id, created_at DESC)。';

COMMENT ON INDEX ix_order_status_time IS '查詢效能索引；表=commerce."order"；定義=(status, created_at DESC)。';

COMMENT ON INDEX uq_payment_external_event IS '唯一索引；表=commerce.payment_event；定義=(source_system, external_event_id) WHERE external_event_id IS NOT NULL。';

COMMENT ON INDEX ix_pv_qualification_time IS '查詢效能索引；表=ledger.pv_ledger；定義=(qualification_id, occurred_at DESC)。';

COMMENT ON INDEX ix_pv_source IS '查詢效能索引；表=ledger.pv_ledger；定義=(source_type, source_id)。';

COMMENT ON INDEX ix_pv_type_time IS '查詢效能索引；表=ledger.pv_ledger；定義=(pv_type, occurred_at DESC)。';

COMMENT ON INDEX ix_award_recipient_status IS '查詢效能索引；表=ledger.award_event；定義=(recipient_qualification_id, status, occurred_at DESC)。';

COMMENT ON INDEX ix_award_source IS '查詢效能索引；表=ledger.award_event；定義=(source_event_id)。';

COMMENT ON INDEX ix_outbox_unpublished IS '查詢效能索引；表=integration.outbox_event；定義=(occurred_at) WHERE published_at IS NULL。';

COMMENT ON TYPE public.record_status IS '共用業務狀態Enum：DRAFT/PENDING/APPROVED/EFFECTIVE/SUSPENDED/VOIDED/CLOSED。';
COMMENT ON TYPE public.side_code IS 'Binary Tree方向：LEFT或RIGHT。';
COMMENT ON TYPE public.actor_type IS '事件操作者種類：USER/SYSTEM/JOB/INTEGRATION。';
COMMENT ON TYPE public.rule_status IS 'Rule/Parameter生命週期：DRAFT/REVIEW/APPROVED/PUBLISHED/RETIRED。';
COMMENT ON TYPE public.order_status IS '會員訂單狀態：DRAFT/CONFIRMED/PAID/FULFILLED/PARTIAL_RETURN/RETURNED/VOIDED。';
COMMENT ON TYPE public.award_status IS '獎金生命週期：CALCULATED/PENDING_45D/EFFECTIVE/PAYABLE/PAID/REVERSED/CLAWBACK。';
COMMENT ON TYPE public.parameter_data_type IS '參數資料型別Enum；Parameter Value以JSONB承載、Definition負責型別與驗證。';
COMMIT;

-- =============================================================================
-- END OF UCell R1.0B PostgreSQL Full Database Definition v1.0
-- =============================================================================
