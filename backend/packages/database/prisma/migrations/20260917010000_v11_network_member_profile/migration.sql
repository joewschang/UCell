CREATE TYPE identity."PersonMembershipState" AS ENUM ('NETWORK_MEMBER','FORMAL_PENDING','FORMAL_MEMBER');

ALTER TABLE identity.person
 ADD COLUMN gender_code text,
 ADD COLUMN membership_state identity."PersonMembershipState",
 ADD COLUMN mobile_verified_at timestamptz(6),
 ADD CONSTRAINT person_gender_code_length_check CHECK (gender_code IS NULL OR length(trim(gender_code)) BETWEEN 1 AND 32);

CREATE TABLE identity.person_membership_state_event (
 person_membership_state_event_id uuid PRIMARY KEY,
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 from_state identity."PersonMembershipState",
 to_state identity."PersonMembershipState" NOT NULL,
 reason_code text NOT NULL,
 source_type text NOT NULL,
 source_id uuid,
 correlation_id uuid NOT NULL,
 occurred_at timestamptz(6) NOT NULL DEFAULT now(),
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT person_membership_state_reason_check CHECK (length(trim(reason_code)) > 0),
 CONSTRAINT person_membership_state_source_check CHECK (length(trim(source_type)) > 0)
);
CREATE INDEX person_membership_state_event_person_occurred_idx ON identity.person_membership_state_event(person_id,occurred_at);
CREATE INDEX person_membership_state_event_correlation_idx ON identity.person_membership_state_event(correlation_id);

CREATE FUNCTION identity.reject_membership_state_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'person membership state evidence is append-only';
END $$;
CREATE TRIGGER person_membership_state_event_immutable BEFORE UPDATE OR DELETE ON identity.person_membership_state_event
FOR EACH ROW EXECUTE FUNCTION identity.reject_membership_state_event_mutation();
