CREATE TABLE identity.formal_payout_method (
  application_id uuid PRIMARY KEY REFERENCES identity.formal_member_application(formal_member_application_id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('BANK_TRANSFER','COMPANY_CASH')),
  version integer NOT NULL CHECK (version > 0),
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE membership.holder_payout_method (
  owner_type text NOT NULL CHECK (owner_type IN ('PERSON','LEGAL_ENTITY')),
  owner_id uuid NOT NULL,
  application_id uuid NOT NULL REFERENCES identity.formal_member_application(formal_member_application_id),
  method text NOT NULL CHECK (method IN ('BANK_TRANSFER','COMPANY_CASH')),
  PRIMARY KEY (owner_type, owner_id)
);
