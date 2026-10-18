ALTER TABLE identity.contact_verification_challenge DROP CONSTRAINT contact_verification_challenge_purpose_check;
ALTER TABLE identity.contact_verification_challenge ADD CONSTRAINT contact_verification_challenge_purpose_check CHECK (purpose IN ('REGISTRATION','PROFILE','LOGIN'));

CREATE TABLE integration.sms_campaign (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_key uuid NOT NULL UNIQUE,
 actor_id text NOT NULL, message text NOT NULL, recipients jsonb NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT', content_hash text NOT NULL,
 provider_ref text, failure_code text, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, submitted_at timestamptz,
 CHECK (status IN ('DRAFT','SENDING','SUBMITTED','UNKNOWN','CANCELLED'))
);
CREATE INDEX sms_campaign_created ON integration.sms_campaign(created_at DESC);
