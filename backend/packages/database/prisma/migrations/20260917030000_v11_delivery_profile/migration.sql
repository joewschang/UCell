CREATE TABLE identity.delivery_profile (
 delivery_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 recipient_name text NOT NULL,
 contact_ciphertext text NOT NULL,
 country_code text NOT NULL,
 postal_code text,
 address_ciphertext text NOT NULL,
 key_version text NOT NULL,
 effective_from timestamptz(6) NOT NULL DEFAULT now(),
 effective_to timestamptz(6),
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT delivery_profile_window_check CHECK (effective_to IS NULL OR effective_to > effective_from),
 CONSTRAINT delivery_profile_country_check CHECK (country_code ~ '^[A-Z]{2}$'),
 CONSTRAINT delivery_profile_key_version_check CHECK (key_version ~ '^[A-Za-z0-9._-]{1,64}$')
);
CREATE INDEX delivery_profile_person_history_idx ON identity.delivery_profile(person_id,effective_from,effective_to);
CREATE UNIQUE INDEX delivery_profile_one_current_idx ON identity.delivery_profile(person_id) WHERE effective_to IS NULL;

CREATE FUNCTION identity.protect_delivery_profile_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'delivery profile history cannot be deleted'; END IF;
 IF OLD.effective_to IS NOT NULL OR NEW.delivery_profile_id IS DISTINCT FROM OLD.delivery_profile_id OR NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name OR NEW.contact_ciphertext IS DISTINCT FROM OLD.contact_ciphertext OR NEW.country_code IS DISTINCT FROM OLD.country_code OR NEW.postal_code IS DISTINCT FROM OLD.postal_code OR NEW.address_ciphertext IS DISTINCT FROM OLD.address_ciphertext OR NEW.key_version IS DISTINCT FROM OLD.key_version OR NEW.effective_from IS DISTINCT FROM OLD.effective_from OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.effective_to IS NULL THEN
  RAISE EXCEPTION 'delivery profile history permits only closing the current version';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_profile_history_guard BEFORE UPDATE OR DELETE ON identity.delivery_profile FOR EACH ROW EXECUTE FUNCTION identity.protect_delivery_profile_history();
