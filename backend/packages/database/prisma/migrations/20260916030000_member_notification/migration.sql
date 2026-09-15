CREATE TABLE integration.member_notification (
 notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 qualification_id uuid REFERENCES membership.qualification(qualification_id),
 category text NOT NULL CHECK (category IN ('SERVICE','ORDER','ACCOUNT')),
 title text NOT NULL,
 body text NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX member_notification_person_id_qualification_id_created_at_idx
 ON integration.member_notification(person_id, qualification_id, created_at);
