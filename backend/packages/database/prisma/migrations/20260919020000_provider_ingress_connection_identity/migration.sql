-- Provider webhook and reconciliation rows carry a denormalized provider identity.
-- When a version is recorded, that identity must describe the version's connection.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM commerce.provider_webhook_inbox inbox
    JOIN commerce.provider_connection_version version ON version.provider_connection_version_id = inbox.provider_connection_version_id
    JOIN commerce.provider_connection connection ON connection.provider_connection_id = version.provider_connection_id
    WHERE connection.domain <> inbox.domain OR connection.provider <> inbox.provider OR connection.connection_key <> inbox.connection_id
  ) THEN RAISE EXCEPTION 'existing provider webhook inbox identity does not match its provider connection version'; END IF;
  IF EXISTS (
    SELECT 1 FROM commerce.provider_reconciliation_run run
    JOIN commerce.provider_connection_version version ON version.provider_connection_version_id = run.provider_connection_version_id
    JOIN commerce.provider_connection connection ON connection.provider_connection_id = version.provider_connection_id
    WHERE connection.domain <> run.domain OR connection.provider <> run.provider OR connection.connection_key <> run.connection_id
  ) THEN RAISE EXCEPTION 'existing provider reconciliation identity does not match its provider connection version'; END IF;
END;
$$;

CREATE FUNCTION commerce.ucell_assert_provider_ingress_connection_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.provider_connection_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM commerce.provider_connection_version version
    JOIN commerce.provider_connection connection ON connection.provider_connection_id = version.provider_connection_id
    WHERE version.provider_connection_version_id = NEW.provider_connection_version_id
      AND connection.domain = NEW.domain AND connection.provider = NEW.provider
      AND connection.connection_key = NEW.connection_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_provider_identity_ck',
      MESSAGE = TG_TABLE_NAME || ' identity does not match its provider connection version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_webhook_inbox_connection_identity_guard
BEFORE INSERT OR UPDATE OF domain, provider, connection_id, provider_connection_version_id
ON commerce.provider_webhook_inbox FOR EACH ROW EXECUTE FUNCTION commerce.ucell_assert_provider_ingress_connection_identity();
CREATE TRIGGER provider_reconciliation_run_connection_identity_guard
BEFORE INSERT OR UPDATE OF domain, provider, connection_id, provider_connection_version_id
ON commerce.provider_reconciliation_run FOR EACH ROW EXECUTE FUNCTION commerce.ucell_assert_provider_ingress_connection_identity();

CREATE FUNCTION commerce.ucell_guard_provider_ingress_parent_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM commerce.provider_connection_version version
    JOIN commerce.provider_webhook_inbox inbox ON inbox.provider_connection_version_id = version.provider_connection_version_id
    WHERE version.provider_connection_id = NEW.provider_connection_id
      AND (inbox.domain <> NEW.domain OR inbox.provider <> NEW.provider OR inbox.connection_id <> NEW.connection_key)
  ) OR EXISTS (
    SELECT 1 FROM commerce.provider_connection_version version
    JOIN commerce.provider_reconciliation_run run ON run.provider_connection_version_id = version.provider_connection_version_id
    WHERE version.provider_connection_id = NEW.provider_connection_id
      AND (run.domain <> NEW.domain OR run.provider <> NEW.provider OR run.connection_id <> NEW.connection_key)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'provider_ingress_parent_identity_ck',
      MESSAGE = 'provider connection identity is referenced by webhook or reconciliation evidence and cannot become inconsistent';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_connection_ingress_identity_guard
BEFORE UPDATE OF domain, provider, connection_key ON commerce.provider_connection FOR EACH ROW
EXECUTE FUNCTION commerce.ucell_guard_provider_ingress_parent_identity();
