-- R1.0B Retail Referral foundation. Additive and forward-only.
-- Retail attribution is intentionally separate from SponsorRelationship and the
-- transient identity.referral_attribution conversion flow.
ALTER TABLE commerce.product_rule_profile
  ADD COLUMN retail_referral_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN retail_referral_calculation_type text,
  ADD COLUMN retail_referral_rate numeric(10,6),
  ADD COLUMN retail_referral_base_type text,
  ADD CONSTRAINT product_rule_profile_retail_referral_shape CHECK (
    (NOT retail_referral_enabled
      AND retail_referral_calculation_type IS NULL
      AND retail_referral_rate IS NULL
      AND retail_referral_base_type IS NULL)
    OR
    (retail_referral_enabled
      AND retail_referral_calculation_type = 'PERCENTAGE'
      AND retail_referral_rate >= 0 AND retail_referral_rate <= 1
      AND retail_referral_base_type = 'NET_PAID_ITEM_AMOUNT')
  );

ALTER TABLE commerce."order" ALTER COLUMN qualification_id DROP NOT NULL;
ALTER TABLE commerce."order" ADD COLUMN purchaser_person_id uuid;
ALTER TABLE commerce."order"
  ADD CONSTRAINT order_purchaser_person_fk FOREIGN KEY (purchaser_person_id)
  REFERENCES identity.person(person_id);
ALTER TABLE commerce."order"
  ADD CONSTRAINT order_retail_purchaser_shape CHECK (
    (purpose = 'RETAIL' AND (qualification_id IS NOT NULL OR purchaser_person_id IS NOT NULL))
    OR (purpose <> 'RETAIL' AND qualification_id IS NOT NULL)
  );
ALTER TABLE commerce."order"
  ADD CONSTRAINT order_purchaser_only_retail CHECK (purchaser_person_id IS NULL OR purpose = 'RETAIL');
CREATE INDEX order_purchaser_person_created_at_idx ON commerce."order"(purchaser_person_id, created_at DESC);

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE commerce.retail_referrer_attribution (
  retail_referrer_attribution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(person_id),
  referrer_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  referrer_ball_no_snapshot text NOT NULL,
  source text NOT NULL,
  effective_from timestamptz(6) NOT NULL,
  effective_to timestamptz(6),
  created_by_order_id uuid REFERENCES commerce."order"(order_id),
  correction_reason text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT retail_referrer_attribution_interval CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT retail_referrer_attribution_no_overlap EXCLUDE USING gist
    (person_id WITH =, tstzrange(effective_from,coalesce(effective_to,'infinity'::timestamptz),'[)') WITH &&)
);
CREATE UNIQUE INDEX retail_referrer_attribution_person_effective_from_key ON commerce.retail_referrer_attribution(person_id,effective_from);
CREATE INDEX retail_referrer_attribution_person_effective_idx ON commerce.retail_referrer_attribution(person_id,effective_from,effective_to);
CREATE INDEX retail_referrer_attribution_referrer_effective_idx ON commerce.retail_referrer_attribution(referrer_qualification_id,effective_from);

CREATE TABLE commerce.retail_referrer_attribution_event (
  retail_referrer_attribution_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retail_referrer_attribution_id uuid NOT NULL REFERENCES commerce.retail_referrer_attribution(retail_referrer_attribution_id),
  action text NOT NULL,
  actor_person_id uuid REFERENCES identity.person(person_id),
  reason text,
  effective_from timestamptz(6) NOT NULL,
  correlation_id uuid NOT NULL,
  evidence_hash text NOT NULL CHECK(length(evidence_hash)=64),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX retail_referrer_attribution_event_attribution_idx ON commerce.retail_referrer_attribution_event(retail_referrer_attribution_id,created_at);
CREATE INDEX retail_referrer_attribution_event_actor_idx ON commerce.retail_referrer_attribution_event(actor_person_id,created_at);

CREATE TABLE commerce.retail_referral_order_line_snapshot (
  retail_referral_order_line_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id uuid NOT NULL UNIQUE REFERENCES commerce.order_line(order_line_id),
  order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
  retail_referrer_attribution_id uuid REFERENCES commerce.retail_referrer_attribution(retail_referrer_attribution_id),
  referrer_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  referrer_ball_no_snapshot text,
  retail_referral_enabled boolean NOT NULL,
  calculation_type text,
  rate numeric(10,6),
  base_type text,
  net_paid_item_amount numeric(18,2) NOT NULL CHECK(net_paid_item_amount>=0),
  product_rule_profile_id uuid NOT NULL REFERENCES commerce.product_rule_profile(product_rule_profile_id),
  product_rule_version text NOT NULL,
  parameter_snapshot_hash text,
  attribution_evidence jsonb NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT retail_referral_snapshot_shape CHECK (
    (NOT retail_referral_enabled AND calculation_type IS NULL AND rate IS NULL AND base_type IS NULL)
    OR (retail_referral_enabled AND calculation_type='PERCENTAGE' AND rate>=0 AND rate<=1 AND base_type='NET_PAID_ITEM_AMOUNT')
  )
);
CREATE INDEX retail_referral_line_snapshot_order_idx ON commerce.retail_referral_order_line_snapshot(order_id);
CREATE INDEX retail_referral_line_snapshot_referrer_idx ON commerce.retail_referral_order_line_snapshot(referrer_qualification_id,created_at);

CREATE OR REPLACE FUNCTION commerce.prevent_retail_referral_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'RETAIL_REFERRAL_SNAPSHOT_IMMUTABLE'; END $$;
CREATE TRIGGER retail_referral_snapshot_immutable BEFORE UPDATE OR DELETE ON commerce.retail_referral_order_line_snapshot
FOR EACH ROW EXECUTE FUNCTION commerce.prevent_retail_referral_snapshot_mutation();
CREATE TRIGGER retail_referrer_event_immutable BEFORE UPDATE OR DELETE ON commerce.retail_referrer_attribution_event
FOR EACH ROW EXECUTE FUNCTION commerce.prevent_retail_referral_snapshot_mutation();

CREATE OR REPLACE FUNCTION commerce.guard_retail_referrer_attribution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'RETAIL_REFERRER_ATTRIBUTION_APPEND_ONLY'; END IF;
 IF NEW.person_id IS DISTINCT FROM OLD.person_id
    OR NEW.referrer_qualification_id IS DISTINCT FROM OLD.referrer_qualification_id
    OR NEW.referrer_ball_no_snapshot IS DISTINCT FROM OLD.referrer_ball_no_snapshot
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
    OR NEW.created_by_order_id IS DISTINCT FROM OLD.created_by_order_id
    OR NEW.correction_reason IS DISTINCT FROM OLD.correction_reason
    OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL
 THEN RAISE EXCEPTION 'RETAIL_REFERRER_ATTRIBUTION_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER retail_referrer_attribution_guard BEFORE UPDATE OR DELETE ON commerce.retail_referrer_attribution
FOR EACH ROW EXECUTE FUNCTION commerce.guard_retail_referrer_attribution();