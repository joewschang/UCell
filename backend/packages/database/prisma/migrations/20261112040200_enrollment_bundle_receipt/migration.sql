CREATE TABLE commerce.enrollment_bundle_payment (
  bundle_id uuid PRIMARY KEY REFERENCES membership.enrollment_bundle(bundle_id) ON DELETE RESTRICT,
  receipt_id uuid NOT NULL UNIQUE,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL,
  reference_no text NOT NULL CHECK (length(btrim(reference_no)) BETWEEN 1 AND 180),
  received_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  request_id text NOT NULL
);
CREATE UNIQUE INDEX enrollment_bundle_payment_evidence_key
  ON commerce.enrollment_bundle_payment (upper(btrim(payment_method)), upper(btrim(reference_no)));

CREATE TABLE commerce.enrollment_bundle_payment_report (
  bundle_id uuid PRIMARY KEY REFERENCES membership.enrollment_bundle(bundle_id) ON DELETE RESTRICT,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  account_last_five text NOT NULL CHECK (account_last_five ~ '^[0-9]{5}$'),
  paid_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
