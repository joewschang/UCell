ALTER TABLE commerce.product_review ADD COLUMN featured boolean NOT NULL DEFAULT false;
CREATE INDEX product_review_featured_idx ON commerce.product_review(product_id,featured) WHERE status='APPROVED';
CREATE TABLE commerce.product_content (
 product_id uuid PRIMARY KEY REFERENCES commerce.product_reference(product_id),
 draft jsonb NOT NULL DEFAULT '{"blocks":[]}',
 published jsonb,
 version integer NOT NULL DEFAULT 1,
 published_version integer,
 published_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL
);
CREATE TABLE commerce.product_content_media (
 media_id uuid PRIMARY KEY,
 product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
 actor_id uuid NOT NULL,
 mime_type text NOT NULL,
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 20971520),
 sha256 char(64) NOT NULL,
 object_key text NOT NULL UNIQUE CHECK(object_key LIKE 'product-content/%'),
 status text NOT NULL DEFAULT 'UPLOADING' CHECK(status IN ('UPLOADING','READY')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product_id,actor_id,sha256)
);
CREATE TABLE commerce.product_content_chunk (
 media_id uuid NOT NULL REFERENCES commerce.product_content_media(media_id) ON DELETE CASCADE,
 part integer NOT NULL CHECK(part BETWEEN 0 AND 79),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 262144),
 sha256 char(64) NOT NULL,
 PRIMARY KEY(media_id,part)
);
