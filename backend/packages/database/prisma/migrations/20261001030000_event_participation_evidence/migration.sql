ALTER TABLE learning.member_event_registration ADD COLUMN registration_cycle_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE TABLE learning.member_event_participation_evidence (
 participation_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 member_event_registration_id uuid NOT NULL REFERENCES learning.member_event_registration(member_event_registration_id),
 member_event_version_id uuid NOT NULL REFERENCES learning.member_event_version(member_event_version_id),
 registration_cycle_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('EVENT_REGISTERED','EVENT_REGISTRATION_CANCELLED','EVENT_CHECKED_IN','EVENT_ATTENDED')),
 occurred_at timestamptz(6) NOT NULL,
 origin text NOT NULL CHECK(origin IN ('LEGACY_SNAPSHOT','REGISTRATION_TRANSITION')),
 UNIQUE(member_event_registration_id,registration_cycle_id,event_type)
);
CREATE INDEX member_event_participation_time_idx ON learning.member_event_participation_evidence(occurred_at,participation_evidence_id);
-- Only extant timestamps are preserved. Previously overwritten registration cycles cannot be invented.
INSERT INTO learning.member_event_participation_evidence(member_event_registration_id,member_event_version_id,registration_cycle_id,event_type,occurred_at,origin)
 SELECT r.member_event_registration_id,r.member_event_version_id,r.registration_cycle_id,t.kind,t.at,'LEGACY_SNAPSHOT'
 FROM learning.member_event_registration r CROSS JOIN LATERAL (VALUES
 ('EVENT_REGISTERED',r.registered_at),('EVENT_REGISTRATION_CANCELLED',r.cancelled_at),('EVENT_CHECKED_IN',r.checked_in_at),('EVENT_ATTENDED',r.attended_at)) t(kind,at) WHERE t.at IS NOT NULL;

CREATE FUNCTION learning.ucell_event_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Event participation evidence is immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER event_evidence_immutable BEFORE UPDATE OR DELETE ON learning.member_event_participation_evidence FOR EACH ROW EXECUTE FUNCTION learning.ucell_event_evidence_immutable();
CREATE FUNCTION learning.ucell_event_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'Published event version is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER event_version_immutable BEFORE UPDATE OR DELETE ON learning.member_event_version FOR EACH ROW EXECUTE FUNCTION learning.ucell_event_version_guard();

