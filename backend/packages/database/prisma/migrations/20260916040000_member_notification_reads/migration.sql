ALTER TABLE integration.member_notification ADD COLUMN source_event_id uuid;
CREATE UNIQUE INDEX member_notification_source_event_id_key ON integration.member_notification(source_event_id);
CREATE UNIQUE INDEX member_notification_notification_id_person_id_key ON integration.member_notification(notification_id,person_id);
CREATE TABLE integration.member_notification_read (
 notification_id uuid NOT NULL,
 person_id uuid NOT NULL,
 read_at timestamptz(6) NOT NULL DEFAULT now(),
 PRIMARY KEY(notification_id,person_id),
 FOREIGN KEY(notification_id,person_id) REFERENCES integration.member_notification(notification_id,person_id)
);
