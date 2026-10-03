-- Prospective admission guard only: no historical ledger or receipt is rewritten.
CREATE FUNCTION ledger.guard_closed_period_original_volume() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Exact redelivery may reach BEFORE INSERT before a unique conflict is resolved.
 -- Nullable source-line identities are not unique in PostgreSQL and cannot bypass closure.
 IF EXISTS (SELECT 1 FROM ledger.pv_ledger prior WHERE
   (prior.event_id=NEW.event_id OR (NEW.source_line_id IS NOT NULL
    AND prior.event_type=NEW.event_type AND prior.source_type=NEW.source_type
    AND prior.source_id=NEW.source_id AND prior.source_line_id=NEW.source_line_id AND prior.pv_type=NEW.pv_type))
   AND prior.qualification_id=NEW.qualification_id AND prior.pv_type=NEW.pv_type
   AND prior.amount=NEW.amount AND prior.rule_version_code=NEW.rule_version_code
   AND prior.occurred_at=NEW.occurred_at AND prior.reversal_of_event_id IS NOT DISTINCT FROM NEW.reversal_of_event_id) THEN
  RETURN NEW;
 END IF;
 -- Existing governed corrections retain the original identity and append a linked effect.
 IF NEW.reversal_of_event_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM ledger.pv_ledger original WHERE original.event_id=NEW.reversal_of_event_id
     AND original.qualification_id=NEW.qualification_id AND original.pv_type=NEW.pv_type
     AND original.rule_version_code=NEW.rule_version_code
 ) AND ((NEW.source_type='RETURN' AND NEW.event_type IN ('GPV_REVERSAL','EPV_REPLAY_ADJUSTMENT'))
     OR (NEW.source_type='MONTHLY_RECOGNITION_REVERSAL' AND NEW.event_type='RPV_REVERSAL')) THEN
  RETURN NEW;
 END IF;
 IF EXISTS (SELECT 1 FROM integration.period_close_job job
   JOIN integration.period_close_receipt receipt USING(period_close_job_id)
   WHERE job.rule_version_code=NEW.rule_version_code
     AND NEW.occurred_at>=job.period_start AND NEW.occurred_at<job.period_end) THEN
  RAISE EXCEPTION 'PERIOD_CLOSE_LATE_INPUT_REQUIRES_CORRECTION' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER period_close_original_volume_guard BEFORE INSERT ON ledger.pv_ledger
 FOR EACH ROW EXECUTE FUNCTION ledger.guard_closed_period_original_volume();
