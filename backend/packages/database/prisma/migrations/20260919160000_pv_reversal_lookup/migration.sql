-- Signed correction lookups must not scan the original PV population once per event.
-- Also serves Core Return/replay and period GPV aggregates; no authoritative facts change.
CREATE INDEX ix_pv_reversal_recorded ON ledger.pv_ledger (reversal_of_event_id, recorded_at)
 INCLUDE (amount) WHERE reversal_of_event_id IS NOT NULL;
