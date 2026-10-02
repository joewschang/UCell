ALTER TABLE integration.notification_delivery
  ADD CONSTRAINT notification_delivery_person_channel_type_evidence_unique
  UNIQUE (person_id, channel, notification_type, evidence_hash);