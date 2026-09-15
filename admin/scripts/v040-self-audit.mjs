
import fs from 'node:fs';
const failures=[];
const files={
 returns:'src/features/returns/ReturnsPage.tsx',
 workflows:'src/features/workflows/WorkflowsPage.tsx',
 payouts:'src/features/payouts/PayoutsPage.tsx',
 system:'src/features/system/SystemPage.tsx',
 api:'src/lib/api.ts'
};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))failures.push(`${k} missing`);
const read=p=>fs.readFileSync(p,'utf8');

for(const x of ['operations/returns','process-reversal','replays/returns','Recovery','Replay Periods']){
  if(!read(files.returns).includes(x))failures.push(`Return operations missing ${x}`);
}
for(const x of ['operations/workflows','reviewFeePaid','COMPANY_RETRANSFER','NT$600']){
  if(!read(files.workflows).includes(x))failures.push(`Workflow operations missing ${x}`);
}
for(const x of ['operations/recoveries','FINANCE_REVIEW','COMPLIANCE_REVIEW','/export','mark-paid','Recovery Aging']){
  if(!read(files.payouts).includes(x))failures.push(`Payout operations missing ${x}`);
}
if(read(files.payouts).includes('system directly executes bank transfer'))failures.push('UI falsely claims direct bank execution');
if(!read(files.api).includes('Idempotency-Key'))failures.push('command idempotency boundary missing');

// Do not calculate R1.0B compensation in UI.
const source=read(files.returns)+read(files.workflows)+read(files.payouts);
for(const pat of [/\b0\.42\b/,/\b0\.36\b/,/\b0\.15\b/,/\b0\.12\b/,/\b0\.05\b/,/\b0\.02\b/]){
  if(pat.test(source))failures.push(`compensation constant leaked into operational UI: ${pat}`);
}

if(failures.length){
  console.error('ADMIN_V040_SELF_AUDIT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('ADMIN_V040_SELF_AUDIT_PASS');
