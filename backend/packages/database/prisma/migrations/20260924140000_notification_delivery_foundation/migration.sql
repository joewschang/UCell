CREATE TYPE integration."NotificationDeliveryStatus" AS ENUM ('PENDING', 'CONFIGURATION_PENDING', 'SENT', 'FAILED', 'EXPIRED');
CREATE TABLE integration.notification_delivery (
  notification_delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL,
  channel TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  destination_binding_id UUID,
  status integration."NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  evidence_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ(6),
  sent_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
ALTER TABLE integration.notification_delivery
  ADD CONSTRAINT notification_delivery_person_fk FOREIGN KEY (person_id) REFERENCES identity.person(person_id),
  ADD CONSTRAINT notification_delivery_binding_fk FOREIGN KEY (destination_binding_id) REFERENCES identity.identity_link(identity_link_id);
CREATE INDEX notification_delivery_person_created_idx ON integration.notification_delivery(person_id, created_at DESC);
CREATE INDEX notification_delivery_status_expires_idx ON integration.notification_delivery(status, expires_at);
