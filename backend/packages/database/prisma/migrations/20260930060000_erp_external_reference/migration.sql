-- An external document may acknowledge one projection per ERP connection,
-- including across connection configuration versions. No legacy receipt is rewritten.
CREATE TABLE commerce.erp_projection_external_reference (
 projection_id uuid PRIMARY KEY REFERENCES commerce.erp_business_projection(projection_id),
 provider_connection_id uuid NOT NULL REFERENCES commerce.provider_connection(provider_connection_id),
 provider_reference text NOT NULL CHECK (provider_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'),
 recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE(provider_connection_id,provider_reference)
);
CREATE FUNCTION commerce.ucell_validate_projection_external_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM commerce.erp_projection_dispatch d JOIN commerce.provider_connection_version v USING(provider_connection_version_id)
  WHERE d.projection_id=NEW.projection_id AND v.provider_connection_id=NEW.provider_connection_id)
 THEN RAISE EXCEPTION 'ERP_EXTERNAL_REFERENCE_CONNECTION_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER erp_projection_external_reference_source BEFORE INSERT ON commerce.erp_projection_external_reference
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_projection_external_reference();
CREATE TRIGGER erp_projection_external_reference_append_only BEFORE UPDATE OR DELETE ON commerce.erp_projection_external_reference
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
-- Preserve unambiguous pre-upgrade acceptance. Conflicting historical references
-- intentionally remain unclaimed for explicit reconciliation, never guessed.
INSERT INTO commerce.erp_projection_external_reference(projection_id,provider_connection_id,provider_reference,recorded_at)
 SELECT candidate.projection_id,candidate.provider_connection_id,candidate.provider_reference,candidate.recorded_at FROM (
 SELECT d.projection_id,v.provider_connection_id,min(a.provider_reference) AS provider_reference,min(a.recorded_at) AS recorded_at
 FROM commerce.erp_projection_dispatch d
 JOIN commerce.provider_connection_version v USING(provider_connection_version_id)
 JOIN commerce.erp_projection_dispatch_attempt a USING(dispatch_id)
 WHERE a.outcome='ACCEPTED'
 GROUP BY d.projection_id,v.provider_connection_id
 HAVING count(DISTINCT a.provider_reference)=1
 ) candidate WHERE NOT EXISTS (
  SELECT 1 FROM commerce.erp_projection_dispatch other_d
  JOIN commerce.provider_connection_version other_v USING(provider_connection_version_id)
  JOIN commerce.erp_projection_dispatch_attempt other_a USING(dispatch_id)
  WHERE other_v.provider_connection_id=candidate.provider_connection_id AND other_d.projection_id<>candidate.projection_id
   AND other_a.outcome='ACCEPTED' AND other_a.provider_reference=candidate.provider_reference
 );
CREATE FUNCTION commerce.ucell_validate_projection_acceptance_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.outcome='ACCEPTED' AND NOT EXISTS (
  SELECT 1 FROM commerce.erp_projection_dispatch d JOIN commerce.erp_projection_external_reference r USING(projection_id)
  WHERE d.dispatch_id=NEW.dispatch_id AND r.provider_reference=NEW.provider_reference)
 THEN RAISE EXCEPTION 'ERP_EXTERNAL_REFERENCE_CLAIM_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER erp_projection_dispatch_acceptance_reference BEFORE INSERT ON commerce.erp_projection_dispatch_attempt
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_projection_acceptance_reference();
