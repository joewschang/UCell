'use strict';
// Run in the deployed API container. No bootstrap jobs or write-capable application endpoints are invoked.
const {createHash}=require('node:crypto');
const action='current-tree-rebase:20261112:six-company-balls';
const day=86400000;
function must(ok,label){if(!ok)throw Error(label);}
function value(n){const [whole,f='']=String(n).split('.');must(/^\d+$/.test(whole)&&/^\d{0,4}$/.test(f),'invalid source amount');return BigInt(whole)*10000n+BigInt(f.padEnd(4,'0'));}
function decimal(n){return (n/10000n).toString()+'.'+(n%10000n).toString().padStart(4,'0');}
function trace(graph,source,root,kind){
 const edges=graph[kind],parents=new Map(edges.map(e=>[e.childQualificationId,e])),visited=new Set([source]);
 must(parents.size===edges.length,'duplicate '+kind+' parent');
 let at=source;
 for(let generation=1;parents.has(at);generation++){
   const e=parents.get(at);at=kind==='binary'?e.parentQualificationId:e.sponsorQualificationId;
   must(!visited.has(at),'cycle in '+kind+' graph');visited.add(at);
   if(at===root)return {generation,side:e.side};
 }
 return null;
}
function group(facts,root,kind){
 const result={amount:0n,left:0n,right:0n,generations:Array(12).fill(0n),ids:[],sides:new Map()};
 for(const f of facts){const a=trace(f.graph,f.qid,root,kind);if(!a)continue;
   result.ids.push(f.id);result.sides.set(f.id,a.side);if(a.generation>12)continue;
   result.amount+=f.amount;result.generations[a.generation-1]+=f.amount;
   if(kind==='binary'){must(['LEFT','RIGHT'].includes(a.side),'invalid binary side');result[a.side.toLowerCase()]+=f.amount;}
 }
 return result;
}
function equal(actual,expected,label){if(String(actual)!==String(expected))throw Error(label+' expected '+String(expected)+' actual '+String(actual));}
function hash(s){return createHash('sha256').update(JSON.stringify(s)).digest('hex');}
function theoryKey(x){return [x.sourceVolumeEventId,x.recipientQualificationId,x.fixedGenerationNo,x.theoryKind,String(x.theoryAmount),String(x.baseAmount),String(x.rateSnapshot),x.activeSnapshot,x.unlockEligibleSnapshot].join('/');}
async function run(){
 const load=require('node:module').createRequire('/app/apps/api/dist/modules/admin-observability/admin-observability.service.js');
 const {PrismaClient}=load('@prisma/client');
 const lib=load('@ucell/database'),{captureVolumeProjection}=load('/app/apps/api/dist/modules/analytics/analytics.volume.js');
 const {readFoundingPerformance}=load('/app/apps/api/dist/modules/binary-tree/binary-tree-metrics.js');
 const {AdminObservabilityService}=load('/app/apps/api/dist/modules/admin-observability/admin-observability.service.js');
 const db=new PrismaClient();
 try{
 const report=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   const finished=await tx.replayAction.findUnique({where:{actionKey:action}});must(finished,'No committed operation receipt');
   const records=await tx.auditEvent.findMany({where:{action:'GPV_ATTRIBUTION_REBASE',requestId:action},select:{entityId:true,beforeHash:true,afterHash:true,afterData:true,occurredAt:true}});
   const receipt=finished.result;
   equal(records.length,receipt.volume.sourceCount,'Receipt/source count');
   must(records.length>0,'Empty operation');
   const [[{now}],roots,snapshots,ledger,binary,sponsor,originalTheory]=await Promise.all([
     tx.$queryRawUnsafe('SELECT transaction_timestamp() AS now'),
     tx.qualification.findMany({where:{ballNo:{in:Array.from({length:7},(_,i)=>'TW8888888888-0'+(i+1))}},select:{qualificationId:true,ballNo:true,binaryTreeMembership:{select:{binaryTreeId:true}}},orderBy:{ballNo:'asc'}}),
     tx.historicalReplaySnapshot.findMany({where:{kind:'GPV',sourceId:{in:records.map(r=>r.entityId)}}}),
     tx.pvLedger.findMany({where:{eventId:{in:records.map(r=>r.entityId)}}}),
     tx.binaryPlacement.findMany({where:{effectiveTo:null},select:{childQualificationId:true,parentQualificationId:true,side:true,effectiveFrom:true}}),
     tx.sponsorRelationship.findMany({where:{effectiveTo:null},select:{childQualificationId:true,sponsorQualificationId:true,effectiveFrom:true}}),
     tx.theoryCalculationEvidence.findMany({where:{sourceVolumeEventId:{in:records.map(r=>r.entityId)}},select:{recipientQualificationId:true}})
   ]);
   equal(roots.length,7,'Seven company balls');equal(ledger.length,records.length,'GPV ledger count');equal(snapshots.length,records.length,'GPV snapshot count');
   const state={sponsor:sponsor.filter(e=>e.effectiveFrom<=now),binary:binary.filter(e=>e.effectiveFrom<=now)};
   const revisions=new Map(records.map(r=>[r.entityId,r])),events=new Map(ledger.map(e=>[e.eventId,e]));
   const first=Math.min(...records.map(r=>r.occurredAt.getTime())),last=Math.max(...records.map(r=>r.occurredAt.getTime()));
   const before=new Date(first-1),after=new Date(last+1);must(after<=now,'Source revisions newer than verification snapshot');
   equal((await lib.gpvAttributionsAt(tx,ledger.map(e=>e.eventId),before)).size,0,'Pre-cutover source heads');
   equal((await lib.gpvAttributionsAt(tx,ledger.map(e=>e.eventId),after)).size,ledger.length,'Post-cutover source heads');
   const oldFacts=[],newFacts=[],expectedTheory=[];let total=0n;
   for(const snap of snapshots){
     const e=events.get(snap.sourceId),r=revisions.get(snap.sourceId),old=lib.verifyReplayEnvelope(snap);
     const corrected=lib.applyGpvAttribution(old,r);
     must(corrected.evidence.at===old.at && r.afterData.sourceId===e.eventId,'GPV revision identity');
     equal(r.beforeHash,snap.hash,'GPV original hash');
     const amount=value(r.afterData.net);total+=amount;
     oldFacts.push({id:e.eventId,qid:e.qualificationId,at:e.occurredAt,amount,graph:old.evidence});
     newFacts.push({id:e.eventId,qid:e.qualificationId,at:e.occurredAt,amount,graph:state});
     for(const root of roots)for(const kind of ['sponsor','binary'])equal(JSON.stringify(trace(corrected.evidence,e.qualificationId,root.qualificationId,kind)),JSON.stringify(trace(state,e.qualificationId,root.qualificationId,kind)),'Revision differs from current '+kind+' tree for '+root.ballNo);
     for(const t of r.afterData.theory)expectedTheory.push({sourceVolumeEventId:e.eventId,recipientQualificationId:t.recipientQualificationId,fixedGenerationNo:t.generation,theoryKind:t.kind,theoryAmount:t.amount,baseAmount:t.baseAmount,rateSnapshot:t.rate,activeSnapshot:t.active,unlockEligibleSnapshot:t.unlocked});
   }
   equal(decimal(total),decimal(value(receipt.volume.sourceTotal)),'Total GPV in operation');
   const reportRows=[];const memberService=new AdminObservabilityService(tx),targetIds=new Set(events.keys());
   for(const root of roots){const id=root.qualificationId,treeId=root.binaryTreeMembership?.binaryTreeId;must(treeId,'Missing binary tree');
     const out={ball:root.ballNo};
     for(const [label,ts,all] of [['before',before,oldFacts],['after',after,newFacts]]){
       const facts=all.filter(f=>f.at<ts&&f.at>=new Date(ts-day*30));
       const time={asOf:ts.toISOString(),knowledgeCutoff:ts.toISOString(),periodStart:new Date(ts-day*30).toISOString(),periodEnd:ts.toISOString()};
       const projection=await captureVolumeProjection(tx,id,ts);
       must(projection.status==='AVAILABLE',root.ballNo+' '+label+' analytics '+projection.reason);
       equal(projection.sourceEvents,facts.length,'30-day recognized GPV/RPV/EPV count');
       const amounts={};
       for(const kind of ['sponsor','binary']){
         const g=group(facts,id,kind),rows=projection[kind],api=rows.find(r=>r.type==='GPV');
         equal(api.total.net,decimal(g.amount),'analytics '+kind+' '+root.ballNo+' '+label);
         for(let i=0;i<12;i++)equal(api.generations[i].net,decimal(g.generations[i]),'analytics generation '+(i+1));
         if(kind==='binary'){equal(api.left.net,decimal(g.left),'analytics left');equal(api.right.net,decimal(g.right),'analytics right');}
         for(const type of ['RPV','EPV']){const other=rows.find(r=>r.type===type);equal(other.total.net,'0.0000',type+' recognized net');equal(other.total.events,0,type+' recognized events');}
         amounts[kind]=api.total.net;
       }
       const full=await readFoundingPerformance(tx,treeId,id,time,true);
       must(full.status==='AVAILABLE',root.ballNo+' '+label+' binary detail '+full.reason);
       const allFacts=all.filter(f=>f.at<ts),scope=group(allFacts,id,'binary'),expected=new Map(allFacts.filter(f=>scope.sides.has(f.id)).map(f=>[f.id,f]));
       equal(full.sourceFacts.length,expected.size,'binary detail source count');
       const seen=new Set();for(const f of full.sourceFacts){const raw=expected.get(f.eventId);must(raw&&!seen.has(f.eventId),'Unexpected/duplicate source on binary report');seen.add(f.eventId);equal(f.netGpv,decimal(raw.amount),'binary source net');equal(f.firstSide,scope.sides.get(f.eventId),'binary source side');}
       const cumulative=[...expected.values()].reduce((s,f)=>s+f.amount,0n),month=facts.filter(f=>scope.sides.has(f.id));
       const monthSum=side=>month.filter(f=>!side||scope.sides.get(f.id)===side).reduce((s,f)=>s+f.amount,0n);
       equal(full.value.cumulative,decimal(cumulative),'binary cumulative');equal(full.value.month,decimal(monthSum()),'binary period');equal(full.value.leftMonth,decimal(monthSum('LEFT')),'binary period left');equal(full.value.rightMonth,decimal(monthSum('RIGHT')),'binary period right');
       out[label]=amounts;
     }
     reportRows.push(out);
   }
   const allBeneficiaries=new Set([...expectedTheory.map(t=>t.recipientQualificationId),...originalTheory.map(t=>t.recipientQualificationId),...roots.map(t=>t.qualificationId)]);
   const actualTheory=[];for(const id of allBeneficiaries){
     const rows=roots.some(r=>r.qualificationId===id)?(await memberService.qualificationOperations(id)).v3Evidence.theoryCalculations:await lib.currentTheoryForBall(tx,id);
     for(const row of rows)if(targetIds.has(row.sourceVolumeEventId))actualTheory.push(theoryKey(row));
   }
   equal(actualTheory.length,receipt.volume.theoryRows,'Projected theory rows');
   equal(hash(actualTheory.sort()),hash(expectedTheory.map(theoryKey).sort()),'Source/recipient/generation, rate, base and amount');
   return {status:'RUNTIME_READ_ONLY_VERIFIED',asOf:now,before,after,recognizedGpv:decimal(total),sources:records.length,theoryChecked:actualTheory.length,beneficiariesChecked:allBeneficiaries.size,companyBalls:reportRows};
 },{isolationLevel:'RepeatableRead',timeout:180000,maxWait:10000});
 console.log('VERIFIED_REPORT '+JSON.stringify(report));
 }catch(e){console.log('REPORT_CHECK_FAILED '+(e.code||'CHECK')+' '+String(e.message).replace(/[\r\n]+/g,' ').slice(0,300));process.exitCode=1;}finally{await db.$disconnect();}
}
function selftest(){
 const f=[{id:'S',qid:'C',amount:226500n,graph:{sponsor:[{childQualificationId:'C',sponsorQualificationId:'P'}],binary:[{childQualificationId:'C',parentQualificationId:'P',side:'LEFT'},{childQualificationId:'P',parentQualificationId:'R',side:'RIGHT'}]}}];
 equal(decimal(group(f,'P','sponsor').amount),'22.6500','sponsor');equal(decimal(group(f,'R','binary').right),'22.6500','first side');equal(decimal(group(f,'R','binary').generations[1]),'22.6500','depth');equal(group(f,'C','binary').ids.length,0,'self');
 return 'PASS fixed point, first side, depth, excluding origin';
}
if(process.argv.includes('--selftest'))console.log(selftest());else run().catch(e=>{console.log('REPORT_CHECK_FAILED '+String(e.message).slice(0,180));process.exitCode=1;});
