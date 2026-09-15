-- UCell R1.0B FROZEN / Backend v0.6.5
ALTER TYPE ledger."BonusAwardType" ADD VALUE IF NOT EXISTS 'GLOBAL';
COMMENT ON TABLE ledger.payable_entry IS
'Unified payable projection for BonusAward, RPV Upline Award and Global Pool Award. Source facts remain immutable.';
