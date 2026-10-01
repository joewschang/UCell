CREATE TYPE identity."FormalApplicantType" AS ENUM ('INDIVIDUAL','LEGAL_ENTITY');
CREATE TYPE identity."SpouseVerificationStatus" AS ENUM ('NOT_APPLICABLE','PENDING','VERIFIED','REJECTED');
CREATE TYPE identity."LegalEntityStatus" AS ENUM ('DRAFT','ACTIVE','SUSPENDED','TERMINATED');

CREATE TABLE identity.legal_entity (
  legal_entity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_no text NOT NULL DEFAULT identity.allocate_member_no() UNIQUE,
  registered_name text NOT NULL,
  registration_no text NOT NULL UNIQUE,
  registered_address text,
  membership_state identity."PersonMembershipState",
  status identity."LegalEntityStatus" NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX legal_entity_status_idx ON identity.legal_entity(status);

ALTER TABLE identity.formal_member_application
  ADD COLUMN applicant_type identity."FormalApplicantType" NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN legal_entity_id uuid,
  ADD COLUMN legal_entity_registration_no text,
  ADD COLUMN applicant_identity_fingerprint text,
  ADD COLUMN spouse_identity_fingerprint text,
  ADD COLUMN spouse_verification_status identity."SpouseVerificationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN cross_line_review_status text NOT NULL DEFAULT 'NOT_EVALUATED',
  ADD COLUMN cross_line_conflict_code text,
  ADD CONSTRAINT formal_member_application_legal_entity_fk FOREIGN KEY (legal_entity_id) REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT;

CREATE INDEX formal_member_application_applicant_type_status_idx
  ON identity.formal_member_application(applicant_type,status);
CREATE INDEX formal_member_application_legal_entity_registration_idx
  ON identity.formal_member_application(legal_entity_registration_no);
CREATE INDEX formal_member_application_spouse_fingerprint_idx
  ON identity.formal_member_application(spouse_identity_fingerprint);
CREATE INDEX formal_member_application_applicant_fingerprint_idx
  ON identity.formal_member_application(applicant_identity_fingerprint);

CREATE TABLE identity.legal_entity_representative (
  legal_entity_representative_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id uuid NOT NULL REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  role_code text NOT NULL DEFAULT 'PRIMARY_OPERATING_REPRESENTATIVE',
  effective_from timestamptz(6) NOT NULL DEFAULT now(),
  effective_to timestamptz(6),
  verified_at timestamptz(6),
  verified_by uuid,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT legal_entity_representative_window_check CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX legal_entity_representative_entity_window_idx
  ON identity.legal_entity_representative(legal_entity_id,effective_from,effective_to);
CREATE INDEX legal_entity_representative_person_window_idx
  ON identity.legal_entity_representative(person_id,effective_from,effective_to);
CREATE UNIQUE INDEX legal_entity_one_current_primary_rep_uq
  ON identity.legal_entity_representative(legal_entity_id)
  WHERE effective_to IS NULL AND role_code='PRIMARY_OPERATING_REPRESENTATIVE';

CREATE TABLE identity.spouse_relationship (
  spouse_relationship_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  spouse_identity_fingerprint text NOT NULL,
  spouse_name_masked text NOT NULL,
  verification_status identity."SpouseVerificationStatus" NOT NULL DEFAULT 'PENDING',
  effective_from timestamptz(6) NOT NULL DEFAULT now(),
  effective_to timestamptz(6),
  verified_at timestamptz(6),
  verified_by uuid,
  source_formal_application_id uuid REFERENCES identity.formal_member_application(formal_member_application_id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT spouse_relationship_window_check CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT spouse_identity_fingerprint_check CHECK (spouse_identity_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX spouse_relationship_person_window_idx
  ON identity.spouse_relationship(person_id,effective_from,effective_to);
CREATE INDEX spouse_relationship_fingerprint_status_idx
  ON identity.spouse_relationship(spouse_identity_fingerprint,verification_status);
CREATE UNIQUE INDEX spouse_relationship_one_current_verified_uq
  ON identity.spouse_relationship(person_id)
  WHERE effective_to IS NULL AND verification_status='VERIFIED';

CREATE TABLE identity.formal_identity_index (
  formal_identity_index_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  national_id_fingerprint text NOT NULL UNIQUE,
  verified_at timestamptz(6) NOT NULL,
  verified_by uuid,
  source_formal_application_id uuid NOT NULL REFERENCES identity.formal_member_application(formal_member_application_id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT formal_identity_fingerprint_check CHECK (national_id_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX formal_identity_index_fingerprint_idx
  ON identity.formal_identity_index(national_id_fingerprint);

CREATE OR REPLACE FUNCTION identity.prevent_legal_entity_member_no_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.member_no IS DISTINCT FROM OLD.member_no THEN RAISE EXCEPTION 'MEMBER_NO_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER legal_entity_member_no_immutable
BEFORE UPDATE ON identity.legal_entity
FOR EACH ROW EXECUTE FUNCTION identity.prevent_legal_entity_member_no_mutation();

CREATE OR REPLACE FUNCTION identity.prevent_cross_party_member_no_collision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='person' THEN
    IF EXISTS(SELECT 1 FROM identity.legal_entity le WHERE le.member_no=NEW.member_no) THEN
      RAISE EXCEPTION 'MEMBER_NO_CROSS_PARTY_COLLISION';
    END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM identity.person p WHERE p.member_no=NEW.member_no) THEN
      RAISE EXCEPTION 'MEMBER_NO_CROSS_PARTY_COLLISION';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER person_member_no_cross_party_guard
BEFORE INSERT ON identity.person
FOR EACH ROW EXECUTE FUNCTION identity.prevent_cross_party_member_no_collision();
CREATE TRIGGER legal_entity_member_no_cross_party_guard
BEFORE INSERT ON identity.legal_entity
FOR EACH ROW EXECUTE FUNCTION identity.prevent_cross_party_member_no_collision();
