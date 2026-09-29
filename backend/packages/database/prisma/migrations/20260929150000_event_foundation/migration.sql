CREATE TYPE learning."MemberEventStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE learning."MemberEventType" AS ENUM ('ONLINE','OFFLINE','HYBRID');
CREATE TYPE learning."MemberEventRegistrationStatus" AS ENUM ('REGISTERED','CANCELLED','CHECKED_IN','ATTENDED');

CREATE TABLE learning.member_event (
 member_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_code text NOT NULL UNIQUE,
 status learning."MemberEventStatus" NOT NULL DEFAULT 'DRAFT', created_by_actor text NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE learning.member_event_version (
 member_event_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_event_id uuid NOT NULL REFERENCES learning.member_event(member_event_id), version integer NOT NULL,
 title text NOT NULL, description text, event_type learning."MemberEventType" NOT NULL, starts_at timestamptz(6) NOT NULL, ends_at timestamptz(6) NOT NULL,
 location_reference text, online_join_reference text, capacity integer, audience_policy text NOT NULL DEFAULT 'NETWORK_MEMBER', approval_reference text, approved_by_actor text, approved_at timestamptz(6), content_hash char(64) NOT NULL, status learning."MemberEventStatus" NOT NULL DEFAULT 'DRAFT', created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT member_event_version_unique UNIQUE(member_event_id,version), CONSTRAINT member_event_window_check CHECK(ends_at > starts_at), CONSTRAINT member_event_capacity_check CHECK(capacity IS NULL OR capacity > 0), CONSTRAINT member_event_hash_check CHECK(content_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX member_event_version_visible_idx ON learning.member_event_version(status,starts_at);
CREATE TABLE learning.member_event_registration (
 member_event_registration_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_event_id uuid NOT NULL REFERENCES learning.member_event(member_event_id), member_event_version_id uuid NOT NULL REFERENCES learning.member_event_version(member_event_version_id), person_id uuid NOT NULL REFERENCES identity.person(person_id), status learning."MemberEventRegistrationStatus" NOT NULL DEFAULT 'REGISTERED', check_in_token_hash char(64) NOT NULL UNIQUE,
 registered_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at timestamptz(6), checked_in_at timestamptz(6), attended_at timestamptz(6),
 CONSTRAINT member_event_registration_unique UNIQUE(member_event_id,person_id)
);
CREATE INDEX member_event_registration_status_idx ON learning.member_event_registration(member_event_id,status,registered_at);
