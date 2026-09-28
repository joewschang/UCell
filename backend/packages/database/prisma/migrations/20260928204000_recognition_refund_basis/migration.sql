-- Existing schedules have no proven refund basis. Do not backfill them with
-- an assumed ratio; the application accepts legacy rows only without partial returns.
ALTER TABLE subscription.monthly_recognition_schedule
  ADD COLUMN retained_entitlement_ratio NUMERIC(38,18);
ALTER TABLE subscription.monthly_recognition_schedule
  ALTER COLUMN retained_entitlement_ratio SET DEFAULT 1;
ALTER TABLE subscription.monthly_recognition_schedule
  ADD CONSTRAINT recognition_retained_ratio_bounds
  CHECK (retained_entitlement_ratio >= 0 AND retained_entitlement_ratio <= 1);
