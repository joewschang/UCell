-- v0.6.6 convergence guards. No destructive rewrite of historical ledger facts.
CREATE INDEX IF NOT EXISTS ix_recovery_open_balance
ON ledger.bonus_recovery_event(status, outstanding_amount, occurred_at)
WHERE outstanding_amount > 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_recovery_application_line_event
ON ledger.recovery_application(payout_line_id, bonus_recovery_event_id);

COMMENT ON INDEX ledger.ix_recovery_open_balance IS
'Fast FIFO lookup for OPEN/OFFSETTING recovery balances during payout.';
