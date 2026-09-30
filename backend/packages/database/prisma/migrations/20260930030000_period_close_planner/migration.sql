CREATE TABLE integration.period_close_planner_cursor (
 rule_version_code text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION')),
 configured_from timestamptz(6) NOT NULL,
 approval_reference text NOT NULL CHECK (length(trim(approval_reference))>0),
 next_period_start timestamptz(6) NOT NULL,
 updated_at timestamptz(6) NOT NULL DEFAULT now(),
 PRIMARY KEY (rule_version_code,kind)
);
CREATE FUNCTION integration.guard_period_close_planner_cursor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.rule_version_code<>OLD.rule_version_code OR NEW.kind<>OLD.kind
   OR NEW.configured_from<>OLD.configured_from OR NEW.approval_reference<>OLD.approval_reference
   OR NEW.next_period_start<OLD.next_period_start THEN
  RAISE EXCEPTION 'PERIOD_CLOSE_PLANNER_CURSOR_IMMUTABLE_CONFIGURATION';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER period_close_planner_cursor_guard BEFORE UPDATE ON integration.period_close_planner_cursor
 FOR EACH ROW EXECUTE FUNCTION integration.guard_period_close_planner_cursor();
