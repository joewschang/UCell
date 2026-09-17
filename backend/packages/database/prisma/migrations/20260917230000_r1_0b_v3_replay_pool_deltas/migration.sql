-- Migration 42: append-only replay deltas for Global Reservoir A and Welfare.
ALTER TYPE ledger."ReservoirEffectType" RENAME TO "ReservoirEffectType_old";
CREATE TYPE ledger."ReservoirEffectType" AS ENUM ('GLOBAL_UNDISTRIBUTED','REPLAY_ADJUSTMENT');
ALTER TABLE ledger.reservoir_ledger_effect ALTER COLUMN effect_type TYPE ledger."ReservoirEffectType" USING effect_type::text::ledger."ReservoirEffectType";
DROP TYPE ledger."ReservoirEffectType_old";
CREATE TYPE ledger."WelfareEffectType" AS ENUM ('INITIAL_ACCRUAL','REPLAY_ADJUSTMENT');

ALTER TABLE ledger.reservoir_ledger_effect ADD COLUMN replay_action_key text;
ALTER TABLE ledger.reservoir_ledger_effect DROP CONSTRAINT uq_reservoir_source_effect;
ALTER TABLE ledger.reservoir_ledger_effect DROP CONSTRAINT ck_reservoir_amount;
ALTER TABLE ledger.reservoir_ledger_effect ADD CONSTRAINT ck_reservoir_effect_shape CHECK (
  (effect_type = 'GLOBAL_UNDISTRIBUTED' AND amount >= 0 AND replay_action_key IS NULL) OR
  (effect_type = 'REPLAY_ADJUSTMENT' AND amount <> 0 AND replay_action_key IS NOT NULL)
);
CREATE UNIQUE INDEX uq_reservoir_initial_source ON ledger.reservoir_ledger_effect(reservoir_code,source_global_settlement_id) WHERE effect_type = 'GLOBAL_UNDISTRIBUTED';
CREATE UNIQUE INDEX uq_reservoir_replay_action ON ledger.reservoir_ledger_effect(replay_action_key) WHERE replay_action_key IS NOT NULL;

CREATE OR REPLACE FUNCTION ledger.validate_reservoir_a_effect() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_row ledger.global_pool_settlement%ROWTYPE;
BEGIN
  SELECT * INTO source_row FROM ledger.global_pool_settlement WHERE global_pool_settlement_id = NEW.source_global_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVOIR_A_SOURCE_MISSING'; END IF;
  IF NEW.source_period_start <> source_row.period_start OR NEW.source_period_end <> source_row.period_end OR NEW.rule_version_code <> source_row.rule_version_code THEN RAISE EXCEPTION 'RESERVOIR_A_SOURCE_MISMATCH'; END IF;
  IF NEW.effect_type = 'GLOBAL_UNDISTRIBUTED' AND NEW.amount <> source_row.undistributed_amount THEN RAISE EXCEPTION 'RESERVOIR_A_SOURCE_MISMATCH'; END IF;
  RETURN NEW;
END $$;

CREATE TABLE ledger.welfare_pool_effect (
  welfare_pool_effect_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), welfare_pool_accrual_id uuid NOT NULL REFERENCES ledger.welfare_pool_accrual(welfare_pool_accrual_id),
  effect_type ledger."WelfareEffectType" NOT NULL, amount numeric(18,4) NOT NULL, rule_version_code text NOT NULL,
  idempotency_key text NOT NULL UNIQUE, evidence_hash text NOT NULL, replay_action_key text, created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT ck_welfare_effect_shape CHECK ((effect_type = 'INITIAL_ACCRUAL' AND amount >= 0 AND replay_action_key IS NULL) OR (effect_type = 'REPLAY_ADJUSTMENT' AND amount <> 0 AND replay_action_key IS NOT NULL))
);
CREATE INDEX ix_welfare_effect_source ON ledger.welfare_pool_effect(welfare_pool_accrual_id,created_at);
CREATE UNIQUE INDEX uq_welfare_initial_source ON ledger.welfare_pool_effect(welfare_pool_accrual_id) WHERE effect_type = 'INITIAL_ACCRUAL';
CREATE UNIQUE INDEX uq_welfare_replay_action ON ledger.welfare_pool_effect(replay_action_key) WHERE replay_action_key IS NOT NULL;

INSERT INTO ledger.welfare_pool_effect(welfare_pool_accrual_id,effect_type,amount,rule_version_code,idempotency_key,evidence_hash)
SELECT welfare_pool_accrual_id,'INITIAL_ACCRUAL',accrued_amount,rule_version_code,'welfare:initial:' || welfare_pool_accrual_id,
       encode(digest(concat_ws('|','WELFARE','INITIAL_ACCRUAL',welfare_pool_accrual_id::text,accrued_amount::text,rule_version_code),'sha256'),'hex')
FROM ledger.welfare_pool_accrual;

CREATE FUNCTION ledger.validate_welfare_pool_effect() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_row ledger.welfare_pool_accrual%ROWTYPE;
BEGIN
  SELECT * INTO source_row FROM ledger.welfare_pool_accrual WHERE welfare_pool_accrual_id = NEW.welfare_pool_accrual_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WELFARE_SOURCE_MISSING'; END IF;
  IF NEW.rule_version_code <> source_row.rule_version_code THEN RAISE EXCEPTION 'WELFARE_SOURCE_MISMATCH'; END IF;
  IF NEW.effect_type = 'INITIAL_ACCRUAL' AND NEW.amount <> source_row.accrued_amount THEN RAISE EXCEPTION 'WELFARE_SOURCE_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_welfare_pool_effect BEFORE INSERT ON ledger.welfare_pool_effect FOR EACH ROW EXECUTE FUNCTION ledger.validate_welfare_pool_effect();
CREATE TRIGGER trg_welfare_pool_effect_append_only BEFORE UPDATE OR DELETE ON ledger.welfare_pool_effect FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
COMMENT ON TABLE ledger.welfare_pool_effect IS 'Append-only Welfare initial accrual and signed replay deltas; it never creates a member Award.';
