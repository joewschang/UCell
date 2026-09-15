import fs from 'node:fs';
const failures=[];
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
const auth=fs.readFileSync('apps/api/src/modules/auth/admin-authentication.guard.ts','utf8');
const ctrl=fs.readFileSync('apps/api/src/modules/admin-ops-ready/admin-ops-ready.controller.ts','utf8');
const svc=fs.readFileSync('apps/api/src/modules/admin-ops-ready/admin-ops-ready.service.ts','utf8');
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const mig=fs.readFileSync('packages/database/prisma/migrations/0015_r5_operations_ready/migration.sql','utf8');

if(!app.includes('AdminOpsReadyModule'))failures.push('AdminOpsReadyModule missing');
if(!app.includes('APP_GUARD'))failures.push('global admin auth guard not registered');
if(!auth.includes("ADMIN_AUTH_BYPASS")||!auth.includes("env!=='production'"))failures.push('safe DEV auth bypass boundary missing');
for(const x of ['attachments','audit-events','reports/operations','integrity-alerts','exports/:dataset']){
  if(!ctrl.includes(x))failures.push(`ops-ready endpoint missing ${x}`);
}
for(const x of ['RECOVERY_BALANCE_MISMATCH','PAYOUT_NET_MISMATCH','ACTIVE_FLAG_WITHOUT_PERIOD','PAID_ORDER_WITHOUT_GPV']){
  if(!svc.includes(x))failures.push(`integrity alert missing ${x}`);
}
if(!schema.includes('model DocumentAttachment'))failures.push('DocumentAttachment model missing');
if(!mig.includes('trg_document_attachment_no_delete'))failures.push('attachment no-delete guard missing');
if(failures.length){
  console.error('OPERATIONS_READY_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('OPERATIONS_READY_PREFLIGHT_PASS');
