CREATE TABLE integration.period_close_job (
 period_close_job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL')),
 period_start timestamptz(6) NOT NULL,
 period_end timestamptz(6) NOT NULL CHECK (period_end > period_start),
 rule_version_code text NOT NULL CHECK (length(trim(rule_version_code)) > 0),
 parameter_snapshot jsonb NOT NULL,
 prerequisite_ids jsonb NOT NULL CHECK (jsonb_typeof(prerequisite_ids) = 'array'),
 requested_by text NOT NULL CHECK (length(trim(requested_by)) > 0),
 approval_reference text NOT NULL CHECK (length(trim(approval_reference)) > 0),
 outbox_event_id uuid NOT NULL UNIQUE REFERENCES integration.outbox_event(outbox_event_id),
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE (kind,period_start,period_end,rule_version_code)
);
CREATE TABLE integration.period_close_receipt (
 period_close_job_id uuid PRIMARY KEY REFERENCES integration.period_close_job(period_close_job_id),
 source_id uuid NOT NULL,
 snapshot_id uuid NOT NULL UNIQUE,
 completed_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE TRIGGER period_close_job_append_only BEFORE UPDATE OR DELETE
 ON integration.period_close_job FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER period_close_receipt_append_only BEFORE UPDATE OR DELETE
 ON integration.period_close_receipt FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
