CREATE TYPE commerce."ProviderIntegrationDomain" AS ENUM ('PAYMENT', 'INVOICE', 'LOGISTICS');
CREATE TYPE commerce."ProviderWebhookStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'REJECTED', 'PROCESSING', 'PROCESSED', 'RETRY_PENDING', 'MANUAL_REVIEW');
CREATE TYPE commerce."ProviderReconciliationStatus" AS ENUM ('RUNNING', 'MATCHED', 'DISCREPANCY', 'FAILED');

CREATE TABLE commerce.provider_webhook_inbox (
  provider_webhook_inbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain commerce."ProviderIntegrationDomain" NOT NULL,
  provider text NOT NULL,
  connection_id text NOT NULL,
  ingress_key text NOT NULL,
  provider_event_identity text,
  payload_hash text NOT NULL,
  safe_evidence_ref text NOT NULL,
  verification_config_version text NOT NULL,
  status commerce."ProviderWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  received_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
  verified_at timestamptz(6),
  processed_at timestamptz(6),
  next_attempt_at timestamptz(6),
  correlation_id uuid NOT NULL,
  CONSTRAINT provider_webhook_inbox_payload_hash_ck CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT provider_webhook_inbox_attempt_count_ck CHECK (attempt_count >= 0)
);
CREATE UNIQUE INDEX provider_webhook_inbox_ingress_key_uq ON commerce.provider_webhook_inbox(domain, provider, connection_id, ingress_key);
CREATE UNIQUE INDEX provider_webhook_inbox_event_identity_uq ON commerce.provider_webhook_inbox(domain, provider, connection_id, provider_event_identity);
CREATE INDEX provider_webhook_inbox_dispatch_idx ON commerce.provider_webhook_inbox(status, next_attempt_at, received_at);
CREATE INDEX provider_webhook_inbox_correlation_idx ON commerce.provider_webhook_inbox(correlation_id);

CREATE TABLE commerce.provider_reconciliation_run (
  provider_reconciliation_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain commerce."ProviderIntegrationDomain" NOT NULL,
  provider text NOT NULL,
  connection_id text NOT NULL,
  run_key text NOT NULL,
  provider_batch_ref text,
  period_start timestamptz(6) NOT NULL,
  period_end timestamptz(6) NOT NULL,
  status commerce."ProviderReconciliationStatus" NOT NULL DEFAULT 'RUNNING',
  provider_record_count integer NOT NULL DEFAULT 0,
  internal_record_count integer NOT NULL DEFAULT 0,
  discrepancy_count integer NOT NULL DEFAULT 0,
  evidence_hash text,
  safe_evidence_ref text,
  verification_config_version text NOT NULL,
  started_at timestamptz(6) NOT NULL DEFAULT current_timestamp,
  completed_at timestamptz(6),
  correlation_id uuid NOT NULL,
  CONSTRAINT provider_reconciliation_period_ck CHECK (period_start < period_end),
  CONSTRAINT provider_reconciliation_counts_ck CHECK (provider_record_count >= 0 AND internal_record_count >= 0 AND discrepancy_count >= 0),
  CONSTRAINT provider_reconciliation_evidence_hash_ck CHECK (evidence_hash IS NULL OR evidence_hash ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX provider_reconciliation_run_key_uq ON commerce.provider_reconciliation_run(domain, provider, connection_id, run_key);
CREATE INDEX provider_reconciliation_status_idx ON commerce.provider_reconciliation_run(domain, provider, status, started_at);
CREATE INDEX provider_reconciliation_period_idx ON commerce.provider_reconciliation_run(period_start, period_end);

COMMENT ON TABLE commerce.provider_webhook_inbox IS 'Provider-neutral webhook metadata inbox. Raw payload and secrets are never persisted; provider verification precedes domain effects.';
COMMENT ON TABLE commerce.provider_reconciliation_run IS 'Provider-neutral reconciliation evidence. It records counts and safe evidence only and is not a monetary ledger.';
