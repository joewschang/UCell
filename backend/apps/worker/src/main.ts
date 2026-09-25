import {effectiveSponsorDirectCount} from '@ucell/database';
import { PrismaService, Prisma, companyAlwaysActiveAt, captureParameters, snapshotDecimal, processMemberOrderNotification, processPaymentInventoryReservation, recognizeConsumption, applyGpvImmediateEffects, sealRpvEvent, pending, claimOutboxLease, withOutboxLease, processLeasedReplay, processTreeProjectionEvent, releaseFailedOutboxLease, OutboxLease, matureBonusAward } from '@ucell/database';
import * as crypto from 'node:crypto';
import { pollProviderWebhooks, type ProviderHandlerRegistration } from './provider-runtime';
import { WorkerLoop, workerPollInterval } from './worker-loop';
import { ProviderWorkloadMetrics } from './provider-workload-metrics';
import { createLineMessagingObserverHandler } from './line-messaging-handler';

const prisma = new PrismaService();
const providerHandlers: readonly ProviderHandlerRegistration[] = process.env.LINE_MESSAGING_WORKER_ENABLED==='true'
  ? Object.freeze([{domain:'IDENTITY',provider:'LINE_MESSAGING',connectionId:'LINE_MESSAGING_DEFAULT',handler:createLineMessagingObserverHandler(prisma)}])
  : Object.freeze([]);
const providerMetrics = new ProviderWorkloadMetrics();

function unlockedDepth(count:number){
  if(count<=0) return 5;
  if(count===1) return 8;
  return 12;
}

async function effectiveDirectCountAt(tx:Prisma.TransactionClient,sponsorQualificationId:string,at:Date){return effectiveSponsorDirectCount(tx,sponsorQualificationId,at);}

