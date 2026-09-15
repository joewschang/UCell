CREATE TYPE membership."QualificationLifecycleStatus" AS ENUM
('DRAFT','PENDING','EFFECTIVE','SUSPENDED','EXITED','TRANSFERRED','VOIDED','CLOSED');
CREATE TYPE commerce."OrderPurpose" AS ENUM
('ENTRY','RETAIL','REPURCHASE','SUBSCRIPTION_PREPAY','UPGRADE');
CREATE TYPE commerce."ReturnStatus" AS ENUM ('DRAFT','CONFIRMED','POSTED','VOIDED');
CREATE TYPE ledger."RecoveryStatus" AS ENUM ('OPEN','OFFSETTING','RECOVERED','WAIVED');
ALTER TYPE ledger."BonusAwardType" ADD VALUE IF NOT EXISTS 'EPV';
CREATE TYPE ledger."PayoutBatchStatus" AS ENUM ('DRAFT','READY','EXPORTED','PAID','VOIDED');
CREATE TYPE ledger."GlobalRankCode" AS ENUM ('NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN');

ALTER TABLE commerce."order"
ADD COLUMN purpose commerce."OrderPurpose" NOT NULL DEFAULT 'RETAIL';

CREATE TABLE membership.qualification_status_history (
  qualification_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  status membership."QualificationLifecycleStatus" NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source_type text NOT NULL,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX ix_qualification_status_history_time
ON membership.qualification_status_history(qualification_id,effective_from,effective_to);

-- Backfill current effective qualifications as the initial temporal status projection.
INSERT INTO membership.qualification_status_history
(qualification_id,status,effective_from,source_type)
SELECT qualification_id,'EFFECTIVE',COALESCE(effective_at,created_at),'BACKFILL_V050'
FROM membership.qualification
WHERE status='EFFECTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM membership.qualification_status_history qsh
    WHERE qsh.qualification_id=membership.qualification.qualification_id
  );

