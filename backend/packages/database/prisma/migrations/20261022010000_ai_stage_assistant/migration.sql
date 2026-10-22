-- Additive AI control plane. No changes to operational or financial records.
CREATE SCHEMA IF NOT EXISTS ai;
CREATE TABLE ai.capability_grant (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL, capability text NOT NULL,
 valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz NOT NULL,
 granted_by text NOT NULL, reason text NOT NULL, revision integer NOT NULL DEFAULT 1,
 UNIQUE(actor_id,capability), CHECK(valid_to>valid_from)
);
CREATE TABLE ai.conversation (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL, audience text NOT NULL CHECK(audience IN ('ADMIN','MEMBER')),
 qualification_id uuid, context_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 CHECK(context_version>0)
);
CREATE INDEX ON ai.conversation(actor_id,created_at);
CREATE TABLE ai.turn (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES ai.conversation(id),
 actor_id uuid NOT NULL, audience text NOT NULL, idempotency_key text NOT NULL,
 input_hash text NOT NULL, status text NOT NULL CHECK(status IN ('QUEUED','RUNNING','COMPLETED','NEEDS_CLARIFICATION','FAILED','CANCELLED')),
 result jsonb, intent text, model_version text, prompt_version text NOT NULL DEFAULT 'stage-v1',
 token_count integer NOT NULL DEFAULT 0, reserved_tokens integer NOT NULL DEFAULT 4096,
 request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(conversation_id,idempotency_key)
);
CREATE INDEX ON ai.turn(actor_id,created_at);
CREATE TABLE ai.snapshot (
 id uuid PRIMARY KEY, turn_id uuid NOT NULL UNIQUE REFERENCES ai.turn(id), actor_id uuid NOT NULL,
 audience text NOT NULL, qualification_id uuid, payload jsonb NOT NULL, payload_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE ai.report_job (
 id uuid PRIMARY KEY, snapshot_id uuid NOT NULL REFERENCES ai.snapshot(id), actor_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('READY','EXPIRED')), created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 UNIQUE(snapshot_id,actor_id)
);
CREATE TABLE ai.knowledge_version (
 id uuid PRIMARY KEY, topic text NOT NULL, version integer NOT NULL, title text NOT NULL,
 body text NOT NULL, audience text NOT NULL CHECK(audience IN ('ALL','MEMBER','ADMIN')),
 source_ref text NOT NULL, source_hash text NOT NULL, effective_from timestamptz NOT NULL, effective_to timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('DRAFT','IN_REVIEW','PUBLISHED','DISABLED')),
 author_id uuid NOT NULL, approver_id uuid, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(topic,version), CHECK(effective_to>effective_from),
 CHECK(approver_id IS NULL OR author_id<>approver_id)
);
CREATE INDEX ON ai.knowledge_version(topic,status,effective_from,effective_to);
CREATE TABLE ai.audit_event (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL, audience text NOT NULL, action text NOT NULL,
 entity_id uuid, outcome text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ai.audit_event(created_at);
CREATE TABLE ai.feedback (
 id uuid PRIMARY KEY, turn_id uuid NOT NULL REFERENCES ai.turn(id), actor_id uuid NOT NULL,
 rating text NOT NULL CHECK(rating IN ('HELPFUL','INCORRECT','UNCLEAR')), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(turn_id,actor_id)
);
CREATE FUNCTION ai.immutable_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AI_EVIDENCE_IMMUTABLE'; END $$;
CREATE TRIGGER ai_snapshot_no_update BEFORE UPDATE ON ai.snapshot FOR EACH ROW EXECUTE FUNCTION ai.immutable_evidence();
CREATE TRIGGER ai_audit_no_update BEFORE UPDATE ON ai.audit_event FOR EACH ROW EXECUTE FUNCTION ai.immutable_evidence();
