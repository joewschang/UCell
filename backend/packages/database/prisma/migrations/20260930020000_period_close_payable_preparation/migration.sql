ALTER TABLE integration.period_close_job DROP CONSTRAINT period_close_job_kind_check;
ALTER TABLE integration.period_close_job ADD CONSTRAINT period_close_job_kind_check
 CHECK (kind IN ('REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'));
