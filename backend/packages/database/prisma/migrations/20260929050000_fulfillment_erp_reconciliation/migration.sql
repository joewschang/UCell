-- Physical ERP results are evidence, not payment/award authority. No historical
-- handoff is rewritten or inferred to have shipped during this forward change.
CREATE TABLE commerce.fulfillment_erp_reconciliation (
 reconciliation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fulfillment_erp_handoff_id uuid NOT NULL REFERENCES commerce.fulfillment_erp_handoff(fulfillment_erp_handoff_id),
 result_key text NOT NULL,
 result_hash char(64) NOT NULL CHECK (result_hash ~ '^[a-f0-9]{64}$'),
 outcome text NOT NULL CHECK (outcome IN ('MATCHED','PARTIAL','MISMATCH')),
 reason_code text NOT NULL,
 result_snapshot jsonb NOT NULL,
 occurred_at timestamptz(6) NOT NULL,
 recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 reported_by_actor text NOT NULL,
 UNIQUE (fulfillment_erp_handoff_id,result_key)
);
CREATE INDEX fulfillment_erp_reconciliation_handoff_occurred_idx
 ON commerce.fulfillment_erp_reconciliation(fulfillment_erp_handoff_id,occurred_at);
CREATE TRIGGER fulfillment_erp_reconciliation_append_only
 BEFORE UPDATE OR DELETE ON commerce.fulfillment_erp_reconciliation
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();

-- Existing handoffs and physical source/serial bindings are historical intent.
-- Corrections use a new governed fulfillment/evidence, never an in-place edit.
CREATE TRIGGER fulfillment_erp_handoff_append_only BEFORE UPDATE OR DELETE
 ON commerce.fulfillment_erp_handoff FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER fulfillment_source_allocation_append_only BEFORE UPDATE OR DELETE
 ON commerce.fulfillment_source_allocation FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER fulfillment_serial_allocation_append_only BEFORE UPDATE OR DELETE
 ON commerce.fulfillment_serial_allocation FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
