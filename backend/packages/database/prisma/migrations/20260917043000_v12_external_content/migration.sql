CREATE TABLE integration.content (
 content_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_type text NOT NULL CHECK(content_type IN ('VIDEO_EXTERNAL','EXTERNAL_LINK')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')), created_by_actor text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX content_status_created_idx ON integration.content(status,created_at);
CREATE TABLE integration.content_version (
 content_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid NOT NULL REFERENCES integration.content(content_id), version integer NOT NULL CHECK(version>0),
 title text NOT NULL, summary text, external_url text NOT NULL, thumbnail_url text, audience_policy text NOT NULL CHECK(audience_policy='NETWORK_MEMBER'), shareable boolean NOT NULL DEFAULT true,
 publish_from timestamptz(6), publish_to timestamptz(6), approval_reference text, approved_by_actor text, approved_at timestamptz(6), content_hash text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')), created_at timestamptz(6) NOT NULL DEFAULT now(), UNIQUE(content_id,version),
 CHECK(publish_to IS NULL OR (publish_from IS NOT NULL AND publish_to>publish_from)), CHECK((status='PUBLISHED')=(approved_at IS NOT NULL AND approval_reference IS NOT NULL))
);
CREATE INDEX content_version_publish_idx ON integration.content_version(status,publish_from,publish_to);
CREATE OR REPLACE FUNCTION integration.protect_published_content_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'published content version is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER content_version_published_immutable BEFORE UPDATE OR DELETE ON integration.content_version FOR EACH ROW EXECUTE FUNCTION integration.protect_published_content_version();
