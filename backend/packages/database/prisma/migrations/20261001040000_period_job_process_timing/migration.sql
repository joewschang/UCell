-- Actual durable process transitions only; old entry times cannot be reconstructed.
CREATE TABLE integration.period_job_process_transition (
 transition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 outbox_event_id uuid NOT NULL REFERENCES integration.outbox_event(outbox_event_id),
 revision integer NOT NULL CHECK (revision > 0),
 from_status integration."EventProcessStatus",
 to_status integration."EventProcessStatus" NOT NULL,
 entered_at timestamptz,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(outbox_event_id,revision),
 CHECK (entered_at IS NULL OR entered_at=recorded_at)
);

-- This is an observation of legacy state, never an invented stage-entry timestamp.
INSERT INTO integration.period_job_process_transition(outbox_event_id,revision,to_status,entered_at)
 SELECT outbox_event_id,1,process_status,NULL FROM integration.outbox_event
 WHERE event_type='PERIOD_CLOSE_REQUESTED' AND aggregate_type='PERIOD_CLOSE_JOB';

CREATE FUNCTION integration.ucell_period_process_transition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' OR pg_trigger_depth()<2 THEN
  RAISE EXCEPTION 'Period process transitions are trigger-owned immutable evidence' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER period_process_transition_immutable BEFORE INSERT OR UPDATE OR DELETE
 ON integration.period_job_process_transition FOR EACH ROW
 EXECUTE FUNCTION integration.ucell_period_process_transition_guard();

CREATE FUNCTION integration.ucell_period_process_capture() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_revision integer; captured_at timestamptz;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.event_type='PERIOD_CLOSE_REQUESTED' AND OLD.aggregate_type='PERIOD_CLOSE_JOB'
   AND (NEW.event_type IS DISTINCT FROM OLD.event_type OR NEW.aggregate_type IS DISTINCT FROM OLD.aggregate_type OR NEW.aggregate_id IS DISTINCT FROM OLD.aggregate_id) THEN
   RAISE EXCEPTION 'Period process identity is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.event_type<>'PERIOD_CLOSE_REQUESTED' OR NEW.aggregate_type<>'PERIOD_CLOSE_JOB' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.process_status IS NOT DISTINCT FROM OLD.process_status THEN RETURN NEW; END IF;
 END IF;
 SELECT COALESCE(max(revision),0)+1 INTO next_revision
  FROM integration.period_job_process_transition WHERE outbox_event_id=NEW.outbox_event_id;
 captured_at:=clock_timestamp();
 INSERT INTO integration.period_job_process_transition(outbox_event_id,revision,from_status,to_status,entered_at,recorded_at)
 VALUES(NEW.outbox_event_id,next_revision,CASE WHEN TG_OP='UPDATE' THEN OLD.process_status ELSE NULL END,
 NEW.process_status,captured_at,captured_at);
 RETURN NEW;
END $$;
CREATE TRIGGER period_process_capture AFTER INSERT OR UPDATE
 ON integration.outbox_event FOR EACH ROW EXECUTE FUNCTION integration.ucell_period_process_capture();
