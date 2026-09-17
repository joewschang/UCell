ALTER TABLE commerce.provider_webhook_inbox
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_expires_at timestamptz(6);

ALTER TABLE commerce.provider_webhook_inbox
  ADD CONSTRAINT provider_webhook_inbox_lease_pair_ck
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL));

CREATE INDEX provider_webhook_inbox_worker_claim_idx
  ON commerce.provider_webhook_inbox(status, lease_expires_at, next_attempt_at, received_at);

CREATE OR REPLACE FUNCTION commerce.enforce_provider_webhook_inbox_worker_lease()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'PROCESSING' AND (NEW.lease_owner IS NULL OR NEW.lease_expires_at IS NULL) THEN
    RAISE EXCEPTION 'processing provider webhook requires an active worker lease'
      USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_processing_lease_ck';
  END IF;

  IF NEW.status <> 'PROCESSING' AND (NEW.lease_owner IS NOT NULL OR NEW.lease_expires_at IS NOT NULL) THEN
    RAISE EXCEPTION 'non-processing provider webhook cannot retain a worker lease'
      USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_non_processing_lease_ck';
  END IF;

  IF OLD.status = 'PROCESSING' AND OLD.lease_expires_at > clock_timestamp()
     AND (NEW.lease_owner IS DISTINCT FROM OLD.lease_owner OR NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at)
     AND current_setting('ucell.provider_webhook_lease_owner', true) IS DISTINCT FROM OLD.lease_owner THEN
    RAISE EXCEPTION 'provider webhook worker lease is owned by another worker'
      USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_lease_owner_ck';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_webhook_inbox_worker_lease_guard
BEFORE UPDATE ON commerce.provider_webhook_inbox
FOR EACH ROW EXECUTE FUNCTION commerce.enforce_provider_webhook_inbox_worker_lease();

COMMENT ON COLUMN commerce.provider_webhook_inbox.lease_owner IS
  'Opaque worker identity holding the processing lease; never a provider credential.';
COMMENT ON COLUMN commerce.provider_webhook_inbox.lease_expires_at IS
  'Lease expiry used for deterministic crash recovery and safe reclaim.';
COMMENT ON FUNCTION commerce.enforce_provider_webhook_inbox_worker_lease() IS
  'Enforces paired lease metadata, PROCESSING ownership, and safe active-lease mutation.';
