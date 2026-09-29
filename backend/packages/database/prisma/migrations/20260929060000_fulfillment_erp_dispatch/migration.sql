ALTER TYPE commerce."ProviderIntegrationDomain" ADD VALUE IF NOT EXISTS 'ERP';
CREATE TABLE commerce.fulfillment_erp_dispatch (
 dispatch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fulfillment_erp_handoff_id uuid NOT NULL UNIQUE REFERENCES commerce.fulfillment_erp_handoff(fulfillment_erp_handoff_id),
 provider_connection_version_id uuid NOT NULL REFERENCES commerce.provider_connection_version(provider_connection_version_id),
 idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^ucell-erp-[a-f0-9]{64}$'),
 created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE TABLE commerce.fulfillment_erp_dispatch_attempt (
 attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dispatch_id uuid NOT NULL REFERENCES commerce.fulfillment_erp_dispatch(dispatch_id),
 attempt_number integer NOT NULL CHECK (attempt_number > 0),
 outcome text NOT NULL CHECK (outcome IN ('ACCEPTED','UNKNOWN','REJECTED')),
 provider_reference text,
 evidence_hash char(64) NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE (dispatch_id,attempt_number),
 CHECK ((outcome = 'ACCEPTED') = (provider_reference IS NOT NULL))
);
CREATE FUNCTION commerce.ucell_validate_erp_dispatch_connection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM commerce.provider_connection_version v
  JOIN commerce.provider_connection c ON c.provider_connection_id=v.provider_connection_id
  WHERE v.provider_connection_version_id=NEW.provider_connection_version_id
   AND c.domain::text='ERP' AND c.provider IN ('EZTOOL','DYNAMICS_365_BC')
   AND c.status::text='ACTIVE' AND NULLIF(v.approval_reference,'') IS NOT NULL
   AND v.effective_from<=now() AND (v.effective_to IS NULL OR v.effective_to>now())
 ) THEN RAISE EXCEPTION 'ERP_DISPATCH_CONNECTION_NOT_APPROVED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fulfillment_erp_dispatch_connection BEFORE INSERT
 ON commerce.fulfillment_erp_dispatch FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_erp_dispatch_connection();
CREATE TRIGGER fulfillment_erp_dispatch_append_only BEFORE UPDATE OR DELETE
 ON commerce.fulfillment_erp_dispatch FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER fulfillment_erp_dispatch_attempt_append_only BEFORE UPDATE OR DELETE
 ON commerce.fulfillment_erp_dispatch_attempt FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
