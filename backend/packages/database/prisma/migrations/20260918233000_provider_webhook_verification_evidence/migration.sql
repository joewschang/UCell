ALTER TABLE commerce.provider_webhook_inbox
  ADD COLUMN verification_evidence_hash text,
  ADD COLUMN signature_timestamp timestamptz(6);

ALTER TABLE commerce.provider_webhook_inbox
  ADD CONSTRAINT provider_webhook_inbox_verification_evidence_hash_ck
  CHECK (verification_evidence_hash IS NULL OR verification_evidence_hash ~ '^[a-f0-9]{64}$');

COMMENT ON COLUMN commerce.provider_webhook_inbox.verification_evidence_hash IS
  'SHA-256 digest of complete provider-neutral verification evidence; no raw signature or secret is persisted.';
COMMENT ON COLUMN commerce.provider_webhook_inbox.signature_timestamp IS
  'Provider adapter reported signed timestamp retained only as verification evidence.';
