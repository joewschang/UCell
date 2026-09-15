import fs from 'node:fs';
const failures=[];
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
const ctrl=fs.readFileSync('apps/api/src/modules/admin-operations/admin-operations.controller.ts','utf8');
const svc=fs.readFileSync('apps/api/src/modules/admin-operations/admin-operations.service.ts','utf8');
const reversal=fs.readFileSync('apps/api/src/modules/return/reversal.service.ts','utf8');
const carryReplay=fs.readFileSync('apps/api/src/modules/adjustment/carry-chain-replay.service.ts','utf8');
const worker=fs.readFileSync('apps/worker/src/main.ts','utf8');
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const mig=fs.readFileSync('packages/database/prisma/migrations/0014_r4_payout_approval_recovery_integrity/migration.sql','utf8');

if(!app.includes('AdminOperationsModule'))failures.push('AdminOperationsModule not wired');
for(const x of ['operations/returns','operations/workflows','operations/recoveries','operations/payout-batches']){
  if(!ctrl.includes(x.split('/').pop()))failures.push(`operation endpoint missing ${x}`);
}
for(const x of ['FINANCE_REVIEW','COMPLIANCE_REVIEW','markPaid','exportPayout']){
  if(!svc.includes(x))failures.push(`payout operational rule missing ${x}`);
}
// SA-20260915-01: recovery moved from the obsolete per-source shortcut to atomic replay.
// Keep balance, idempotency and calendar requirements; inspect their current owners.
for(const source of [reversal,worker]){
  if(!source.includes('historicalPeriods') || !source.includes('historical.periodStart') || !source.includes('historical.periodEnd'))failures.push('Return must reference finalized historical periods');
  if(!source.includes('RETURN_REVERSAL_PROCESSED') || !source.includes('if(processed)'))failures.push('Return source reversal is not idempotent');
  if(!source.includes('RETURN_DEPENDENCY_REPLAY_REQUIRED'))failures.push('Return dependency replay outbox missing');
  if(source.includes("start.getUTCDate()-start.getUTCDay()"))failures.push('Hardcoded return calendar remains');
}
if(!carryReplay.includes('recoveryAmount:delta.abs(),outstandingAmount:delta.abs()'))failures.push('Replay recovery creation does not initialize outstanding balance');
if(!carryReplay.includes('K0_REPLAY_IMPLEMENTATION_PENDING') || !carryReplay.includes('REPLAY_EFFECTIVE_BASELINE_PENDING'))failures.push('Incomplete or repeated dependency replay must block before posting');
if(reversal.includes('bonusRecoveryEvent.create'))failures.push('Per-source return recovery bypasses dependency-wide normalization');
if(!svc.includes('different actors'))failures.push('Dual payout approval does not enforce distinct actors');
if(!svc.includes("['FINANCE','SUPER_ADMIN']"))failures.push('Payout export/paid role enforcement missing');
if(!schema.includes('model PayoutApproval'))failures.push('PayoutApproval model missing');
if(!mig.includes('uq_bonus_recovery_return_reason'))failures.push('Recovery DB uniqueness guard missing');

if(failures.length){
  console.error('ADMIN_OPERATIONS_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('ADMIN_OPERATIONS_PREFLIGHT_PASS');
