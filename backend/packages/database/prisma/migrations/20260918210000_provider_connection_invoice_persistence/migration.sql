CREATE TYPE commerce."ProviderConnectionStatus" AS ENUM ('DRAFT','ACTIVE','SUSPENDED','RETIRED');
CREATE TYPE commerce."ProviderEnvironment" AS ENUM ('TEST','STAGE','PRODUCTION');
CREATE TYPE commerce."CanonicalInvoiceStatus" AS ENUM ('DRAFT','ISSUE_PENDING','ISSUED','VOID_PENDING','VOIDED','ALLOWANCE_PENDING','PARTIALLY_ALLOWED','FULLY_ALLOWED','FAILED','MANUAL_REVIEW');
CREATE TYPE commerce."InvoiceAdjustmentStatus" AS ENUM ('REQUESTED','SUBMITTED','CONFIRMED','FAILED','MANUAL_REVIEW');
CREATE TYPE commerce."InvoiceOperationType" AS ENUM ('ISSUE','APPLY_PROVIDER_EVENT','CREATE_ALLOWANCE','VOID');

CREATE TABLE commerce.provider_connection (
 provider_connection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain commerce."ProviderIntegrationDomain" NOT NULL,
 provider text NOT NULL, connection_key text NOT NULL, status commerce."ProviderConnectionStatus" NOT NULL DEFAULT 'DRAFT',
 created_at timestamptz(6) NOT NULL DEFAULT current_timestamp, updated_at timestamptz(6) NOT NULL);
CREATE UNIQUE INDEX provider_connection_domain_provider_key_uq ON commerce.provider_connection(domain,provider,connection_key);
CREATE INDEX provider_connection_lookup_idx ON commerce.provider_connection(domain,provider,status);

