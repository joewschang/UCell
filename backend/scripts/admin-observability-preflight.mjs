import fs from 'node:fs';
const failures=[];
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
const ctrl=fs.readFileSync('apps/api/src/modules/admin-observability/admin-observability.controller.ts','utf8');
const svc=fs.readFileSync('apps/api/src/modules/admin-observability/admin-observability.service.ts','utf8');

if(!app.includes('AdminObservabilityModule'))failures.push('AdminObservabilityModule not wired');
for(const x of ['sponsor-tree','binary-tree','qualifications/:qualificationId/operations','awards/:bonusAwardId','settlements','pools','compensation/summary']){
  if(!ctrl.includes(x))failures.push(`endpoint missing ${x}`);
}
for(const x of ['activePeriods','pvLedger','bonusAward','binaryCarry','settlementBatch','globalPoolSettlement','welfarePoolAccrual']){
  if(!svc.includes(x))failures.push(`observability source missing ${x}`);
}
if(failures.length){
 console.error('ADMIN_OBSERVABILITY_PREFLIGHT_FAIL');
 failures.forEach(x=>console.error('-',x));
 process.exit(1);
}
console.log('ADMIN_OBSERVABILITY_PREFLIGHT_PASS');
