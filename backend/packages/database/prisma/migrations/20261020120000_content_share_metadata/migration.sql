-- Additive metadata only: no Sponsor, attribution or compensation rule changes.
CREATE TABLE integration.content_share_link (
 referral_link_id uuid PRIMARY KEY REFERENCES identity.referral_link(referral_link_id),
 content_id uuid NOT NULL REFERENCES integration.content(content_id),
 content_version_id uuid NOT NULL REFERENCES integration.content_version(content_version_id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_share_link_content_idx ON integration.content_share_link(content_id, created_at);
