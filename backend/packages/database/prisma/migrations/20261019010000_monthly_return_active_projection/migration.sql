-- An empty projection represents revoked consumption-based Active eligibility.
-- The original interval remains in append-only ledger.active_interval_evidence.
ALTER TABLE membership.active_period DROP CONSTRAINT active_period_check;
ALTER TABLE membership.active_period ADD CONSTRAINT active_period_check
CHECK (active_to IS NULL OR active_to >= active_from);
