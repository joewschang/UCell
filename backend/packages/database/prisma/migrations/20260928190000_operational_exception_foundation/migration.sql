CREATE TYPE integration."OperationalExceptionStatus" AS ENUM ('OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED');
CREATE TABLE integration.operational_exception (
 operational_exception_id uuid NOT NULL DEFAULT gen_random_uuid(), source_type text NOT NULL, source_id text NOT NULL, exception_code text NOT NULL,
 severity text NOT NULL DEFAULT 'WARNING', status integration."OperationalExceptionStatus" NOT NULL DEFAULT 'OPEN', evidence_hash char(64), trace_id uuid,
 summary text NOT NULL, acknowledged_by_actor text, acknowledged_at timestamptz(6), resolved_by_actor text, resolved_at timestamptz(6), resolution_note text,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT operational_exception_pkey PRIMARY KEY (operational_exception_id),
 CONSTRAINT operational_exception_source_code_key UNIQUE (source_type,source_id,exception_code),
 CONSTRAINT operational_exception_hash_check CHECK (evidence_hash IS NULL OR evidence_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX operational_exception_status_severity_created_idx ON integration.operational_exception(status,severity,created_at);
