-- A posted Return can request each sealed settlement period/type exactly once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recalculation_return_type_period
ON ledger.settlement_recalculation_request
  (source_return_case_id, settlement_type, period_start, period_end);