export async function processSaleConfirmed(db:PrismaService,lease:OutboxLease,deps={withOutboxLease,applyGpvImmediateEffects}){
  const outboxEventId=lease.outboxEventId;
  return deps.withOutboxLease(db,lease,async tx=>{
    const event=await tx.outboxEvent.findUnique({where:{outboxEventId}});
    if(!event || event.processStatus==='PROCESSED') return;

    const payload=event.payload as any;
    const order=await tx.order.findUnique({where:{orderId:payload.orderId},include:{lines:true}});
    if(!order || !order.qualificationId || !['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(order.status)) throw new Error(`SALE_CONFIRMED order ${payload.orderId} is not a qualified paid order`);

    if(!order.paidAt) pending('HISTORICAL_SNAPSHOT_MISSING','Original sale recognition timestamp is missing');
    if(!order.parameterSnapshotHash) pending('HISTORICAL_SNAPSHOT_MISSING','Original sale Parameter snapshot hash is missing');
    for(const line of order.lines){
      const result=await recognizeConsumption(tx,{
        qualificationId:order.qualificationId,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,
        amount:line.gpvAmountSnapshot,eligible:line.gpvAmountSnapshot.gt(0),exclusionReasonCode:'ZERO_ELIGIBLE_AMOUNT',
        concreteVolumeType:'GPV',productProfileVersion:String((line.ruleProfileSnapshot as any)?.profileId??'ORDER_LINE_SNAPSHOT'),
        ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:order.parameterSnapshotHash,recognizedAt:order.paidAt,
        activeThreshold:process.env.UCELL_ACTIVE_THRESHOLD??'1200',correlationId:event.correlationId
      });
      if(result.created&&result.volume) await deps.applyGpvImmediateEffects(tx,result.volume);
    }

    await tx.outboxEvent.update({
      where:{outboxEventId},
      data:{processStatus:'PROCESSED',processedAt:new Date()}
    });
  });
}

/** Recognizes only immutable WEB_MEMBER retail line snapshots; it never emits PV or organization edges. */
export async function processRetailReferralPayment(db:PrismaService,lease:OutboxLease,deps={withOutboxLease}){
 return deps.withOutboxLease(db,lease,async tx=>{
  const event=await tx.outboxEvent.findUnique({where:{outboxEventId:lease.outboxEventId}}); if(!event||event.processStatus==='PROCESSED')return;
  const order=await tx.order.findUnique({where:{orderId:(event.payload as any).orderId},include:{retailReferralLineSnapshots:true}});
  if(!order||order.qualificationId||!order.purchaserPersonId||order.status!=='PAID'||!order.paidAt)throw new Error('WEB_RETAIL_PAYMENT_INVALID');
  const parameters=await captureParameters(tx,order.paidAt,order.ruleVersionCode),pendingUntil=new Date(order.paidAt.getTime()+Number(snapshotDecimal(parameters,'award.pending.days').toString())*86400000);
  for(const line of order.retailReferralLineSnapshots){
   if(!line.retailReferralEnabled||!line.referrerQualificationId||line.calculationType!=='PERCENTAGE'||line.baseType!=='NET_PAID_ITEM_AMOUNT'||!line.rate)continue;
   const active=await companyAlwaysActiveAt(tx,line.referrerQualificationId,order.paidAt)||!!await tx.activePeriod.findFirst({where:{qualificationId:line.referrerQualificationId,activeFrom:{lte:order.paidAt},OR:[{activeTo:null},{activeTo:{gt:order.paidAt}}]}});
   const plan=await tx.qualificationPlanHistory.findFirst({where:{qualificationId:line.referrerQualificationId,effectiveFrom:{lte:order.paidAt},OR:[{effectiveTo:null},{effectiveTo:{gt:order.paidAt}}]},orderBy:{effectiveFrom:'desc'}});
   if(!plan)throw new Error('RETAIL_REFERRAL_PLAN_EVIDENCE_MISSING');
   const theory=line.netPaidItemAmount.mul(line.rate),payable=active?theory:new Prisma.Decimal(0);
   const existing=await tx.bonusAward.findFirst({where:{awardType:'RETAIL_REFERRAL',recipientQualificationId:line.referrerQualificationId,sourceEventId:line.orderLineId}});if(existing)continue;
   const award=await tx.bonusAward.create({data:{awardType:'RETAIL_REFERRAL',recipientQualificationId:line.referrerQualificationId,sourceEventId:line.orderLineId,theoryAmount:theory,payableAmount:payable,kFactor:new Prisma.Decimal(1),activeSnapshot:active,planLevelSnapshot:plan.planCode,ruleVersionCode:line.productRuleVersion,parameterSnapshotHash:line.parameterSnapshotHash??parameters.hash,occurredAt:order.paidAt,pendingUntil,calculationDetail:{orderId:order.orderId,orderLineId:line.orderLineId,referrerBallNo:line.referrerBallNoSnapshot,baseType:line.baseType,baseAmount:line.netPaidItemAmount.toString(),rate:line.rate.toString(),activeAsOf:order.paidAt.toISOString(),activeEvidence:active?'ACTIVE':'INELIGIBLE'}}});
   await tx.bonusAwardLifecycleEvent.createMany({data:[{bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date(),reasonCode:active?undefined:'INACTIVE_AT_RECOGNITION'},{bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date(),reasonCode:active?undefined:'INACTIVE_AT_RECOGNITION'}]});
  }
  await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}});
 });
}

