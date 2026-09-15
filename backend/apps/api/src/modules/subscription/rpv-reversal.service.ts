import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class RpvReversalService {
  constructor(private readonly prisma:PrismaService){}

  async reverseRecognition(recognitionId:string, correlationId:string){
    return this.prisma.$transaction(async tx=>{
      const schedule=await tx.monthlyRecognitionSchedule.findUnique({
        where:{recognitionId},
        include:{subscription:true}
      });
      if(!schedule) return {skipped:'NOT_FOUND'};
      if(schedule.status!=='RECOGNIZED') return {skipped:'NOT_RECOGNIZED'};

      const original=await tx.pvLedger.findFirst({
        where:{
          sourceType:'MONTHLY_RECOGNITION',
          sourceId:schedule.subscriptionId,
          sourceLineId:schedule.recognitionId,
          pvType:'RPV',eventType:'RPV_CREATED'
        }
      });
      if(!original) return {skipped:'ORIGINAL_RPV_NOT_FOUND'};

      const reverse=await tx.pvLedger.upsert({
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
          occurredAt:new Date(),recordedAt:new Date(),
          reversalOfEventId:original.eventId,correlationId
        }
      });

      const awards=await tx.rpvUplineAwardEvent.findMany({
        where:{recognitionId:schedule.recognitionId}
      });

      for(const a of awards){
        if(a.payableAmount.lte(0)) continue;

        // RPV upline award table is immutable. Recovery is represented as a new BonusAward anchor.
        const anchor=await tx.bonusAward.create({
          data:{
            awardType:'RPV',
            recipientQualificationId:a.recipientQualificationId,
            sourceQualificationId:a.sourceQualificationId,
            sourceEventId:reverse.eventId,
            generationNo:a.binaryGeneration,
            theoryAmount:new Prisma.Decimal(0),payableAmount:new Prisma.Decimal(0),
            kFactor:new Prisma.Decimal(1),activeSnapshot:a.activeSnapshot,
            effectiveDirectCountSnapshot:a.effectiveDirectCountSnapshot,
            ruleVersionCode:a.ruleVersionCode,occurredAt:new Date(),pendingUntil:new Date(),
            calculationDetail:{subtype:'RPV_REVERSAL_ANCHOR',recognitionId}
          }
        });
        await tx.bonusRecoveryEvent.create({
          data:{
            bonusAwardId:anchor.bonusAwardId,
            recoveryAmount:a.payableAmount,status:'OPEN',
            reasonCode:'RPV_RECOGNITION_REVERSED',occurredAt:new Date()
          }
        });
      }

      await tx.monthlyRecognitionSchedule.update({
        where:{recognitionId},
        data:{status:'REVERSED'}
      });

      return {
        recognitionId,
        reversalEventId:reverse.eventId,
        recoveryCount:awards.filter(a=>a.payableAmount.gt(0)).length
      };
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
