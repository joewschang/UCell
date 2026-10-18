-- Source-specific replay sealing must not scan every award while concurrent
-- Serializable recognitions insert awards for unrelated source events.
CREATE INDEX bonus_award_source_event_type_idx
ON ledger.bonus_award (source_event_id, award_type);
