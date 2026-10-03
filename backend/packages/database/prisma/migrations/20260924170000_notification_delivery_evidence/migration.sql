ALTER TABLE integration.notification_delivery
  ADD COLUMN last_attempt_at TIMESTAMPTZ(6),
  ADD COLUMN provider_correlation TEXT,
  ADD COLUMN failure_code TEXT;
CREATE INDEX notification_delivery_status_attempt_idx ON integration.notification_delivery(status, last_attempt_at);