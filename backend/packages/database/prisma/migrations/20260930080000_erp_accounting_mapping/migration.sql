-- Append-only approved transport attachments, preserving the original review.
CREATE TABLE commerce.erp_accounting_mapping (
 mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mapping_reference text NOT NULL UNIQUE CHECK(mapping_reference ~ '^ERP-MAPPING-[a-f0-9]{40}$'),
 projection_id uuid NOT NULL REFERENCES commerce.erp_business_projection(projection_id),
 revision integer NOT NULL CHECK(revision>0),
 previous_mapping_reference text REFERENCES commerce.erp_accounting_mapping(mapping_reference),
 provider_connection_version_id uuid NOT NULL REFERENCES commerce.provider_connection_version(provider_connection_version_id),
 review_hash char(64) NOT NULL CHECK(review_hash ~ '^[a-f0-9]{64}$'),
 request_hash char(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 request_snapshot jsonb NOT NULL,
 approval_reference text NOT NULL CHECK(approval_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$'),
 approved_by_actor text NOT NULL,
 approved_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE(projection_id,revision)
);
CREATE FUNCTION commerce.ucell_validate_accounting_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p commerce.erp_business_projection%ROWTYPE; prior commerce.erp_accounting_mapping%ROWTYPE;
BEGIN
 SELECT * INTO p FROM commerce.erp_business_projection WHERE projection_id=NEW.projection_id FOR UPDATE;
 IF p.stream IS DISTINCT FROM 'COMPENSATION' THEN RAISE EXCEPTION 'ERP_MAPPING_COMPENSATION_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('COMPENSATION:' || p.source_identity,0));
 IF EXISTS(SELECT 1 FROM commerce.erp_business_projection WHERE stream='COMPENSATION' AND source_identity=p.source_identity AND revision>p.revision)
 THEN RAISE EXCEPTION 'ERP_MAPPING_LATEST_PROJECTION_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM commerce.erp_projection_dispatch WHERE projection_id=NEW.projection_id)
 THEN RAISE EXCEPTION 'ERP_MAPPING_DISPATCH_ALREADY_PINNED'; END IF;
 SELECT * INTO prior FROM commerce.erp_accounting_mapping WHERE projection_id=NEW.projection_id ORDER BY revision DESC LIMIT 1;
 IF NEW.revision<>COALESCE(prior.revision,0)+1 OR NEW.previous_mapping_reference IS DISTINCT FROM prior.mapping_reference
 THEN RAISE EXCEPTION 'ERP_MAPPING_PREVIOUS_REVISION_REQUIRED'; END IF;
 IF NEW.request_snapshot->>'projectionReference' IS DISTINCT FROM p.projection_reference
 OR NEW.request_snapshot->>'sourcePayloadHash' IS DISTINCT FROM p.payload_hash::text
 OR NEW.request_snapshot->>'drillbackHash' IS DISTINCT FROM p.drillback_hash::text
 OR NEW.request_snapshot->>'mappingReference' IS DISTINCT FROM NEW.mapping_reference
 OR NEW.request_snapshot->>'approvalReference' IS DISTINCT FROM NEW.approval_reference
 THEN RAISE EXCEPTION 'ERP_MAPPING_SOURCE_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT 1 FROM commerce.provider_connection_version v JOIN commerce.provider_connection c USING(provider_connection_id)
 WHERE v.provider_connection_version_id=NEW.provider_connection_version_id AND c.domain::text='ERP'
 AND c.status::text='ACTIVE' AND NULLIF(btrim(v.approval_reference),'') IS NOT NULL
 AND v.effective_from<=now() AND (v.effective_to IS NULL OR v.effective_to>now()))
 THEN RAISE EXCEPTION 'ERP_CONNECTION_NOT_APPROVED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER erp_accounting_mapping_source BEFORE INSERT ON commerce.erp_accounting_mapping FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_accounting_mapping();
CREATE TRIGGER erp_accounting_mapping_append_only BEFORE UPDATE OR DELETE ON commerce.erp_accounting_mapping FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE OR REPLACE FUNCTION commerce.ucell_validate_projection_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p commerce.erp_business_projection%ROWTYPE; m commerce.erp_accounting_mapping%ROWTYPE;
BEGIN
 SELECT * INTO p FROM commerce.erp_business_projection WHERE projection_id=NEW.projection_id FOR UPDATE;
 IF p.stream='COMPENSATION' THEN
  SELECT * INTO m FROM commerce.erp_accounting_mapping WHERE projection_id=NEW.projection_id ORDER BY revision DESC LIMIT 1;
  IF m.mapping_id IS NULL THEN RAISE EXCEPTION 'ERP_ACCOUNT_MAPPING_REQUIRED'; END IF;
  IF m.request_hash<>NEW.request_hash OR m.provider_connection_version_id<>NEW.provider_connection_version_id
  THEN RAISE EXCEPTION 'ERP_MAPPING_DISPATCH_MISMATCH'; END IF;
 ELSE
  IF p.projection_id IS NULL OR p.payload_hash<>NEW.request_hash THEN RAISE EXCEPTION 'ERP_PROJECTION_DISPATCH_HASH_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END $$;
