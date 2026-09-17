CREATE OR REPLACE FUNCTION commerce.enforce_provider_webhook_inbox_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attempt_count < 0 THEN
    RAISE EXCEPTION 'provider webhook attempt_count must be non-negative'
      USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_attempt_count_ck';
  END IF;

  IF OLD.status <> NEW.status AND NOT (CASE OLD.status
    WHEN 'RECEIVED' THEN NEW.status IN ('VERIFIED', 'REJECTED')
    WHEN 'VERIFIED' THEN NEW.status IN ('PROCESSING', 'MANUAL_REVIEW')
    WHEN 'PROCESSING' THEN NEW.status IN ('PROCESSED', 'RETRY_PENDING', 'MANUAL_REVIEW')
    WHEN 'RETRY_PENDING' THEN NEW.status IN ('PROCESSING', 'MANUAL_REVIEW')
    WHEN 'MANUAL_REVIEW' THEN NEW.status = 'RETRY_PENDING'
    WHEN 'REJECTED' THEN FALSE
    WHEN 'PROCESSED' THEN FALSE
    ELSE FALSE
  END) THEN
    RAISE EXCEPTION 'invalid provider webhook status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_status_transition_ck';
  END IF;

  IF OLD.status = 'MANUAL_REVIEW' AND NEW.status = 'RETRY_PENDING' THEN
    IF NEW.next_attempt_at IS NULL THEN
      RAISE EXCEPTION 'manual provider webhook retry requires next_attempt_at'
        USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_manual_retry_schedule_ck';
    END IF;

    IF NEW.last_error_code IS DISTINCT FROM OLD.last_error_code THEN
      RAISE EXCEPTION 'manual provider webhook retry must preserve last_error_code'
        USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_manual_retry_error_ck';
    END IF;

    IF NEW.lease_owner IS NOT NULL OR NEW.lease_expires_at IS NOT NULL THEN
      RAISE EXCEPTION 'manual provider webhook retry cannot acquire a worker lease'
        USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_manual_retry_lease_ck';
    END IF;
  END IF;

  IF OLD.status <> 'RECEIVED' AND (
    NEW.payload_hash IS DISTINCT FROM OLD.payload_hash OR
    NEW.safe_evidence_ref IS DISTINCT FROM OLD.safe_evidence_ref OR
    NEW.verification_config_version IS DISTINCT FROM OLD.verification_config_version OR
    NEW.provider_event_identity IS DISTINCT FROM OLD.provider_event_identity OR
    NEW.verification_evidence_hash IS DISTINCT FROM OLD.verification_evidence_hash OR
    NEW.signature_timestamp IS DISTINCT FROM OLD.signature_timestamp OR
    NEW.verified_at IS DISTINCT FROM OLD.verified_at
  ) THEN
    RAISE EXCEPTION 'provider webhook verification evidence is immutable after verification'
      USING ERRCODE = '23514', CONSTRAINT = 'provider_webhook_inbox_terminal_evidence_ck';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION commerce.enforce_provider_webhook_inbox_lifecycle() IS
  'Enforces provider-neutral webhook state transitions, governed manual retry scheduling, immutable verification evidence, and non-negative retry attempts.';
