-- UCell R1.0B FROZEN / Backend v0.6.1
-- Complete supporting tables for deterministic replay, subscription cancellation and qualification workflow.

CREATE TABLE IF NOT EXISTS membership.qualification_plan_history (
  qualification_plan_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  plan_code text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source_type text NOT NULL,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX IF NOT EXISTS ix_q_plan_history_time
ON membership.qualification_plan_history(qualification_id,effective_from,effective_to);

CREATE TABLE IF NOT EXISTS subscription.subscription_cancellation (
  subscription_cancellation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscription.subscription(subscription_id),
  requested_at timestamptz NOT NULL,
  effective_at timestamptz NOT NULL,
  reason_code text NOT NULL,
  refund_amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'POSTED',
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_subscription_cancellation_sub
ON subscription.subscription_cancellation(subscription_id,effective_at);

-- Recognition status must support immutable reversal state.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid=t.oid
    JOIN pg_namespace n ON t.typnamespace=n.oid
    WHERE n.nspname='subscription'
      AND t.typname='RecognitionStatus'
      AND e.enumlabel='REVERSED'
  ) THEN
    ALTER TYPE subscription."RecognitionStatus" ADD VALUE 'REVERSED';
  END IF;
END $$;

CREATE TRIGGER trg_q_plan_history_no_delete
BEFORE DELETE ON membership.qualification_plan_history
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_subscription_cancellation_no_delete_v061
BEFORE DELETE ON subscription.subscription_cancellation
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

COMMENT ON TABLE membership.qualification_plan_history IS
'Qualification plan level temporal history. Upgrade is prospective only; past awards retain the original plan snapshot.';
COMMENT ON TABLE subscription.subscription_cancellation IS
'Subscription cancellation fact. Future schedule rows are cancelled; recognized rows are reversed via explicit RPV reversal events.';
