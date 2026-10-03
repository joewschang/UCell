CREATE TYPE identity."FormalApplicationSourceChannel" AS ENUM ('MEMBER_WEB','ADMIN_PAPER');
CREATE TYPE identity."FormalDocumentType" AS ENUM (
  'IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','SIGNED_APPLICATION_AGREEMENT','CORPORATE_REGISTRATION',
  'REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK','CORPORATE_BANK_PROOF',
  'TAX_REGISTRATION','OTHER'
);
CREATE TYPE identity."FormalDocumentStatus" AS ENUM ('PENDING_UPLOAD','PRESENT','REJECTED','SUPERSEDED');
CREATE TYPE identity."MalwareScanStatus" AS ENUM ('PENDING','CLEAN','INFECTED','FAILED');
CREATE TYPE identity."PaperEvidenceStatus" AS ENUM ('PENDING','REVIEWED','REJECTED','NOT_APPLICABLE');

ALTER TABLE identity.formal_member_application
  ADD COLUMN source_channel identity."FormalApplicationSourceChannel" NOT NULL DEFAULT 'MEMBER_WEB',
  ADD COLUMN paper_application_reference text,
  ADD COLUMN entered_by uuid,
  ADD COLUMN entered_at timestamptz(6),
  ADD CONSTRAINT formal_application_source_rule CHECK (
    (applicant_type='LEGAL_ENTITY' AND source_channel='ADMIN_PAPER')
    OR applicant_type='INDIVIDUAL'
  ),
  ADD CONSTRAINT formal_application_paper_reference_rule CHECK (
    source_channel<>'ADMIN_PAPER' OR paper_application_reference IS NOT NULL
  );

CREATE INDEX formal_member_application_type_channel_status_idx
  ON identity.formal_member_application(applicant_type,source_channel,status);

CREATE TABLE identity.formal_application_document (
  formal_application_document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formal_member_application_id uuid NOT NULL REFERENCES identity.formal_member_application(formal_member_application_id) ON DELETE RESTRICT,
  document_type identity."FormalDocumentType" NOT NULL,
  status identity."FormalDocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  storage_object_key text,
  content_sha256 text,
  mime_type text,
  size_bytes integer,
  malware_scan_status identity."MalwareScanStatus" NOT NULL DEFAULT 'PENDING',
  uploaded_by_person_id uuid,
  uploaded_at timestamptz(6),
  reviewed_by uuid,
  reviewed_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT formal_document_sha256_check CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT formal_document_size_check CHECK (size_bytes IS NULL OR size_bytes > 0),
  CONSTRAINT formal_document_present_metadata_check CHECK (
    status<>'PRESENT' OR (storage_object_key IS NOT NULL AND content_sha256 IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL AND uploaded_at IS NOT NULL)
  )
);
CREATE INDEX formal_application_document_app_type_idx
  ON identity.formal_application_document(formal_member_application_id,document_type);
CREATE INDEX formal_application_document_scan_status_idx
  ON identity.formal_application_document(malware_scan_status,status);
CREATE UNIQUE INDEX formal_application_one_current_document_uq
  ON identity.formal_application_document(formal_member_application_id,document_type)
  WHERE status IN ('PENDING_UPLOAD','PRESENT');

CREATE TABLE identity.formal_paper_evidence (
  formal_paper_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formal_member_application_id uuid NOT NULL REFERENCES identity.formal_member_application(formal_member_application_id) ON DELETE RESTRICT,
  evidence_type identity."FormalDocumentType" NOT NULL,
  status identity."PaperEvidenceStatus" NOT NULL DEFAULT 'PENDING',
  source_reference text,
  reviewed_by uuid,
  reviewed_at timestamptz(6),
  note text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT formal_paper_review_evidence_check CHECK (
    status NOT IN ('REVIEWED','REJECTED') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX formal_paper_evidence_type_uq
  ON identity.formal_paper_evidence(formal_member_application_id,evidence_type);
CREATE INDEX formal_paper_evidence_app_status_idx
  ON identity.formal_paper_evidence(formal_member_application_id,status);

CREATE OR REPLACE FUNCTION identity.prevent_formal_document_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FORMAL_KYC_DOCUMENT_APPEND_ONLY'; END IF;
  IF OLD.status='SUPERSEDED' OR OLD.status='REJECTED' THEN
    RAISE EXCEPTION 'FORMAL_KYC_DOCUMENT_FINALIZED';
  END IF;
  IF NEW.formal_member_application_id IS DISTINCT FROM OLD.formal_member_application_id
     OR NEW.document_type IS DISTINCT FROM OLD.document_type
     OR (OLD.storage_object_key IS NOT NULL AND NEW.storage_object_key IS DISTINCT FROM OLD.storage_object_key)
     OR (OLD.content_sha256 IS NOT NULL AND NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256) THEN
    RAISE EXCEPTION 'FORMAL_KYC_DOCUMENT_IDENTITY_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER formal_application_document_guard
BEFORE UPDATE OR DELETE ON identity.formal_application_document
FOR EACH ROW EXECUTE FUNCTION identity.prevent_formal_document_mutation();
