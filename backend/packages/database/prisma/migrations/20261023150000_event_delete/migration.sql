CREATE TABLE learning.member_event_deletion (
 member_event_id uuid PRIMARY KEY REFERENCES learning.member_event(member_event_id),
 deleted_at timestamptz NOT NULL DEFAULT now(),
 deleted_by text NOT NULL,
 reason text NOT NULL
);
