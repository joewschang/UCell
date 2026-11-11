CREATE TABLE ledger.compensation_audit_period (
  settlement_batch_id uuid PRIMARY KEY REFERENCES ledger.settlement_batch(settlement_batch_id),
  checked_at timestamptz NOT NULL, checked_sources integer NOT NULL, checked_awards integer NOT NULL,
  expected_amount numeric(18,4) NOT NULL, recorded_amount numeric(18,4) NOT NULL,
  open_cases integer NOT NULL, evidence_hash text NOT NULL
);
CREATE TABLE ledger.compensation_audit_case (
  settlement_batch_id uuid NOT NULL REFERENCES ledger.settlement_batch(settlement_batch_id),
  case_key text NOT NULL, reason text NOT NULL, qualification_id uuid,
  source_order_id uuid, expected_amount numeric(18,4), recorded_amount numeric(18,4),
  evidence jsonb NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(), verified_at timestamptz,
  PRIMARY KEY (settlement_batch_id, case_key)
);
CREATE INDEX compensation_audit_pending ON ledger.compensation_audit_case(settlement_batch_id,verified_at);
CREATE INDEX compensation_audit_checked ON ledger.compensation_audit_period(checked_at);
