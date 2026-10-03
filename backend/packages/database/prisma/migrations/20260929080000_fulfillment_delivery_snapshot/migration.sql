CREATE TABLE commerce.fulfillment_delivery_snapshot (
 delivery_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fulfillment_id uuid NOT NULL REFERENCES commerce.fulfillment(fulfillment_id),
 version integer NOT NULL CHECK (version>0),
 shipping_method commerce."ShippingMethod" NOT NULL,
 encrypted_payload text NOT NULL,
 key_version text NOT NULL,
 snapshot_hash char(64) NOT NULL UNIQUE CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
 captured_by_actor text NOT NULL,
 captured_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE (fulfillment_id,version)
);
CREATE TRIGGER fulfillment_delivery_snapshot_append_only BEFORE UPDATE OR DELETE
 ON commerce.fulfillment_delivery_snapshot FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
-- Existing records remain null: no historical recipient or request is invented.
ALTER TABLE commerce.fulfillment_erp_dispatch
 ADD COLUMN delivery_snapshot_id uuid REFERENCES commerce.fulfillment_delivery_snapshot(delivery_snapshot_id),
 ADD COLUMN request_hash char(64) CHECK (request_hash IS NULL OR request_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE commerce.shipment ADD COLUMN delivery_snapshot_id uuid REFERENCES commerce.fulfillment_delivery_snapshot(delivery_snapshot_id);
CREATE FUNCTION commerce.ucell_validate_delivery_snapshot_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_fulfillment uuid;
BEGIN
 IF NEW.delivery_snapshot_id IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='shipment' THEN owner_fulfillment:=NEW.fulfillment_id;
 ELSE SELECT fulfillment_id INTO owner_fulfillment FROM commerce.fulfillment_erp_handoff WHERE fulfillment_erp_handoff_id=NEW.fulfillment_erp_handoff_id;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM commerce.fulfillment_delivery_snapshot WHERE delivery_snapshot_id=NEW.delivery_snapshot_id AND fulfillment_id=owner_fulfillment)
 THEN RAISE EXCEPTION 'DELIVERY_SNAPSHOT_SOURCE_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipment_delivery_snapshot_source BEFORE INSERT OR UPDATE ON commerce.shipment
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_delivery_snapshot_source();
CREATE TRIGGER erp_dispatch_delivery_snapshot_source BEFORE INSERT ON commerce.fulfillment_erp_dispatch
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_delivery_snapshot_source();
