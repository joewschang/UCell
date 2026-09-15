import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { SettlementReplayService } from './settlement-replay.service';

@Injectable()
export class SettlementAdjustmentService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly replay:SettlementReplayService
  ){}

  async prepare(requestId:string){
    return this.prisma.$transaction(async tx=>{
      const req=await tx.settlementRecalculationRequest.findUnique({
        where:{settlementRecalculationRequestId:requestId}
      });
      if(!req) throw new UnprocessableEntityException('Recalculation request not found');

      const existing=await tx.settlementAdjustmentBatch.findUnique({
        where:{sourceRecalculationRequestId:requestId}
      });
      if(existing) return existing;

      return tx.settlementAdjustmentBatch.create({
        data:{
          sourceRecalculationRequestId:requestId,
          settlementType:req.settlementType,
          periodStart:req.periodStart,periodEnd:req.periodEnd,
          status:'DRAFT',
          calculationSnapshot:{
            rule:'R1.0B-FROZEN',
            method:'DETERMINISTIC_REPLAY',
            invariant:'NO_HISTORICAL_SETTLEMENT_MUTATION'
          }
        }
      });
    });
  }

  async calculateAndPost(requestId:string,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const req=await tx.settlementRecalculationRequest.findUniqueOrThrow({
        where:{settlementRecalculationRequestId:requestId}
      });
      if(!req.impactedQualificationId)
        throw new UnprocessableEntityException('impactedQualificationId required');

      let batch=await tx.settlementAdjustmentBatch.findUnique({
        where:{sourceRecalculationRequestId:requestId}
      });
      if(!batch){
        batch=await tx.settlementAdjustmentBatch.create({
          data:{
            sourceRecalculationRequestId:requestId,
            settlementType:req.settlementType,
            periodStart:req.periodStart,periodEnd:req.periodEnd,
            status:'DRAFT',
            calculationSnapshot:{rule:'R1.0B-FROZEN',method:'DETERMINISTIC_REPLAY'}
          }
        });
      }
      if(batch.status==='POSTED') return batch;

      const binary=await this.replay.replayBinary(tx,{
        impactedQualificationId:req.impactedQualificationId,
        periodStart:req.periodStart,periodEnd:req.periodEnd,
        ruleVersionCode
      });

      const lines:Array<{
        qualificationId:string;awardType:'BINARY'|'MATCHING';
        originalAmount:Prisma.Decimal;recomputedAmount:Prisma.Decimal;sourceReference:any;
      }> = [{
        qualificationId:binary.qualificationId,
        awardType:'BINARY',
        originalAmount:binary.originalPayable,
        recomputedAmount:binary.recomputedPayable,
        sourceReference:{
          carryOriginal:{
            left:binary.originalCarryOutLeft.toString(),
            right:binary.originalCarryOutRight.toString()
          },
          carryRecomputed:{
            left:binary.recomputedCarryOutLeft.toString(),
            right:binary.recomputedCarryOutRight.toString()
          }
        }
      }];

      const matching=await this.replay.replayMatching(tx,{
        impactedQualificationId:req.impactedQualificationId,
        periodStart:req.periodStart,periodEnd:req.periodEnd,
        ruleVersionCode,
        recomputedBinaryPaid:binary.recomputedPayable
      });
      for(const m of matching){
        lines.push({
          qualificationId:m.qualificationId,
          awardType:'MATCHING',
          originalAmount:m.originalPayable,
          recomputedAmount:m.recomputedPayable,
          sourceReference:{sourceQualificationId:req.impactedQualificationId}
        });
      }

      let original=new Prisma.Decimal(0), recomputed=new Prisma.Decimal(0);

      for(const l of lines){
        const delta=l.recomputedAmount.sub(l.originalAmount);
        original=original.add(l.originalAmount);
        recomputed=recomputed.add(l.recomputedAmount);

        await tx.settlementAdjustmentLine.create({
          data:{
            settlementAdjustmentBatchId:batch.settlementAdjustmentBatchId,
            qualificationId:l.qualificationId,awardType:l.awardType,
            originalAmount:l.originalAmount,recomputedAmount:l.recomputedAmount,
            deltaAmount:delta,sourceReference:l.sourceReference
          }
        });

        if(delta.gt(0)){
          const award=await tx.bonusAward.create({
            data:{
              awardType:l.awardType,
              recipientQualificationId:l.qualificationId,
              theoryAmount:delta,payableAmount:delta,kFactor:new Prisma.Decimal(1),
              activeSnapshot:true,ruleVersionCode,
              occurredAt:new Date(),pendingUntil:new Date(),
              calculationDetail:{
                subtype:'SETTLEMENT_ADJUSTMENT',
                adjustmentBatchId:batch.settlementAdjustmentBatchId,
                sourceReference:l.sourceReference
              }
            }
          });
          await tx.bonusAwardLifecycleEvent.create({
            data:{
              bonusAwardId:award.bonusAwardId,status:'EFFECTIVE',
              occurredAt:new Date(),reasonCode:'SETTLEMENT_ADJUSTMENT'
            }
          });
        }else if(delta.lt(0)){
          const anchor=await tx.bonusAward.create({
            data:{
              awardType:l.awardType,
              recipientQualificationId:l.qualificationId,
              theoryAmount:new Prisma.Decimal(0),payableAmount:new Prisma.Decimal(0),
              kFactor:new Prisma.Decimal(1),activeSnapshot:true,ruleVersionCode,
              occurredAt:new Date(),pendingUntil:new Date(),
              calculationDetail:{
                subtype:'NEGATIVE_SETTLEMENT_ADJUSTMENT_ANCHOR',
                adjustmentBatchId:batch.settlementAdjustmentBatchId
              }
            }
          });
          await tx.bonusRecoveryEvent.create({
            data:{
              bonusAwardId:anchor.bonusAwardId,recoveryAmount:delta.abs(),
              status:'OPEN',reasonCode:'SETTLEMENT_ADJUSTMENT',occurredAt:new Date()
            }
          });
        }
      }

      const delta=recomputed.sub(original);
      await tx.settlementRecalculationRequest.update({
        where:{settlementRecalculationRequestId:requestId},
        data:{status:'PROCESSED',processedAt:new Date()}
      });

      return tx.settlementAdjustmentBatch.update({
        where:{settlementAdjustmentBatchId:batch.settlementAdjustmentBatchId},
        data:{
          status:'POSTED',
          originalTheory:original,recomputedTheory:recomputed,deltaTheory:delta,
          originalPayable:original,recomputedPayable:recomputed,deltaPayable:delta,
          postedAt:new Date(),
          calculationSnapshot:{
            rule:'R1.0B-FROZEN',
            method:'DETERMINISTIC_REPLAY',
            sourceRecalculationRequestId:requestId,
            replayedAt:new Date().toISOString()
          }
        }
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
