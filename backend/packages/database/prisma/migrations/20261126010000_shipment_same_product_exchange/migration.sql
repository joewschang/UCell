-- Additive physical after-sales records. No order, PV, award or price backfill.
CREATE TYPE commerce."ShipmentExchangeStatus" AS ENUM ('REQUESTED','RECEIVED','REPLACEMENT_CREATED','CANCELLED');
CREATE TABLE commerce.shipment_exchange_case (
 shipment_exchange_case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 exchange_no text NOT NULL UNIQUE,
 original_fulfillment_id uuid NOT NULL REFERENCES commerce.fulfillment(fulfillment_id),
 original_shipment_id uuid NOT NULL REFERENCES commerce.shipment(shipment_id),
 replacement_fulfillment_id uuid UNIQUE REFERENCES commerce.fulfillment(fulfillment_id),
 status commerce."ShipmentExchangeStatus" NOT NULL DEFAULT 'REQUESTED',
 reason varchar(500) NOT NULL CHECK(length(btrim(reason))>0),
 request_key uuid NOT NULL UNIQUE, request_hash char(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_by_actor text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now(),
 received_at timestamptz(6), cancelled_at timestamptz(6), cancelled_by_actor text,
 CONSTRAINT shipment_exchange_replacement_state_ck CHECK((status='REPLACEMENT_CREATED')=(replacement_fulfillment_id IS NOT NULL)),
 CONSTRAINT shipment_exchange_received_state_ck CHECK((status IN ('RECEIVED','REPLACEMENT_CREATED'))=(received_at IS NOT NULL)),
 CONSTRAINT shipment_exchange_cancelled_state_ck CHECK((status='CANCELLED')=(cancelled_at IS NOT NULL AND cancelled_by_actor IS NOT NULL))
);
CREATE INDEX shipment_exchange_original_created_idx ON commerce.shipment_exchange_case(original_fulfillment_id,created_at);
CREATE TABLE commerce.shipment_exchange_item (
 shipment_exchange_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_exchange_case_id uuid NOT NULL REFERENCES commerce.shipment_exchange_case(shipment_exchange_case_id),
 shipment_serial_binding_id uuid NOT NULL REFERENCES commerce.shipment_serial_binding(shipment_serial_binding_id),
 received_at timestamptz(6), received_by_actor text, released_at timestamptz(6),
 UNIQUE(shipment_exchange_case_id,shipment_serial_binding_id),
 CHECK((received_at IS NULL)=(received_by_actor IS NULL)),
 CHECK(received_at IS NULL OR released_at IS NULL)
);
CREATE INDEX shipment_exchange_item_binding_idx ON commerce.shipment_exchange_item(shipment_serial_binding_id);
CREATE UNIQUE INDEX shipment_exchange_active_binding_uq ON commerce.shipment_exchange_item(shipment_serial_binding_id) WHERE released_at IS NULL;

CREATE FUNCTION commerce.ucell_guard_shipment_exchange_case() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'REQUESTED' OR NOT EXISTS(SELECT 1 FROM commerce.shipment WHERE shipment_id=NEW.original_shipment_id AND fulfillment_id=NEW.original_fulfillment_id)
  THEN RAISE EXCEPTION 'EXCHANGE_SOURCE_MISMATCH'; END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['status','received_at','replacement_fulfillment_id','cancelled_at','cancelled_by_actor']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','received_at','replacement_fulfillment_id','cancelled_at','cancelled_by_actor'])
 THEN RAISE EXCEPTION 'EXCHANGE_IDENTITY_IMMUTABLE'; END IF;
 IF OLD.status='REQUESTED' AND NEW.status='RECEIVED' THEN
  IF NEW.received_at IS NULL OR NOT EXISTS(SELECT 1 FROM commerce.shipment_exchange_item WHERE shipment_exchange_case_id=OLD.shipment_exchange_case_id)
   OR EXISTS(SELECT 1 FROM commerce.shipment_exchange_item WHERE shipment_exchange_case_id=OLD.shipment_exchange_case_id AND (received_at IS NULL OR released_at IS NOT NULL))
  THEN RAISE EXCEPTION 'EXCHANGE_RECEIPT_REQUIRED'; END IF;
 ELSIF OLD.status='REQUESTED' AND NEW.status='CANCELLED' THEN
  IF EXISTS(SELECT 1 FROM commerce.shipment_exchange_item WHERE shipment_exchange_case_id=OLD.shipment_exchange_case_id AND (received_at IS NOT NULL OR released_at IS NULL))
  THEN RAISE EXCEPTION 'EXCHANGE_CANCELLATION_NOT_ALLOWED'; END IF;
 ELSIF OLD.status='RECEIVED' AND NEW.status='REPLACEMENT_CREATED' THEN
  IF NEW.received_at IS DISTINCT FROM OLD.received_at OR NOT EXISTS(
   SELECT 1 FROM commerce.fulfillment original JOIN commerce.fulfillment replacement ON replacement.order_id=original.order_id
   WHERE original.fulfillment_id=OLD.original_fulfillment_id AND replacement.fulfillment_id=NEW.replacement_fulfillment_id
    AND replacement.fulfillment_id<>original.fulfillment_id AND replacement.status='READY'
    AND replacement.fulfillment_policy_snapshot_ref='UCELL_SAME_PRODUCT_EXCHANGE_V1'
    AND NOT EXISTS(SELECT 1 FROM commerce.fulfillment_source_allocation WHERE fulfillment_id=replacement.fulfillment_id))
  THEN RAISE EXCEPTION 'EXCHANGE_REPLACEMENT_AUTHORITY_REQUIRED'; END IF;
 ELSE RAISE EXCEPTION 'EXCHANGE_STATE_CONFLICT'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipment_exchange_case_guard BEFORE INSERT OR UPDATE ON commerce.shipment_exchange_case FOR EACH ROW EXECUTE FUNCTION commerce.ucell_guard_shipment_exchange_case();
CREATE TRIGGER shipment_exchange_case_no_delete BEFORE DELETE ON commerce.shipment_exchange_case FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();

CREATE FUNCTION commerce.ucell_guard_shipment_exchange_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unit_id uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT a.serialized_unit_id INTO unit_id FROM commerce.shipment_exchange_case c
   JOIN commerce.shipment_serial_binding b ON b.shipment_id=c.original_shipment_id
   JOIN commerce.fulfillment_serial_allocation a ON a.fulfillment_serial_allocation_id=b.fulfillment_serial_allocation_id
   WHERE c.shipment_exchange_case_id=NEW.shipment_exchange_case_id AND c.status='REQUESTED' AND b.shipment_serial_binding_id=NEW.shipment_serial_binding_id;
  IF unit_id IS NULL OR NEW.received_at IS NOT NULL OR NEW.released_at IS NOT NULL THEN RAISE EXCEPTION 'EXCHANGE_SERIAL_SOURCE_MISMATCH'; END IF;
  PERFORM 1 FROM commerce.serialized_unit WHERE serialized_unit_id=unit_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM commerce.serialized_unit WHERE serialized_unit_id=unit_id AND status='SHIPPED')
   OR EXISTS(SELECT 1 FROM commerce.return_serial_receipt WHERE shipment_serial_binding_id=NEW.shipment_serial_binding_id)
  THEN RAISE EXCEPTION 'EXCHANGE_SERIAL_NOT_SHIPPED'; END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['received_at','received_by_actor','released_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['received_at','received_by_actor','released_at'])
   OR OLD.received_at IS NOT NULL OR OLD.released_at IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM commerce.shipment_exchange_case WHERE shipment_exchange_case_id=NEW.shipment_exchange_case_id AND status='REQUESTED')
   OR NOT ((NEW.received_at IS NOT NULL AND NEW.received_by_actor IS NOT NULL AND NEW.released_at IS NULL) OR (NEW.received_at IS NULL AND NEW.received_by_actor IS NULL AND NEW.released_at IS NOT NULL))
  THEN RAISE EXCEPTION 'EXCHANGE_ITEM_IMMUTABLE'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipment_exchange_item_guard BEFORE INSERT OR UPDATE ON commerce.shipment_exchange_item FOR EACH ROW EXECUTE FUNCTION commerce.ucell_guard_shipment_exchange_item();
