-- Provider-neutral evidence only; no GL, inventory-cost or tax ledger.
CREATE TABLE commerce.erp_business_projection (
 projection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 projection_reference text NOT NULL UNIQUE CHECK (projection_reference ~ '^ERP-PROJECTION-[a-f0-9]{40}$'),
 stream text NOT NULL CHECK (stream IN ('SALES','RETURN','COMPENSATION')),
 source_identity text NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 format_version text NOT NULL,
 payload_hash char(64) NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
 payload_snapshot jsonb NOT NULL,
 drillback_hash char(64) NOT NULL CHECK (drillback_hash ~ '^[a-f0-9]{64}$'),
 drillback_snapshot jsonb NOT NULL,
 approval_reference text,
 mapping_reference text,
 requested_by_actor text NOT NULL,
 requested_at timestamptz(6) NOT NULL DEFAULT now(),
 outbox_event_id uuid NOT NULL UNIQUE REFERENCES integration.outbox_event(outbox_event_id),
 UNIQUE(stream,source_identity,revision),
 CHECK (stream<>'COMPENSATION' OR NULLIF(btrim(approval_reference),'') IS NOT NULL)
);
CREATE INDEX erp_business_projection_stream_requested_at_idx ON commerce.erp_business_projection(stream,requested_at);
CREATE TABLE commerce.erp_projection_dispatch (
 dispatch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 projection_id uuid NOT NULL UNIQUE REFERENCES commerce.erp_business_projection(projection_id),
 provider_connection_version_id uuid NOT NULL REFERENCES commerce.provider_connection_version(provider_connection_version_id),
 idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^ucell-erp-projection-[a-f0-9]{64}$'),
 request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE TABLE commerce.erp_projection_dispatch_attempt (
 attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dispatch_id uuid NOT NULL REFERENCES commerce.erp_projection_dispatch(dispatch_id),
 attempt_number integer NOT NULL CHECK (attempt_number>0),
 outcome text NOT NULL CHECK (outcome IN ('ACCEPTED','UNKNOWN','REJECTED')),
 provider_reference text,
 evidence_hash char(64) NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE(dispatch_id,attempt_number),
 CHECK ((outcome='ACCEPTED')=(provider_reference IS NOT NULL)),
 CHECK (provider_reference IS NULL OR provider_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$')
);
CREATE TABLE commerce.erp_projection_reconciliation (
 reconciliation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 projection_id uuid NOT NULL REFERENCES commerce.erp_business_projection(projection_id),
 result_key text NOT NULL,
 result_hash char(64) NOT NULL CHECK (result_hash ~ '^[a-f0-9]{64}$'),
 outcome text NOT NULL CHECK (outcome IN ('MATCHED','MISMATCH','PARTIAL')),
 reason_code text NOT NULL,
 provider_reference text NOT NULL CHECK (provider_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'),
 result_snapshot jsonb NOT NULL,
 occurred_at timestamptz(6) NOT NULL,
 recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 reported_by_actor text NOT NULL,
 UNIQUE(projection_id,result_key)
);
CREATE INDEX erp_projection_reconciliation_projection_id_recorded_at_idx ON commerce.erp_projection_reconciliation(projection_id,recorded_at);
CREATE FUNCTION commerce.ucell_validate_business_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM integration.outbox_event o WHERE o.outbox_event_id=NEW.outbox_event_id
  AND o.event_type='ERP_BUSINESS_PROJECTION_REQUESTED' AND o.aggregate_type='ERP_BUSINESS_PROJECTION'
  AND o.aggregate_id=NEW.projection_id AND o.payload->>'projectionReference'=NEW.projection_reference)
 THEN RAISE EXCEPTION 'ERP_PROJECTION_OUTBOX_MISMATCH'; END IF;
 IF NEW.payload_snapshot->>'stream' IS DISTINCT FROM NEW.stream OR NEW.payload_snapshot->>'projectionReference' IS DISTINCT FROM NEW.projection_reference
 THEN RAISE EXCEPTION 'ERP_PROJECTION_PAYLOAD_IDENTITY_MISMATCH'; END IF;
 IF NEW.stream='SALES' AND NOT EXISTS (SELECT 1 FROM commerce."order" o WHERE o.order_id::text=NEW.source_identity AND o.paid_at IS NOT NULL AND o.status::text IN ('PAID','FULFILLED','PARTIAL_RETURN','RETURNED'))
 THEN RAISE EXCEPTION 'ERP_SALES_APPROVED_SOURCE_REQUIRED'; END IF;
 IF NEW.stream='RETURN' AND NOT EXISTS (SELECT 1 FROM commerce.return_case r WHERE r.return_case_id::text=NEW.source_identity AND r.status::text='POSTED')
 THEN RAISE EXCEPTION 'ERP_RETURN_POSTED_SOURCE_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER erp_business_projection_source BEFORE INSERT ON commerce.erp_business_projection
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_business_projection();
CREATE FUNCTION commerce.ucell_validate_projection_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM commerce.erp_business_projection p WHERE p.projection_id=NEW.projection_id AND p.payload_hash=NEW.request_hash)
 THEN RAISE EXCEPTION 'ERP_PROJECTION_DISPATCH_HASH_MISMATCH'; END IF;
 IF EXISTS (SELECT 1 FROM commerce.erp_business_projection p WHERE p.projection_id=NEW.projection_id AND p.stream='COMPENSATION' AND NULLIF(btrim(p.mapping_reference),'') IS NULL)
 THEN RAISE EXCEPTION 'ERP_ACCOUNT_MAPPING_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER erp_projection_dispatch_source BEFORE INSERT ON commerce.erp_projection_dispatch
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_projection_dispatch();
CREATE TRIGGER erp_projection_dispatch_connection BEFORE INSERT ON commerce.erp_projection_dispatch
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_erp_dispatch_connection();
CREATE TRIGGER erp_business_projection_append_only BEFORE UPDATE OR DELETE ON commerce.erp_business_projection
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER erp_projection_dispatch_append_only BEFORE UPDATE OR DELETE ON commerce.erp_projection_dispatch
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER erp_projection_dispatch_attempt_append_only BEFORE UPDATE OR DELETE ON commerce.erp_projection_dispatch_attempt
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER erp_projection_reconciliation_append_only BEFORE UPDATE OR DELETE ON commerce.erp_projection_reconciliation
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
