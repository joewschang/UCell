CREATE TABLE identity.paper_person_identity_fingerprint (
  paper_person_identity_fingerprint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  document_country varchar(8) NOT NULL,
  document_type varchar(64) NOT NULL,
  fingerprint_algorithm varchar(64) NOT NULL,
  fingerprint_version varchar(32) NOT NULL,
  fingerprint char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paper_identity_country_normalized CHECK (document_country = upper(btrim(document_country)) AND length(document_country) BETWEEN 2 AND 8),
  CONSTRAINT paper_identity_type_normalized CHECK (document_type = upper(btrim(document_type)) AND length(document_type) BETWEEN 1 AND 64),
  CONSTRAINT paper_identity_fingerprint_hex CHECK (fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX paper_person_identity_fingerprint_unique ON identity.paper_person_identity_fingerprint(fingerprint_algorithm, fingerprint_version, fingerprint);
CREATE INDEX paper_person_identity_fingerprint_person_idx ON identity.paper_person_identity_fingerprint(person_id);

CREATE TABLE commerce.paper_identity_duplicate_review (
  paper_identity_duplicate_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_application_no varchar(80) NOT NULL UNIQUE,
  fingerprint_algorithm varchar(64) NOT NULL,
  fingerprint_version varchar(32) NOT NULL,
  fingerprint char(64) NOT NULL,
  status varchar(64) NOT NULL DEFAULT 'DUPLICATE_REVIEW_REQUIRED',
  reason_code varchar(128) NOT NULL,
  evidence_document_ref varchar(500),
  requested_by uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  resolved_by uuid REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  resolution_reason_code varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paper_identity_review_no_normalized CHECK (paper_application_no = btrim(paper_application_no) AND length(paper_application_no) BETWEEN 1 AND 80),
  CONSTRAINT paper_identity_review_fingerprint_hex CHECK (fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX paper_identity_duplicate_review_status_created_idx ON commerce.paper_identity_duplicate_review(status, created_at);
