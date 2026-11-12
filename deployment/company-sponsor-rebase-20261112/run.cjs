'use strict';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !['--trial', '--apply'].includes(args[0]))) {
  console.error('Usage: node run.cjs [--trial | --apply]');
  process.exit(2);
}
const mode = args[0] === '--apply' ? 'apply' : 'trial';
const edges = require('./sponsor-edges.cjs');
const awardsModule = require('./award-engine.cjs');
const volumeModule = require('./volume.cjs');

const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {PrismaClient,Prisma}=require('/app/packages/database/node_modules/@prisma/client');
const db=new PrismaClient(),lib=require('/app/packages/database/dist');
const {inspectCompensationBatch}=require('/app/packages/database/dist/compensation-audit');
const engine=awardsModule.createAwardEngine(Prisma,lib);
const actionKey='current-tree-rebase:20261112:six-company-balls';
const expectedAwardHash='fdace4a2f161507b6951c02cff865d42b467c7433e5a243d3e8e2ed6b1cd4420';
const expectedGpHash='f58709d40aa8ac7961f7e74899fadd3abeee899f6b1c03ebb0a6c0a63f7305c6';
const cash=(v)=>new Prisma.Decimal(v);
async function execute(tx){
 await tx.$queryRawUnsafe("SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('ucell-current-tree-rebase',0))");
 const done=await tx.replayAction.findUnique({where:{actionKey}});
 if(done){
   assert.equal(done.stateHash,expectedAwardHash);assert.equal(done.result.gpvHash,expectedGpHash);
   await edges.verify(tx);return {status:'ALREADY_COMMITTED',receipt:done.result};
 }
 await tx.$executeRawUnsafe("SET LOCAL lock_timeout='6s'");
 await tx.$executeRawUnsafe("LOCK TABLE ledger.pv_ledger,ledger.bonus_award,ledger.payable_entry,ledger.settlement_batch IN SHARE ROW EXCLUSIVE MODE");
 const before=await edges.inspect(tx);assert.equal(before.present,0);
 const relations=await edges.apply(tx);
 const asOf=(await tx.$queryRawUnsafe("SELECT date_trunc('milliseconds',clock_timestamp()) + interval '1 millisecond' AS at"))[0].at;
 const plan=await engine.inspectAwards(tx,{asOf});
 assert.equal(plan.hash,expectedAwardHash,'Calculation does not match the read-only forecast');
 const vol=await volumeModule.inspectVolume(tx,plan,lib,asOf);
 const facts=vol.projected.map(({id,body})=>[id,body.net,body.binary.map(a=>[a.ancestorQualificationId,a.generation,a.side,a.amount]),
   body.theory.map(a=>[a.recipientQualificationId,a.generation,a.kind,a.baseAmount,a.rate,a.amount,a.active,a.unlocked])]);
 const stable=facts.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const gpvHash=createHash('sha256').update(JSON.stringify(stable)).digest('hex');
 assert.equal(gpvHash,expectedGpHash,'GPV attribution differs from the independently calculated ledger');
 await volumeModule.writeVolume(tx,vol,actionKey,edges.correlationId);
 const totals=await engine.applyAwards(tx,plan,{actionKey,expectedHash:expectedAwardHash,asOf,correlationId:edges.correlationId});
 const audits=[];
 for(const {b} of plan.work){
   const audit=await inspectCompensationBatch(tx,b);
   if(audit.findings.length)throw Error('Independent service audit on '+b.settlementType+': '+JSON.stringify(audit.findings.slice(0,4).map(f=>[f.reason,f.key,f.expected,f.actual])));
   assert(audit.expectedTotal.eq(audit.recordedTotal));
   const saved=await lib.verifyCompensationPeriod(tx,b);
   assert.equal(saved.openCases,0,'Unresolved audit cases for '+b.settlementType);
   audits.push({type:b.settlementType,periodEnd:b.periodEnd.toISOString(),count:saved.checkedAwards,net:audit.recordedTotal.toString()});
 }
 await edges.verify(tx,before);
 assert.equal(await tx.payoutPaymentResult.count(),0);
 assert.equal(await tx.payableEntry.count(),0);
 const receipt={asOf:asOf.toISOString(),effectiveFrom:relations.effectiveFrom,relations:relations.relations.map(r=>[r.ball,r.binaryParent,r.sponsorSequenceNo]),gpvHash,
   volume:vol.summary,awardHash:expectedAwardHash,topologyHash:totals.topologyHash,audits,
   net:audits.reduce((a,b)=>a.plus(b.net),cash(0)).toString(),periods:totals.periods,correlationId:edges.correlationId};
 assert(cash(receipt.net).eq('34205.76'));
 await tx.replayAction.create({data:{actionKey,stateHash:expectedAwardHash,result:JSON.parse(JSON.stringify(receipt))}});
 if(mode==='trial'){const end=new Error('TRIAL_ROLLBACK');end.receipt=receipt;throw end;}
 return {status:'COMMITTED',receipt};
}
(async()=>{try{const result=await db.$transaction(execute,{isolationLevel:'Serializable',timeout:210000,maxWait:10000});console.log('VERIFIED_REPORT '+JSON.stringify(result));}
catch(e){if(e.message==='TRIAL_ROLLBACK'){const count=await db.auditEvent.count({where:{correlationId:edges.correlationId}});assert.equal(count,0);console.log('VERIFIED_REPORT '+JSON.stringify({status:'VERIFIED_ROLLBACK',receipt:e.receipt}));}
else{console.log('REPORT_CHECK_FAILED '+String(e.message).replace(/\s+/g,' ').slice(-1000)+' '+String(e.stack).split('\n').slice(-4).join(' ').replace(/\s+/g,' ').slice(-320));process.exitCode=1;}}finally{await db.$disconnect();}})();
