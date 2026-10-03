-- Existing projection and transport evidence is preserved. New financial
-- revisions must form one contiguous append-only chain for their source.
CREATE FUNCTION commerce.ucell_validate_projection_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous commerce.erp_business_projection%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.stream || ':' || NEW.source_identity,0));
 IF (NEW.payload_snapshot->>'revision')::integer IS DISTINCT FROM NEW.revision THEN
  RAISE EXCEPTION 'ERP_PROJECTION_REVISION_IDENTITY_INVALID';
 END IF;
 SELECT * INTO previous FROM commerce.erp_business_projection
  WHERE stream=NEW.stream AND source_identity=NEW.source_identity ORDER BY revision DESC LIMIT 1;
 IF NEW.revision=1 THEN
  IF previous.projection_id IS NOT NULL OR NEW.payload_snapshot ? 'previousProjectionReference' THEN
   RAISE EXCEPTION 'ERP_PROJECTION_PREVIOUS_REVISION_INVALID';
  END IF;
 ELSE
  IF NEW.stream<>'COMPENSATION' OR previous.projection_id IS NULL
   OR previous.revision<>NEW.revision-1
   OR NEW.payload_snapshot->>'previousProjectionReference' IS DISTINCT FROM previous.projection_reference THEN
   RAISE EXCEPTION 'ERP_PROJECTION_PREVIOUS_REVISION_REQUIRED';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER erp_projection_revision BEFORE INSERT ON commerce.erp_business_projection
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_projection_revision();
