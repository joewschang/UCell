ALTER TYPE ledger."PayoutBatchStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE ledger."PayoutBatchStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE ledger."PayoutBatchStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE ledger."PayoutBatchStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE ledger."PayoutBatchStatus" ADD VALUE IF NOT EXISTS 'FAILED';
CREATE TYPE ledger."PayoutPaymentResultStatus" AS ENUM ('PAID', 'FAILED');
CREATE TABLE ledger.payout_payment_result (
 payout_payment_result_id uuid NOT NULL DEFAULT gen_random_uuid(), payout_batch_id uuid NOT NULL, payout_line_id uuid NOT NULL,
 result_status ledger."PayoutPaymentResultStatus" NOT NULL, paid_amount numeric(18,4) NOT NULL, payment_reference text,
 reason_code text, occurred_at timestamptz(6) NOT NULL, recorded_by_actor text NOT NULL, idempotency_key text NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT payout_payment_result_pkey PRIMARY KEY (payout_payment_result_id),
 CONSTRAINT payout_payment_result_idempotency_key_key UNIQUE (idempotency_key),
 CONSTRAINT payout_payment_result_batch_line_key UNIQUE (payout_batch_id,payout_line_id),
 CONSTRAINT payout_payment_result_batch_fkey FOREIGN KEY (payout_batch_id) REFERENCES ledger.payout_batch(payout_batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT payout_payment_result_line_fkey FOREIGN KEY (payout_line_id) REFERENCES ledger.payout_line(payout_line_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT payout_payment_result_amount_check CHECK (paid_amount >= 0)
);
CREATE INDEX payout_payment_result_batch_created_idx ON ledger.payout_payment_result(payout_batch_id,created_at);
