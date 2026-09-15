import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const failures=[];

const auditModule=read('apps/api/src/common/audit/audit.module.ts');
if(!auditModule.includes('APP_INTERCEPTOR')) failures.push('AuditInterceptor is not globally registered');

const ctx=read('apps/api/src/common/interceptors/request-context.interceptor.ts');
if(!ctx.includes('UUID_RE')) failures.push('Correlation ID UUID normalization missing');

const payout=read('apps/api/src/modules/payout/unified-payable.service.ts');
if(!payout.includes("awardType:'GLOBAL'")) failures.push('Global Pool -> Payable adapter missing');
if(!payout.includes("awardType:'RPV'")) failures.push('RPV -> Payable adapter missing');

const recovery=read('apps/api/src/modules/payout/recovery-balance.service.ts');
if(!recovery.includes('outstandingAmount')) failures.push('Partial recovery balance logic missing');

const app=read('apps/api/src/app.module.ts');
for(const mod of ['AdjustmentModule','AuthModule','SettlementModule','PayoutModule']){
  if(!app.includes(mod)) failures.push(`${mod} not wired into AppModule`);
}

if(failures.length){
  console.error('SOURCE_PREFLIGHT_FAIL');
  for(const f of failures) console.error('-',f);
  process.exit(1);
}
console.log('SOURCE_PREFLIGHT_PASS');