export async function processRetailReferralReturn(db:PrismaService,lease:OutboxLease,deps={withOutboxLease}){
 return deps.withOutboxLease(db,lease,async tx=>{
  const event=await tx.outboxEvent.findUnique({where:{outboxEventId:lease.outboxEventId}});if(!event||event.processStatus==='PROCESSED')return;
  const ret=await tx.returnCase.findUnique({where:{returnCaseId:(event.payload as any).returnCaseId},include:{order:{include:{retailReferralLineSnapshots:true}},lines:true}});
  if(!ret||ret.status!=='POSTED'||ret.order.qualificationId||!ret.order.purchaserPersonId)throw new Error('WEB_RETAIL_RETURN_INVALID');
  for(const returned of ret.lines){
   const snapshot=ret.order.retailReferralLineSnapshots.find(row=>row.orderLineId===returned.orderLineId);if(!snapshot?.retailReferralEnabled||!snapshot.referrerQualificationId||!snapshot.rate)continue;
   const award=await tx.bonusAward.findFirst({where:{awardType:'RETAIL_REFERRAL',recipientQualificationId:snapshot.referrerQualificationId,sourceEventId:returned.orderLineId}});if(!award||award.payableAmount.lte(0))continue;
   const requestedAdjustment=returned.returnAmount.mul(snapshot.rate);if(requestedAdjustment.lte(0))continue;
   const priorRecovery=await tx.bonusRecoveryEvent.aggregate({where:{bonusAwardId:award.bonusAwardId},_sum:{recoveryAmount:true}});
   const remaining=Prisma.Decimal.max(new Prisma.Decimal(0),award.payableAmount.sub(priorRecovery._sum.recoveryAmount??0));
   const adjustment=Prisma.Decimal.min(requestedAdjustment,remaining);if(adjustment.lte(0))continue;
   const latest=await tx.bonusAwardLifecycleEvent.findFirst({where:{bonusAwardId:award.bonusAwardId},orderBy:{occurredAt:'desc'}});
   if(latest&&['CALCULATED','PENDING_45D'].includes(latest.status)){
    if(priorRecovery._sum.recoveryAmount===null&&adjustment.gte(remaining))await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:award.bonusAwardId,status:'REVERSED',occurredAt:ret.occurredAt,reasonCode:'RETAIL_RETURN_FULL_OFFSET'}});
    else if(!await tx.bonusRecoveryEvent.findFirst({where:{bonusAwardId:award.bonusAwardId,returnCaseId:ret.returnCaseId,reasonCode:'RETAIL_RETURN_PENDING_OFFSET'}}))await tx.bonusRecoveryEvent.create({data:{bonusAwardId:award.bonusAwardId,returnCaseId:ret.returnCaseId,recoveryAmount:adjustment,outstandingAmount:adjustment,status:'OFFSETTING',reasonCode:'RETAIL_RETURN_PENDING_OFFSET',occurredAt:ret.occurredAt}});
   }
   else if(latest&&['EFFECTIVE','PAYABLE','PAID','CLAWBACK'].includes(latest.status)){
    const recovery=await tx.bonusRecoveryEvent.findFirst({where:{bonusAwardId:award.bonusAwardId,returnCaseId:ret.returnCaseId,reasonCode:'RETAIL_RETURN'}});
    if(!recovery){
     await tx.bonusRecoveryEvent.create({data:{bonusAwardId:award.bonusAwardId,returnCaseId:ret.returnCaseId,recoveryAmount:adjustment,outstandingAmount:adjustment,status:'OPEN',reasonCode:'RETAIL_RETURN',occurredAt:ret.occurredAt}});
     if(latest.status!=='CLAWBACK')await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:award.bonusAwardId,status:'CLAWBACK',occurredAt:ret.occurredAt,reasonCode:'RETAIL_RETURN'}});
    }
   }
  }
  await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}});
 });
}

