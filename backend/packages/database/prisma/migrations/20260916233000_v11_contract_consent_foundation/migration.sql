ALTER TYPE identity."IdentityProvider" ADD VALUE IF NOT EXISTS 'GOOGLE';

CREATE TYPE identity."ContractAudience" AS ENUM ('NETWORK_MEMBER','FORMAL_MEMBER','ALL_MEMBERS');
CREATE TYPE identity."ConsentChannel" AS ENUM ('MEMBER_WEB','LIFF','ADMIN_ASSISTED');

CREATE TABLE identity.contract_document_version (
 contract_document_version_id uuid PRIMARY KEY,
 contract_type text NOT NULL,
 version_code text NOT NULL,
 title text NOT NULL,
 content_text text NOT NULL,
 content_hash text NOT NULL,
 audience identity."ContractAudience" NOT NULL,
 required boolean NOT NULL DEFAULT true,
 effective_from timestamptz(6) NOT NULL,
 effective_to timestamptz(6),
 approval_reference text NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT contract_document_version_window_check CHECK (effective_to IS NULL OR effective_to > effective_from),
 CONSTRAINT contract_document_version_hash_check CHECK (content_hash ~ '^[0-9a-f]{64}$'),
 CONSTRAINT contract_document_version_approval_check CHECK (length(trim(approval_reference)) > 0),
 UNIQUE(contract_type,version_code)
);
CREATE INDEX contract_document_version_audience_effective_idx ON identity.contract_document_version(audience,effective_from,effective_to);

CREATE TABLE identity.consent_evidence (
 consent_evidence_id uuid PRIMARY KEY,
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 contract_document_version_id uuid NOT NULL REFERENCES identity.contract_document_version(contract_document_version_id),
 content_hash_snapshot text NOT NULL,
 channel identity."ConsentChannel" NOT NULL,
 accepted_at timestamptz(6) NOT NULL DEFAULT now(),
 request_id text NOT NULL,
 correlation_id uuid NOT NULL,
 evidence_hash text NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT consent_evidence_content_hash_check CHECK (content_hash_snapshot ~ '^[0-9a-f]{64}$'),
 CONSTRAINT consent_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
 UNIQUE(person_id,contract_document_version_id)
);
CREATE INDEX consent_evidence_contract_accepted_idx ON identity.consent_evidence(contract_document_version_id,accepted_at);
CREATE INDEX consent_evidence_correlation_idx ON identity.consent_evidence(correlation_id);

CREATE FUNCTION identity.reject_consent_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'consent evidence is append-only';
END $$;
CREATE TRIGGER consent_evidence_immutable BEFORE UPDATE OR DELETE ON identity.consent_evidence
FOR EACH ROW EXECUTE FUNCTION identity.reject_consent_evidence_mutation();
