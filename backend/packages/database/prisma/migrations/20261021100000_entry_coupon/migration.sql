ALTER TABLE commerce.package_purchase_snapshot ADD COLUMN qualification_fee numeric(18,2) NOT NULL DEFAULT 0 CHECK(qualification_fee>=0), ADD COLUMN discount_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0), ADD COLUMN coupon_code text, ADD COLUMN payment_deadline timestamptz(6);
CREATE TABLE commerce.coupon_definition(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9_-]{3,40}$'),name text NOT NULL,category text NOT NULL DEFAULT 'QUALIFICATION' CHECK(category='QUALIFICATION'),rule_code text NOT NULL CHECK(rule_code='ENTRY_MINUS_14400_3_V1'),description text NOT NULL,package_codes text[] NOT NULL,starts_at timestamptz(6) NOT NULL,ends_at timestamptz(6) NOT NULL,max_uses int NOT NULL DEFAULT 0 CHECK(max_uses>=0),per_person_limit int NOT NULL DEFAULT 0 CHECK(per_person_limit>=0),enabled boolean NOT NULL DEFAULT false,revision int NOT NULL DEFAULT 1,created_at timestamptz(6) NOT NULL DEFAULT now(),CHECK(ends_at>starts_at));
CREATE TABLE commerce.coupon_redemption(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),coupon_id uuid NOT NULL REFERENCES commerce.coupon_definition(id),order_id uuid NOT NULL UNIQUE REFERENCES commerce."order"(order_id),person_id uuid NOT NULL,snapshot jsonb NOT NULL,reserved_at timestamptz(6) NOT NULL DEFAULT now(),expires_at timestamptz(6) NOT NULL,redeemed_at timestamptz(6));
CREATE INDEX coupon_redemption_coupon_id_person_id_idx ON commerce.coupon_redemption(coupon_id,person_id);
CREATE TABLE commerce.coupon_usage_event(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL,kind text NOT NULL,occurred_at timestamptz(6) NOT NULL DEFAULT now());
CREATE INDEX coupon_usage_event_order_id_occurred_at_idx ON commerce.coupon_usage_event(order_id,occurred_at);
CREATE TRIGGER coupon_event_append_only BEFORE UPDATE OR DELETE ON commerce.coupon_usage_event FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE FUNCTION commerce.entry_coupon_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE deadline timestamptz; BEGIN
 IF NEW.status='PAID' AND OLD.status<>'PAID' THEN
  SELECT payment_deadline INTO deadline FROM commerce.package_purchase_snapshot WHERE order_id=NEW.order_id;
  IF deadline IS NOT NULL AND (clock_timestamp()>=deadline OR NEW.paid_at IS NULL OR NEW.paid_at>=deadline OR NEW.paid_at<OLD.created_at OR NEW.paid_at>clock_timestamp()+interval '1 minute') THEN RAISE EXCEPTION 'PACKAGE_PAYMENT_DEADLINE_EXCEEDED'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER entry_coupon_payment_guard BEFORE UPDATE ON commerce."order" FOR EACH ROW EXECUTE FUNCTION commerce.entry_coupon_payment_guard();
CREATE FUNCTION commerce.coupon_order_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS(SELECT 1 FROM commerce.coupon_redemption WHERE order_id=NEW.order_id) THEN
  INSERT INTO commerce.coupon_usage_event(order_id,kind) VALUES(NEW.order_id,NEW.status::text);
  IF NEW.status='PAID' THEN UPDATE commerce.coupon_redemption SET redeemed_at=NEW.paid_at WHERE order_id=NEW.order_id AND redeemed_at IS NULL; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER coupon_order_event AFTER UPDATE ON commerce."order" FOR EACH ROW EXECUTE FUNCTION commerce.coupon_order_event();
CREATE FUNCTION commerce.coupon_redemption_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'coupon usage cannot be deleted'; END IF;
 IF (NEW.id,NEW.coupon_id,NEW.order_id,NEW.person_id,NEW.snapshot,NEW.reserved_at,NEW.expires_at) IS DISTINCT FROM (OLD.id,OLD.coupon_id,OLD.order_id,OLD.person_id,OLD.snapshot,OLD.reserved_at,OLD.expires_at) OR OLD.redeemed_at IS NOT NULL AND NEW.redeemed_at IS DISTINCT FROM OLD.redeemed_at THEN RAISE EXCEPTION 'coupon usage snapshot is immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER coupon_redemption_guard BEFORE UPDATE OR DELETE ON commerce.coupon_redemption FOR EACH ROW EXECUTE FUNCTION commerce.coupon_redemption_guard();
INSERT INTO commerce.coupon_definition(code,name,rule_code,description,package_codes,starts_at,ends_at,max_uses,per_person_limit,enabled) VALUES('UCELL888','期初會員資格優惠','ENTRY_MINUS_14400_3_V1','資格套組減 14,400 元，可選主商品減少 3 盒；每個資格建立費 600 元另計。活躍及領獎條件另行判定。',ARRAY['STARTER','ELITE','LEADER'],now(),'2027-01-31T16:00:00Z',0,0,true);
