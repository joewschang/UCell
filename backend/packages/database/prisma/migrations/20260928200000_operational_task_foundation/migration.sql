CREATE TYPE integration."OperationalTaskStatus" AS ENUM ('OPEN','ACKNOWLEDGED','COMPLETED');
CREATE TABLE integration.operational_task (
 operational_task_id uuid NOT NULL DEFAULT gen_random_uuid(), source_type text NOT NULL, source_id text NOT NULL, task_code text NOT NULL,
 priority text NOT NULL DEFAULT 'NORMAL', status integration."OperationalTaskStatus" NOT NULL DEFAULT 'OPEN', evidence_hash char(64), trace_id uuid,
 summary text NOT NULL, acknowledged_by_actor text, acknowledged_at timestamptz(6), completed_by_actor text, completed_at timestamptz(6), completion_note text,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT operational_task_pkey PRIMARY KEY (operational_task_id),
 CONSTRAINT operational_task_source_code_key UNIQUE (source_type,source_id,task_code),
 CONSTRAINT operational_task_hash_check CHECK (evidence_hash IS NULL OR evidence_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX operational_task_status_priority_created_idx ON integration.operational_task(status,priority,created_at);