CREATE TABLE commerce.provider_connection_version (
 provider_connection_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_connection_id uuid NOT NULL,
 version integer NOT NULL, environment commerce."ProviderEnvironment" NOT NULL, endpoint_base_url text,
 credential_secret_ref text NOT NULL, webhook_verification_ref text NOT NULL, config_hash text NOT NULL,
 effective_from timestamptz(6) NOT NULL, effective_to timestamptz(6), approval_reference text,
 created_by_actor text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
 CONSTRAINT provider_connection_version_connection_fk FOREIGN KEY(provider_connection_id) REFERENCES commerce.provider_connection(provider_connection_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT provider_connection_version_positive_ck CHECK(version>0),
 CONSTRAINT provider_connection_version_window_ck CHECK(effective_to IS NULL OR effective_from<effective_to),
 CONSTRAINT provider_connection_version_hash_ck CHECK(config_hash ~ '^[a-f0-9]{64}$'));
CREATE UNIQUE INDEX provider_connection_version_number_uq ON commerce.provider_connection_version(provider_connection_id,version);
CREATE INDEX provider_connection_version_effective_idx ON commerce.provider_connection_version(provider_connection_id,environment,effective_from,effective_to);

ALTER TABLE commerce.provider_webhook_inbox ADD COLUMN provider_connection_version_id uuid,
 ADD CONSTRAINT provider_webhook_connection_version_fk FOREIGN KEY(provider_connection_version_id) REFERENCES commerce.provider_connection_version(provider_connection_version_id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE commerce.provider_reconciliation_run ADD COLUMN provider_connection_version_id uuid,
 ADD CONSTRAINT provider_reconciliation_connection_version_fk FOREIGN KEY(provider_connection_version_id) REFERENCES commerce.provider_connection_version(provider_connection_version_id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE commerce.invoice (
 invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL, provider text NOT NULL, connection_id text NOT NULL,
 provider_connection_version_id uuid NOT NULL, provider_invoice_ref text, invoice_number text,
 status commerce."CanonicalInvoiceStatus" NOT NULL DEFAULT 'DRAFT', currency text NOT NULL DEFAULT 'TWD',
 sales_amount numeric(18,2) NOT NULL, tax_amount numeric(18,2) NOT NULL, total_amount numeric(18,2) NOT NULL,
 tax_policy_snapshot_ref text NOT NULL, issued_at timestamptz(6), created_at timestamptz(6) NOT NULL DEFAULT current_timestamp, updated_at timestamptz(6) NOT NULL,
 CONSTRAINT invoice_order_fk FOREIGN KEY(order_id) REFERENCES commerce."order"(order_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_connection_version_fk FOREIGN KEY(provider_connection_version_id) REFERENCES commerce.provider_connection_version(provider_connection_version_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_amounts_nonnegative_ck CHECK(sales_amount>=0 AND tax_amount>=0 AND total_amount>=0),
 CONSTRAINT invoice_currency_iso_ck CHECK(currency ~ '^[A-Z]{3}$'));
CREATE UNIQUE INDEX invoice_provider_ref_uq ON commerce.invoice(provider,connection_id,provider_invoice_ref);
CREATE INDEX invoice_order_created_idx ON commerce.invoice(order_id,created_at);
CREATE INDEX invoice_status_created_idx ON commerce.invoice(status,created_at);

CREATE TABLE commerce.invoice_provider_event_evidence (
 invoice_provider_event_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL,
 provider_connection_version_id uuid NOT NULL, provider_event_identity text NOT NULL, provider_invoice_ref text,
 source text NOT NULL, payload_hash text NOT NULL, safe_evidence_ref text NOT NULL, verified_at timestamptz(6) NOT NULL,
 received_at timestamptz(6) NOT NULL DEFAULT current_timestamp, correlation_id uuid NOT NULL,
 CONSTRAINT invoice_evidence_invoice_fk FOREIGN KEY(invoice_id) REFERENCES commerce.invoice(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_evidence_connection_version_fk FOREIGN KEY(provider_connection_version_id) REFERENCES commerce.provider_connection_version(provider_connection_version_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_evidence_payload_hash_ck CHECK(payload_hash ~ '^[a-f0-9]{64}$'));
CREATE UNIQUE INDEX invoice_evidence_provider_event_uq ON commerce.invoice_provider_event_evidence(provider_connection_version_id,provider_event_identity);
CREATE INDEX invoice_evidence_invoice_received_idx ON commerce.invoice_provider_event_evidence(invoice_id,received_at);

CREATE TABLE commerce.invoice_state_transition (
 invoice_state_transition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL, invoice_provider_event_evidence_id uuid,
 from_status commerce."CanonicalInvoiceStatus" NOT NULL, to_status commerce."CanonicalInvoiceStatus" NOT NULL,
 business_effect_identity text NOT NULL, operation_hash text NOT NULL, occurred_at timestamptz(6) NOT NULL,
 recorded_at timestamptz(6) NOT NULL DEFAULT current_timestamp, correlation_id uuid NOT NULL,
 CONSTRAINT invoice_transition_invoice_fk FOREIGN KEY(invoice_id) REFERENCES commerce.invoice(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_transition_evidence_fk FOREIGN KEY(invoice_provider_event_evidence_id) REFERENCES commerce.invoice_provider_event_evidence(invoice_provider_event_evidence_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_transition_hash_ck CHECK(operation_hash ~ '^[a-f0-9]{64}$'));
CREATE UNIQUE INDEX invoice_transition_business_effect_uq ON commerce.invoice_state_transition(invoice_id,business_effect_identity);
CREATE UNIQUE INDEX invoice_transition_evidence_operation_uq ON commerce.invoice_state_transition(invoice_provider_event_evidence_id,operation_hash);
CREATE INDEX invoice_transition_recorded_idx ON commerce.invoice_state_transition(invoice_id,recorded_at);

CREATE TABLE commerce.invoice_allowance (
 invoice_allowance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL, provider_allowance_ref text,
 business_effect_identity text NOT NULL, amount numeric(18,2) NOT NULL, currency text NOT NULL,
 status commerce."InvoiceAdjustmentStatus" NOT NULL DEFAULT 'REQUESTED', reason_code text NOT NULL, source_return_id uuid,
 safe_evidence_ref text, occurred_at timestamptz(6) NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT current_timestamp, correlation_id uuid NOT NULL,
 CONSTRAINT invoice_allowance_invoice_fk FOREIGN KEY(invoice_id) REFERENCES commerce.invoice(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_allowance_amount_positive_ck CHECK(amount>0), CONSTRAINT invoice_allowance_currency_iso_ck CHECK(currency ~ '^[A-Z]{3}$'));
CREATE UNIQUE INDEX invoice_allowance_business_effect_uq ON commerce.invoice_allowance(invoice_id,business_effect_identity);
CREATE UNIQUE INDEX invoice_allowance_provider_ref_uq ON commerce.invoice_allowance(invoice_id,provider_allowance_ref);
CREATE INDEX invoice_allowance_occurred_idx ON commerce.invoice_allowance(invoice_id,occurred_at);

CREATE TABLE commerce.invoice_void (
 invoice_void_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL, provider_void_ref text,
 business_effect_identity text NOT NULL, status commerce."InvoiceAdjustmentStatus" NOT NULL DEFAULT 'REQUESTED',
 reason_code text NOT NULL, safe_evidence_ref text, occurred_at timestamptz(6) NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT current_timestamp, correlation_id uuid NOT NULL,
 CONSTRAINT invoice_void_invoice_fk FOREIGN KEY(invoice_id) REFERENCES commerce.invoice(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX invoice_void_business_effect_uq ON commerce.invoice_void(invoice_id,business_effect_identity);
CREATE UNIQUE INDEX invoice_void_provider_ref_uq ON commerce.invoice_void(invoice_id,provider_void_ref);
CREATE INDEX invoice_void_occurred_idx ON commerce.invoice_void(invoice_id,occurred_at);

CREATE TABLE commerce.invoice_operation_claim (
 invoice_operation_claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL,
 operation_type commerce."InvoiceOperationType" NOT NULL, business_effect_identity text NOT NULL,
 operation_hash text NOT NULL, committed_effect_ref text NOT NULL, outbox_event_id uuid NOT NULL,
 committed_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
 CONSTRAINT invoice_claim_invoice_fk FOREIGN KEY(invoice_id) REFERENCES commerce.invoice(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_claim_outbox_fk FOREIGN KEY(outbox_event_id) REFERENCES integration.outbox_event(outbox_event_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT invoice_claim_hash_ck CHECK(operation_hash ~ '^[a-f0-9]{64}$'));
CREATE UNIQUE INDEX invoice_claim_business_effect_uq ON commerce.invoice_operation_claim(business_effect_identity);
CREATE UNIQUE INDEX invoice_claim_outbox_uq ON commerce.invoice_operation_claim(outbox_event_id);
CREATE UNIQUE INDEX invoice_claim_operation_hash_uq ON commerce.invoice_operation_claim(invoice_id,operation_hash);
CREATE INDEX invoice_claim_committed_idx ON commerce.invoice_operation_claim(invoice_id,committed_at);

CREATE TRIGGER provider_connection_version_append_only BEFORE UPDATE OR DELETE ON commerce.provider_connection_version FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER invoice_provider_event_evidence_append_only BEFORE UPDATE OR DELETE ON commerce.invoice_provider_event_evidence FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER invoice_state_transition_append_only BEFORE UPDATE OR DELETE ON commerce.invoice_state_transition FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER invoice_allowance_append_only BEFORE UPDATE OR DELETE ON commerce.invoice_allowance FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER invoice_void_append_only BEFORE UPDATE OR DELETE ON commerce.invoice_void FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER invoice_operation_claim_append_only BEFORE UPDATE OR DELETE ON commerce.invoice_operation_claim FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();

COMMENT ON TABLE commerce.provider_connection_version IS 'Immutable provider configuration metadata; secret values remain in the external secret store.';
COMMENT ON TABLE commerce.invoice IS 'Mutable invoice projection backed by append-only evidence, transition, adjustment and claim records.';
COMMENT ON TABLE commerce.invoice_operation_claim IS 'Idempotent invoice effect atomically linked to one transactional outbox event.';