CREATE TABLE commerce.return_case (
  return_case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  status commerce."ReturnStatus" NOT NULL DEFAULT 'DRAFT',
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL,
  posted_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_return_order_time ON commerce.return_case(order_id,occurred_at);

CREATE TABLE commerce.return_line (
  return_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_case_id uuid NOT NULL REFERENCES commerce.return_case(return_case_id),
  order_line_id uuid NOT NULL REFERENCES commerce.order_line(order_line_id),
  quantity numeric(18,4) NOT NULL CHECK (quantity>0),
  return_amount numeric(18,2) NOT NULL CHECK (return_amount>=0),
  gpv_reversal_amount numeric(18,4) NOT NULL CHECK (gpv_reversal_amount>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_return_line UNIQUE(return_case_id,order_line_id)
);
CREATE INDEX ix_return_line_order_line ON commerce.return_line(order_line_id);

CREATE TABLE ledger.bonus_recovery_event (
  bonus_recovery_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_award_id uuid NOT NULL REFERENCES ledger.bonus_award(bonus_award_id),
  return_case_id uuid REFERENCES commerce.return_case(return_case_id),
  recovery_amount numeric(18,4) NOT NULL CHECK (recovery_amount>=0),
  recovered_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (recovered_amount>=0),
  status ledger."RecoveryStatus" NOT NULL DEFAULT 'OPEN',
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_bonus_recovery_award_status ON ledger.bonus_recovery_event(bonus_award_id,status);
CREATE INDEX ix_bonus_recovery_return ON ledger.bonus_recovery_event(return_case_id);

CREATE TABLE ledger.settlement_recalculation_request (
  settlement_recalculation_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_return_case_id uuid NOT NULL REFERENCES commerce.return_case(return_case_id),
  settlement_type text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  impacted_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX ix_settlement_recalc_pending ON ledger.settlement_recalculation_request(status,period_end);

CREATE TABLE ledger.payout_batch (
  payout_batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status ledger."PayoutBatchStatus" NOT NULL DEFAULT 'DRAFT',
  total_gross numeric(18,4) NOT NULL DEFAULT 0,
  total_recovery numeric(18,4) NOT NULL DEFAULT 0,
  total_net numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  exported_at timestamptz,
  paid_at timestamptz,
  CHECK (period_end>period_start)
);
CREATE INDEX ix_payout_batch_status_end ON ledger.payout_batch(status,period_end);

CREATE TABLE ledger.payout_line (
  payout_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id uuid NOT NULL REFERENCES ledger.payout_batch(payout_batch_id),
  recipient_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  gross_amount numeric(18,4) NOT NULL,
  recovery_offset numeric(18,4) NOT NULL DEFAULT 0,
  net_amount numeric(18,4) NOT NULL,
  detail_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payout_line UNIQUE(payout_batch_id,recipient_qualification_id)
);

CREATE TABLE ledger.qualification_global_rank_history (
  qualification_global_rank_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  rank_code ledger."GlobalRankCode" NOT NULL,
  achieved_at timestamptz NOT NULL,
  source_period_end timestamptz NOT NULL,
  rule_version_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_global_rank_achievement UNIQUE(qualification_id,rank_code)
);
CREATE INDEX ix_global_rank_code_time ON ledger.qualification_global_rank_history(rank_code,achieved_at);

CREATE TABLE ledger.global_pool_settlement (
  global_pool_settlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_gpv numeric(18,4) NOT NULL,
  pool_rate numeric(10,6) NOT NULL,
  pool_available numeric(18,4) NOT NULL,
  distributed_amount numeric(18,4) NOT NULL,
  undistributed_amount numeric(18,4) NOT NULL,
  rule_version_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_global_pool_period UNIQUE(period_start,period_end,rule_version_code)
);

CREATE TABLE ledger.global_pool_award (
  global_pool_award_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_pool_settlement_id uuid NOT NULL REFERENCES ledger.global_pool_settlement(global_pool_settlement_id),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  rank_level ledger."GlobalRankCode" NOT NULL,
  rank_pool_rate numeric(10,6) NOT NULL,
  rank_pool_amount numeric(18,4) NOT NULL,
  eligible_count integer NOT NULL CHECK (eligible_count>0),
  payable_amount numeric(18,4) NOT NULL,
  weak_side_pv_snapshot numeric(18,4) NOT NULL,
  active_snapshot boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_global_award UNIQUE(global_pool_settlement_id,qualification_id,rank_level)
);
CREATE INDEX ix_global_award_q_rank ON ledger.global_pool_award(qualification_id,rank_level);

CREATE TABLE ledger.welfare_pool_accrual (
  welfare_pool_accrual_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_gpv numeric(18,4) NOT NULL,
  pool_rate numeric(10,6) NOT NULL,
  accrued_amount numeric(18,4) NOT NULL,
  rule_version_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_welfare_period UNIQUE(period_start,period_end,rule_version_code)
);

CREATE TRIGGER trg_return_case_no_delete
BEFORE DELETE ON commerce.return_case
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_return_line_no_delete
BEFORE DELETE ON commerce.return_line
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_qualification_status_no_delete
BEFORE DELETE ON membership.qualification_status_history
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_bonus_recovery_no_delete
BEFORE DELETE ON ledger.bonus_recovery_event
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_global_pool_award_append_only
BEFORE UPDATE OR DELETE ON ledger.global_pool_award
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE TRIGGER trg_welfare_pool_no_delete
BEFORE DELETE ON ledger.welfare_pool_accrual
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

-- v0.5 parameters
INSERT INTO rules.runtime_rule_parameter
(rule_version_code,parameter_code,scope_key,value_json,effective_from)
VALUES
('R1.0B','epv.base_amount','*','2000','2026-09-01T00:00:00+08:00'),
('R1.0B','epv.rate','*','0.60','2026-09-01T00:00:00+08:00'),
('R1.0B','epv.self.rate','*','0.50','2026-09-01T00:00:00+08:00'),
('R1.0B','epv.upline.rate','1','0.06','2026-09-01T00:00:00+08:00'),
('R1.0B','epv.upline.rate','2','0.06','2026-09-01T00:00:00+08:00'),
('R1.0B','epv.upline.rate','3','0.06','2026-09-01T00:00:00+08:00'),
('R1.0B','epv.upline.rate','4','0.06','2026-09-01T00:00:00+08:00'),
('R1.0B','epv.upline.rate','5','0.06','2026-09-01T00:00:00+08:00'),
('R1.0B','pool.global.rate','*','0.05','2026-09-01T00:00:00+08:00'),
('R1.0B','pool.welfare.rate','*','0.02','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.pool_rate','NEW_STAR','0.015','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.pool_rate','EXCELLENCE','0.010','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.pool_rate','GLORY','0.005','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.pool_rate','DIAMOND','0.005','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.pool_rate','CROWN','0.015','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.weak_threshold','NEW_STAR','300000','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.weak_threshold','EXCELLENCE','600000','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.weak_threshold','GLORY','1000000','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.weak_threshold','DIAMOND','2000000','2026-09-01T00:00:00+08:00'),
('R1.0B','global.rank.weak_threshold','CROWN','4000000','2026-09-01T00:00:00+08:00')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE membership.qualification_status_history IS
'Qualification狀態的時間型歷史。有效直推、歷史獎金資格等不得只讀目前qualification.status。';
COMMENT ON TABLE ledger.settlement_recalculation_request IS
'退貨影響已結算Binary/Matching時建立之重算需求。不得直接覆寫原Settlement或Binary Carry。';
COMMENT ON TABLE ledger.welfare_pool_accrual IS
'2%福利池目前只做應計。未有正式分配規則前，不得自行產生成員獎金。';
