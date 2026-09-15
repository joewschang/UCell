-- SA Phase 3: prospective first-version business timezone. UTC timestamps remain unchanged.
-- No production settlement period or cut-off is approved here.
INSERT INTO rules.runtime_rule_parameter
  (rule_version_code, parameter_code, scope_key, value_json, effective_from)
VALUES
  ('R1.0B', 'accounting.timezone', '*', '"Asia/Taipei"'::jsonb, '2026-09-15T00:00:00+08:00'),
  ('R1.0B', 'epv.calendar.timezone', '*', '"Asia/Taipei"'::jsonb, '2026-09-15T00:00:00+08:00');
