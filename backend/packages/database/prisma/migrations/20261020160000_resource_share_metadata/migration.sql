CREATE TABLE integration.resource_share_link (
 referral_link_id uuid PRIMARY KEY REFERENCES identity.referral_link(referral_link_id),
 target_type text NOT NULL CHECK (target_type IN ('PRODUCT','EVENT')),
 target_reference text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((target_type='PRODUCT' AND target_reference ~ '^TIP-[0-9]{3}$') OR (target_type='EVENT' AND target_reference ~ '^[A-Z][A-Z0-9_-]{2,39}$'))
);
CREATE INDEX resource_share_target_idx ON integration.resource_share_link(target_type,target_reference,created_at);
