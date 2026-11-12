-- Every payment writer, including provider projections, must honor grouped entry
-- payments and the effective date of preselected repurchases.
CREATE FUNCTION commerce.check_enrollment_bundle_order_payment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_bundle uuid; available_from timestamptz; ball_status text;
BEGIN
  SELECT bundle_id INTO entry_bundle FROM membership.enrollment_bundle_ball WHERE qualification_order_id=NEW.order_id;
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM commerce.enrollment_bundle_payment receipt
      WHERE receipt.bundle_id=entry_bundle AND receipt.received_at=NEW.paid_at
    ) THEN RAISE EXCEPTION 'BUNDLE_SINGLE_PAYMENT_NOT_ALLOWED' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  SELECT q.status,q.effective_at INTO ball_status,available_from
  FROM membership.enrollment_bundle_ball b JOIN membership.qualification q ON q.qualification_id=b.qualification_id
  WHERE b.repurchase_order_id=NEW.order_id;
  IF FOUND AND (ball_status<>'EFFECTIVE' OR available_from IS NULL OR NEW.paid_at IS NULL OR NEW.paid_at<available_from) THEN
    RAISE EXCEPTION 'BUNDLE_REPURCHASE_AWAITS_PLACEMENT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enrollment_bundle_order_payment
BEFORE UPDATE OF status ON commerce."order" FOR EACH ROW
WHEN (NEW.status='PAID' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION commerce.check_enrollment_bundle_order_payment();

CREATE FUNCTION commerce.check_enrollment_bundle_receipt_allocation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lines integer; allocated numeric; complete boolean;
BEGIN
  SELECT count(*),sum(o.net_amount),bool_and(o.status='PAID' AND o.paid_at=NEW.received_at
    AND EXISTS (SELECT 1 FROM commerce.payment_event event WHERE event.order_id=o.order_id
      AND event.event_type='PAYMENT_CONFIRMED' AND event.amount=o.net_amount AND event.reference_no=NEW.reference_no))
  INTO lines,allocated,complete
  FROM membership.enrollment_bundle_ball b JOIN commerce."order" o ON o.order_id=b.qualification_order_id
  WHERE b.bundle_id=NEW.bundle_id;
  IF lines<2 OR allocated IS DISTINCT FROM NEW.amount OR complete IS NOT TRUE THEN
    RAISE EXCEPTION 'BUNDLE_RECEIPT_ALLOCATION_INCOMPLETE' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER enrollment_bundle_receipt_allocation
AFTER INSERT ON commerce.enrollment_bundle_payment DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION commerce.check_enrollment_bundle_receipt_allocation();
