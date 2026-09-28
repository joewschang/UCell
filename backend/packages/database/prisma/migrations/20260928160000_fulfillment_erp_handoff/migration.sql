CREATE TABLE commerce.fulfillment_erp_handoff (
  fulfillment_erp_handoff_id uuid NOT NULL DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL,
  outbox_event_id uuid NOT NULL,
  provider_code text NOT NULL,
  format_version text NOT NULL,
  payload_hash char(64) NOT NULL,
  payload_snapshot jsonb NOT NULL,
  requested_by_actor text NOT NULL,
  requested_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fulfillment_erp_handoff_pkey PRIMARY KEY (fulfillment_erp_handoff_id),
  CONSTRAINT fulfillment_erp_handoff_fulfillment_id_key UNIQUE (fulfillment_id),
  CONSTRAINT fulfillment_erp_handoff_outbox_event_id_key UNIQUE (outbox_event_id),
  CONSTRAINT fulfillment_erp_handoff_fulfillment_fkey FOREIGN KEY (fulfillment_id) REFERENCES commerce.fulfillment(fulfillment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fulfillment_erp_handoff_outbox_fkey FOREIGN KEY (outbox_event_id) REFERENCES integration.outbox_event(outbox_event_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fulfillment_erp_handoff_hash_check CHECK (payload_hash ~ '^[a-f0-9]{64}$')
);
