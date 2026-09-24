ALTER TABLE integration.line_messaging_event
  ADD COLUMN status integration."EventProcessStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN processed_at TIMESTAMPTZ(6),
  ADD COLUMN last_error_code TEXT;
CREATE INDEX line_messaging_event_status_created_idx ON integration.line_messaging_event(status, created_at);
