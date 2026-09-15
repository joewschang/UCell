-- UCell R1.0B REVIEW R6
-- Explicit, historical administrator access grants for production identity providers.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='identity' AND t.typname='AdminAccessStatus'
  ) THEN
    CREATE TYPE identity."AdminAccessStatus" AS ENUM ('ACTIVE','SUSPENDED','REVOKED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS identity.admin_access_grant (
  admin_access_grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(person_id),
  provider identity."IdentityProvider" NOT NULL,
  provider_subject text NOT NULL,
  role_code text NOT NULL,
  status identity."AdminAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_admin_access_valid_window CHECK(valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT ck_admin_access_role CHECK(
    role_code IN (
      'SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS',
      'FINANCE','COMPLIANCE_AUDIT','CUSTOMER_SERVICE'
    )
  )
);

CREATE INDEX IF NOT EXISTS ix_admin_access_person_status
ON identity.admin_access_grant(person_id,status,valid_from,valid_to);

CREATE INDEX IF NOT EXISTS ix_admin_access_provider_subject_status
ON identity.admin_access_grant(provider,provider_subject,status);

CREATE INDEX IF NOT EXISTS ix_admin_access_role_status
ON identity.admin_access_grant(role_code,status);

-- At most one currently ACTIVE grant per identity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_access_one_active_identity
ON identity.admin_access_grant(provider,provider_subject)
WHERE status='ACTIVE';

CREATE TRIGGER trg_admin_access_grant_no_delete
BEFORE DELETE ON identity.admin_access_grant
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE OR REPLACE FUNCTION identity.ucell_guard_admin_access_grant_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.person_id IS DISTINCT FROM OLD.person_id
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.provider_subject IS DISTINCT FROM OLD.provider_subject
     OR NEW.role_code IS DISTINCT FROM OLD.role_code
     OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Admin access grant identity/role fields are immutable; revoke and create a new grant'
      USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_admin_access_grant_update_guard
BEFORE UPDATE ON identity.admin_access_grant
FOR EACH ROW EXECUTE FUNCTION identity.ucell_guard_admin_access_grant_update();

COMMENT ON TABLE identity.admin_access_grant IS
'Historical administrator allow-list. Role changes revoke the old grant and create a new grant; old grants are never deleted or overwritten.';
