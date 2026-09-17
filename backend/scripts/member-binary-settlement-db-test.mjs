import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {readBinarySettlement}=require('./apps/api/dist/modules/member/member-read.service.js');
const {replayHash,storeReplaySnapshot}=require('./packages/database/dist/index.js');
const db=new PrismaClient();
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
let assertions=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);assertions++;};
try {
 const person=await db.person.create({data:{legalName:'MEMBER BINARY SETTLEMENT DB',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
 const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'LEADER',status:'EFFECTIVE',effectiveAt:new Date('2026-09-01T00:00:00Z')}});
 const periodStart=new Date('2026-08-31T16:00:00.000Z'),periodEnd=new Date('2026-09-07T16:00:00.000Z'),ruleVersionCode=`TEST_ONLY_MEMBER_BINARY_${Date.now()}`;
 const body={format:'UCELL_PARAMETER_SNAPSHOT_V1',ruleVersionCode,effectiveAt:periodEnd.toISOString(),parameters:[]};
 const parameters={...body,hash:createHash('sha256').update(canonical(body)).digest('hex')};
 const batch=await db.settlementBatch.create({data:{settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode,status:'FINALIZED',parameterSnapshot:parameters,totalGpv:2200,poolRate:.36,poolAvailable:792,totalTheory:100,kFactor:1,calculationHash:createHash('sha256').update(ruleVersionCode).digest('hex'),finalizedAt:new Date('2026-09-07T16:01:00.000Z')}});
 const envelope={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'BINARY_K1',sourceId:batch.settlementBatchId,at:periodEnd.toISOString(),ruleVersionCode,parameters,recipients:[],evidence:{carryRecipients:[{qualificationId:qualification.qualificationId,leftCarryIn:'10',rightCarryIn:'20',leftPeriodGpv:'1500',rightPeriodGpv:'700',pairedPv:'720',leftCarryOut:'790',rightCarryOut:'0'}]},inputs:{periodStart:periodStart.toISOString(),periodEnd:periodEnd.toISOString(),totalGpv:'2200',k:'1'}};
 await db.$transaction(tx=>storeReplaySnapshot(tx,envelope));
 const before=JSON.stringify(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:batch.settlementBatchId}}}));
 const view=await readBinarySettlement(db,qualification.qualificationId,batch.settlementBatchId);
 eq(view.left,{count:null,volume:1500,carry:790},'left metrics come from historical settlement evidence');
 eq(view.right,{count:null,volume:700,carry:0},'right metrics come from historical settlement evidence');
 eq(view.settlementScope.settlementBatchId,batch.settlementBatchId,'response exposes immutable batch scope');
 eq(view.settlementScope.parameterSnapshotHash,parameters.hash,'response exposes exact Parameter snapshot hash');
 eq(JSON.stringify(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:batch.settlementBatchId}}})),before,'read is side-effect free and leaves evidence unchanged');
 let missing=false;try{await readBinarySettlement(db,'00000000-0000-4000-8000-000000000099',batch.settlementBatchId);}catch(error){missing=(error?.getResponse?.()??error?.response)?.code==='HISTORICAL_SNAPSHOT_MISSING';}
 eq(missing,true,'unknown Qualification fails closed instead of reading current state');
 eq(replayHash(envelope),(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:batch.settlementBatchId}}})).hash,'sealed evidence hash remains deterministic');
 console.log(`MEMBER_BINARY_SETTLEMENT_DB_PASS: ${assertions} assertions; explicit finalized batch, sealed carry evidence, no current-state fallback`);
} finally {await db.$disconnect();}
