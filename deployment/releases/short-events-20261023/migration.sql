CREATE TABLE integration.referral_short_link (
 short_code varchar(24) PRIMARY KEY CHECK(short_code ~ '^s_[A-Za-z0-9_-]{22}$'),
 referral_link_id uuid NOT NULL UNIQUE REFERENCES identity.referral_link(referral_link_id),
 encrypted_token text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE learning.member_event_version ADD COLUMN presentation jsonb NOT NULL DEFAULT '{"images":[],"videos":[]}';
CREATE TABLE learning.event_image (
 image_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 12 AND 524288),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
