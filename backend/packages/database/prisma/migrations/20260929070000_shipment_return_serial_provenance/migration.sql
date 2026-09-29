CREATE TABLE commerce.shipment_serial_binding (
 shipment_serial_binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id uuid NOT NULL REFERENCES commerce.shipment(shipment_id),
 fulfillment_serial_allocation_id uuid NOT NULL UNIQUE REFERENCES commerce.fulfillment_serial_allocation(fulfillment_serial_allocation_id),
 bound_by_actor text NOT NULL,
 bound_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX shipment_serial_binding_shipment_idx ON commerce.shipment_serial_binding(shipment_id);
CREATE TABLE commerce.return_serial_receipt (
 return_serial_receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 return_line_id uuid NOT NULL REFERENCES commerce.return_line(return_line_id),
 shipment_serial_binding_id uuid NOT NULL UNIQUE REFERENCES commerce.shipment_serial_binding(shipment_serial_binding_id),
 received_by_actor text NOT NULL,
 received_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX return_serial_receipt_line_idx ON commerce.return_serial_receipt(return_line_id);
CREATE TRIGGER shipment_serial_binding_append_only BEFORE UPDATE OR DELETE
 ON commerce.shipment_serial_binding FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER return_serial_receipt_append_only BEFORE UPDATE OR DELETE
 ON commerce.return_serial_receipt FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE FUNCTION commerce.ucell_validate_shipment_serial_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM commerce.shipment s JOIN commerce.fulfillment_serial_allocation a ON a.fulfillment_id=s.fulfillment_id
  JOIN commerce.fulfillment_source_allocation sa ON sa.fulfillment_source_allocation_id=a.fulfillment_source_allocation_id AND sa.fulfillment_id=s.fulfillment_id
  JOIN commerce.fulfillment f ON f.fulfillment_id=s.fulfillment_id
  JOIN commerce.order_line ol ON ol.order_line_id=sa.order_line_id AND ol.order_id=f.order_id
  WHERE s.shipment_id=NEW.shipment_id AND a.fulfillment_serial_allocation_id=NEW.fulfillment_serial_allocation_id)
 THEN RAISE EXCEPTION 'SHIPMENT_SERIAL_SOURCE_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipment_serial_binding_source BEFORE INSERT ON commerce.shipment_serial_binding
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_shipment_serial_source();
CREATE FUNCTION commerce.ucell_validate_return_serial_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM commerce.return_line WHERE return_line_id=NEW.return_line_id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM commerce.return_line rl JOIN commerce.return_case rc ON rc.return_case_id=rl.return_case_id
  JOIN commerce.fulfillment_source_allocation sa ON sa.order_line_id=rl.order_line_id
  JOIN commerce.fulfillment f ON f.fulfillment_id=sa.fulfillment_id AND f.order_id=rc.order_id
  JOIN commerce.fulfillment_serial_allocation a ON a.fulfillment_source_allocation_id=sa.fulfillment_source_allocation_id
  JOIN commerce.shipment_serial_binding b ON b.fulfillment_serial_allocation_id=a.fulfillment_serial_allocation_id
  WHERE rl.return_line_id=NEW.return_line_id AND b.shipment_serial_binding_id=NEW.shipment_serial_binding_id AND rc.status::text='POSTED')
 THEN RAISE EXCEPTION 'RETURN_SERIAL_SOURCE_MISMATCH'; END IF;
 IF (SELECT count(*)+1 FROM commerce.return_serial_receipt WHERE return_line_id=NEW.return_line_id) > (SELECT quantity FROM commerce.return_line WHERE return_line_id=NEW.return_line_id)
 THEN RAISE EXCEPTION 'RETURN_SERIAL_QUANTITY_EXCEEDED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_serial_receipt_source BEFORE INSERT ON commerce.return_serial_receipt
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_validate_return_serial_source();
CREATE FUNCTION commerce.ucell_protect_serial_shipment_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM commerce.shipment_serial_binding WHERE shipment_id=OLD.shipment_id)
 AND (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at'])
 THEN RAISE EXCEPTION 'SHIPMENT_SERIAL_IDENTITY_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipment_serial_identity BEFORE UPDATE ON commerce.shipment
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_protect_serial_shipment_identity();
CREATE FUNCTION commerce.ucell_protect_serial_return_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM commerce.return_serial_receipt WHERE return_line_id=OLD.return_line_id)
 AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'RETURN_SERIAL_LINE_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_serial_line_identity BEFORE UPDATE ON commerce.return_line
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_protect_serial_return_line();
CREATE FUNCTION commerce.ucell_protect_serial_return_case() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM commerce.return_serial_receipt r JOIN commerce.return_line l ON l.return_line_id=r.return_line_id WHERE l.return_case_id=OLD.return_case_id)
 AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'RETURN_SERIAL_CASE_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_serial_case_identity BEFORE UPDATE ON commerce.return_case
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_protect_serial_return_case();
CREATE FUNCTION commerce.ucell_protect_serial_fulfillment_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM commerce.shipment_serial_binding b JOIN commerce.shipment s ON s.shipment_id=b.shipment_id WHERE s.fulfillment_id=OLD.fulfillment_id)
 AND (NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.fulfillment_key IS DISTINCT FROM OLD.fulfillment_key)
 THEN RAISE EXCEPTION 'SERIAL_FULFILLMENT_SOURCE_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER serial_fulfillment_source BEFORE UPDATE ON commerce.fulfillment
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_protect_serial_fulfillment_source();
CREATE FUNCTION commerce.ucell_protect_serial_order_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM commerce.fulfillment_source_allocation sa
  JOIN commerce.fulfillment_serial_allocation a ON a.fulfillment_source_allocation_id=sa.fulfillment_source_allocation_id
  JOIN commerce.shipment_serial_binding b ON b.fulfillment_serial_allocation_id=a.fulfillment_serial_allocation_id
  WHERE sa.order_line_id=OLD.order_line_id)
 AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'SERIAL_ORDER_LINE_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER serial_order_line_identity BEFORE UPDATE ON commerce.order_line
 FOR EACH ROW EXECUTE FUNCTION commerce.ucell_protect_serial_order_line();
