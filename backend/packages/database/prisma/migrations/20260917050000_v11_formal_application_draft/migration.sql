CREATE TABLE identity.formal_member_application (
 formal_member_application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO','APPROVED','REJECTED','WITHDRAWN')),
 current_snapshot_hash text NOT NULL CHECK(current_snapshot_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz(6) NOT NULL DEFAULT now(), updated_at timestamptz(6) NOT NULL DEFAULT now(), submitted_at timestamptz(6), reviewed_at timestamptz(6), reviewer_id uuid, decision_reason_code text
);
CREATE INDEX formal_member_application_person_status_idx ON identity.formal_member_application(person_id,status);
CREATE UNIQUE INDEX formal_member_application_one_open_idx ON identity.formal_member_application(person_id) WHERE status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO');
CREATE TABLE identity.formal_member_application_snapshot (
 formal_member_application_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), formal_member_application_id uuid NOT NULL REFERENCES identity.formal_member_application(formal_member_application_id),
 version integer NOT NULL CHECK(version>0), payload_ciphertext text NOT NULL, key_version text NOT NULL CHECK(key_version ~ '^[A-Za-z0-9._-]{1,64}$'), payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz(6) NOT NULL DEFAULT now(), UNIQUE(formal_member_application_id,version)
);
CREATE INDEX formal_member_application_snapshot_hash_idx ON identity.formal_member_application_snapshot(payload_hash);
CREATE FUNCTION identity.protect_formal_application_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'formal application snapshots are append-only'; END $$;
CREATE TRIGGER formal_application_snapshot_append_only BEFORE UPDATE OR DELETE ON identity.formal_member_application_snapshot FOR EACH ROW EXECUTE FUNCTION identity.protect_formal_application_snapshot();