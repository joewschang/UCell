-- A cancellation fact is append-only.  Retrying the same governed
-- cancellation request must reuse that fact rather than enqueueing another
-- recovery chain.
ALTER TABLE subscription.subscription_cancellation
  ADD CONSTRAINT subscription_cancellation_subscription_id_effective_at_reason_code_key
  UNIQUE (subscription_id, effective_at, reason_code);
