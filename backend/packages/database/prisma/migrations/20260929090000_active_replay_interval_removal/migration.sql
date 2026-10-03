-- Preserve historical rows; only a typed superseding removal may be zero-length.
ALTER TABLE ledger.active_interval_evidence
  DROP CONSTRAINT ck_active_interval_order,
  ADD CONSTRAINT ck_active_interval_order CHECK (
    (active_to > active_from AND reason_code <> 'HISTORICAL_RETURN_REPLAY_INACTIVE')
    OR (active_to = active_from AND reason_code = 'HISTORICAL_RETURN_REPLAY_INACTIVE'
        AND supersedes_active_evidence_id IS NOT NULL)
  );
