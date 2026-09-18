ALTER TABLE integration.period_aggregate_head ADD COLUMN requested_job_id uuid REFERENCES integration.period_projection_job(job_id);
