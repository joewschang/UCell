-- Job progress/leases are mutable; original authorization and query identity are not.
CREATE FUNCTION integration.guard_projection_job_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.job_id,NEW.actor_id,NEW.actor_context,NEW.request_key,NEW.query_hash,NEW.query,NEW.mode,NEW.requested_at)
 IS DISTINCT FROM ROW(OLD.job_id,OLD.actor_id,OLD.actor_context,OLD.request_key,OLD.query_hash,OLD.query,OLD.mode,OLD.requested_at)
 THEN RAISE EXCEPTION 'PROJECTION_JOB_IDENTITY_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER projection_job_identity BEFORE UPDATE ON integration.period_projection_job
 FOR EACH ROW EXECUTE FUNCTION integration.guard_projection_job_identity();
CREATE FUNCTION integration.guard_export_job_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.export_id,NEW.actor_id,NEW.actor_context,NEW.request_key,NEW.query_hash,NEW.query,NEW.generation_id,NEW.requested_at,NEW.data_through,NEW.definition_version)
 IS DISTINCT FROM ROW(OLD.export_id,OLD.actor_id,OLD.actor_context,OLD.request_key,OLD.query_hash,OLD.query,OLD.generation_id,OLD.requested_at,OLD.data_through,OLD.definition_version)
 THEN RAISE EXCEPTION 'EXPORT_JOB_IDENTITY_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER export_job_identity BEFORE UPDATE ON integration.analytics_export_job
 FOR EACH ROW EXECUTE FUNCTION integration.guard_export_job_identity();
