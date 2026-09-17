import fs from 'node:fs';
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const payout=fs.readFileSync('apps/api/src/modules/payout/unified-payable.service.ts','utf8');
const recovery=fs.readFileSync('apps/api/src/modules/payout/recovery-balance.service.ts','utf8');
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
const failures=[];
const must=(ok,msg)=>{if(!ok) failures.push(msg)};

// Keep schema checks scoped to one model and insensitive to Prisma formatter
// alignment.  The previous cross-model regex depended on exactly one space
// between the field type and @relation.
const model=(name)=>schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
const escapeRegex=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const hasRelation=(modelName,fieldName,typeName)=>new RegExp(
  `(?:^|\\n)\\s*${escapeRegex(fieldName)}\\s+${escapeRegex(typeName)}\\s+@relation\\b`,
).test(model(modelName));

// v0.6.6 schema/service convergence gates
must(hasRelation('PayableEntry','qualification','Qualification'),'PayableEntry->Qualification relation missing');
must(hasRelation('PayableEntry','payoutLine','PayoutLine?'),'PayableEntry->PayoutLine relation missing');
must(hasRelation('RecoveryApplication','recoveryEvent','BonusRecoveryEvent'),'RecoveryApplication->Recovery relation missing');
must(/(?:^|\n)\s*payableEntries\s+PayableEntry\[\]/.test(model('PayoutLine')),'PayoutLine reverse payable relation missing');
must(/(?:^|\n)\s*applications\s+RecoveryApplication\[\]/.test(model('BonusRecoveryEvent')),'Recovery reverse application relation missing');
const personBlock=(schema.match(/model Person \{[\s\S]*?\n\}/)||[''])[0];
must(!personBlock.includes('payoutLines PayoutLine[]'),'Person must not own Qualification payout lines directly');
must(/outstandingAmount\s+Decimal/.test(schema),'Outstanding recovery field missing');
must(payout.includes('recipientQualificationId:qid'),'Payout service field drift: recipientQualificationId');
must(payout.includes('totalGross,totalRecovery,totalNet'),'Payout batch aggregate field drift');
must(recovery.includes("status:{in:['OPEN','OFFSETTING']}") || recovery.includes('OFFSETTING'),'Partial recovery status path missing');
must(app.includes('PayoutModule') && app.includes('AuthModule') && app.includes('SettlementModule'),'Core modules not mounted');

if(failures.length){console.error('CONVERGENCE_VALIDATE_FAIL'); for(const f of failures) console.error('- '+f); process.exit(1)}
console.log('CONVERGENCE_VALIDATE_PASS');