CREATE TRIGGER shipment_exchange_item_no_delete BEFORE DELETE ON commerce.shipment_exchange_item FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();

-- Return receipts and exchange receipts cannot claim the same physical unit.
CREATE FUNCTION commerce.ucell_guard_return_exchange_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM commerce.return_line WHERE return_line_id=NEW.return_line_id FOR UPDATE;
 PERFORM 1 FROM commerce.serialized_unit u JOIN commerce.fulfillment_serial_allocation a ON a.serialized_unit_id=u.serialized_unit_id
  JOIN commerce.shipment_serial_binding b ON b.fulfillment_serial_allocation_id=a.fulfillment_serial_allocation_id
  WHERE b.shipment_serial_binding_id=NEW.shipment_serial_binding_id FOR UPDATE OF u;
 IF EXISTS(SELECT 1 FROM commerce.shipment_exchange_item WHERE shipment_serial_binding_id=NEW.shipment_serial_binding_id AND released_at IS NULL)
 THEN RAISE EXCEPTION 'RETURN_SERIAL_PENDING_EXCHANGE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_serial_exchange_claim BEFORE INSERT ON commerce.return_serial_receipt FOR EACH ROW EXECUTE FUNCTION commerce.ucell_guard_return_exchange_claim();

-- The replacement's allowance belongs to that case and cannot enlarge ordinary fulfillment.
CREATE FUNCTION commerce.ucell_guard_exchange_source_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE exchange_id uuid; authorized bigint; original_source commerce.fulfillment_source_allocation%ROWTYPE; order_quantity numeric;
BEGIN
 PERFORM 1 FROM commerce.fulfillment WHERE fulfillment_id=NEW.fulfillment_id FOR UPDATE;
 PERFORM 1 FROM commerce.order_line WHERE order_line_id=NEW.order_line_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM commerce.fulfillment f JOIN commerce.order_line l ON l.order_id=f.order_id WHERE f.fulfillment_id=NEW.fulfillment_id AND l.order_line_id=NEW.order_line_id)
 THEN RAISE EXCEPTION 'FULFILLMENT_ALLOCATION_SOURCE_MISMATCH'; END IF;
 SELECT shipment_exchange_case_id INTO exchange_id FROM commerce.shipment_exchange_case WHERE replacement_fulfillment_id=NEW.fulfillment_id AND status='REPLACEMENT_CREATED';
 IF exchange_id IS NOT NULL THEN
  SELECT count(*) INTO authorized FROM commerce.shipment_exchange_item i
   JOIN commerce.shipment_serial_binding b ON b.shipment_serial_binding_id=i.shipment_serial_binding_id
   JOIN commerce.fulfillment_serial_allocation a ON a.fulfillment_serial_allocation_id=b.fulfillment_serial_allocation_id
   JOIN commerce.fulfillment_source_allocation s ON s.fulfillment_source_allocation_id=a.fulfillment_source_allocation_id
   WHERE i.shipment_exchange_case_id=exchange_id AND i.received_at IS NOT NULL AND i.released_at IS NULL AND s.order_line_id=NEW.order_line_id;
  SELECT s.* INTO original_source FROM commerce.shipment_exchange_item i
   JOIN commerce.shipment_serial_binding b ON b.shipment_serial_binding_id=i.shipment_serial_binding_id
   JOIN commerce.fulfillment_serial_allocation a ON a.fulfillment_serial_allocation_id=b.fulfillment_serial_allocation_id
   JOIN commerce.fulfillment_source_allocation s ON s.fulfillment_source_allocation_id=a.fulfillment_source_allocation_id
   WHERE i.shipment_exchange_case_id=exchange_id AND s.order_line_id=NEW.order_line_id LIMIT 1;
  IF authorized=0 OR NEW.allocated_quantity<>authorized OR NEW.sku_snapshot IS DISTINCT FROM original_source.sku_snapshot
   OR NEW.commercial_offering_snapshot IS DISTINCT FROM original_source.commercial_offering_snapshot OR NEW.line_purpose IS DISTINCT FROM original_source.line_purpose
  THEN RAISE EXCEPTION 'EXCHANGE_REPLACEMENT_QUANTITY_INVALID'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM commerce.fulfillment WHERE fulfillment_id=NEW.fulfillment_id AND fulfillment_policy_snapshot_ref='UCELL_SAME_PRODUCT_EXCHANGE_V1')
  THEN RAISE EXCEPTION 'EXCHANGE_REPLACEMENT_AUTHORITY_REQUIRED'; END IF;
  SELECT quantity INTO order_quantity FROM commerce.order_line WHERE order_line_id=NEW.order_line_id;
  IF NEW.allocated_quantity+COALESCE((SELECT sum(a.allocated_quantity) FROM commerce.fulfillment_source_allocation a
   WHERE a.order_line_id=NEW.order_line_id AND NOT EXISTS(SELECT 1 FROM commerce.shipment_exchange_case c WHERE c.replacement_fulfillment_id=a.fulfillment_id)),0)>order_quantity
  THEN RAISE EXCEPTION 'FULFILLMENT_ALLOCATION_EXCEEDS_ORDER_LINE'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fulfillment_exchange_source_authority BEFORE INSERT ON commerce.fulfillment_source_allocation FOR EACH ROW EXECUTE FUNCTION commerce.ucell_guard_exchange_source_allocation();
