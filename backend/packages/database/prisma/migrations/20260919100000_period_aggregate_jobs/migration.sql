-- Derived analytics only. None of these tables is an economic source.
CREATE TABLE integration.period_projection_job (
 job_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES identity.person(person_id),
 actor_context jsonb NOT NULL, request_key text NOT NULL, query_hash text NOT NULL,
 query jsonb NOT NULL, mode text NOT NULL CHECK(mode IN ('DRY_RUN','REBUILD','RECONCILE')),
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','RUNNING','COMPLETED','FAILED')),
 lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 result jsonb, failure_code text, requested_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz, completed_at timestamptz, UNIQUE(actor_id,request_key),
 CHECK ((status='RUNNING')=(lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX period_projection_job_claim ON integration.period_projection_job(status,requested_at);
CREATE TABLE integration.period_aggregate_generation (
 generation_id uuid PRIMARY KEY, job_id uuid NOT NULL UNIQUE REFERENCES integration.period_projection_job(job_id),
 query_hash text NOT NULL, query jsonb NOT NULL,
 metric_group text NOT NULL CHECK(metric_group IN ('TREE','FOUNDING','RETURN','RANK','BONUS','ACTIVE','RESERVOIR','CARRY','K')),
 definition_version text NOT NULL, projection_version text NOT NULL,
 data_through timestamptz NOT NULL, projected_at timestamptz NOT NULL DEFAULT now(),
 database_snapshot text NOT NULL, manifest jsonb NOT NULL, source_hash text NOT NULL,
 row_count integer NOT NULL CHECK(row_count>=0),
 status text NOT NULL CHECK(status IN ('CURRENT','STALE','FAILED'))
);
CREATE INDEX period_aggregate_generation_scope ON integration.period_aggregate_generation(query_hash,projected_at DESC);
CREATE TABLE integration.period_aggregate_row (
 generation_id uuid NOT NULL REFERENCES integration.period_aggregate_generation(generation_id),
 row_key text NOT NULL, dimensions jsonb NOT NULL, measures jsonb NOT NULL, evidence jsonb NOT NULL,
 PRIMARY KEY(generation_id,row_key)
);
CREATE TABLE integration.period_aggregate_head (
 query_hash text PRIMARY KEY, generation_id uuid REFERENCES integration.period_aggregate_generation(generation_id),
 status text NOT NULL CHECK(status IN ('CURRENT','UPDATING','REBUILDING','STALE','FAILED')),
 updated_at timestamptz NOT NULL DEFAULT now(), failure_code text
);
CREATE TABLE integration.analytics_export_job (
 export_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES identity.person(person_id),
 actor_context jsonb NOT NULL, request_key text NOT NULL, query_hash text NOT NULL, query jsonb NOT NULL,
 generation_id uuid NOT NULL REFERENCES integration.period_aggregate_generation(generation_id),
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','RUNNING','COMPLETED','FAILED','EXPIRED')),
 lease_token uuid, lease_until timestamptz, requested_at timestamptz NOT NULL DEFAULT now(),
 generated_at timestamptz, expires_at timestamptz NOT NULL, data_through timestamptz NOT NULL,
 definition_version text NOT NULL, chunk_count integer, row_count integer, content_hash text, failure_code text,
 UNIQUE(actor_id,request_key),
 CHECK ((status='RUNNING')=(lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX analytics_export_job_claim ON integration.analytics_export_job(status,requested_at);
CREATE TABLE integration.analytics_export_chunk (
 export_id uuid NOT NULL REFERENCES integration.analytics_export_job(export_id), chunk_no integer NOT NULL CHECK(chunk_no>=0),
 csv text NOT NULL CHECK(octet_length(csv)<=1048576), PRIMARY KEY(export_id,chunk_no)
);
CREATE TRIGGER period_generation_immutable BEFORE UPDATE OR DELETE ON integration.period_aggregate_generation
 FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER period_row_immutable BEFORE UPDATE OR DELETE ON integration.period_aggregate_row
 FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER analytics_export_chunk_immutable BEFORE UPDATE OR DELETE ON integration.analytics_export_chunk
 FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
COMMENT ON TABLE integration.period_aggregate_generation IS 'Tree/Founding/Return/Rank/Bonus/Active/Reservoir period read models; immutable generations rebuilt from facts. STALE is never current authority.';
