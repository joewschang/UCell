-- UCell R1.0B REVIEW R4
-- Operational payout approval/reconciliation + return recovery idempotency.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='ledger' AND t.typname='PayoutApprovalStage'
  ) THEN
    CREATE TYPE ledger."PayoutApprovalStage" AS ENUM ('FINANCE_REVIEW','COMPLIANCE_REVIEW');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='ledger' AND t.typname='PayoutApprovalDecision'
  ) THEN
    CREATE TYPE ledger."PayoutApprovalDecision" AS ENUM ('APPROVED','REJECTED');
  END IF;
END $$;

ALTER TABLE ledger.payout_batch
  ADD COLUMN IF NOT EXISTS export_reference text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_method text;

CREATE TABLE IF NOT EXISTS ledger.payout_approval (
  payout_approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id uuid NOT NULL REFERENCES ledger.payout_batch(payout_batch_id),
  stage ledger."PayoutApprovalStage" NOT NULL,
  decision ledger."PayoutApprovalDecision" NOT NULL,
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payout_approval_stage UNIQUE(payout_batch_id,stage)
);
CREATE INDEX IF NOT EXISTS ix_payout_approval_stage_decision
ON ledger.payout_approval(stage,decision,created_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bonus_recovery_return_reason
ON ledger.bonus_recovery_event(bonus_award_id,return_case_id,reason_code)
WHERE return_case_id IS NOT NULL;

CREATE TRIGGER trg_payout_approval_no_delete
BEFORE DELETE ON ledger.payout_approval
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

COMMENT ON TABLE ledger.payout_approval IS
'Two-stage operational approval record before payout export/payment.';
COMMENT ON COLUMN ledger.payout_batch.payment_reference IS
'External bank/payment reconciliation reference. This system records payment; it does not execute bank transfers by itself.';
