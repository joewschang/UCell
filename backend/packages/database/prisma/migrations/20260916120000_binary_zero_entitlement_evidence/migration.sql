CREATE TABLE ledger.bonus_calculation_evidence (
  bonus_calculation_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_batch_id uuid NOT NULL REFERENCES ledger.settlement_batch(settlement_batch_id),
  evidence_type text NOT NULL,
  recipient_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  reason_code text NOT NULL,
  theoretical_amount numeric(18,4) NOT NULL,
  entitlement_amount numeric(18,4) NOT NULL DEFAULT 0,
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  occurred_at timestamptz NOT NULL,
  calculation_detail jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bonus_calculation_evidence UNIQUE (settlement_batch_id,evidence_type,recipient_qualification_id),
  CONSTRAINT ck_bonus_zero_entitlement CHECK (entitlement_amount = 0)
);

CREATE INDEX ix_bonus_calculation_evidence_recipient
ON ledger.bonus_calculation_evidence(recipient_qualification_id,evidence_type,occurred_at);

CREATE TRIGGER trg_bonus_calculation_evidence_append_only
BEFORE UPDATE OR DELETE ON ledger.bonus_calculation_evidence
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

COMMENT ON TABLE ledger.bonus_calculation_evidence IS
'Append-only non-monetary eligibility evidence. Zero entitlement rows explain why a calculated candidate produced no payable award.';
