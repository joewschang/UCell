-- SA-20260915-03. Additive only; historical snapshots remain unknown (NULL).
-- Do not backfill using today's parameters or change historical monetary amounts.
ALTER TABLE ledger.settlement_batch ADD COLUMN parameter_snapshot JSONB;
ALTER TABLE ledger.global_pool_settlement ADD COLUMN parameter_snapshot JSONB;
ALTER TABLE ledger.welfare_pool_accrual ADD COLUMN parameter_snapshot JSONB;
