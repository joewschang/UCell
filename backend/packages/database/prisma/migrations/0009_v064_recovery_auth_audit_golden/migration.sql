-- UCell R1.0B FROZEN / Backend v0.6.4
ALTER TABLE ledger.bonus_recovery_event ADD COLUMN IF NOT EXISTS outstanding_amount numeric(18,4);
UPDATE ledger.bonus_recovery_event SET outstanding_amount = GREATEST(recovery_amount - recovered_amount, 0) WHERE outstanding_amount IS NULL;
ALTER TABLE ledger.bonus_recovery_event ALTER COLUMN outstanding_amount SET DEFAULT 0, ALTER COLUMN outstanding_amount SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_recovery_balance') THEN
    ALTER TABLE ledger.bonus_recovery_event ADD CONSTRAINT ck_recovery_balance
    CHECK (recovery_amount >= 0 AND recovered_amount >= 0 AND outstanding_amount >= 0 AND recovered_amount + outstanding_amount = recovery_amount);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='IdentityProvider') THEN
    CREATE TYPE identity."IdentityProvider" AS ENUM ('ADMIN_LOCAL','ENTRA','LINE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='AuthSessionStatus') THEN
    CREATE TYPE identity."AuthSessionStatus" AS ENUM ('ACTIVE','REVOKED','EXPIRED');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS identity.identity_link (
  identity_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES identity.person(person_id),
  provider identity."IdentityProvider" NOT NULL, provider_subject text NOT NULL, email text, display_name text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_identity_provider_subject UNIQUE(provider,provider_subject)
);
CREATE INDEX IF NOT EXISTS ix_identity_link_person_provider ON identity.identity_link(person_id,provider);
CREATE TABLE IF NOT EXISTS identity.auth_session (
  auth_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid REFERENCES identity.person(person_id),
  provider identity."IdentityProvider" NOT NULL, subject text NOT NULL, role_code text, token_hash text NOT NULL UNIQUE,
  status identity."AuthSessionStatus" NOT NULL DEFAULT 'ACTIVE', issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_auth_session_person_status_expiry ON identity.auth_session(person_id,status,expires_at);
CREATE TABLE IF NOT EXISTS audit.golden_case_run (
  golden_case_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_code text NOT NULL, rule_version_code text NOT NULL,
  input_snapshot jsonb NOT NULL, expected_snapshot jsonb NOT NULL, actual_snapshot jsonb, passed boolean,
  executed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_golden_case_code_version ON audit.golden_case_run(case_code,rule_version_code);
CREATE TRIGGER trg_identity_link_updated_at BEFORE UPDATE ON identity.identity_link FOR EACH ROW EXECUTE FUNCTION public.ucell_set_updated_at();
CREATE TRIGGER trg_identity_link_no_delete BEFORE DELETE ON identity.identity_link FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();
CREATE TRIGGER trg_auth_session_no_delete BEFORE DELETE ON identity.auth_session FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();
CREATE TRIGGER trg_golden_case_no_delete BEFORE DELETE ON audit.golden_case_run FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();
COMMENT ON COLUMN ledger.bonus_recovery_event.outstanding_amount IS 'Remaining clawback balance across future payout batches.';
