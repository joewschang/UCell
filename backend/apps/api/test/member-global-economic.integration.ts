import {randomUUID} from 'node:crypto';
import {PrismaService,Prisma,captureParameters,recognizeConsumption,sealGpvEvent,processHistoricalReturn} from '@ucell/database';
import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
const db=new PrismaService();afterAll(()=>db.$disconnect());
it('ordinary Member Global remains payable, with one signed replay recovery and exactly one payout offset',async()=>{
 const person=await db.person.create({data:{legalName:'SYNTHETIC MEMBER GLOBAL INVARIANCE'}}),start=new Date(),ids:string[]=[];
 for(let i=0;i<3;i++){
  const at=new Date(),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});ids.push(q.qualificationId);
  await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'SYNTHETIC'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'SYNTHETIC'}});
  await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:person.personId,effectiveFrom:at,sourceType:'SYNTHETIC',sourceId:randomUUID()}});
  if(i){await db.sponsorRelationship.create({data:{sponsorQualificationId:ids[0],childQualificationId:q.qualificationId,sponsorSequenceNo:i,effectiveFrom:at}});await db.binaryPlacement.create({data:{parentQualificationId:ids[0],childQualificationId:q.qualificationId,side:i===1?'LEFT':'RIGHT',effectiveFrom:at}});}
 }
 const product=await db.productReference.create({data:{sku:'MEMBER-GLOBAL-'+randomUUID(),displayName:'Synthetic',currentPrice:1}}),orders:any[]=[];
 for(let i=0;i<3;i++){
  const at=new Date(),amount=i===0?2000:400000,snapshot=await captureParameters(db as unknown as Prisma.TransactionClient,at,'R1.0B');
  const order=await db.order.create({data:{qualificationId:ids[i],purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:amount,netAmount:amount,ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:20,unitPrice:amount/20,lineAmount:amount,gpvRateSnapshot:1,gpvAmountSnapshot:amount,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});orders.push(order);
  await db.$transaction(async tx=>{const r=await recognizeConsumption(tx,{qualificationId:ids[i],sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC',ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,recognizedAt:at,activeThreshold:'2000'});await sealGpvEvent(tx,r.volume!);},{timeout:30000});
 }
 const end=new Date(),snapshot=await captureParameters(db as unknown as Prisma.TransactionClient,end,'R1.0B'),calendar={captureForPeriod:async()=>snapshot};
 const settled=await new GlobalPoolService(db,{} as any,new BonusQueryService(db),calendar as any,new GlobalPoolPersistence()).evaluateAndSettle(start,end);
 const award=await db.globalPoolAward.findFirstOrThrow({where:{globalPoolSettlementId:settled.globalPoolSettlementId,qualificationId:ids[0],rankLevel:'NEW_STAR'}});
 const rate=new Prisma.Decimal(snapshot.parameters.find(p=>p.code==='global.rank.pool_rate'&&p.scope==='NEW_STAR')!.value as string);
 expect(award.payableAmount.eq(new Prisma.Decimal(802000).mul(rate))).toBe(true);
 expect(await db.awardEconomicDestination.count()).toBe(0);expect(await db.reservoirBEffect.count()).toBe(0);
 const payout=new UnifiedPayableService(db,new RecoveryBalanceService(db));await payout.materialize(new Date());
 const payable=await db.payableEntry.findUniqueOrThrow({where:{sourceType_sourceId:{sourceType:'GLOBAL_POOL_AWARD',sourceId:award.globalPoolAwardId}}});expect(payable.grossAmount.eq(award.payableAmount)).toBe(true);
 const target=orders[1],ret=await db.returnCase.create({data:{orderId:target.orderId,status:'POSTED',postedAt:new Date(),occurredAt:new Date(),reasonCode:'SYNTHETIC',idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:target.lines[0].orderLineId,quantity:1,returnAmount:20000,gpvReversalAmount:20000}}}});
 await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:30000});
 const postings=await db.entitlementReplayPosting.findMany({where:{recipientQualificationId:ids[0],snapshot:{kind:'GLOBAL',sourceId:settled.globalPoolSettlementId}}});
 expect(postings).toHaveLength(1);expect(postings[0].delta.eq(new Prisma.Decimal(-20000).mul(rate))).toBe(true);expect(postings[0].recoveryId).toBeTruthy();
 const recovery=await db.bonusRecoveryEvent.findUniqueOrThrow({where:{bonusRecoveryEventId:postings[0].recoveryId!},include:{bonusAward:true}});
 expect(recovery.bonusAward.awardType).toBe('GLOBAL');expect(recovery.bonusAward.payableAmount.eq(0)).toBe(true);expect((recovery.bonusAward.calculationDetail as any).originalAwardId).toBe(award.globalPoolAwardId);
 await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:30000});
 expect(await db.entitlementReplayPosting.count({where:{recipientQualificationId:ids[0],snapshot:{kind:'GLOBAL'}}})).toBe(1);
 expect((await db.globalPoolAward.findUniqueOrThrow({where:{globalPoolAwardId:award.globalPoolAwardId}})).payableAmount.eq(award.payableAmount)).toBe(true);
 const paid=await payout.createPayoutBatch(start,new Date()),line=await db.payoutLine.findFirstOrThrow({where:{payoutBatchId:paid.payoutBatchId,recipientQualificationId:ids[0]}});
 expect(line.recoveryOffset.eq(new Prisma.Decimal(20000).mul(rate))).toBe(true);expect(line.netAmount.eq(new Prisma.Decimal(782000).mul(rate))).toBe(true);
 expect(await db.recoveryApplication.count({where:{bonusRecoveryEventId:recovery.bonusRecoveryEventId}})).toBe(1);
 await payout.materialize(new Date());expect(await db.payableEntry.count({where:{sourceType:'GLOBAL_POOL_AWARD',sourceId:award.globalPoolAwardId}})).toBe(1);
 expect(await db.reservoirBEffect.count()).toBe(0);
},120000);
