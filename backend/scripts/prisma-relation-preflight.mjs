import fs from 'node:fs';

const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const failures=[];

function block(name){
  const m=schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if(!m){ failures.push(`missing model ${name}`); return ''; }
  return m[1];
}

const person=block('Person');
const qualification=block('Qualification');
const bonus=block('BonusAward');
const session=block('AuthSession');
const payable=block('PayableEntry');
const payout=block('PayoutLine');
const recovery=block('BonusRecoveryEvent');
const application=block('RecoveryApplication');

const noPersonRelations=[
  ['BonusAward','bonusAwards'],
  ['BonusAward source','sourceBonusAwards'],
  ['BinaryCarry','binaryCarry'],
  ['QualificationStatusHistory','qualificationStatusHistory'],
  ['QualificationGlobalRankHistory','globalRankHistory'],
];
for(const [label,field] of noPersonRelations){
  if(new RegExp(`\\b${field}\\b`).test(person))
    failures.push(`Person must not directly own ${label}; it belongs to Qualification`);
}

if(!/authSessions\s+AuthSession\[\]/.test(person)) failures.push('Person.authSessions inverse relation missing');
if(!/person\s+Person\?\s+@relation\(fields:\s*\[personId\],\s*references:\s*\[personId\]\)/.test(session))
  failures.push('AuthSession.person relation missing');
if(!/sourceAward\s+BonusAward\?/.test(bonus) || !/derivedAwards\s+BonusAward\[\]/.test(bonus))
  failures.push('BonusAward self relation for sourceAwardId missing');
if(!/payoutLines\s+PayoutLine\[\]/.test(qualification))
  failures.push('Qualification.payoutLines missing');
if(!/qualification\s+Qualification/.test(payable))
  failures.push('PayableEntry.qualification missing');
if(!/recipient\s+Qualification/.test(payout))
  failures.push('PayoutLine.recipient missing');
if(!/applications\s+RecoveryApplication\[\]/.test(recovery))
  failures.push('BonusRecoveryEvent.applications missing');
if(!/recoveryEvent\s+BonusRecoveryEvent/.test(application))
  failures.push('RecoveryApplication.recoveryEvent missing');

if(failures.length){
  console.error('PRISMA_RELATION_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('PRISMA_RELATION_PREFLIGHT_PASS');
