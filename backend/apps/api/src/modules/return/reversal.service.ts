import { captureParameters, verifySnapshot } from '../rules/parameter-snapshot';
import { EpvMonthService } from '../epv/epv-month.service';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { SettlementCalendarService } from '../settlement/settlement-calendar.service';

@Injectable()
export class ReversalService {
  constructor(private readonly prisma:PrismaService,private readonly calendar:SettlementCalendarService,private readonly epvMonths:EpvMonthService){}

  async processReturn(returnCaseId:string){
    return this.prisma.$transaction(async tx=>{
      const ret=await tx.returnCase.findUnique({
        where:{returnCaseId},
        include:{lines:true,order:true}
      });
      if(!ret || ret.status!=='POSTED') return {skipped:'NOT_POSTED'};

      const processed=await tx.auditEvent.findFirst({where:{action:'RETURN_REVERSAL_PROCESSED',entityId:returnCaseId}});
      if(processed) return {returnCaseId,replayed:true,...processed.afterData as object};
      const createdReversalEvents:string[]=[];
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
              eventType:'GPV_REVERSAL',
              sourceType:'RETURN',
              sourceId:ret.returnCaseId,
              sourceLineId:line.returnLineId,
              pvType:'GPV'
            }
          },
          update:{},
          create:{
            qualificationId:ret.order.qualificationId,pvType:'GPV',
            amount:line.gpvReversalAmount.negated(),
            sourceType:'RETURN',sourceId:ret.returnCaseId,sourceLineId:line.returnLineId,
            eventType:'GPV_REVERSAL',
            ruleVersionCode:ret.order.ruleVersionCode,
            parameterSnapshotHash:ret.order.parameterSnapshotHash,
            occurredAt:ret.occurredAt,reversalOfEventId:original.eventId,
            correlationId:ret.correlationId
          }
        });
        createdReversalEvents.push(reverse.eventId);

        // Direct-source awards (Referral / Equalization) can be linked exactly to original GPV event.
        const directAwards=await tx.bonusAward.findMany({
          where:{sourceEventId:original.eventId,awardType:{in:['REFERRAL','EQUALIZATION']}}
        });

        const ratio=original.amount.abs().gt(0)
          ? line.gpvReversalAmount.abs().div(original.amount.abs())
          : new Prisma.Decimal(0);

        for(const award of directAwards){
          const latest=await tx.bonusAwardLifecycleEvent.findFirst({
            where:{bonusAwardId:award.bonusAwardId},orderBy:{occurredAt:'desc'}
          });
          const recovery=Prisma.Decimal.min(award.payableAmount,award.payableAmount.mul(ratio));

          if(latest?.status==='PENDING_45D'){
            await tx.bonusAwardLifecycleEvent.create({
              data:{
                bonusAwardId:award.bonusAwardId,status:'REVERSED',
                occurredAt:ret.occurredAt,reasonCode:'SOURCE_GPV_RETURNED',
                sourceEventId:reverse.eventId
              }
            });
          }else if(['EFFECTIVE','PAYABLE','PAID'].includes(latest?.status ?? '')){
            await tx.bonusAwardLifecycleEvent.create({
              data:{
                bonusAwardId:award.bonusAwardId,status:'CLAWBACK',
                occurredAt:ret.occurredAt,reasonCode:'SOURCE_GPV_RETURNED',
                sourceEventId:reverse.eventId
              }
            });
            const existingRecovery=await tx.bonusRecoveryEvent.findFirst({
              where:{
                bonusAwardId:award.bonusAwardId,
                returnCaseId:ret.returnCaseId,
                reasonCode:'SOURCE_GPV_RETURNED'
              }
            });
            if(!existingRecovery){
              await tx.bonusRecoveryEvent.create({
                data:{
                  bonusAwardId:award.bonusAwardId,returnCaseId:ret.returnCaseId,
                  recoveryAmount:recovery,recoveredAmount:new Prisma.Decimal(0),
                  outstandingAmount:recovery,status:'OPEN',
                  reasonCode:'SOURCE_GPV_RETURNED',occurredAt:ret.occurredAt
                }
              });
            }
          }
        }
      }

      // Binary/Matching impact every Binary ancestor whose subtree contains the returned qualification.
      // The affected settlement period is the ORIGINAL sale economic period, not the refund posting date.
      const firstOriginal=await tx.pvLedger.findFirst({
        where:{sourceType:'ORDER',sourceId:ret.orderId,pvType:'GPV',eventType:'GPV_CREATED'},
        orderBy:{occurredAt:'asc'}
      });
      if(firstOriginal){
        // Existing finalized periods are historical evidence. Never derive a calendar default.
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
              data:{
                sourceReturnCaseId:ret.returnCaseId,settlementType:historical.settlementType,
                periodStart:historical.periodStart,periodEnd:historical.periodEnd,impactedQualificationId:a.qualification_id,status:'PENDING'
              }
            });
          }
        }
      }

      let epvStatus='NOT_REPURCHASE';
      if(ret.order.purpose==='REPURCHASE') {
        try {
          const recognition=await tx.auditEvent.findFirst({where:{action:'EPV_MONTH_RECOGNIZED',entityId:ret.orderId}});
          const originalDetail=recognition?.afterData as any;
          const snapshot=originalDetail?verifySnapshot(originalDetail.parameterSnapshot):await captureParameters(tx,ret.order.paidAt??ret.occurredAt,ret.order.ruleVersionCode);
          const projection=await this.epvMonths.returnProjection(tx,returnCaseId,snapshot);
          epvStatus='EPV_RETURN_ALLOCATION_PENDING';
          await tx.outboxEvent.create({data:{eventType:'EPV_MONTH_RECALCULATION_REQUIRED',aggregateType:'RETURN',aggregateId:returnCaseId,correlationId:ret.correlationId,payload:{decisionId:'SA-20260915-02',status:epvStatus,qualificationId:projection.qualificationId,monthStart:projection.start.toISOString(),monthEnd:projection.end.toISOString(),timezone:projection.timezone,before:projection.before.toString(),after:projection.after.toString(),originalEpv:projection.original.toString(),recomputedEpv:projection.recomputed.toString(),delta:projection.delta.toString(),sourceOrderIds:projection.sourceOrderIds,parameterSnapshot:snapshot as unknown as Prisma.InputJsonValue}}});
        } catch(error) {
          if(!(error instanceof UnprocessableEntityException)) throw error;
          epvStatus='EPV_CONFIGURATION_OR_DECISION_PENDING';
          await tx.outboxEvent.create({data:{eventType:'EPV_MONTH_RECALCULATION_REQUIRED',aggregateType:'RETURN',aggregateId:returnCaseId,correlationId:ret.correlationId,payload:{status:epvStatus,blocker:error.getResponse() as Prisma.InputJsonValue}}});
        }
      }
      const result={createdReversalEvents,epvStatus,dependencyReplayStatus:'PENDING'};
      await tx.outboxEvent.create({data:{eventType:'RETURN_DEPENDENCY_REPLAY_REQUIRED',aggregateType:'RETURN',aggregateId:returnCaseId,correlationId:ret.correlationId,payload:{returnCaseId,ruleVersionCode:ret.order.ruleVersionCode,status:'PENDING',dependencies:['K0','K1','K2','RPV','EPV']}}});
      await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'RETURN_REVERSAL_PROCESSED',entityType:'RETURN',entityId:returnCaseId,requestId:returnCaseId,correlationId:ret.correlationId,afterData:result}});
      return {returnCaseId,...result};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
