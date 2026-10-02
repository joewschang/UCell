CREATE TABLE integration.line_messaging_event (
  line_messaging_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_webhook_inbox_id UUID NOT NULL REFERENCES commerce.provider_webhook_inbox(provider_webhook_inbox_id),
  provider_event_identity TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ(6) NOT NULL,
  source_subject_hash TEXT,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX line_messaging_event_inbox_idx ON integration.line_messaging_event(provider_webhook_inbox_id);
CREATE INDEX line_messaging_event_type_occurred_idx ON integration.line_messaging_event(event_type, occurred_at);
