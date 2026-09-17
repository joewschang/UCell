CREATE TYPE commerce."FulfillmentStatus" AS ENUM ('READY','ALLOCATED','PICKING','PICKED','QC_PENDING','QC_PASSED','PACKED','SHIPPING_REQUESTED','SHIPPED','DELIVERED','EXCEPTION','CANCELLED');
CREATE TYPE commerce."QcStatus" AS ENUM ('PENDING','PASS','FAIL','HOLD');
CREATE TYPE commerce."ShippingMethod" AS ENUM ('HOME_DELIVERY','CVS_PICKUP');
CREATE TYPE commerce."CanonicalShipmentStatus" AS ENUM ('READY','LABEL_CREATED','PICKED_UP','IN_TRANSIT','DELIVERED','DELIVERY_FAILED','RETURNING','RETURNED','CANCELLED');
CREATE TYPE commerce."ShipmentOperationType" AS ENUM ('CREATE_SHIPMENT','GET_LABEL','APPLY_TRACKING_EVENT','CANCEL_SHIPMENT');

CREATE TABLE commerce.fulfillment (
 fulfillment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL, fulfillment_key text NOT NULL, status commerce."FulfillmentStatus" NOT NULL DEFAULT 'READY',
 allocation_snapshot_ref text NOT NULL, fulfillment_policy_snapshot_ref text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT current_timestamp, updated_at timestamptz(6) NOT NULL,
 CONSTRAINT fulfillment_order_fk FOREIGN KEY(order_id) REFERENCES commerce."order"(order_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fulfillment_refs_nonempty_ck CHECK(length(btrim(fulfillment_key))>0 AND length(btrim(allocation_snapshot_ref))>0 AND length(btrim(fulfillment_policy_snapshot_ref))>0));
CREATE UNIQUE INDEX fulfillment_order_key_uq ON commerce.fulfillment(order_id,fulfillment_key);
CREATE INDEX fulfillment_order_created_idx ON commerce.fulfillment(order_id,created_at);
CREATE INDEX fulfillment_status_created_idx ON commerce.fulfillment(status,created_at);

CREATE TABLE commerce.fulfillment_parcel (
 fulfillment_parcel_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fulfillment_id uuid NOT NULL, parcel_key text NOT NULL, content_snapshot_ref text NOT NULL,
 package_snapshot_ref text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
 CONSTRAINT fulfillment_parcel_fulfillment_fk FOREIGN KEY(fulfillment_id) REFERENCES commerce.fulfillment(fulfillment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fulfillment_parcel_refs_nonempty_ck CHECK(length(btrim(parcel_key))>0 AND length(btrim(content_snapshot_ref))>0 AND length(btrim(package_snapshot_ref))>0));
CREATE UNIQUE INDEX fulfillment_parcel_key_uq ON commerce.fulfillment_parcel(fulfillment_id,parcel_key);
CREATE INDEX fulfillment_parcel_created_idx ON commerce.fulfillment_parcel(fulfillment_id,created_at);

CREATE TABLE commerce.fulfillment_qc_evidence (
 fulfillment_qc_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fulfillment_id uuid NOT NULL, policy_id text NOT NULL, policy_version text NOT NULL,
 policy_snapshot_ref text NOT NULL, result commerce."QcStatus" NOT NULL, checks jsonb NOT NULL, inspector_actor text NOT NULL, reason text NOT NULL,
 occurred_at timestamptz(6) NOT NULL, recorded_at timestamptz(6) NOT NULL DEFAULT current_timestamp, correlation_id uuid NOT NULL,
 CONSTRAINT fulfillment_qc_fulfillment_fk FOREIGN KEY(fulfillment_id) REFERENCES commerce.fulfillment(fulfillment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fulfillment_qc_refs_nonempty_ck CHECK(length(btrim(policy_id))>0 AND length(btrim(policy_version))>0 AND length(btrim(policy_snapshot_ref))>0 AND length(btrim(inspector_actor))>0 AND length(btrim(reason))>0),
 CONSTRAINT fulfillment_qc_checks_object_ck CHECK(jsonb_typeof(checks)='object'));
CREATE INDEX fulfillment_qc_occurred_idx ON commerce.fulfillment_qc_evidence(fulfillment_id,occurred_at);

CREATE TABLE commerce.shipment (
 shipment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fulfillment_id uuid NOT NULL, fulfillment_parcel_id uuid NOT NULL, fulfillment_qc_evidence_id uuid NOT NULL,
 provider text NOT NULL, connection_id text NOT NULL, provider_connection_version_id uuid NOT NULL, carrier text NOT NULL,
 shipping_method commerce."ShippingMethod" NOT NULL, recipient_snapshot_ref text NOT NULL, pickup_store_snapshot_ref text,
 provider_shipment_ref text, tracking_no text, status commerce."CanonicalShipmentStatus" NOT NULL DEFAULT 'READY',
 created_at timestamptz(6) NOT NULL DEFAULT current_timestamp, updated_at timestamptz(6) NOT NULL,
 CONSTRAINT shipment_fulfillment_fk FOREIGN KEY(fulfillment_id) REFERENCES commerce.fulfillment(fulfillment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_parcel_fk FOREIGN KEY(fulfillment_parcel_id) REFERENCES commerce.fulfillment_parcel(fulfillment_parcel_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_qc_evidence_fk FOREIGN KEY(fulfillment_qc_evidence_id) REFERENCES commerce.fulfillment_qc_evidence(fulfillment_qc_evidence_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_connection_version_fk FOREIGN KEY(provider_connection_version_id) REFERENCES commerce.provider_connection_version(provider_connection_version_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_refs_nonempty_ck CHECK(length(btrim(provider))>0 AND length(btrim(connection_id))>0 AND length(btrim(carrier))>0 AND length(btrim(recipient_snapshot_ref))>0),
 CONSTRAINT shipment_pickup_store_ck CHECK(shipping_method<>'CVS_PICKUP' OR (pickup_store_snapshot_ref IS NOT NULL AND length(btrim(pickup_store_snapshot_ref))>0)));
CREATE UNIQUE INDEX shipment_provider_ref_uq ON commerce.shipment(provider,connection_id,provider_shipment_ref);
CREATE INDEX shipment_fulfillment_created_idx ON commerce.shipment(fulfillment_id,created_at);
CREATE INDEX shipment_status_created_idx ON commerce.shipment(status,created_at);

CREATE TABLE commerce.shipment_tracking_event_evidence (
 shipment_tracking_event_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id uuid NOT NULL, provider_connection_version_id uuid NOT NULL,
 provider_event_identity text NOT NULL, provider_shipment_ref text NOT NULL, raw_status_code text NOT NULL,
 normalized_status commerce."CanonicalShipmentStatus", mapping_snapshot_ref text, payload_hash text NOT NULL, safe_evidence_ref text NOT NULL,
 event_time timestamptz(6) NOT NULL, verified_at timestamptz(6) NOT NULL, received_at timestamptz(6) NOT NULL DEFAULT current_timestamp, correlation_id uuid NOT NULL,
 CONSTRAINT shipment_tracking_shipment_fk FOREIGN KEY(shipment_id) REFERENCES commerce.shipment(shipment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_tracking_connection_version_fk FOREIGN KEY(provider_connection_version_id) REFERENCES commerce.provider_connection_version(provider_connection_version_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_tracking_hash_ck CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 CONSTRAINT shipment_tracking_refs_nonempty_ck CHECK(length(btrim(provider_event_identity))>0 AND length(btrim(provider_shipment_ref))>0 AND length(btrim(raw_status_code))>0 AND length(btrim(safe_evidence_ref))>0),
 CONSTRAINT shipment_tracking_mapping_ck CHECK((normalized_status IS NULL AND mapping_snapshot_ref IS NULL) OR (normalized_status IS NOT NULL AND mapping_snapshot_ref IS NOT NULL AND length(btrim(mapping_snapshot_ref))>0)));
CREATE UNIQUE INDEX shipment_tracking_provider_event_uq ON commerce.shipment_tracking_event_evidence(provider_connection_version_id,provider_event_identity);
CREATE INDEX shipment_tracking_event_time_idx ON commerce.shipment_tracking_event_evidence(shipment_id,event_time);

CREATE TABLE commerce.shipment_state_transition (
 shipment_state_transition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id uuid NOT NULL, shipment_tracking_event_evidence_id uuid,
 from_status commerce."CanonicalShipmentStatus" NOT NULL, to_status commerce."CanonicalShipmentStatus" NOT NULL,
 business_effect_identity text NOT NULL, operation_hash text NOT NULL, occurred_at timestamptz(6) NOT NULL,
 recorded_at timestamptz(6) NOT NULL DEFAULT current_timestamp, correlation_id uuid NOT NULL,
 CONSTRAINT shipment_transition_shipment_fk FOREIGN KEY(shipment_id) REFERENCES commerce.shipment(shipment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_transition_evidence_fk FOREIGN KEY(shipment_tracking_event_evidence_id) REFERENCES commerce.shipment_tracking_event_evidence(shipment_tracking_event_evidence_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_transition_hash_ck CHECK(operation_hash ~ '^[a-f0-9]{64}$'), CONSTRAINT shipment_transition_identity_ck CHECK(length(btrim(business_effect_identity))>0));
CREATE UNIQUE INDEX shipment_transition_business_effect_uq ON commerce.shipment_state_transition(shipment_id,business_effect_identity);
CREATE UNIQUE INDEX shipment_transition_evidence_operation_uq ON commerce.shipment_state_transition(shipment_tracking_event_evidence_id,operation_hash);
CREATE INDEX shipment_transition_recorded_idx ON commerce.shipment_state_transition(shipment_id,recorded_at);

CREATE TABLE commerce.shipment_operation_claim (
 shipment_operation_claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id uuid NOT NULL, operation_type commerce."ShipmentOperationType" NOT NULL,
 business_effect_identity text NOT NULL, operation_hash text NOT NULL, committed_effect_ref text NOT NULL, outbox_event_id uuid NOT NULL,
 committed_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
 CONSTRAINT shipment_claim_shipment_fk FOREIGN KEY(shipment_id) REFERENCES commerce.shipment(shipment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_claim_outbox_fk FOREIGN KEY(outbox_event_id) REFERENCES integration.outbox_event(outbox_event_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT shipment_claim_hash_ck CHECK(operation_hash ~ '^[a-f0-9]{64}$'),
 CONSTRAINT shipment_claim_refs_nonempty_ck CHECK(length(btrim(business_effect_identity))>0 AND length(btrim(committed_effect_ref))>0));
CREATE UNIQUE INDEX shipment_claim_business_effect_uq ON commerce.shipment_operation_claim(business_effect_identity);
CREATE UNIQUE INDEX shipment_claim_outbox_uq ON commerce.shipment_operation_claim(outbox_event_id);
CREATE UNIQUE INDEX shipment_claim_operation_hash_uq ON commerce.shipment_operation_claim(shipment_id,operation_hash);
CREATE INDEX shipment_claim_committed_idx ON commerce.shipment_operation_claim(shipment_id,committed_at);

CREATE TRIGGER fulfillment_parcel_append_only BEFORE UPDATE OR DELETE ON commerce.fulfillment_parcel FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER fulfillment_qc_evidence_append_only BEFORE UPDATE OR DELETE ON commerce.fulfillment_qc_evidence FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER shipment_tracking_event_evidence_append_only BEFORE UPDATE OR DELETE ON commerce.shipment_tracking_event_evidence FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER shipment_state_transition_append_only BEFORE UPDATE OR DELETE ON commerce.shipment_state_transition FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER shipment_operation_claim_append_only BEFORE UPDATE OR DELETE ON commerce.shipment_operation_claim FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();

COMMENT ON TABLE commerce.fulfillment IS 'Fulfillment projection; allocation and operational sequencing remain governed by immutable snapshot references.';
COMMENT ON TABLE commerce.shipment IS 'Shipment projection separated from payment, invoice, volume and monetary lifecycles.';
COMMENT ON TABLE commerce.shipment_tracking_event_evidence IS 'Verified append-only carrier evidence; unmapped provider statuses remain unnormalized and fail closed.';
COMMENT ON TABLE commerce.shipment_operation_claim IS 'Idempotent shipment effect atomically linked to one transactional outbox event.';
