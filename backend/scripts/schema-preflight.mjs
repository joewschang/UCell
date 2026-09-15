import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const schema=fs.readFileSync(path.join(root,'packages/database/prisma/schema.prisma'),'utf8');
const failures=[];

function modelBlock(name){
  const m=schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return m?.[1] ?? '';
}
function must(re,msg){ if(!re.test(schema)) failures.push(msg); }

const person=modelBlock('Person');
const qualification=modelBlock('Qualification');
const payoutLine=modelBlock('PayoutLine');
const recovery=modelBlock('BonusRecoveryEvent');
const payable=modelBlock('PayableEntry');

if(!/qualifications\s+Qualification\[\]/.test(person)) failures.push('Person must own Qualifications');
if(/payoutLines\s+PayoutLine\[\]/.test(person)) failures.push('Person must not directly own payout lines');
if(!/payoutLines\s+PayoutLine\[\]/.test(qualification)) failures.push('Qualification must own payout lines');
if(!/recipientQualificationId/.test(payoutLine)) failures.push('PayoutLine must be qualification-scoped');
if(!/outstandingAmount/.test(recovery)) failures.push('Recovery outstanding balance required');
must(/model RecoveryApplication\s*\{/,'RecoveryApplication model required');
must(/enum BonusAwardType\s*\{[\s\S]*?\bRPV\b[\s\S]*?\bGLOBAL\b/,'RPV and GLOBAL award types required');
if(!/qualification\s+Qualification/.test(payable)) failures.push('PayableEntry qualification relation required');
must(/model IdentityLink\s*\{/,'IdentityLink required');
must(/model AuthSession\s*\{/,'AuthSession required');
must(/model GoldenCaseRun\s*\{/,'GoldenCaseRun required');

if(failures.length){
  console.error('SCHEMA_PREFLIGHT_FAIL');
  for(const f of failures) console.error('-',f);
  process.exit(1);
}
console.log('SCHEMA_PREFLIGHT_PASS');
