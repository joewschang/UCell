-- UCell R1.0B FROZEN / Backend v0.6.2
-- Carry-chain replay and schema convergence.

ALTER TYPE ledger."BonusAwardType" ADD VALUE IF NOT EXISTS 'RPV';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='ledger' AND t.typname='ReplayRunStatus'
  ) THEN
    CREATE TYPE ledger."ReplayRunStatus" AS ENUM ('PENDING','RUNNING','CONVERGED','MAX_HORIZON','FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ledger.settlement_replay_run (
  settlement_replay_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_return_case_id uuid NOT NULL UNIQUE REFERENCES commerce.return_case(return_case_id),
  initial_period_start timestamptz NOT NULL,
  initial_period_end timestamptz NOT NULL,
  rule_version_code text NOT NULL,
  status ledger."ReplayRunStatus" NOT NULL DEFAULT 'PENDING',
  max_weeks integer NOT NULL DEFAULT 26 CHECK (max_weeks BETWEEN 1 AND 104),
  processed_weeks integer NOT NULL DEFAULT 0,
  converged_at timestamptz,
  calculation_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger.settlement_replay_period (
  settlement_replay_period_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_replay_run_id uuid NOT NULL REFERENCES ledger.settlement_replay_run(settlement_replay_run_id),
  period_no integer NOT NULL CHECK (period_no > 0),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  original_k1 numeric(18,8) NOT NULL,
  recomputed_k1 numeric(18,8) NOT NULL,
  original_k2 numeric(18,8),
  recomputed_k2 numeric(18,8),
  impacted_qualifications jsonb NOT NULL,
  carry_delta_snapshot jsonb NOT NULL,
  award_delta_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_replay_run_period UNIQUE(settlement_replay_run_id,period_end)
);
CREATE INDEX IF NOT EXISTS ix_replay_period_end ON ledger.settlement_replay_period(period_end);

CREATE TRIGGER trg_replay_run_updated_at
BEFORE UPDATE ON ledger.settlement_replay_run
FOR EACH ROW EXECUTE FUNCTION public.ucell_set_updated_at();

CREATE TRIGGER trg_replay_period_append_only
BEFORE UPDATE OR DELETE ON ledger.settlement_replay_period
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE TRIGGER trg_replay_run_no_delete
BEFORE DELETE ON ledger.settlement_replay_run
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

COMMENT ON TABLE ledger.settlement_replay_run IS
'Return-driven deterministic weekly replay. Propagates recomputed carry through subsequent finalized Binary periods until carry converges or max horizon is reached.';
COMMENT ON TABLE ledger.settlement_replay_period IS
'Immutable per-period replay trace containing K1/K2, impacted qualifications, carry deltas and award deltas.';
