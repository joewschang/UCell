-- Align the persisted safety horizon with the validated service contract.
-- This changes no calculation rule; it only permits the existing 1..260 replay guard.
ALTER TABLE ledger.settlement_replay_run
  DROP CONSTRAINT IF EXISTS settlement_replay_run_max_weeks_check;

ALTER TABLE ledger.settlement_replay_run
  ADD CONSTRAINT settlement_replay_run_max_weeks_check
  CHECK (max_weeks BETWEEN 1 AND 260);
