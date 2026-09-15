CREATE TABLE IF NOT EXISTS ledger.payable_entry (
  payable_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  source_type text NOT NULL, source_id uuid NOT NULL,
  award_type ledger."BonusAwardType" NOT NULL,
  gross_amount numeric(18,4) NOT NULL CHECK(gross_amount>=0),
  available_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'OPEN',
  payout_line_id uuid REFERENCES ledger.payout_line(payout_line_id),
  rule_version_code text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type,source_id)
);
CREATE TABLE IF NOT EXISTS ledger.recovery_application (
  recovery_application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_line_id uuid NOT NULL REFERENCES ledger.payout_line(payout_line_id),
  bonus_recovery_event_id uuid NOT NULL REFERENCES ledger.bonus_recovery_event(bonus_recovery_event_id),
  amount numeric(18,4) NOT NULL CHECK(amount>0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_payable_open ON ledger.payable_entry(status,available_at,qualification_id);
CREATE TRIGGER trg_payable_no_delete BEFORE DELETE ON ledger.payable_entry
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();
CREATE TRIGGER trg_recovery_application_append_only BEFORE UPDATE OR DELETE ON ledger.recovery_application
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

INSERT INTO rules.runtime_rule_parameter(rule_version_code,parameter_code,scope_key,value_json,effective_from)
SELECT 'R1.0B','settlement.timezone','*','"Asia/Taipei"'::jsonb,'2026-09-07T00:00:00+08:00'
WHERE NOT EXISTS(SELECT 1 FROM rules.runtime_rule_parameter
 WHERE rule_version_code='R1.0B' AND parameter_code='settlement.timezone' AND scope_key='*');

INSERT INTO rules.runtime_rule_parameter(rule_version_code,parameter_code,scope_key,value_json,effective_from)
SELECT 'R1.0B','settlement.week.starts_on','*','1'::jsonb,'2026-09-07T00:00:00+08:00'
WHERE NOT EXISTS(SELECT 1 FROM rules.runtime_rule_parameter
 WHERE rule_version_code='R1.0B' AND parameter_code='settlement.week.starts_on' AND scope_key='*');
