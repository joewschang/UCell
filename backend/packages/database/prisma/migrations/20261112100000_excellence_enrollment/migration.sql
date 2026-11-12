ALTER TABLE membership.enrollment_bundle ADD COLUMN plan_code text NOT NULL DEFAULT 'CUSTOM'
  CHECK (plan_code IN ('CUSTOM','EXCELLENCE'));
ALTER TABLE membership.enrollment_bundle ADD COLUMN payment_policy text NOT NULL DEFAULT 'QUALIFICATION_ONLY'
  CHECK (payment_policy IN ('QUALIFICATION_ONLY','COMBINED') AND (plan_code<>'EXCELLENCE' OR payment_policy='COMBINED'));

CREATE FUNCTION membership.keep_enrollment_plan_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_code IS DISTINCT FROM OLD.plan_code OR NEW.payment_policy IS DISTINCT FROM OLD.payment_policy THEN
    RAISE EXCEPTION 'BUNDLE_PLAN_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER keep_enrollment_plan_code BEFORE UPDATE OF plan_code,payment_policy ON membership.enrollment_bundle
  FOR EACH ROW EXECUTE FUNCTION membership.keep_enrollment_plan_code();

CREATE FUNCTION membership.check_excellence_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM membership.enrollment_bundle b WHERE b.bundle_id=NEW.bundle_id AND b.plan_code='EXCELLENCE') AND
    (SELECT count(*)<>3 OR count(*) FILTER(WHERE row.position BETWEEN 1 AND 3 AND
       entry.package_code='STARTER' AND rep.package_code='ACTIVE_QUARTER' AND
       rep.active_duration_unit='MONTH' AND rep.active_duration_value=3)<>3
     FROM membership.enrollment_bundle_ball row
     LEFT JOIN commerce.package_purchase_snapshot entry ON entry.order_id=row.qualification_order_id
     LEFT JOIN commerce.package_purchase_snapshot rep ON rep.order_id=row.repurchase_order_id
     WHERE row.bundle_id=NEW.bundle_id) THEN
    RAISE EXCEPTION 'EXCELLENCE_SELECTION_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER excellence_plan_created AFTER INSERT ON membership.enrollment_bundle
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN(NEW.plan_code='EXCELLENCE')
 EXECUTE FUNCTION membership.check_excellence_plan();
CREATE CONSTRAINT TRIGGER excellence_plan_position AFTER INSERT ON membership.enrollment_bundle_ball
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION membership.check_excellence_plan();

-- The bank receipt and its allocations are recorded together. Applying that money to an
-- order is a separate event after the member is approved and the recipient is known.
CREATE TABLE commerce.enrollment_bundle_allocation (
  order_id uuid PRIMARY KEY REFERENCES commerce."order"(order_id),
  bundle_id uuid NOT NULL REFERENCES commerce.enrollment_bundle_payment(bundle_id),
  amount numeric(18,2) NOT NULL CHECK(amount>=0)
);
CREATE INDEX enrollment_bundle_allocation_bundle_idx ON commerce.enrollment_bundle_allocation(bundle_id);
CREATE TRIGGER immutable_enrollment_allocation BEFORE UPDATE OR DELETE ON commerce.enrollment_bundle_allocation
  FOR EACH ROW EXECUTE FUNCTION membership.keep_enrollment_bundle_ball();

CREATE FUNCTION commerce.keep_verified_enrollment_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT FROM commerce.enrollment_bundle_allocation WHERE order_id=NEW.order_id) THEN
    RAISE EXCEPTION 'BUNDLE_VERIFIED_PREPAYMENT_EXISTS' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER keep_verified_enrollment_order BEFORE UPDATE OF status ON commerce."order" FOR EACH ROW
  WHEN (OLD.status='CONFIRMED' AND NEW.status='VOIDED') EXECUTE FUNCTION commerce.keep_verified_enrollment_order();

CREATE FUNCTION commerce.check_combined_allocation_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM membership.enrollment_bundle b
    JOIN membership.enrollment_bundle_ball p USING(bundle_id)
    JOIN commerce."order" o ON o.order_id IN (p.qualification_order_id,p.repurchase_order_id)
    WHERE b.bundle_id=NEW.bundle_id AND b.payment_policy='COMBINED' AND o.order_id=NEW.order_id
      AND o.net_amount=NEW.amount AND o.status='CONFIRMED') THEN
    RAISE EXCEPTION 'BUNDLE_ALLOCATION_BINDING_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER combined_allocation_binding BEFORE INSERT ON commerce.enrollment_bundle_allocation
  FOR EACH ROW EXECUTE FUNCTION commerce.check_combined_allocation_binding();

