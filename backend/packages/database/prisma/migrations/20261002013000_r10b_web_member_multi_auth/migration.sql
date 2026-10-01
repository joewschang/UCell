ALTER TYPE identity."IdentityProvider" ADD VALUE IF NOT EXISTS 'MEMBER_LOCAL';

CREATE TABLE identity.member_password_credential (
 person_id uuid PRIMARY KEY REFERENCES identity.person(person_id) ON DELETE RESTRICT,
 password_hash text NOT NULL,
 password_changed_at timestamptz(6) NOT NULL DEFAULT now(),
 failed_attempt_count integer NOT NULL DEFAULT 0,
 locked_until timestamptz(6),
 credential_version integer NOT NULL DEFAULT 1,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 updated_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT member_password_failed_attempt_check CHECK (failed_attempt_count BETWEEN 0 AND 100),
 CONSTRAINT member_password_version_check CHECK (credential_version > 0),
 CONSTRAINT member_password_hash_nonempty CHECK (length(password_hash) >= 32)
);

CREATE TABLE identity.password_reset_token (
 password_reset_token_id uuid PRIMARY KEY,
 person_id uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz(6) NOT NULL,
 consumed_at timestamptz(6),
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT password_reset_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 CONSTRAINT password_reset_token_window_check CHECK (expires_at > created_at),
 CONSTRAINT password_reset_token_consumed_check CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);
CREATE INDEX password_reset_token_person_expires_idx ON identity.password_reset_token(person_id,expires_at);
