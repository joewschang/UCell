ALTER TABLE identity.person ADD COLUMN email_verified_at timestamptz;
CREATE TABLE identity.contact_verification_challenge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_hash text NOT NULL, destination_hash text NOT NULL,
 channel text NOT NULL CHECK (channel IN ('SMS','EMAIL')), purpose text NOT NULL CHECK (purpose IN ('REGISTRATION','PROFILE')),
 request_key uuid NOT NULL, code_hash text NOT NULL, status text NOT NULL DEFAULT 'SENDING', attempts integer NOT NULL DEFAULT 0,
 proof_hash text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, resend_at timestamptz NOT NULL,
 verified_at timestamptz, consumed_at timestamptz, UNIQUE(subject_hash,request_key)
);
CREATE INDEX contact_verification_destination_created ON identity.contact_verification_challenge(destination_hash,created_at);
CREATE INDEX contact_verification_subject_created ON identity.contact_verification_challenge(subject_hash,created_at);
