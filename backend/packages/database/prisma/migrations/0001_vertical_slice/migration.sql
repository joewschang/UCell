CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS membership;
CREATE SCHEMA IF NOT EXISTS organization;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS ledger;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS rules;

CREATE TYPE membership."RecordStatus" AS ENUM (
  'DRAFT','PENDING','APPROVED','EFFECTIVE','SUSPENDED','VOIDED','CLOSED'
);
CREATE TYPE organization."SideCode" AS ENUM ('LEFT','RIGHT');
CREATE TYPE commerce."OrderStatus" AS ENUM (
  'DRAFT','CONFIRMED','PAID','FULFILLED','PARTIAL_RETURN','RETURNED','VOIDED'
);
CREATE TYPE ledger."PvType" AS ENUM ('GPV','PV','RPV','EPV');
CREATE TYPE integration."EventProcessStatus" AS ENUM (
  'PENDING','PROCESSING','PROCESSED','FAILED','DEAD'
);

CREATE TABLE identity.person (
  person_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  preferred_name text,
  birth_date date,
  mobile text,
  email text,
  status membership."RecordStatus" NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_person_legal_name ON identity.person(legal_name);
CREATE INDEX ix_person_mobile ON identity.person(mobile);

CREATE TABLE membership.qualification (
  qualification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_no bigserial NOT NULL UNIQUE,
  current_holder_person_id uuid NOT NULL REFERENCES identity.person(person_id),
  plan_level_code text NOT NULL CHECK (plan_level_code IN ('STARTER','ELITE','LEADER')),
  status membership."RecordStatus" NOT NULL DEFAULT 'DRAFT',
  active_flag boolean NOT NULL DEFAULT false,
  effective_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_qualification_holder ON membership.qualification(current_holder_person_id);
CREATE INDEX ix_qualification_status_effective ON membership.qualification(status,effective_at);

CREATE TABLE membership.qualification_holder_history (
  holder_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  holder_person_id uuid NOT NULL REFERENCES identity.person(person_id),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source_type text NOT NULL,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX ix_holder_history_q ON membership.qualification_holder_history(qualification_id,effective_from);
CREATE INDEX ix_holder_history_person ON membership.qualification_holder_history(holder_person_id,effective_from);

CREATE TABLE organization.sponsor_relationship (
  sponsor_relationship_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  child_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  sponsor_sequence_no integer NOT NULL CHECK (sponsor_sequence_no > 0),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sponsor_child_all_versions UNIQUE(child_qualification_id),
  CONSTRAINT uq_sponsor_sequence UNIQUE(sponsor_qualification_id,sponsor_sequence_no),
  CHECK (sponsor_qualification_id <> child_qualification_id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX ix_sponsor_parent_effective
ON organization.sponsor_relationship(sponsor_qualification_id,effective_from);

CREATE TABLE organization.binary_placement (
  binary_placement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  child_qualification_id uuid NOT NULL UNIQUE REFERENCES membership.qualification(qualification_id),
  side organization."SideCode" NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_qualification_id <> child_qualification_id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX ix_binary_parent_side_current
ON organization.binary_placement(parent_qualification_id,side,effective_to);
CREATE UNIQUE INDEX uq_binary_current_parent_side
ON organization.binary_placement(parent_qualification_id,side)
WHERE effective_to IS NULL;

CREATE TABLE commerce.product_reference (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  display_name text NOT NULL,
  current_price numeric(18,2) NOT NULL CHECK (current_price >= 0),
  currency text NOT NULL DEFAULT 'TWD',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commerce.product_rule_profile (
  product_rule_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  gpv_rate numeric(10,6) NOT NULL DEFAULT 0.60 CHECK (gpv_rate >= 0),
  pv_rate numeric(10,6),
  rpv_eligible boolean NOT NULL DEFAULT false,
  epv_eligible boolean NOT NULL DEFAULT false,
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX ix_product_rule_profile_effective
ON commerce.product_rule_profile(product_id,effective_from,effective_to);

CREATE TABLE commerce."order" (
  order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no bigserial NOT NULL UNIQUE,
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  status commerce."OrderStatus" NOT NULL DEFAULT 'DRAFT',
  currency text NOT NULL DEFAULT 'TWD',
  gross_amount numeric(18,2) NOT NULL CHECK (gross_amount >= 0),
  discount_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  net_amount numeric(18,2) NOT NULL CHECK (net_amount >= 0),
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  source_referral_token_hash text,
  client_reference text,
  confirmed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (net_amount = gross_amount - discount_amount)
);
CREATE INDEX ix_order_q_created ON commerce."order"(qualification_id,created_at);
CREATE INDEX ix_order_status_created ON commerce."order"(status,created_at);

CREATE TABLE commerce.order_line (
  order_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
  sku_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  line_amount numeric(18,2) NOT NULL CHECK (line_amount >= 0),
  gpv_rate_snapshot numeric(10,6) NOT NULL CHECK (gpv_rate_snapshot >= 0),
  gpv_amount_snapshot numeric(18,4) NOT NULL CHECK (gpv_amount_snapshot >= 0),
  pv_rate_snapshot numeric(10,6),
  rule_profile_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_order_line_order ON commerce.order_line(order_id);

CREATE TABLE commerce.payment_event (
  payment_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  event_type text NOT NULL,
  amount numeric(18,2) NOT NULL,
  payment_method text NOT NULL,
  reference_no text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  correlation_id uuid NOT NULL
);
CREATE INDEX ix_payment_order_occurred ON commerce.payment_event(order_id,occurred_at);

CREATE TABLE ledger.pv_ledger (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  pv_type ledger."PvType" NOT NULL,
  amount numeric(18,4) NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  source_line_id uuid,
  event_type text NOT NULL,
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  reversal_of_event_id uuid,
  correlation_id uuid NOT NULL,
  CONSTRAINT uq_pv_source UNIQUE(event_type,source_type,source_id,source_line_id,pv_type),
  CONSTRAINT fk_pv_reversal FOREIGN KEY(reversal_of_event_id) REFERENCES ledger.pv_ledger(event_id)
);
CREATE INDEX ix_pv_q_type_time ON ledger.pv_ledger(qualification_id,pv_type,occurred_at);

CREATE TABLE audit.audit_event (
  audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason_code text,
  request_id text NOT NULL,
  correlation_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit.audit_event(entity_type,entity_id,occurred_at);
CREATE INDEX ix_audit_correlation ON audit.audit_event(correlation_id);

CREATE TABLE integration.idempotency_record (
  idempotency_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status_code integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT uq_idempotency_scope_key UNIQUE(actor_scope,idempotency_key)
);
CREATE INDEX ix_idempotency_expiry ON integration.idempotency_record(expires_at);

CREATE TABLE integration.outbox_event (
  outbox_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  process_status integration."EventProcessStatus" NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_outbox_pending ON integration.outbox_event(process_status,available_at);

-- Common updated_at trigger.
CREATE OR REPLACE FUNCTION public.ucell_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_person_updated_at
BEFORE UPDATE ON identity.person
FOR EACH ROW EXECUTE FUNCTION public.ucell_set_updated_at();

CREATE TRIGGER trg_qualification_updated_at
BEFORE UPDATE ON membership.qualification
FOR EACH ROW EXECUTE FUNCTION public.ucell_set_updated_at();

CREATE TRIGGER trg_product_updated_at
BEFORE UPDATE ON commerce.product_reference
FOR EACH ROW EXECUTE FUNCTION public.ucell_set_updated_at();

CREATE TRIGGER trg_order_updated_at
BEFORE UPDATE ON commerce."order"
FOR EACH ROW EXECUTE FUNCTION public.ucell_set_updated_at();

-- Append-only protection.
CREATE OR REPLACE FUNCTION public.ucell_prevent_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'UCell append-only table % does not allow UPDATE/DELETE', TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_pv_ledger_append_only
BEFORE UPDATE OR DELETE ON ledger.pv_ledger
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE TRIGGER trg_payment_event_append_only
BEFORE UPDATE OR DELETE ON commerce.payment_event
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE TRIGGER trg_audit_event_append_only
BEFORE UPDATE OR DELETE ON audit.audit_event
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

-- No physical delete on core nodes.
CREATE OR REPLACE FUNCTION public.ucell_prevent_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'UCell core table % does not allow physical DELETE', TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_person_no_delete
BEFORE DELETE ON identity.person
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_qualification_no_delete
BEFORE DELETE ON membership.qualification
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_sponsor_no_delete
BEFORE DELETE ON organization.sponsor_relationship
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_binary_no_delete
BEFORE DELETE ON organization.binary_placement
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

-- Sponsor cycle guard.
CREATE OR REPLACE FUNCTION organization.ucell_guard_sponsor_cycle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE has_cycle boolean;
BEGIN
  WITH RECURSIVE ancestors AS (
    SELECT sponsor_qualification_id
      FROM organization.sponsor_relationship
     WHERE child_qualification_id = NEW.sponsor_qualification_id
       AND effective_to IS NULL
    UNION ALL
    SELECT sr.sponsor_qualification_id
      FROM organization.sponsor_relationship sr
      JOIN ancestors a ON sr.child_qualification_id = a.sponsor_qualification_id
     WHERE sr.effective_to IS NULL
  )
  SELECT EXISTS(
    SELECT 1 FROM ancestors
     WHERE sponsor_qualification_id = NEW.child_qualification_id
  ) INTO has_cycle;

  IF has_cycle OR NEW.sponsor_qualification_id = NEW.child_qualification_id THEN
    RAISE EXCEPTION 'Sponsor cycle detected';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sponsor_cycle
BEFORE INSERT ON organization.sponsor_relationship
FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_sponsor_cycle();

-- Binary cycle guard.
CREATE OR REPLACE FUNCTION organization.ucell_guard_binary_cycle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE has_cycle boolean;
BEGIN
  WITH RECURSIVE ancestors AS (
    SELECT parent_qualification_id
      FROM organization.binary_placement
     WHERE child_qualification_id = NEW.parent_qualification_id
       AND effective_to IS NULL
    UNION ALL
    SELECT bp.parent_qualification_id
      FROM organization.binary_placement bp
      JOIN ancestors a ON bp.child_qualification_id = a.parent_qualification_id
     WHERE bp.effective_to IS NULL
  )
  SELECT EXISTS(
    SELECT 1 FROM ancestors
     WHERE parent_qualification_id = NEW.child_qualification_id
  ) INTO has_cycle;

  IF has_cycle OR NEW.parent_qualification_id = NEW.child_qualification_id THEN
    RAISE EXCEPTION 'Binary cycle detected';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_binary_cycle
BEFORE INSERT ON organization.binary_placement
FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_binary_cycle();

COMMENT ON TABLE ledger.pv_ledger IS
'GPV/PV/RPV/EPV不可變帳本。修正必須建立反向事件，不得修改或刪除原事件。';
COMMENT ON COLUMN membership.qualification.qualification_id IS
'會員資格／球唯一識別碼；組織、Active、PV、獎金等球級業務的Aggregate ID。';
COMMENT ON COLUMN organization.sponsor_relationship.sponsor_sequence_no IS
'推薦人的永久直推序號；退出或退貨不重新編號。';
COMMENT ON COLUMN commerce.order_line.gpv_amount_snapshot IS
'訂單建立時依當時有效商品Rule Profile計算並凍結的GPV；未來商品參數異動不得回寫。';
COMMENT ON TABLE integration.outbox_event IS
'Transactional Outbox；核心交易與待發布Domain/Integration Event同一DB Transaction提交。';
