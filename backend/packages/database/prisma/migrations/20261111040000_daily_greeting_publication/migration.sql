CREATE TABLE learning.daily_greeting_publication (
 id uuid PRIMARY KEY,
 greeting_date text NOT NULL CHECK (greeting_date ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'),
 title text NOT NULL, message text NOT NULL,
 image bytea NOT NULL CHECK (octet_length(image) <= 3000000),
 image_hash text NOT NULL, status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 approved_by text, approved_at timestamptz, approval_reference text,
 publish_at timestamptz NOT NULL,
 CHECK (status <> 'PUBLISHED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approval_reference IS NOT NULL))
);
CREATE UNIQUE INDEX daily_greeting_active_date ON learning.daily_greeting_publication(greeting_date) WHERE status = 'PUBLISHED';
CREATE INDEX daily_greeting_release ON learning.daily_greeting_publication(status,publish_at);
