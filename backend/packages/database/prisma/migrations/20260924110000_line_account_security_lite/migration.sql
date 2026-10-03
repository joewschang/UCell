CREATE TYPE identity."PersonSecurityStatus" AS ENUM ('NORMAL', 'SECURITY_LOCKED');
CREATE TYPE identity."IdentityLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE identity."AccountRecoveryType" AS ENUM ('LINE_REBIND', 'BANK_ACCOUNT_CHANGE');
CREATE TYPE identity."AccountRecoveryStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

ALTER TABLE identity.person
  ADD COLUMN security_status identity."PersonSecurityStatus" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN security_locked_at TIMESTAMPTZ(6),
  ADD COLUMN security_locked_reason TEXT;

ALTER TABLE identity.identity_link
  ADD COLUMN status identity."IdentityLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN revoked_at TIMESTAMPTZ(6),
  ADD COLUMN revoke_reason TEXT,
  ADD COLUMN replaced_by_binding_id UUID;

ALTER TABLE identity.identity_link
  ADD CONSTRAINT identity_link_replaced_by_binding_fk
  FOREIGN KEY (replaced_by_binding_id) REFERENCES identity.identity_link(identity_link_id);

CREATE INDEX identity_link_person_provider_status_idx
  ON identity.identity_link (person_id, provider, status);

CREATE TABLE identity.account_recovery_request (
  account_recovery_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES identity.person(person_id),
  type identity."AccountRecoveryType" NOT NULL,
  status identity."AccountRecoveryStatus" NOT NULL DEFAULT 'PENDING',
  requester_actor_id UUID,
  approver_actor_id UUID,
  verification_evidence JSONB,
  requested_provider_subject TEXT,
  completion_token_hash TEXT UNIQUE,
  completion_token_expires_at TIMESTAMPTZ(6),
  completion_token_used_at TIMESTAMPTZ(6),
  approved_at TIMESTAMPTZ(6),
  completed_at TIMESTAMPTZ(6),
  rejected_at TIMESTAMPTZ(6),
  reason_code TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT account_recovery_approval_separation CHECK (
    approver_actor_id IS NULL OR requester_actor_id IS NULL OR approver_actor_id <> requester_actor_id
  ),
  CONSTRAINT account_recovery_completion_token_shape CHECK (
    completion_token_hash IS NULL OR completion_token_expires_at IS NOT NULL
  )
);
CREATE INDEX account_recovery_request_person_type_status_created_idx
  ON identity.account_recovery_request (person_id, type, status, created_at DESC);