async function processRecognition(recognitionId:string){
  return prisma.$transaction(async tx=>{
    const schedule=await tx.monthlyRecognitionSchedule.findUnique({
      where:{recognitionId},include:{subscription:true}
    });
    if(!schedule || !['SCHEDULED','DUE'].includes(schedule.status) || schedule.dueAt>new Date()) return;

    const correlationId=crypto.randomUUID();
    const pvEvent=await tx.pvLedger.upsert({
      where:{
        eventType_sourceType_sourceId_sourceLineId_pvType:{
          eventType:'RPV_CREATED',sourceType:'MONTHLY_RECOGNITION',
          sourceId:schedule.subscriptionId,sourceLineId:schedule.recognitionId,pvType:'RPV'
        }
      },
      update:{},
      create:{
        qualificationId:schedule.subscription.qualificationId,pvType:'RPV',amount:schedule.rpvAmount,
        sourceType:'MONTHLY_RECOGNITION',sourceId:schedule.subscriptionId,sourceLineId:schedule.recognitionId,
        eventType:'RPV_CREATED',ruleVersionCode:schedule.ruleVersionCode,
        parameterSnapshotHash:schedule.parameterSnapshotHash,
        occurredAt:schedule.dueAt,correlationId
      }
    });

    const ancestors=await tx.$queryRaw<Array<{qualification_id:string;generation:number}>>`
      WITH RECURSIVE up AS (
        SELECT bp.parent_qualification_id AS qualification_id,1 AS generation
        FROM organization.binary_placement bp
        WHERE bp.child_qualification_id=${schedule.subscription.qualificationId}::uuid
          AND bp.effective_from <= ${schedule.dueAt}
          AND (bp.effective_to IS NULL OR bp.effective_to > ${schedule.dueAt})
        UNION ALL
        SELECT bp.parent_qualification_id,up.generation+1
        FROM organization.binary_placement bp
        JOIN up ON bp.child_qualification_id=up.qualification_id
        WHERE up.generation < 12
          AND bp.effective_from <= ${schedule.dueAt}
          AND (bp.effective_to IS NULL OR bp.effective_to > ${schedule.dueAt})
      )
      SELECT qualification_id::text,generation FROM up ORDER BY generation
    `;

    for(const a of ancestors){
      const directCount=await effectiveDirectCountAt(tx,a.qualification_id,schedule.dueAt);
      const depth=unlockedDepth(directCount);
      const company=await companyAlwaysActiveAt(tx,a.qualification_id,schedule.dueAt);
      const companySnapshot=company?await captureParameters(tx,schedule.dueAt,schedule.ruleVersionCode):null;
      const active=company||!!await tx.activePeriod.findFirst({
        where:{
          qualificationId:a.qualification_id,
          activeFrom:{lte:schedule.dueAt},
          OR:[{activeTo:null},{activeTo:{gt:schedule.dueAt}}]
        }
      });
      const theory=new Prisma.Decimal('100.00');
      await tx.rpvUplineAwardEvent.upsert({
        where:{
          recognitionId_recipientQualificationId_binaryGeneration:{
            recognitionId:schedule.recognitionId,
            recipientQualificationId:a.qualification_id,
            binaryGeneration:a.generation
          }
        },
        update:{},
        create:{
          recognitionId:schedule.recognitionId,
          sourceQualificationId:schedule.subscription.qualificationId,
          recipientQualificationId:a.qualification_id,
          binaryGeneration:a.generation,
          effectiveDirectCountSnapshot:directCount,
          unlockedDepthSnapshot:depth,
          activeSnapshot:active,
          theoryAmount:theory,
          payableAmount:(active && a.generation<=depth)?theory:new Prisma.Decimal(0),
          ruleVersionCode:schedule.ruleVersionCode,
          parameterSnapshotHash:companySnapshot?.hash??schedule.parameterSnapshotHash,
          occurredAt:schedule.dueAt
        }
      });
    }

    await sealRpvEvent(tx,pvEvent,schedule);
    await tx.monthlyRecognitionSchedule.update({
      where:{recognitionId},
      data:{status:'RECOGNIZED',recognizedAt:new Date(),pvLedgerEventId:pvEvent.eventId}
    });
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}


export async function expireNotificationDeliveries(db:Pick<PrismaService,'notificationDelivery'>=prisma,now=new Date()){return (db.notificationDelivery as any).updateMany({where:{status:{in:['PENDING','CONFIGURATION_PENDING']},expiresAt:{lte:now}},data:{status:'EXPIRED'}});}

export async function processReplayEvent(lease:OutboxLease,db:PrismaService=prisma) {
  return processLeasedReplay(db,lease);
}

export async function pollOutbox(
  db:PrismaService=prisma,
  deps={claimOutboxLease,processSaleConfirmed,processRetailReferralPayment,processRetailReferralReturn,processMemberOrderNotification,processPaymentInventoryReservation,processLeasedReplay,processTreeProjectionEvent,releaseFailedOutboxLease}
){
  const events=await db.outboxEvent.findMany({
    where:{eventType:{in:['BINARY_TREE_CHANGED','SALE_CONFIRMED','WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED','MEMBER_ORDER_CREATED','PAYMENT_STATE_TRANSITIONED','RETURN_CONFIRMED','RETURN_DEPENDENCY_REPLAY_REQUIRED','EPV_MONTH_RECALCULATION_REQUIRED','RPV_REVERSAL_REQUIRED']},processStatus:{in:['PENDING','PROCESSING']},availableAt:{lte:new Date()}},
    orderBy:{createdAt:'asc'},take:20
  });
  for(const event of events){
    let lease:OutboxLease|null=null;
    try{
      lease=await deps.claimOutboxLease(db,event);
      if(!lease)continue;
      if(event.eventType==='BINARY_TREE_CHANGED') await deps.processTreeProjectionEvent(db,lease);
      else if(event.eventType==='SALE_CONFIRMED') await deps.processSaleConfirmed(db,lease);
      else if(event.eventType==='WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED') await deps.processRetailReferralPayment(db,lease);
      else if(event.eventType==='RETURN_CONFIRMED'&&(event.payload as any)?.qualificationId===null) await deps.processRetailReferralReturn(db,lease);
      else if(event.eventType==='MEMBER_ORDER_CREATED') await deps.processMemberOrderNotification(db,lease);
      else if(event.eventType==='PAYMENT_STATE_TRANSITIONED') await deps.processPaymentInventoryReservation(db,lease,{
        warehouseId:process.env.UCELL_INVENTORY_WAREHOUSE_ID??'',
        policyVersion:process.env.UCELL_INVENTORY_POLICY_VERSION??''
      });
      else await deps.processLeasedReplay(db,lease);
    }catch(e){
      if(lease)await deps.releaseFailedOutboxLease(db,lease,e);
    }
  }
}

async function pollRecognitions(){
  const rows=await prisma.monthlyRecognitionSchedule.findMany({
    where:{status:{in:['SCHEDULED','DUE']},dueAt:{lte:new Date()}},
    orderBy:{dueAt:'asc'},take:20
  });
  for(const row of rows){
    try{ await processRecognition(row.recognitionId); }
    catch(e){ console.error('recognition failed',row.recognitionId,e); }
  }
}

async function matureBonusAwards(){
  const now=new Date();
  const awards=await prisma.bonusAward.findMany({
    where:{pendingUntil:{lte:now}},
    take:500
  });
  for(const award of awards){
    await matureBonusAward(prisma,award.bonusAwardId,now);
  }
}

async function tick(){
  await pollOutbox();
  await pollRecognitions();
  await matureBonusAwards();
  await expireNotificationDeliveries();
  const providerStartedAt=Date.now();
  try{
    const provider=await pollProviderWebhooks(prisma,providerHandlers);
    if(provider.enabled&&provider.result)console.log(JSON.stringify(providerMetrics.record(provider.result,Date.now()-providerStartedAt)));
  }catch(error){
    console.error(JSON.stringify({...providerMetrics.recordFailure(Date.now()-providerStartedAt),errorCode:'PROVIDER_WORKER_BATCH_FAILED'}));
    throw error;
  }
}

async function main(){
  const loop=new WorkerLoop({tick,disconnect:()=>prisma.$disconnect(),onError:error=>console.error('worker tick failed',error)},workerPollInterval());
  const shutdown=(signal:string)=>{console.log(`UCell worker received ${signal}; draining current tick`);void loop.stop().then(()=>{process.exitCode=0;}).catch(error=>{console.error(error);process.exitCode=1;});};
  process.once('SIGTERM',()=>shutdown('SIGTERM'));
  process.once('SIGINT',()=>shutdown('SIGINT'));
  console.log('UCell worker v0.6.10 started');
  await loop.start();
}
if(require.main===module) main().catch(async error=>{
  console.error(error);await prisma.$disconnect();process.exitCode=1;
});
