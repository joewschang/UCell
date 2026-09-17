import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient,Prisma}=require('@prisma/client');
const {appendReplayPoolDeltas}=require(fileURLToPath(new URL('../packages/database/dist/replay-pool-delta.js',import.meta.url)));
const db=new PrismaClient();let n=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);n++;};
try{
  const start=new Date('2026-09-01T00:00:00Z'),end=new Date('2026-09-16T00:00:00Z');
  const global=await db.globalPoolSettlement.create({data:{periodStart:start,periodEnd:end,totalGpv:1000,poolRate:.05,poolAvailable:50,distributedAmount:20,undistributedAmount:30,ruleVersionCode:'TEST_REPLAY_42'}});
  const welfare=await db.welfarePoolAccrual.create({data:{periodStart:start,periodEnd:end,totalGpv:1000,poolRate:.02,accruedAmount:20,ruleVersionCode:'TEST_REPLAY_42'}});
  await db.reservoirLedgerEffect.create({data:{reservoirCode:'A',effectType:'GLOBAL_UNDISTRIBUTED',sourceGlobalSettlementId:global.globalPoolSettlementId,sourcePeriodStart:start,sourcePeriodEnd:end,amount:30,ruleVersionCode:'TEST_REPLAY_42',idempotencyKey:`initial:${global.globalPoolSettlementId}`,evidenceHash:'initial'}});
  await db.welfarePoolEffect.create({data:{welfarePoolAccrualId:welfare.welfarePoolAccrualId,effectType:'INITIAL_ACCRUAL',amount:20,ruleVersionCode:'TEST_REPLAY_42',idempotencyKey:`initial:${welfare.welfarePoolAccrualId}`,evidenceHash:'initial'}});
  const input={actionKey:'RETURN:test-42:POOL',reservoir:{sourceGlobalSettlementId:global.globalPoolSettlementId,delta:new Prisma.Decimal('-7.5')},welfare:{welfarePoolAccrualId:welfare.welfarePoolAccrualId,delta:new Prisma.Decimal('-3')}};
  await db.$transaction(tx=>appendReplayPoolDeltas(tx,input));await db.$transaction(tx=>appendReplayPoolDeltas(tx,input));
  eq(await db.reservoirLedgerEffect.count({where:{sourceGlobalSettlementId:global.globalPoolSettlementId}}),2,'Reservoir initial plus one replay delta');
  eq(await db.welfarePoolEffect.count({where:{welfarePoolAccrualId:welfare.welfarePoolAccrualId}}),2,'Welfare initial plus one replay delta');
  eq((await db.reservoirLedgerEffect.aggregate({where:{sourceGlobalSettlementId:global.globalPoolSettlementId},_sum:{amount:true}}))._sum.amount?.toString(),'22.5','Reservoir signed balance');
  eq((await db.welfarePoolEffect.aggregate({where:{welfarePoolAccrualId:welfare.welfarePoolAccrualId},_sum:{amount:true}}))._sum.amount?.toString(),'17','Welfare signed balance');
  eq((await db.globalPoolSettlement.findUniqueOrThrow({where:{globalPoolSettlementId:global.globalPoolSettlementId}})).undistributedAmount.toString(),'30','original Global settlement preserved');
  eq((await db.welfarePoolAccrual.findUniqueOrThrow({where:{welfarePoolAccrualId:welfare.welfarePoolAccrualId}})).accruedAmount.toString(),'20','original Welfare accrual preserved');
  await assert.rejects(db.reservoirLedgerEffect.update({where:{idempotencyKey:`reservoir:${input.actionKey}`},data:{amount:-8}}),/append-only table/);n++;
  await assert.rejects(db.reservoirLedgerEffect.create({data:{reservoirCode:'A',effectType:'GLOBAL_UNDISTRIBUTED',sourceGlobalSettlementId:global.globalPoolSettlementId,sourcePeriodStart:start,sourcePeriodEnd:end,amount:29,ruleVersionCode:'TEST_REPLAY_42',idempotencyKey:'invalid-initial',evidenceHash:'invalid'}}),/RESERVOIR_A_SOURCE_MISMATCH|Unique constraint/);n++;
  console.log(`REPLAY_POOL_DELTA_DB_PASS: ${n} assertions; signed append-only exactly-once deltas preserve originals`);
}finally{await db.$disconnect();}
