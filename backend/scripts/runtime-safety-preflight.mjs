import fs from 'node:fs';

const failures=[];
const audit=fs.readFileSync('apps/api/src/common/audit/audit.interceptor.ts','utf8');
const legacy=fs.readFileSync('apps/api/src/modules/payout/payout.service.ts','utf8');
const module=fs.readFileSync('apps/api/src/common/audit/audit.module.ts','utf8');

if(!audit.includes('entityId:null')) failures.push('HTTP audit must not store request_id in UUID entity_id');
if(!module.includes('APP_INTERCEPTOR')) failures.push('Audit interceptor global registration missing');
if(!legacy.includes('UnifiedPayableService')) failures.push('Legacy payout service can bypass Unified Payable');
if(legacy.includes('bonusRecoveryEvent.update')) failures.push('Legacy payout service still mutates Recovery directly');

if(failures.length){
  console.error('RUNTIME_SAFETY_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('RUNTIME_SAFETY_PREFLIGHT_PASS');
