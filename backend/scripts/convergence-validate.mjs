import fs from 'node:fs';
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const payout=fs.readFileSync('apps/api/src/modules/payout/unified-payable.service.ts','utf8');
const recovery=fs.readFileSync('apps/api/src/modules/payout/recovery-balance.service.ts','utf8');
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
const failures=[];
const must=(ok,msg)=>{if(!ok) failures.push(msg)};

// v0.6.6 schema/service convergence gates
must(/model PayableEntry[\s\S]*qualification Qualification @relation/.test(schema),'PayableEntry->Qualification relation missing');
must(/model PayableEntry[\s\S]*payoutLine PayoutLine\? @relation/.test(schema),'PayableEntry->PayoutLine relation missing');
must(/model RecoveryApplication[\s\S]*recoveryEvent BonusRecoveryEvent @relation/.test(schema),'RecoveryApplication->Recovery relation missing');
must(/model PayoutLine[\s\S]*payableEntries PayableEntry\[\]/.test(schema),'PayoutLine reverse payable relation missing');
must(/model BonusRecoveryEvent[\s\S]*applications RecoveryApplication\[\]/.test(schema),'Recovery reverse application relation missing');
const personBlock=(schema.match(/model Person \{[\s\S]*?\n\}/)||[''])[0];
must(!personBlock.includes('payoutLines PayoutLine[]'),'Person must not own Qualification payout lines directly');
must(/outstandingAmount\s+Decimal/.test(schema),'Outstanding recovery field missing');
must(payout.includes('recipientQualificationId:qid'),'Payout service field drift: recipientQualificationId');
must(payout.includes('totalGross,totalRecovery,totalNet'),'Payout batch aggregate field drift');
must(recovery.includes("status:{in:['OPEN','OFFSETTING']}") || recovery.includes('OFFSETTING'),'Partial recovery status path missing');
must(app.includes('PayoutModule') && app.includes('AuthModule') && app.includes('SettlementModule'),'Core modules not mounted');

if(failures.length){console.error('CONVERGENCE_VALIDATE_FAIL'); for(const f of failures) console.error('- '+f); process.exit(1)}
console.log('CONVERGENCE_VALIDATE_PASS');
