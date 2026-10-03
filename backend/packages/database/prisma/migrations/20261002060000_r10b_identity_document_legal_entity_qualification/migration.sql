CREATE TYPE identity."IdentityDocumentType" AS ENUM ('NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER');

ALTER TABLE identity.person
  ADD COLUMN nationality_code text,
  ADD COLUMN identity_document_type identity."IdentityDocumentType",
  ADD COLUMN identity_document_number_ciphertext text,
  ADD COLUMN identity_document_key_version text,
  ADD COLUMN identity_document_fingerprint text;

CREATE UNIQUE INDEX person_identity_document_fingerprint_uq
  ON identity.person(identity_document_fingerprint)
  WHERE identity_document_fingerprint IS NOT NULL;

ALTER TABLE identity.legal_entity
  ADD COLUMN registration_country_code text;

ALTER TABLE identity.formal_member_application
  ADD COLUMN applicant_nationality_code text,
  ADD COLUMN applicant_identity_document_type identity."IdentityDocumentType";

ALTER TABLE membership.qualification
  ADD COLUMN current_holder_legal_entity_id uuid,
  ADD CONSTRAINT qualification_current_holder_legal_entity_fk
    FOREIGN KEY (current_holder_legal_entity_id) REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT,
  ADD CONSTRAINT qualification_single_current_owner_check CHECK (
    num_nonnulls(current_holder_person_id,current_holder_legal_entity_id,current_company_principal_id) <= 1
  );
CREATE INDEX qualification_current_holder_legal_entity_idx
  ON membership.qualification(current_holder_legal_entity_id);

ALTER TABLE membership.qualification_holder_history
  ALTER COLUMN holder_person_id DROP NOT NULL,
  ADD COLUMN holder_legal_entity_id uuid,
  ADD CONSTRAINT qualification_holder_history_legal_entity_fk
    FOREIGN KEY (holder_legal_entity_id) REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT,
  ADD CONSTRAINT qualification_holder_history_exact_owner_check CHECK (
    num_nonnulls(holder_person_id,holder_legal_entity_id)=1
  );
CREATE INDEX qualification_holder_history_legal_entity_idx
  ON membership.qualification_holder_history(holder_legal_entity_id,effective_from);

ALTER TABLE membership.qualification_owner_interval
  ADD COLUMN legal_entity_id uuid,
  ADD CONSTRAINT qualification_owner_interval_legal_entity_fk
    FOREIGN KEY (legal_entity_id) REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT;

ALTER TABLE membership.qualification_owner_interval
  DROP CONSTRAINT IF EXISTS qualification_owner_interval_owner_check;
ALTER TABLE membership.qualification_owner_interval
  ADD CONSTRAINT qualification_owner_interval_owner_check CHECK (
    (owner_type='MEMBER' AND person_id IS NOT NULL AND legal_entity_id IS NULL AND company_principal_id IS NULL)
    OR
    (owner_type='LEGAL_ENTITY' AND person_id IS NULL AND legal_entity_id IS NOT NULL AND company_principal_id IS NULL)
    OR
    (owner_type='COMPANY' AND person_id IS NULL AND legal_entity_id IS NULL AND company_principal_id IS NOT NULL)
  );
CREATE INDEX qualification_owner_interval_legal_entity_idx
  ON membership.qualification_owner_interval(legal_entity_id,effective_from,effective_to);

ALTER TABLE membership.membership_application
  ALTER COLUMN person_id DROP NOT NULL,
  ADD COLUMN legal_entity_id uuid,
  ADD CONSTRAINT membership_application_legal_entity_fk
    FOREIGN KEY (legal_entity_id) REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT,
  ADD CONSTRAINT membership_application_exact_applicant_check CHECK (
    num_nonnulls(person_id,legal_entity_id)=1
  );
CREATE INDEX membership_application_legal_entity_status_idx
  ON membership.membership_application(legal_entity_id,status);

ALTER TABLE identity.person
  ADD CONSTRAINT person_nationality_code_check CHECK (
    nationality_code IS NULL OR nationality_code ~ '^[A-Z]{2}$'
  ),
  ADD CONSTRAINT person_identity_document_fields_check CHECK (
    (identity_document_type IS NULL AND identity_document_number_ciphertext IS NULL AND identity_document_key_version IS NULL AND identity_document_fingerprint IS NULL)
    OR
    (identity_document_type IS NOT NULL AND nationality_code IS NOT NULL AND identity_document_number_ciphertext IS NOT NULL AND identity_document_key_version IS NOT NULL AND identity_document_fingerprint IS NOT NULL)
  );

ALTER TABLE identity.legal_entity
  ADD CONSTRAINT legal_entity_registration_country_check CHECK (
    registration_country_code IS NULL OR registration_country_code ~ '^[A-Z]{2}$'
  );
