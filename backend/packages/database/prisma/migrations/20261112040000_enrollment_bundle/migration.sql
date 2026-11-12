ALTER TABLE organization.qualification_sponsor_selection_evidence
  ALTER COLUMN selected_sponsor_owner_person_id DROP NOT NULL;

CREATE FUNCTION organization.require_sponsor_holder_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.selected_sponsor_owner_person_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM membership.qualification WHERE qualification_id=NEW.selected_sponsor_qualification_id
      AND (current_holder_legal_entity_id IS NOT NULL OR current_company_principal_id IS NOT NULL OR kind='COMPANY_BOOTSTRAP')
  ) THEN RAISE EXCEPTION 'Sponsor owner identity required' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enrollment_sponsor_holder_identity BEFORE INSERT ON organization.qualification_sponsor_selection_evidence
  FOR EACH ROW EXECUTE FUNCTION organization.require_sponsor_holder_identity();

CREATE TABLE membership.enrollment_bundle (
  bundle_id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES identity.formal_member_application(formal_member_application_id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  superseded_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX enrollment_bundle_active_application ON membership.enrollment_bundle(application_id) WHERE superseded_at IS NULL;
CREATE INDEX enrollment_bundle_person_id_idx ON membership.enrollment_bundle(person_id);

CREATE TABLE membership.enrollment_bundle_ball (
  bundle_id uuid NOT NULL REFERENCES membership.enrollment_bundle(bundle_id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  qualification_id uuid NOT NULL UNIQUE REFERENCES membership.qualification(qualification_id) ON DELETE RESTRICT,
  qualification_order_id uuid NOT NULL UNIQUE REFERENCES commerce."order"(order_id) ON DELETE RESTRICT,
  repurchase_order_id uuid UNIQUE REFERENCES commerce."order"(order_id) ON DELETE RESTRICT,
  PRIMARY KEY (bundle_id, position),
  CHECK (qualification_order_id IS DISTINCT FROM repurchase_order_id)
);

-- A package must belong to the same applicant, qualification and order purpose at the time of binding.
CREATE FUNCTION membership.validate_enrollment_bundle_ball() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Bundle positions and order bindings are immutable' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM membership.enrollment_bundle b
    JOIN identity.formal_member_application a ON a.formal_member_application_id=b.application_id AND a.person_id=b.person_id
    JOIN commerce."order" o ON o.order_id=NEW.qualification_order_id AND o.qualification_id=NEW.qualification_id AND o.purpose='ENTRY'
    JOIN commerce.package_purchase_snapshot s ON s.order_id=o.order_id AND s.person_id=b.person_id AND s.package_class='QUALIFICATION'
    WHERE b.bundle_id=NEW.bundle_id AND s.legal_entity_id IS NULL
  ) THEN RAISE EXCEPTION 'Invalid bundled qualification order' USING ERRCODE='23514'; END IF;
  IF NEW.repurchase_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM membership.enrollment_bundle b JOIN commerce."order" o ON o.order_id=NEW.repurchase_order_id
    JOIN commerce.package_purchase_snapshot s ON s.order_id=o.order_id AND s.person_id=b.person_id AND s.package_class='ACTIVE_DURATION'
    WHERE b.bundle_id=NEW.bundle_id AND o.purpose='REPURCHASE' AND o.qualification_id=NEW.qualification_id
      AND s.target_qualification_id=NEW.qualification_id AND s.legal_entity_id IS NULL
  ) THEN RAISE EXCEPTION 'Invalid bundled repurchase order' USING ERRCODE='23514'; END IF;
  IF NEW.position>1 AND NOT EXISTS (
    SELECT 1 FROM membership.enrollment_bundle_ball WHERE bundle_id=NEW.bundle_id AND position=NEW.position/2
  ) THEN RAISE EXCEPTION 'Missing bundle parent' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_enrollment_bundle_ball BEFORE INSERT OR UPDATE OR DELETE ON membership.enrollment_bundle_ball
  FOR EACH ROW EXECUTE FUNCTION membership.validate_enrollment_bundle_ball();
