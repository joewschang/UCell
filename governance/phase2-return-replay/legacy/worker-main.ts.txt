import { PrismaService, Prisma } from '@ucell/database';
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

async function processSaleConfirmed(outboxEventId:string){
  return prisma.$transaction(async tx=>{
    const event=await tx.outboxEvent.findUnique({where:{outboxEventId}});
    if(!event || event.processStatus==='PROCESSED') return;

    const payload=event.payload as any;
    const order=await tx.order.findUnique({where:{orderId:payload.orderId},include:{lines:true}});
    if(!order || order.status!=='PAID') throw new Error(`SALE_CONFIRMED order ${payload.orderId} is not PAID`);

    for(const line of order.lines){
      await tx.pvLedger.upsert({
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
          occurredAt:new Date(payload.occurredAt),correlationId:event.correlationId
        }
      });
    }

    await tx.outboxEvent.update({
      where:{outboxEventId},
      data:{processStatus:'PROCESSED',processedAt:new Date()}
    });
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

async function processRecognition(recognitionId:string){
  return prisma.$transaction(async tx=>{
    const schedule=await tx.monthlyRecognitionSchedule.findUnique({
      where:{recognitionId},include:{subscription:true}
    });
    if(!schedule || schedule.status==='RECOGNIZED' || schedule.dueAt>new Date()) return;

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

    await tx.monthlyRecognitionSchedule.update({
      where:{recognitionId},
      data:{status:'RECOGNIZED',recognizedAt:new Date(),pvLedgerEventId:pvEvent.eventId}
    });
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}


async function processReturnConfirmed(outboxEventId:string){
  return prisma.$transaction(async tx=>{
    const event=await tx.outboxEvent.findUnique({where:{outboxEventId}});
    if(!event || event.processStatus==='PROCESSED') return;
    const payload=event.payload as any;
    const ret=await tx.returnCase.findUnique({
      where:{returnCaseId:payload.returnCaseId},
      include:{lines:true,order:true}
    });
    if(!ret || ret.status!=='POSTED') throw new Error('Return not posted');
    const processed=await tx.auditEvent.findFirst({where:{action:'RETURN_REVERSAL_PROCESSED',entityId:ret.returnCaseId}});
    if(processed){
      await tx.outboxEvent.update({where:{outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}});
      return;
    }

    for(const line of ret.lines){
      const original=await tx.pvLedger.findFirst({
        where:{
          sourceType:'ORDER',sourceId:ret.orderId,
          sourceLineId:line.orderLineId,pvType:'GPV',eventType:'GPV_CREATED'
        }
      });
      if(!original) continue;
      const reverse=await tx.pvLedger.upsert({
        where:{
          eventType_sourceType_sourceId_sourceLineId_pvType:{
            eventType:'GPV_REVERSAL',sourceType:'RETURN',sourceId:ret.returnCaseId,
            sourceLineId:line.returnLineId,pvType:'GPV'
          }
        },
        update:{},
        create:{
          qualificationId:ret.order.qualificationId,pvType:'GPV',
          amount:line.gpvReversalAmount.negated(),
          sourceType:'RETURN',sourceId:ret.returnCaseId,sourceLineId:line.returnLineId,
          eventType:'GPV_REVERSAL',ruleVersionCode:ret.order.ruleVersionCode,
          parameterSnapshotHash:ret.order.parameterSnapshotHash,
          occurredAt:ret.occurredAt,reversalOfEventId:original.eventId,
          correlationId:ret.correlationId
        }
      });

      // Defer monetary award effects to complete dependency replay (SA-20260915-01).

    }

    const firstOriginal=await tx.pvLedger.findFirst({
      where:{sourceType:'ORDER',sourceId:ret.orderId,pvType:'GPV',eventType:'GPV_CREATED'},
      orderBy:{occurredAt:'asc'}
    });
    if(firstOriginal){
      const historicalPeriods=await tx.settlementBatch.findMany({where:{status:'FINALIZED',ruleVersionCode:ret.order.ruleVersionCode,periodStart:{lte:firstOriginal.occurredAt},periodEnd:{gt:firstOriginal.occurredAt},settlementType:{in:['REFERRAL_K0','BINARY_K1','MATCHING_K2']}}});
      const ancestors=await tx.$queryRaw<Array<{qualification_id:string}>>`
        WITH RECURSIVE up AS (
          SELECT bp.parent_qualification_id AS qualification_id
          FROM organization.binary_placement bp
          WHERE bp.child_qualification_id=${ret.order.qualificationId}::uuid
            AND bp.effective_from <= ${firstOriginal.occurredAt}
            AND (bp.effective_to IS NULL OR bp.effective_to > ${firstOriginal.occurredAt})
          UNION ALL
          SELECT bp.parent_qualification_id
          FROM organization.binary_placement bp
          JOIN up ON bp.child_qualification_id=up.qualification_id
          WHERE bp.effective_from <= ${firstOriginal.occurredAt}
            AND (bp.effective_to IS NULL OR bp.effective_to > ${firstOriginal.occurredAt})
        )
        SELECT DISTINCT qualification_id::text FROM up
      `;
      for(const a of ancestors){
        for(const historical of historicalPeriods){
          await tx.settlementRecalculationRequest.create({
            data:{sourceReturnCaseId:ret.returnCaseId,settlementType:historical.settlementType,
              periodStart:historical.periodStart,periodEnd:historical.periodEnd,impactedQualificationId:a.qualification_id,status:'PENDING'}
          });
        }
      }
    }

    await tx.outboxEvent.create({data:{eventType:'RETURN_DEPENDENCY_REPLAY_REQUIRED',aggregateType:'RETURN',aggregateId:ret.returnCaseId,correlationId:ret.correlationId,payload:{returnCaseId:ret.returnCaseId,status:'PENDING',dependencies:['K0','K1','K2','RPV','EPV']}}});
    if(ret.order.purpose==='REPURCHASE') await tx.outboxEvent.create({data:{eventType:'EPV_MONTH_RECALCULATION_REQUIRED',aggregateType:'RETURN',aggregateId:ret.returnCaseId,correlationId:ret.correlationId,payload:{returnCaseId:ret.returnCaseId,status:'EPV_RETURN_ALLOCATION_PENDING'}}});
    await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'RETURN_REVERSAL_PROCESSED',entityType:'RETURN',entityId:ret.returnCaseId,requestId:outboxEventId,correlationId:ret.correlationId,afterData:{dependencyReplayStatus:'PENDING',epvStatus:ret.order.purpose==='REPURCHASE'?'EPV_RETURN_ALLOCATION_PENDING':'NOT_REPURCHASE'}}});
    await tx.outboxEvent.update({
      where:{outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}
    });
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}


async function processRpvReversalRequired(outboxEventId:string){
  return prisma.$transaction(async tx=>{
    const event=await tx.outboxEvent.findUnique({where:{outboxEventId}});
    if(!event || event.processStatus==='PROCESSED') return;
    const payload=event.payload as any;
    const schedule=await tx.monthlyRecognitionSchedule.findUnique({
      where:{recognitionId:payload.recognitionId},
      include:{subscription:true}
    });
    if(!schedule || schedule.status!=='RECOGNIZED'){
      await tx.outboxEvent.update({
        where:{outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}
      });
      return;
    }

    const original=await tx.pvLedger.findFirst({
      where:{
        sourceType:'MONTHLY_RECOGNITION',
        sourceId:schedule.subscriptionId,
        sourceLineId:schedule.recognitionId,
        pvType:'RPV',eventType:'RPV_CREATED'
      }
    });
    if(original){
      await tx.pvLedger.upsert({
        where:{
          eventType_sourceType_sourceId_sourceLineId_pvType:{
            eventType:'RPV_REVERSAL',
            sourceType:'MONTHLY_RECOGNITION_REVERSAL',
            sourceId:schedule.subscriptionId,
            sourceLineId:schedule.recognitionId,
            pvType:'RPV'
          }
        },
        update:{},
        create:{
          qualificationId:schedule.subscription.qualificationId,
          pvType:'RPV',amount:original.amount.negated(),
          sourceType:'MONTHLY_RECOGNITION_REVERSAL',
          sourceId:schedule.subscriptionId,sourceLineId:schedule.recognitionId,
          eventType:'RPV_REVERSAL',ruleVersionCode:schedule.ruleVersionCode,
          parameterSnapshotHash:schedule.parameterSnapshotHash,
          occurredAt:new Date(),reversalOfEventId:original.eventId,
          correlationId:event.correlationId
        }
      });

      const awards=await tx.rpvUplineAwardEvent.findMany({
        where:{recognitionId:schedule.recognitionId}
      });
      for(const a of awards){
        if(a.payableAmount.lte(0)) continue;
        const anchor=await tx.bonusAward.create({
          data:{
            awardType:'RPV',
            recipientQualificationId:a.recipientQualificationId,
            sourceQualificationId:a.sourceQualificationId,
            sourceEventId:original.eventId,
            generationNo:a.binaryGeneration,
            theoryAmount:new Prisma.Decimal(0),payableAmount:new Prisma.Decimal(0),
            kFactor:new Prisma.Decimal(1),activeSnapshot:a.activeSnapshot,
            effectiveDirectCountSnapshot:a.effectiveDirectCountSnapshot,
            ruleVersionCode:a.ruleVersionCode,occurredAt:new Date(),pendingUntil:new Date(),
            calculationDetail:{subtype:'RPV_REVERSAL_ANCHOR',recognitionId:schedule.recognitionId}
          }
        });
        await tx.bonusRecoveryEvent.create({
          data:{
            bonusAwardId:anchor.bonusAwardId,recoveryAmount:a.payableAmount,
            status:'OPEN',reasonCode:'RPV_RECOGNITION_REVERSED',occurredAt:new Date()
          }
        });
      }
    }

    await tx.monthlyRecognitionSchedule.update({
      where:{recognitionId:schedule.recognitionId},data:{status:'REVERSED'}
    });
    await tx.outboxEvent.update({
      where:{outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}
    });
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

async function pollOutbox(){
  const events=await prisma.outboxEvent.findMany({
    where:{eventType:{in:['SALE_CONFIRMED','RETURN_CONFIRMED','RPV_REVERSAL_REQUIRED']},processStatus:'PENDING',availableAt:{lte:new Date()}},
    orderBy:{createdAt:'asc'},take:20
  });
  for(const event of events){
    try{
      await prisma.outboxEvent.update({
        where:{outboxEventId:event.outboxEventId},
        data:{processStatus:'PROCESSING',attemptCount:{increment:1}}
      });
      if(event.eventType==='SALE_CONFIRMED') await processSaleConfirmed(event.outboxEventId);
      else if(event.eventType==='RETURN_CONFIRMED') await processReturnConfirmed(event.outboxEventId);
      else if(event.eventType==='RPV_REVERSAL_REQUIRED') await processRpvReversalRequired(event.outboxEventId);
    }catch(e){
      const message=e instanceof Error?e.message:String(e);
      await prisma.outboxEvent.update({
        where:{outboxEventId:event.outboxEventId},
        data:{
          processStatus:event.attemptCount>=9?'DEAD':'PENDING',
          lastError:message.slice(0,4000),
          availableAt:new Date(Date.now()+30000)
        }
      });
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
  setInterval(()=>void tick(),2000);
  await tick();
}
main().catch(async e=>{
  console.error(e);await prisma.$disconnect();process.exit(1);
});
