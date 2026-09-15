import fs from 'node:fs';
const failures=[];
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
const ctrl=fs.readFileSync('apps/api/src/modules/admin-operations/admin-operations.controller.ts','utf8');
const svc=fs.readFileSync('apps/api/src/modules/admin-operations/admin-operations.service.ts','utf8');
const reversal=fs.readFileSync('apps/api/src/modules/return/reversal.service.ts','utf8');
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const mig=fs.readFileSync('packages/database/prisma/migrations/0014_r4_payout_approval_recovery_integrity/migration.sql','utf8');

if(!app.includes('AdminOperationsModule'))failures.push('AdminOperationsModule not wired');
for(const x of ['operations/returns','operations/workflows','operations/recoveries','operations/payout-batches']){
  if(!ctrl.includes(x.split('/').pop()))failures.push(`operation endpoint missing ${x}`);
}
for(const x of ['FINANCE_REVIEW','COMPLIANCE_REVIEW','markPaid','exportPayout']){
  if(!svc.includes(x))failures.push(`payout operational rule missing ${x}`);
}
if(!reversal.includes('SettlementCalendarService'))failures.push('Return reversal still bypasses SettlementCalendar');
if(!reversal.includes('outstandingAmount:recovery'))failures.push('Recovery creation does not initialize outstanding balance');
if(!reversal.includes('existingRecovery'))failures.push('Return recovery is not idempotent');
if(!svc.includes('different actors'))failures.push('Dual payout approval does not enforce distinct actors');
if(!svc.includes("['FINANCE','SUPER_ADMIN']"))failures.push('Payout export/paid role enforcement missing');
if(!schema.includes('model PayoutApproval'))failures.push('PayoutApproval model missing');
if(!mig.includes('uq_bonus_recovery_return_reason'))failures.push('Recovery DB uniqueness guard missing');

if(failures.length){
  console.error('ADMIN_OPERATIONS_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('ADMIN_OPERATIONS_PREFLIGHT_PASS');
