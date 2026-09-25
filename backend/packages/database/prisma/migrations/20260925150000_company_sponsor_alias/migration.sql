CREATE TABLE organization.company_sponsor_alias (
  company_sponsor_alias_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_normalized text NOT NULL,
  display_label text NOT NULL,
  target_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  policy_version text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz NULL,
  evidence_hash text NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_sponsor_alias_effective_range CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT company_sponsor_alias_normalized_format CHECK (alias_normalized ~ '^[A-Z][A-Z0-9_-]{1,39}$')
);
CREATE UNIQUE INDEX company_sponsor_alias_normalized_effective_from_uq ON organization.company_sponsor_alias(alias_normalized,effective_from);
CREATE INDEX company_sponsor_alias_lookup_idx ON organization.company_sponsor_alias(alias_normalized,effective_from,effective_to);
