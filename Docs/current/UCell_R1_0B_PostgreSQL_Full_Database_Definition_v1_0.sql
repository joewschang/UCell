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

COMMIT;

-- =============================================================================
-- END OF UCell R1.0B PostgreSQL Full Database Definition v1.0
-- =============================================================================
