-- Preserve published content and recorded learning evidence; no historical rewriting.
CREATE FUNCTION learning.ucell_learning_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'DRAFT' THEN
  RAISE EXCEPTION 'Published learning version is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_version_immutable BEFORE UPDATE OR DELETE ON learning.learning_course_version
 FOR EACH ROW EXECUTE FUNCTION learning.ucell_learning_version_guard();

CREATE FUNCTION learning.ucell_learning_lesson_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version_id uuid; version_state text;
BEGIN
 IF TG_OP='INSERT' THEN version_id:=NEW.learning_course_version_id; ELSE version_id:=OLD.learning_course_version_id; END IF;
 SELECT status::text INTO version_state FROM learning.learning_course_version WHERE learning_course_version_id=version_id FOR UPDATE;
 IF version_state <> 'DRAFT' THEN RAISE EXCEPTION 'Published learning content is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NEW.learning_course_version_id IS DISTINCT FROM OLD.learning_course_version_id THEN
  RAISE EXCEPTION 'Learning lesson version is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_lesson_immutable BEFORE INSERT OR UPDATE OR DELETE ON learning.learning_lesson
 FOR EACH ROW EXECUTE FUNCTION learning.ucell_learning_lesson_guard();

CREATE FUNCTION learning.ucell_learning_enrollment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE course_id uuid;
BEGIN
 SELECT learning_course_id INTO course_id FROM learning.learning_course_version WHERE learning_course_version_id=NEW.learning_course_version_id;
 IF course_id IS DISTINCT FROM NEW.learning_course_id THEN RAISE EXCEPTION 'Learning enrollment version mismatch' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.learning_course_id,NEW.learning_course_version_id,NEW.person_id,NEW.enrolled_at) IS DISTINCT FROM (OLD.learning_course_id,OLD.learning_course_version_id,OLD.person_id,OLD.enrolled_at) THEN
  RAISE EXCEPTION 'Learning enrollment identity is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Completed learning evidence is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_enrollment_integrity BEFORE INSERT OR UPDATE ON learning.learning_enrollment
 FOR EACH ROW EXECUTE FUNCTION learning.ucell_learning_enrollment_guard();

CREATE FUNCTION learning.ucell_learning_progress_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE enrollment_version uuid; lesson_version uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Learning progress evidence is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.learning_lesson_id IS NOT NULL THEN
  SELECT learning_course_version_id INTO enrollment_version FROM learning.learning_enrollment WHERE learning_enrollment_id=NEW.learning_enrollment_id;
  SELECT learning_course_version_id INTO lesson_version FROM learning.learning_lesson WHERE learning_lesson_id=NEW.learning_lesson_id;
  IF lesson_version IS DISTINCT FROM enrollment_version THEN RAISE EXCEPTION 'Learning progress lesson mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.event_type='LESSON_COMPLETED' AND NEW.learning_lesson_id IS NULL THEN RAISE EXCEPTION 'Completed lesson requires a source lesson' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_progress_integrity BEFORE INSERT OR UPDATE OR DELETE ON learning.learning_progress_event
 FOR EACH ROW EXECUTE FUNCTION learning.ucell_learning_progress_guard();
CREATE UNIQUE INDEX learning_single_course_milestone ON learning.learning_progress_event(learning_enrollment_id,event_type)
 WHERE event_type IN ('COURSE_ENROLLED','COURSE_STARTED','COURSE_COMPLETED');
CREATE UNIQUE INDEX learning_single_lesson_completion ON learning.learning_progress_event(learning_enrollment_id,learning_lesson_id)
 WHERE event_type='LESSON_COMPLETED';
