CREATE TYPE ledger."BonusAwardType" AS ENUM ('REFERRAL','EQUALIZATION','BINARY','MATCHING');
CREATE TYPE ledger."BonusAwardLifecycleStatus" AS ENUM
('CALCULATED','PENDING_45D','EFFECTIVE','PAYABLE','PAID','REVERSED','CLAWBACK');
CREATE TYPE ledger."SettlementType" AS ENUM ('REFERRAL_K0','BINARY_K1','MATCHING_K2');
CREATE TYPE ledger."SettlementStatus" AS ENUM ('DRAFT','CALCULATED','FINALIZED','VOIDED');

CREATE TABLE rules.runtime_rule_parameter (
  runtime_rule_parameter_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_code text NOT NULL,
  parameter_code text NOT NULL,
  scope_key text NOT NULL DEFAULT '*',
  value_json jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_runtime_parameter UNIQUE(rule_version_code,parameter_code,scope_key,effective_from),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX ix_runtime_parameter_resolve
ON rules.runtime_rule_parameter(rule_version_code,parameter_code,scope_key,effective_from,effective_to);

CREATE TABLE ledger.settlement_batch (
  settlement_batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_type ledger."SettlementType" NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  rule_version_code text NOT NULL,
  status ledger."SettlementStatus" NOT NULL DEFAULT 'DRAFT',
  total_gpv numeric(18,4) NOT NULL DEFAULT 0,
  pool_rate numeric(10,6) NOT NULL DEFAULT 0,
  pool_available numeric(18,4) NOT NULL DEFAULT 0,
  total_theory numeric(18,4) NOT NULL DEFAULT 0,
  k_factor numeric(18,8) NOT NULL DEFAULT 1,
  calculation_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CONSTRAINT uq_settlement_period UNIQUE(settlement_type,period_start,period_end,rule_version_code),
  CHECK (period_end > period_start),
  CHECK (k_factor >= 0 AND k_factor <= 1)
);
CREATE INDEX ix_settlement_type_status_end
ON ledger.settlement_batch(settlement_type,status,period_end);

CREATE TABLE ledger.bonus_award (
  bonus_award_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_batch_id uuid REFERENCES ledger.settlement_batch(settlement_batch_id),
  award_type ledger."BonusAwardType" NOT NULL,
  recipient_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  source_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  source_event_id uuid,
  source_award_id uuid,
  generation_no integer,
  theory_amount numeric(18,4) NOT NULL,
  k_factor numeric(18,8) NOT NULL DEFAULT 1,
  payable_amount numeric(18,4) NOT NULL,
  active_snapshot boolean NOT NULL,
  effective_direct_count_snapshot integer,
  plan_level_snapshot text,
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  occurred_at timestamptz NOT NULL,
  pending_until timestamptz NOT NULL,
  calculation_detail jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_bonus_award_source
ON ledger.bonus_award(
  award_type,
  recipient_qualification_id,
  COALESCE(source_event_id,'00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(generation_no,0),
  COALESCE(settlement_batch_id,'00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE INDEX ix_bonus_recipient_type_time
ON ledger.bonus_award(recipient_qualification_id,award_type,occurred_at);
CREATE INDEX ix_bonus_settlement_type
ON ledger.bonus_award(settlement_batch_id,award_type);

CREATE TABLE ledger.bonus_award_lifecycle_event (
  lifecycle_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_award_id uuid NOT NULL REFERENCES ledger.bonus_award(bonus_award_id),
  status ledger."BonusAwardLifecycleStatus" NOT NULL,
  occurred_at timestamptz NOT NULL,
  reason_code text,
  source_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_bonus_lifecycle_award_time
ON ledger.bonus_award_lifecycle_event(bonus_award_id,occurred_at);

CREATE TABLE ledger.binary_carry (
  binary_carry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  period_end timestamptz NOT NULL,
  left_carry_in numeric(18,4) NOT NULL,
  right_carry_in numeric(18,4) NOT NULL,
  left_period_gpv numeric(18,4) NOT NULL,
  right_period_gpv numeric(18,4) NOT NULL,
  paired_pv numeric(18,4) NOT NULL,
  left_carry_out numeric(18,4) NOT NULL,
  right_carry_out numeric(18,4) NOT NULL,
  weekly_cap_snapshot numeric(18,4) NOT NULL,
  rule_version_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_binary_carry_period UNIQUE(qualification_id,period_end,rule_version_code)
);
CREATE INDEX ix_binary_carry_q_end ON ledger.binary_carry(qualification_id,period_end);

CREATE TRIGGER trg_bonus_award_append_only
BEFORE UPDATE OR DELETE ON ledger.bonus_award
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE TRIGGER trg_bonus_lifecycle_append_only
BEFORE UPDATE OR DELETE ON ledger.bonus_award_lifecycle_event
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE TRIGGER trg_binary_carry_append_only
BEFORE UPDATE OR DELETE ON ledger.binary_carry
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE TRIGGER trg_settlement_no_delete
BEFORE DELETE ON ledger.settlement_batch
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

-- Runtime rule projection. Canonical production design remains the full hierarchical
-- Rule Set -> Rule Version -> Parameter Set registry from the DB architecture spec.
INSERT INTO rules.runtime_rule_parameter
(rule_version_code,parameter_code,scope_key,value_json,effective_from)
VALUES
('R1.0B','pool.referral.rate','*','0.42','2026-09-01T00:00:00+08:00'),
('R1.0B','pool.binary.rate','*','0.36','2026-09-01T00:00:00+08:00'),
('R1.0B','pool.matching.rate','*','0.15','2026-09-01T00:00:00+08:00'),
('R1.0B','award.pending.days','*','45','2026-09-01T00:00:00+08:00'),
('R1.0B','referral.g1.rate','STARTER','0.15','2026-09-01T00:00:00+08:00'),
('R1.0B','referral.g1.rate','ELITE','0.20','2026-09-01T00:00:00+08:00'),
('R1.0B','referral.g1.rate','LEADER','0.25','2026-09-01T00:00:00+08:00'),
('R1.0B','binary.pair.rate','*','0.12','2026-09-01T00:00:00+08:00'),
('R1.0B','binary.weekly.cap','STARTER','450000','2026-09-01T00:00:00+08:00'),
('R1.0B','binary.weekly.cap','ELITE','900000','2026-09-01T00:00:00+08:00'),
('R1.0B','binary.weekly.cap','LEADER','1500000','2026-09-01T00:00:00+08:00'),
('R1.0B','matching.rate','1','0.15','2026-09-01T00:00:00+08:00'),
('R1.0B','matching.rate','2','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','matching.rate','3','0.05','2026-09-01T00:00:00+08:00'),
('R1.0B','matching.rate','4','0.05','2026-09-01T00:00:00+08:00'),
('R1.0B','matching.rate','5','0.05','2026-09-01T00:00:00+08:00')
ON CONFLICT DO NOTHING;

-- Equalization rates: scope key = PLAN:Gn
INSERT INTO rules.runtime_rule_parameter
(rule_version_code,parameter_code,scope_key,value_json,effective_from)
VALUES
('R1.0B','equalization.rate','STARTER:G2','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','STARTER:G3','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','STARTER:G4','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','ELITE:G2','0.20','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','ELITE:G3','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','ELITE:G4','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','ELITE:G5','0.05','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','ELITE:G6','0.05','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','LEADER:G2','0.20','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','LEADER:G3','0.15','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','LEADER:G4','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','LEADER:G5','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','LEADER:G6','0.10','2026-09-01T00:00:00+08:00'),
('R1.0B','equalization.rate','LEADER:G7','0.05','2026-09-01T00:00:00+08:00')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE ledger.bonus_award IS
'推薦、推薦對等、Binary、Matching之不可變獎金計算結果。Theory與K後Payable均保存，生命週期另由bonus_award_lifecycle_event記錄。';
COMMENT ON TABLE ledger.binary_carry IS
'Binary週結算之左右Carry快照。Pair後扣除相同Pair PV，強區未配對業績保留。';
