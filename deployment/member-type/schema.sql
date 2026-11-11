CREATE TABLE IF NOT EXISTS identity.member_type_evidence (
 evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 legal_entity_id uuid NOT NULL REFERENCES identity.legal_entity(legal_entity_id),
 registration_no text NOT NULL CHECK(registration_no ~ '^[0-9]{8}$'),
 mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','application/pdf')),
 sha256 text NOT NULL,
 ciphertext text NOT NULL,
 key_version text NOT NULL,
 uploaded_by uuid NOT NULL REFERENCES identity.person(person_id),
 uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_type_evidence_lookup ON identity.member_type_evidence(legal_entity_id,uploaded_at DESC);
CREATE TABLE IF NOT EXISTS identity.member_type_change (
 change_id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES identity.person(person_id),
 request_hash text NOT NULL,
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 legal_entity_id uuid NOT NULL REFERENCES identity.legal_entity(legal_entity_id),
 previous_type text NOT NULL CHECK(previous_type IN ('INDIVIDUAL','LEGAL_ENTITY')),
 next_type text NOT NULL CHECK(next_type IN ('INDIVIDUAL','LEGAL_ENTITY')),
 member_no text NOT NULL,
 reason text NOT NULL,
 evidence_id uuid REFERENCES identity.member_type_evidence(evidence_id),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_type_change_lookup ON identity.member_type_change(person_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS identity.member_type_number_change(
 change_id uuid NOT NULL, party text NOT NULL, subject uuid NOT NULL, old_no text NOT NULL, new_no text NOT NULL,
 xid bigint NOT NULL DEFAULT txid_current(), PRIMARY KEY(change_id,party)
);
CREATE TABLE IF NOT EXISTS identity.member_type_award_owner(
 source_type text NOT NULL,source_id uuid NOT NULL,qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 party text NOT NULL CHECK(party IN ('INDIVIDUAL','LEGAL_ENTITY')),owner_id uuid NOT NULL,member_no text NOT NULL,PRIMARY KEY(source_type,source_id)
);
CREATE INDEX IF NOT EXISTS type_award_by_ball ON identity.member_type_award_owner(qualification_id);
CREATE TABLE IF NOT EXISTS identity.member_type_current(
 person_id uuid NOT NULL REFERENCES identity.person(person_id),legal_entity_id uuid PRIMARY KEY REFERENCES identity.legal_entity(legal_entity_id),
 active_type text NOT NULL CHECK(active_type IN ('INDIVIDUAL','LEGAL_ENTITY')),member_no text NOT NULL,changed_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS member_type_active_rep ON identity.member_type_current(person_id) WHERE active_type='LEGAL_ENTITY';