CREATE FUNCTION learning.ucell_event_registration_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_event uuid;
BEGIN
 SELECT member_event_id INTO source_event FROM learning.member_event_version WHERE member_event_version_id=NEW.member_event_version_id;
 IF source_event IS DISTINCT FROM NEW.member_event_id THEN RAISE EXCEPTION 'Event registration version mismatch' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.member_event_id,NEW.person_id) IS DISTINCT FROM (OLD.member_event_id,OLD.person_id) THEN RAISE EXCEPTION 'Event registration identity is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.registration_cycle_id IS DISTINCT FROM OLD.registration_cycle_id THEN
   IF OLD.status<>'CANCELLED' OR NEW.status<>'REGISTERED' OR NEW.cancelled_at IS NOT NULL OR NEW.checked_in_at IS NOT NULL OR NEW.attended_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid event registration renewal' USING ERRCODE='23514'; END IF;
  ELSE
   IF (NEW.member_event_version_id,NEW.registered_at) IS DISTINCT FROM (OLD.member_event_version_id,OLD.registered_at) THEN RAISE EXCEPTION 'Pinned event registration is immutable' USING ERRCODE='23514'; END IF;
   IF OLD.status='REGISTERED' AND NEW.status='ATTENDED' THEN RAISE EXCEPTION 'Attendance requires check-in evidence' USING ERRCODE='23514'; END IF;
   IF (OLD.status='ATTENDED' AND NEW IS DISTINCT FROM OLD) OR (OLD.status='CHECKED_IN' AND NEW.status NOT IN ('CHECKED_IN','ATTENDED')) OR (OLD.status='CANCELLED' AND NEW.status<>'CANCELLED') THEN RAISE EXCEPTION 'Invalid event participation transition' USING ERRCODE='23514'; END IF;
   IF (OLD.cancelled_at IS NOT NULL AND NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at) OR (OLD.checked_in_at IS NOT NULL AND NEW.checked_in_at IS DISTINCT FROM OLD.checked_in_at) OR (OLD.attended_at IS NOT NULL AND NEW.attended_at IS DISTINCT FROM OLD.attended_at) THEN RAISE EXCEPTION 'Recorded event timestamps are immutable' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 IF (NEW.status='REGISTERED' AND (NEW.cancelled_at IS NOT NULL OR NEW.checked_in_at IS NOT NULL OR NEW.attended_at IS NOT NULL))
 OR (NEW.status='CANCELLED' AND (NEW.cancelled_at IS NULL OR NEW.checked_in_at IS NOT NULL OR NEW.attended_at IS NOT NULL))
 OR (NEW.status='CHECKED_IN' AND (NEW.checked_in_at IS NULL OR NEW.cancelled_at IS NOT NULL OR NEW.attended_at IS NOT NULL))
 OR (NEW.status='ATTENDED' AND (NEW.checked_in_at IS NULL OR NEW.attended_at IS NULL OR NEW.cancelled_at IS NOT NULL))
 THEN RAISE EXCEPTION 'Event participation state lacks matching timestamps' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER event_registration_integrity BEFORE INSERT OR UPDATE ON learning.member_event_registration FOR EACH ROW EXECUTE FUNCTION learning.ucell_event_registration_guard();

CREATE FUNCTION learning.ucell_event_evidence_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r learning.member_event_registration%ROWTYPE; expected_at timestamptz;
BEGIN
 SELECT * INTO r FROM learning.member_event_registration WHERE member_event_registration_id=NEW.member_event_registration_id;
 expected_at:=CASE NEW.event_type WHEN 'EVENT_REGISTERED' THEN r.registered_at WHEN 'EVENT_REGISTRATION_CANCELLED' THEN r.cancelled_at WHEN 'EVENT_CHECKED_IN' THEN r.checked_in_at WHEN 'EVENT_ATTENDED' THEN r.attended_at END;
 IF NEW.origin<>'REGISTRATION_TRANSITION' OR NEW.member_event_version_id IS DISTINCT FROM r.member_event_version_id OR NEW.registration_cycle_id IS DISTINCT FROM r.registration_cycle_id OR expected_at IS NULL OR NEW.occurred_at IS DISTINCT FROM expected_at THEN RAISE EXCEPTION 'Event evidence must match its registration source' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER event_evidence_source BEFORE INSERT ON learning.member_event_participation_evidence FOR EACH ROW EXECUTE FUNCTION learning.ucell_event_evidence_source_guard();

CREATE FUNCTION learning.ucell_event_capture_participation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO learning.member_event_participation_evidence(member_event_registration_id,member_event_version_id,registration_cycle_id,event_type,occurred_at,origin)
 SELECT NEW.member_event_registration_id,NEW.member_event_version_id,NEW.registration_cycle_id,t.kind,t.at,'REGISTRATION_TRANSITION'
 FROM (VALUES ('EVENT_REGISTERED',NEW.registered_at),('EVENT_REGISTRATION_CANCELLED',NEW.cancelled_at),('EVENT_CHECKED_IN',NEW.checked_in_at),('EVENT_ATTENDED',NEW.attended_at)) t(kind,at)
 WHERE t.at IS NOT NULL ON CONFLICT(member_event_registration_id,registration_cycle_id,event_type) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER event_capture_participation AFTER INSERT OR UPDATE ON learning.member_event_registration FOR EACH ROW EXECUTE FUNCTION learning.ucell_event_capture_participation();
