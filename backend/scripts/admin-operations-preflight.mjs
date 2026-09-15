import fs from 'node:fs';
const failures=[];
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
const ctrl=fs.readFileSync('apps/api/src/modules/admin-operations/admin-operations.controller.ts','utf8');
const svc=fs.readFileSync('apps/api/src/modules/admin-operations/admin-operations.service.ts','utf8');
const reversal=fs.readFileSync('apps/api/src/modules/return/reversal.service.ts','utf8');
const carryReplay=fs.readFileSync('apps/api/src/modules/adjustment/carry-chain-replay.service.ts','utf8');
const worker=fs.readFileSync('apps/worker/src/main.ts','utf8');
const outboxLease=fs.readFileSync('packages/database/src/outbox-lease.ts','utf8');
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const mig=fs.readFileSync('packages/database/prisma/migrations/0014_r4_payout_approval_recovery_integrity/migration.sql','utf8');

if(!app.includes('AdminOperationsModule'))failures.push('AdminOperationsModule not wired');
for(const x of ['operations/returns','operations/workflows','operations/recoveries','operations/payout-batches']){
  if(!ctrl.includes(x.split('/').pop()))failures.push(`operation endpoint missing ${x}`);
}
for(const x of ['FINANCE_REVIEW','COMPLIANCE_REVIEW','markPaid','exportPayout']){
  if(!svc.includes(x))failures.push(`payout operational rule missing ${x}`);
}
// Phase 2: inspect the shared production/API owner and its durable DB guards.
const replay=fs.readFileSync('packages/database/src/historical-replay.ts','utf8');
const replayMigration=fs.readFileSync('packages/database/prisma/migrations/20260915120000_phase2_historical_replay/migration.sql','utf8');
for(const x of ['verifyReplayEnvelope','HISTORICAL_SNAPSHOT_MISSING','periodK0','periodBinary','periodMatching','historicalMonthlyEntitlements','replayRpvCancellation','entitlementReplayPosting','replayCarryProjection','originallyPosted:original','outstandingAmount:delta.abs()']){
  if(!replay.includes(x)) failures.push(`Historical replay safeguard missing ${x}`);
}
for(const x of ['APPEND_ONLY_REPLAY_EVIDENCE','REPLAY_DELTA_BASELINE_MISMATCH','pg_advisory_xact_lock']) if(!replayMigration.includes(x)) failures.push(`Replay DB guard missing ${x}`);
if(!reversal.includes('processHistoricalReturn')) failures.push('API does not use atomic historical owner');
if(!carryReplay.includes('replayReturnDependencies')) failures.push('Carry continuation bypasses historical owner');
for(const x of ['claimOutboxLease','withOutboxLease','processLeasedReplay','releaseFailedOutboxLease']) if(!worker.includes(x)) failures.push(`Worker lease owner wiring missing ${x}`);
for(const x of ['consumeReplayOutbox','attemptCount','availableAt','PROCESSING','FOR UPDATE','lostLease','Serializable']) if(!outboxLease.includes(x)) failures.push(`Shared outbox lease safeguard missing ${x}`);
if(reversal.includes('bonusRecoveryEvent.create')) failures.push('Per-source recovery bypasses normalization');
if(!svc.includes('different actors'))failures.push('Dual payout approval does not enforce distinct actors');
if(!svc.includes("['FINANCE','SUPER_ADMIN']"))failures.push('Payout export/paid role enforcement missing');
if(!schema.includes('model PayoutApproval'))failures.push('PayoutApproval model missing');
if(!mig.includes('uq_bonus_recovery_return_reason'))failures.push('Recovery DB uniqueness guard missing');

if(failures.length){
  console.error('ADMIN_OPERATIONS_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('ADMIN_OPERATIONS_PREFLIGHT_PASS');
