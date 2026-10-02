ALTER TABLE integration.member_notification
 ADD COLUMN message_key text,
 ADD COLUMN source_type text,
 ADD COLUMN source_reference text,
 ADD COLUMN deep_link text,
 ADD COLUMN published_at timestamptz(6),
 ADD COLUMN expires_at timestamptz(6),
 ADD COLUMN retired_at timestamptz(6);
-- The legacy delivery model made every notice visible immediately on creation.
UPDATE integration.member_notification SET published_at=created_at;
ALTER TABLE integration.member_notification ALTER COLUMN published_at SET NOT NULL;
ALTER TABLE integration.member_notification ALTER COLUMN published_at SET DEFAULT now();
ALTER TABLE integration.member_notification ADD CONSTRAINT member_message_window CHECK(expires_at IS NULL OR expires_at>published_at);
ALTER TABLE integration.member_notification DROP CONSTRAINT member_notification_category_check;
ALTER TABLE integration.member_notification ADD CONSTRAINT member_notification_category_check CHECK(category IN ('SERVICE','ORDER','ACCOUNT','SHIPMENT','REPURCHASE','ACTIVE','QUALIFICATION','AWARD','PAYOUT','LEARNING','EVENT'));
CREATE UNIQUE INDEX member_notification_message_key_key ON integration.member_notification(message_key);
CREATE TABLE integration.member_notification_archive (
 notification_id uuid NOT NULL,
 person_id uuid NOT NULL,
 archived_at timestamptz(6) NOT NULL DEFAULT now(),
 PRIMARY KEY(notification_id,person_id),
 FOREIGN KEY(notification_id,person_id) REFERENCES integration.member_notification(notification_id,person_id)
);
CREATE FUNCTION integration.ucell_member_message_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Member message receipt is append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER member_message_read_immutable BEFORE UPDATE OR DELETE ON integration.member_notification_read FOR EACH ROW EXECUTE FUNCTION integration.ucell_member_message_evidence_immutable();
CREATE TRIGGER member_message_archive_immutable BEFORE UPDATE OR DELETE ON integration.member_notification_archive FOR EACH ROW EXECUTE FUNCTION integration.ucell_member_message_evidence_immutable();
