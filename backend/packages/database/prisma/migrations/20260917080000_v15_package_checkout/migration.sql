ALTER TABLE membership.qualification_setup
  ADD COLUMN package_purchase_snapshot_id uuid UNIQUE
  REFERENCES commerce.package_purchase_snapshot(package_purchase_snapshot_id);

CREATE INDEX qualification_setup_package_snapshot_idx
  ON membership.qualification_setup(package_purchase_snapshot_id)
  WHERE package_purchase_snapshot_id IS NOT NULL;

CREATE FUNCTION commerce.ucell_package_order_recognition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.aggregate_type='ORDER'
     AND EXISTS (SELECT 1 FROM commerce.package_purchase_snapshot s WHERE s.order_id=NEW.aggregate_id)
     AND NEW.event_type='SALE_CONFIRMED' THEN
    RAISE EXCEPTION 'package orders require explicit package recognition; generic SALE_CONFIRMED denied';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER package_order_recognition_guard
  BEFORE INSERT ON integration.outbox_event
  FOR EACH ROW EXECUTE FUNCTION commerce.ucell_package_order_recognition_guard();
