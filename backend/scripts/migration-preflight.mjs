import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const dir=path.join(root,'packages/database/prisma/migrations');
const dirs=fs.readdirSync(dir).filter(x=>fs.statSync(path.join(dir,x)).isDirectory()).sort();
const failures=[];

const numeric=new Map();
for(const d of dirs){
  // Accept the repository's four-digit sequence and Prisma's fourteen-digit timestamp.
  // Compare the complete prefix so distinct timestamps in one year remain distinct.
  const m=d.match(/^(\d{4}|\d{14})_/);
  if(!m){ failures.push(`migration without numeric prefix: ${d}`); continue; }
  const n=m[1];
  const arr=numeric.get(n)??[]; arr.push(d); numeric.set(n,arr);
}
for(const [n,arr] of numeric) if(arr.length>1) failures.push(`duplicate migration prefix ${n}: ${arr.join(', ')}`);

const all=dirs.map(d=>fs.readFileSync(path.join(dir,d,'migration.sql'),'utf8')).join('\n');
const v3Dir=dirs.find(d=>d.endsWith('_r1_0b_v3_evidence'));
const v3=v3Dir ? fs.readFileSync(path.join(dir,v3Dir,'migration.sql'),'utf8') : '';
if(/CREATE TABLE\s+commerce\.subscription_cancellation/i.test(all))
  failures.push('legacy commerce.subscription_cancellation must not be created');
if(!/CREATE TABLE IF NOT EXISTS\s+subscription\.subscription_cancellation/i.test(all))
  failures.push('canonical subscription.subscription_cancellation missing');
if(!/outstanding_amount/i.test(all))
  failures.push('partial recovery migration missing outstanding_amount');
if(!/settlement\.timezone/i.test(all))
  failures.push('settlement timezone parameter migration missing');
if(!/CREATE TABLE\s+"commerce"\."payment_operation_claim"/i.test(all))
  failures.push('payment operation claim migration missing');
if(!/CREATE TABLE\s+"commerce"\."inventory_operation_claim"/i.test(all))
  failures.push('inventory operation claim migration missing');
if(!/inventory_balance_available_nonnegative/i.test(all))
  failures.push('inventory non-negative balance constraint missing');
if(!/payment_provider_event_evidence_append_only/i.test(all) || !/inventory_movement_append_only/i.test(all))
  failures.push('payment/inventory append-only evidence triggers missing');
if(!/CREATE TABLE ledger\.consumption_recognition_event/i.test(all) || !/trg_consumption_recognition_event_append_only/i.test(all))
  failures.push('immutable ConsumptionRecognitionEvent migration missing');
if(!/CREATE TABLE ledger\.volume_recognition_classification/i.test(all) || !/volume_event_id uuid NOT NULL UNIQUE REFERENCES ledger\.pv_ledger/i.test(all))
  failures.push('one-to-one concrete volume classification migration missing');
if(/INSERT INTO ledger\.pv_ledger[\s\S]*?(?:'PV'|'BV')/i.test(v3))
  failures.push('v3 migration must not duplicate historical GPV into PV/BV');
for(const required of ['qualification_month_accumulator_evidence','active_interval_evidence','theory_calculation_evidence','binary_volume_ledger','business_calendar_version','business_calendar_date','settlement_calendar_evidence','award_payout_anchor','reservoir_ledger_effect'])
  if(!new RegExp(`CREATE TABLE (?:ledger|rules)\\.${required}`,'i').test(all)) failures.push(`v3 evidence table missing: ${required}`);
if(!/uq_reservoir_source_effect/i.test(all) || !/validate_reservoir_a_effect/i.test(all))
  failures.push('Reservoir A exactly-once source validation missing');
if(!/trg_global_pool_settlement_append_only/i.test(all) || !/trg_welfare_pool_accrual_append_only/i.test(all))
  failures.push('Global/Welfare immutability hardening missing');
if(!/ReservoirEffectType[\s\S]*REPLAY_ADJUSTMENT/i.test(all) || !/uq_reservoir_replay_action/i.test(all) || !/ck_reservoir_effect_shape/i.test(all))
  failures.push('Reservoir signed exactly-once replay delta migration missing');
if(!/CREATE TABLE ledger\.welfare_pool_effect/i.test(all) || !/uq_welfare_replay_action/i.test(all) || !/trg_welfare_pool_effect_append_only/i.test(all))
  failures.push('Welfare append-only replay delta migration missing');

if(failures.length){
  console.error('MIGRATION_PREFLIGHT_FAIL');
  for(const f of failures) console.error('-',f);
  process.exit(1);
}
console.log('MIGRATION_PREFLIGHT_PASS');