ALTER FUNCTION commerce.check_enrollment_bundle_receipt_allocation() RENAME TO check_qualification_only_allocation;
DROP TRIGGER enrollment_bundle_receipt_allocation ON commerce.enrollment_bundle_payment;
CREATE FUNCTION commerce.check_enrollment_bundle_receipt_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected integer; allocated numeric; actual integer; valid boolean;
BEGIN
  IF EXISTS(SELECT 1 FROM membership.enrollment_bundle b WHERE b.bundle_id=NEW.bundle_id AND b.payment_policy='COMBINED') THEN
    SELECT count(qualification_order_id)+count(repurchase_order_id) INTO expected
      FROM membership.enrollment_bundle_ball WHERE bundle_id=NEW.bundle_id;
    SELECT count(*),sum(amount) INTO actual,allocated FROM commerce.enrollment_bundle_allocation WHERE bundle_id=NEW.bundle_id;
    valid:=expected>=2 AND expected=actual;
  ELSE
    SELECT count(*),sum(o.net_amount),bool_and(o.status IN ('PAID','FULFILLED') AND o.paid_at=NEW.received_at AND
      EXISTS(SELECT 1 FROM commerce.payment_event e WHERE e.order_id=o.order_id AND e.event_type='PAYMENT_CONFIRMED'
        AND e.amount=o.net_amount AND e.reference_no=NEW.reference_no)) INTO expected,allocated,valid
    FROM membership.enrollment_bundle_ball p JOIN commerce."order" o ON o.order_id=p.qualification_order_id WHERE p.bundle_id=NEW.bundle_id;
    valid:=valid AND expected>=2;
  END IF;
  IF valid IS NOT TRUE OR NEW.amount IS DISTINCT FROM allocated THEN
    RAISE EXCEPTION 'BUNDLE_RECEIPT_ALLOCATION_INCOMPLETE' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER enrollment_bundle_receipt_allocation AFTER INSERT ON commerce.enrollment_bundle_payment
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commerce.check_enrollment_bundle_receipt_allocation();
DROP FUNCTION commerce.check_qualification_only_allocation();

CREATE OR REPLACE FUNCTION commerce.check_enrollment_bundle_order_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE part record;
BEGIN
  SELECT b.payment_policy AS policy,b.bundle_id,p.qualification_order_id=NEW.order_id AS entry,
    q.status::text AS ball_status,q.effective_at,a.status::text AS review INTO part
  FROM membership.enrollment_bundle_ball p JOIN membership.enrollment_bundle b USING(bundle_id)
    JOIN membership.qualification q ON q.qualification_id=p.qualification_id
    JOIN identity.formal_member_application a ON a.formal_member_application_id=b.application_id
  WHERE NEW.order_id IN (p.qualification_order_id,p.repurchase_order_id);
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF part.policy='COMBINED' THEN
    IF part.review<>'APPROVED' OR NOT EXISTS(SELECT FROM commerce.enrollment_bundle_allocation a
      JOIN commerce.enrollment_bundle_payment r USING(bundle_id)
      WHERE a.order_id=NEW.order_id AND a.bundle_id=part.bundle_id AND a.amount=NEW.net_amount AND r.received_at<=NEW.paid_at
        AND EXISTS(SELECT FROM commerce.payment_event e WHERE e.order_id=NEW.order_id AND e.event_type='PAYMENT_CONFIRMED'
         AND e.occurred_at=NEW.paid_at AND e.reference_no=r.reference_no AND e.amount=a.amount)) THEN
      RAISE EXCEPTION 'BUNDLE_VERIFIED_RECEIPT_AND_APPROVAL_REQUIRED' USING ERRCODE='23514';
    END IF;
  ELSIF part.entry AND NOT EXISTS (SELECT FROM commerce.enrollment_bundle_payment r
        WHERE r.bundle_id=part.bundle_id AND r.received_at=NEW.paid_at) THEN
    RAISE EXCEPTION 'BUNDLE_SINGLE_PAYMENT_NOT_ALLOWED' USING ERRCODE='23514';
  END IF;
  IF NOT part.entry AND (part.ball_status<>'EFFECTIVE' OR part.effective_at IS NULL OR NEW.paid_at IS NULL OR NEW.paid_at<part.effective_at) THEN
    RAISE EXCEPTION 'BUNDLE_REPURCHASE_AWAITS_PLACEMENT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- An alternative placement writer cannot commit an effective combined-payment ball
-- while its prepaid subscription is missing. Deferral lets the normal group placement
-- create every binary edge, then activate each paid subscription in that same transaction.
CREATE FUNCTION membership.check_funded_bundle_activation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE has_funding boolean;
BEGIN
  SELECT a.status='APPROVED' AND p.membership_state='FORMAL_MEMBER'
      AND EXISTS(SELECT FROM commerce.enrollment_bundle_allocation e WHERE e.order_id=row.qualification_order_id)
      AND (row.repurchase_order_id IS NULL OR EXISTS(SELECT FROM commerce.enrollment_bundle_allocation r
        JOIN subscription.subscription s ON s.order_id=r.order_id AND s.qualification_id=row.qualification_id
        WHERE r.order_id=row.repurchase_order_id AND s.status='ACTIVE'))
   INTO has_funding
  FROM membership.enrollment_bundle_ball row JOIN membership.enrollment_bundle b USING(bundle_id)
    JOIN identity.formal_member_application a ON a.formal_member_application_id=b.application_id
    JOIN identity.person p ON p.person_id=b.person_id
  WHERE row.qualification_id=NEW.qualification_id AND b.payment_policy='COMBINED';
  IF FOUND AND has_funding IS NOT TRUE THEN RAISE EXCEPTION 'BUNDLE_ACTIVATION_INCOMPLETE' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER funded_bundle_activation AFTER UPDATE OF status ON membership.qualification
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.status='DRAFT' AND NEW.status='EFFECTIVE')
 EXECUTE FUNCTION membership.check_funded_bundle_activation();
