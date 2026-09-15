import { PrismaService, Prisma, sealGpvEvent, sealRpvEvent, verifyReplayEnvelope, pending, claimOutboxLease, withOutboxLease, processLeasedReplay, releaseFailedOutboxLease, OutboxLease } from '@ucell/database';
import * as crypto from 'node:crypto';

const prisma = new PrismaService();

function unlockedDepth(count:number){
  if(count<=0) return 5;
  if(count===1) return 8;
  return 12;
}

async function effectiveDirectCountAt(
  tx:Prisma.TransactionClient,
  sponsorQualificationId:string,
  at:Date
){
  const rows=await tx.$queryRaw<Array<{count:string}>>`
    SELECT COUNT(*)::text AS count
    FROM organization.sponsor_relationship sr
    WHERE sr.sponsor_qualification_id=${sponsorQualificationId}::uuid
      AND sr.effective_from <= ${at}
      AND (sr.effective_to IS NULL OR sr.effective_to > ${at})
      AND EXISTS (
        SELECT 1
        FROM membership.qualification_status_history qsh
        WHERE qsh.qualification_id=sr.child_qualification_id
          AND qsh.status='EFFECTIVE'::membership."QualificationLifecycleStatus"
          AND qsh.effective_from <= ${at}
          AND (qsh.effective_to IS NULL OR qsh.effective_to > ${at})
      )
  `;
  return Number(rows[0]?.count ?? '0');
}

async function processSaleConfirmed(lease:OutboxLease){
  const outboxEventId=lease.outboxEventId;
  return withOutboxLease(prisma,lease,async tx=>{
    const event=await tx.outboxEvent.findUnique({where:{outboxEventId}});
    if(!event || event.processStatus==='PROCESSED') return;

    const payload=event.payload as any;
    const order=await tx.order.findUnique({where:{orderId:payload.orderId},include:{lines:true}});
    if(!order || !['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(order.status)) throw new Error(`SALE_CONFIRMED order ${payload.orderId} is not PAID`);

    if(!order.paidAt) pending('HISTORICAL_SNAPSHOT_MISSING','Original sale recognition timestamp is missing');
    for(const line of order.lines){
      const original=await tx.pvLedger.findFirst({where:{sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',pvType:'GPV'}});
      const ledger=await tx.pvLedger.upsert({
        where:{
          eventType_sourceType_sourceId_sourceLineId_pvType:{
            eventType:'GPV_CREATED',sourceType:'ORDER',sourceId:order.orderId,
            sourceLineId:line.orderLineId,pvType:'GPV'
          }
        },
        update:{},
        create:{
          qualificationId:order.qualificationId,pvType:'GPV',amount:line.gpvAmountSnapshot,
          sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,
          eventType:'GPV_CREATED',ruleVersionCode:order.ruleVersionCode,
          parameterSnapshotHash:order.parameterSnapshotHash,
          occurredAt:order.paidAt,correlationId:event.correlationId
        }
      });
      if(!original) await sealGpvEvent(tx,ledger);
      else verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'GPV',sourceId:original.eventId}}}));
    }

    await tx.outboxEvent.update({
      where:{outboxEventId},
      data:{processStatus:'PROCESSED',processedAt:new Date()}
    });
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
      const active=!!await tx.activePeriod.findFirst({
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
          parameterSnapshotHash:schedule.parameterSnapshotHash,
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


export async function processReplayEvent(lease:OutboxLease) {
  return processLeasedReplay(prisma,lease);
}

export async function pollOutbox(){
  const events=await prisma.outboxEvent.findMany({
    where:{eventType:{in:['SALE_CONFIRMED','RETURN_CONFIRMED','RETURN_DEPENDENCY_REPLAY_REQUIRED','EPV_MONTH_RECALCULATION_REQUIRED','RPV_REVERSAL_REQUIRED']},processStatus:{in:['PENDING','PROCESSING']},availableAt:{lte:new Date()}},
    orderBy:{createdAt:'asc'},take:20
  });
  for(const event of events){
    let lease:OutboxLease|null=null;
    try{
      lease=await claimOutboxLease(prisma,event);
      if(!lease)continue;
      if(event.eventType==='SALE_CONFIRMED') await processSaleConfirmed(lease);
      else await processReplayEvent(lease);
    }catch(e){
      if(lease)await releaseFailedOutboxLease(prisma,lease,e);
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
    const latest=await prisma.bonusAwardLifecycleEvent.findFirst({
      where:{bonusAwardId:award.bonusAwardId},
      orderBy:{occurredAt:'desc'}
    });
    if(latest?.status!=='PENDING_45D') continue;
    await prisma.bonusAwardLifecycleEvent.create({
      data:{bonusAwardId:award.bonusAwardId,status:'EFFECTIVE',occurredAt:now}
    });
  }
}

async function tick(){
  await pollOutbox();
  await pollRecognitions();
  await matureBonusAwards();
}

async function main(){
  console.log('UCell worker v0.5.0 started');
  let running=true;
  setInterval(()=>{if(running) return;running=true;void tick().catch(console.error).finally(()=>{running=false;});},2000);
  try{await tick();}finally{running=false;}
}
if(require.main===module) main().catch(async e=>{
  console.error(e);await prisma.$disconnect();process.exit(1);
});
