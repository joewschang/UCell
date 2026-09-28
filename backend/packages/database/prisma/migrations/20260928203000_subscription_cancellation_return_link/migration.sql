-- A single accepted commerce return can produce one immutable subscription
-- cancellation fact.  Request idempotency and the ReturnCase link permit
-- multiple legitimate partial returns without reusing or updating history.
ALTER TABLE subscription.subscription_cancellation
  DROP CONSTRAINT subscription_cancellation_subscription_id_effective_at_reason_code_key,
  ADD COLUMN source_return_case_id uuid,
  ADD COLUMN idempotency_key text,
  ADD CONSTRAINT subscription_cancellation_source_return_case_id_key UNIQUE (source_return_case_id),
  ADD CONSTRAINT subscription_cancellation_idempotency_key_key UNIQUE (idempotency_key),
  ADD CONSTRAINT subscription_cancellation_source_return_case_id_fkey
    FOREIGN KEY (source_return_case_id) REFERENCES commerce.return_case(return_case_id);
