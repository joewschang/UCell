CREATE TYPE identity."OtpPurpose" AS ENUM ('NETWORK_REGISTRATION','MOBILE_CHANGE','ACCOUNT_RECOVERY');
CREATE TYPE identity."OtpChallengeStatus" AS ENUM ('PENDING','VERIFIED','EXPIRED','LOCKED');

CREATE TABLE identity.otp_challenge (
 otp_challenge_id uuid PRIMARY KEY,
 person_id uuid REFERENCES identity.person(person_id),
 registration_session_id uuid,
 purpose identity."OtpPurpose" NOT NULL,
 destination_fingerprint text NOT NULL,
 code_hash text NOT NULL,
 provider_ref text NOT NULL,
 status identity."OtpChallengeStatus" NOT NULL DEFAULT 'PENDING',
 attempt_count integer NOT NULL DEFAULT 0,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 expires_at timestamptz(6) NOT NULL,
 resend_available_at timestamptz(6) NOT NULL,
 verified_at timestamptz(6),
 locked_at timestamptz(6),
 correlation_id uuid NOT NULL,
 CONSTRAINT otp_challenge_subject_check CHECK ((person_id IS NOT NULL)::int + (registration_session_id IS NOT NULL)::int = 1),
 CONSTRAINT otp_challenge_attempt_check CHECK (attempt_count BETWEEN 0 AND 5),
 CONSTRAINT otp_challenge_window_check CHECK (expires_at > created_at AND resend_available_at > created_at),
 CONSTRAINT otp_challenge_hash_check CHECK (code_hash ~ '^[0-9a-f]{64}$' AND destination_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX otp_challenge_destination_created_idx ON identity.otp_challenge(destination_fingerprint,created_at);
CREATE INDEX otp_challenge_registration_purpose_status_idx ON identity.otp_challenge(registration_session_id,purpose,status);
CREATE INDEX otp_challenge_person_purpose_status_idx ON identity.otp_challenge(person_id,purpose,status);
