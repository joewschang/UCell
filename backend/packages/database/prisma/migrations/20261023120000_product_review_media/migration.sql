CREATE TABLE commerce.product_review (
 review_id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
 rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK (length(comment)<=1000),
 media_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(media_ids)<=6),
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','HIDDEN')),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 moderation_reason text NOT NULL DEFAULT '',
 moderated_by uuid,
 moderated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,person_id,product_id)
);
CREATE INDEX product_review_public_idx ON commerce.product_review(product_id,status,created_at DESC);
CREATE INDEX product_review_queue_idx ON commerce.product_review(status,updated_at DESC);
CREATE TABLE commerce.product_review_media (
 media_id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 product_id uuid NOT NULL REFERENCES commerce.product_reference(product_id),
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/mp4')),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 20971520),
 sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE CHECK (object_key LIKE 'product-reviews/%'),
 status text NOT NULL DEFAULT 'UPLOADING' CHECK (status IN ('UPLOADING','READY')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,person_id,product_id,sha256)
);
CREATE INDEX product_review_media_owner_idx ON commerce.product_review_media(person_id,created_at);
CREATE TABLE commerce.product_review_media_chunk (
 media_id uuid NOT NULL REFERENCES commerce.product_review_media(media_id) ON DELETE CASCADE,
 part integer NOT NULL CHECK (part BETWEEN 0 AND 79),
 content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 262144),
 sha256 char(64) NOT NULL,
 PRIMARY KEY(media_id,part)
);
