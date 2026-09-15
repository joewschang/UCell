import { SettlementCalendarService } from '../settlement/settlement-calendar.service';
import { snapshotDecimal, verifySnapshot, captureParameters } from '../rules/parameter-snapshot';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, sealSettlement, capturedSideGpv, verifyReplayEnvelope, effectiveGpv, pending } from '@ucell/database';
import { createHash } from 'crypto';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from './bonus-query.service';

@Injectable()
export class BinaryBonusService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
    private readonly calendar:SettlementCalendarService,
  ){}

  matchingUnlockDepth(directs:number){
    if(directs<=0) return 0;
    if(directs===1) return 2;
    if(directs===2) return 3;
    if(directs===3) return 4;
    return 5;
  }

  async sideGpv(
    tx:Prisma.TransactionClient,
    rootQualificationId:string,
    side:'LEFT'|'RIGHT',
    start:Date,end:Date,ruleVersionCode='R1.0B'
  ){
    return capturedSideGpv(tx,rootQualificationId,side,start,end,ruleVersionCode);
  }

  async settleBinary(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const existing=await tx.settlementBatch.findUnique({
        where:{
          settlementType_periodStart_periodEnd_ruleVersionCode:{
            settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode
          }
        }
      });
      if(existing?.status==='FINALIZED') return existing;

      const parameterSnapshot=existing?verifySnapshot(existing.parameterSnapshot):await this.calendar.captureForPeriod(tx,periodStart,periodEnd,'BINARY_K1',ruleVersionCode);
      const batch=existing ?? await tx.settlementBatch.create({
        data:{settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode,parameterSnapshot:parameterSnapshot as unknown as Prisma.InputJsonValue}
      });

      const pendingDays=Number(snapshotDecimal(parameterSnapshot,'award.pending.days').toString());
      const poolRate=snapshotDecimal(parameterSnapshot,'pool.binary.rate','*');
      const pairRate=snapshotDecimal(parameterSnapshot,'binary.pair.rate','*');
      const originals=await tx.pvLedger.findMany({where:{pvType:'GPV',eventType:'GPV_CREATED',ruleVersionCode,occurredAt:{gte:periodStart,lt:periodEnd}}});
      const sourceSnapshots=[];for(const event of originals)sourceSnapshots.push(verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'GPV',sourceId:event.eventId}}})));
      const effective=await effectiveGpv(tx,sourceSnapshots);
      const totalGpv=[...effective.values()].reduce((sum,value)=>sum.add(value),new Prisma.Decimal(0));

      const qualifications=await tx.qualification.findMany({
        where:{effectiveAt:{lt:periodEnd}},
        select:{qualificationId:true}
      });

      const theoryRows:Array<any>=[];
      for(const q of qualifications){
        const effective=await this.query.isQualificationEffectiveAt(tx,q.qualificationId,periodEnd);
        if(!effective) continue;
        const active=await this.query.isActiveAt(tx,q.qualificationId,periodEnd);
        const planLevelCode=await this.query.qualificationPlanAt(tx,q.qualificationId,periodEnd);
        const previous=await tx.binaryCarry.findFirst({
          where:{qualificationId:q.qualificationId,periodEnd:{lt:periodEnd},ruleVersionCode},
          orderBy:{periodEnd:'desc'}
        });

        const projection=previous?await tx.replayCarryProjection.findFirst({where:{periodEnd:previous.periodEnd,ruleVersionCode},orderBy:{sequence:'desc'}}):null;
        const corrected=(projection?.carry as any)?.[q.qualificationId];
        if(projection&&!corrected) pending('HISTORICAL_SNAPSHOT_MISSING','Carry projection does not contain original recipient');
        const leftIn=corrected?new Prisma.Decimal(corrected.left):(previous?.leftCarryOut ?? new Prisma.Decimal(0));
        const rightIn=corrected?new Prisma.Decimal(corrected.right):(previous?.rightCarryOut ?? new Prisma.Decimal(0));
        const leftPeriod=await this.sideGpv(tx,q.qualificationId,'LEFT',periodStart,periodEnd,ruleVersionCode);
        const rightPeriod=await this.sideGpv(tx,q.qualificationId,'RIGHT',periodStart,periodEnd,ruleVersionCode);
        const leftAvailable=leftIn.add(leftPeriod);
        const rightAvailable=rightIn.add(rightPeriod);

        const cap=snapshotDecimal(parameterSnapshot,'binary.weekly.cap',planLevelCode);
        const rawPair=Prisma.Decimal.min(leftAvailable,rightAvailable);
        const paired=Prisma.Decimal.min(rawPair,cap);

        await tx.binaryCarry.create({
          data:{
            qualificationId:q.qualificationId,periodEnd,
            leftCarryIn:leftIn,rightCarryIn:rightIn,
            leftPeriodGpv:leftPeriod,rightPeriodGpv:rightPeriod,
            pairedPv:paired,
            leftCarryOut:leftAvailable.sub(paired),
            rightCarryOut:rightAvailable.sub(paired),
            weeklyCapSnapshot:cap,ruleVersionCode
          }
        });

        const theory=active?paired.mul(pairRate):new Prisma.Decimal(0);
        {
          theoryRows.push({
            recipientQualificationId:q.qualificationId,
            theoryAmount:theory,
            activeSnapshot:active,
            planLevelSnapshot:planLevelCode,
            occurredAt:periodEnd,
            pendingUntil:this.query.pendingUntil(periodEnd,pendingDays),
            calculationDetail:{
              leftCarryIn:leftIn.toString(),rightCarryIn:rightIn.toString(),
              leftPeriodGpv:leftPeriod.toString(),rightPeriodGpv:rightPeriod.toString(),
              pairedPv:paired.toString(),pairRate:pairRate.toString(),
              weeklyCap:cap.toString()
            }
          });
        }
      }

      const totalTheory=theoryRows.reduce((a,r)=>a.add(r.theoryAmount),new Prisma.Decimal(0));
      const poolAvailable=totalGpv.mul(poolRate);
      const k=totalTheory.gt(0)
        ? Prisma.Decimal.min(new Prisma.Decimal(1),poolAvailable.div(totalTheory))
        : new Prisma.Decimal(1);

      for(const row of theoryRows){
        const award=await tx.bonusAward.create({
          data:{
            settlementBatchId:batch.settlementBatchId,
            awardType:'BINARY',
            recipientQualificationId:row.recipientQualificationId,
            theoryAmount:row.theoryAmount,kFactor:k,payableAmount:row.theoryAmount.mul(k),
            activeSnapshot:row.activeSnapshot,planLevelSnapshot:row.planLevelSnapshot,
            ruleVersionCode,parameterSnapshotHash:parameterSnapshot.hash,occurredAt:periodEnd,pendingUntil:row.pendingUntil,
            calculationDetail:row.calculationDetail
          }
        });
        await tx.bonusAwardLifecycleEvent.createMany({
          data:[
            {bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date()},
            {bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date()}
          ]
        });
      }

      const hash=createHash('sha256')
        .update(JSON.stringify({
          batch:batch.settlementBatchId,totalGpv:totalGpv.toString(),
          poolRate:poolRate.toString(),totalTheory:totalTheory.toString(),k:k.toString()
        })).digest('hex');

      const finalized=await tx.settlementBatch.update({
        where:{settlementBatchId:batch.settlementBatchId},
        data:{
          status:'FINALIZED',totalGpv,poolRate,poolAvailable,totalTheory,kFactor:k,
          calculationHash:hash,finalizedAt:new Date()
        }
      });
      await sealSettlement(tx,finalized);
      return finalized;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async settleMatching(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const binaryBatch=await tx.settlementBatch.findUnique({
        where:{
          settlementType_periodStart_periodEnd_ruleVersionCode:{
            settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode
          }
        }
      });
      if(!binaryBatch || binaryBatch.status!=='FINALIZED')
        throw new Error('Binary K1 must be finalized before Matching');

      const existing=await tx.settlementBatch.findUnique({
        where:{
          settlementType_periodStart_periodEnd_ruleVersionCode:{
            settlementType:'MATCHING_K2',periodStart,periodEnd,ruleVersionCode
          }
        }
      });
      if(existing?.status==='FINALIZED') return existing;

      const parameterSnapshot=existing?verifySnapshot(existing.parameterSnapshot):await this.calendar.captureForPeriod(tx,periodStart,periodEnd,'MATCHING_K2',ruleVersionCode);
      const batch=existing ?? await tx.settlementBatch.create({
        data:{settlementType:'MATCHING_K2',periodStart,periodEnd,ruleVersionCode,parameterSnapshot:parameterSnapshot as unknown as Prisma.InputJsonValue}
      });

      const pendingDays=Number(snapshotDecimal(parameterSnapshot,'award.pending.days').toString());
      const poolRate=snapshotDecimal(parameterSnapshot,'pool.matching.rate','*');
      const originals=await tx.pvLedger.findMany({where:{pvType:'GPV',eventType:'GPV_CREATED',ruleVersionCode,occurredAt:{gte:periodStart,lt:periodEnd}}});
      const sourceSnapshots=[];for(const event of originals)sourceSnapshots.push(verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'GPV',sourceId:event.eventId}}})));
      const effective=await effectiveGpv(tx,sourceSnapshots);
      const totalGpv=[...effective.values()].reduce((sum,value)=>sum.add(value),new Prisma.Decimal(0));

      const binaryAwards=await tx.bonusAward.findMany({
        where:{settlementBatchId:binaryBatch.settlementBatchId,awardType:'BINARY'}
      });

      const rows:Array<any>=[];
      for(const source of binaryAwards){
        const uplines=await this.query.sponsorAncestors(tx,source.recipientQualificationId,periodEnd,5);
        for(const u of uplines){
          const directCount=await this.query.effectiveDirectCountAt(tx,u.qualification_id,periodEnd);
          const unlock=this.matchingUnlockDepth(directCount);
          const active=await this.query.isActiveAt(tx,u.qualification_id,periodEnd);


          const rate=snapshotDecimal(parameterSnapshot,'matching.rate',String(u.generation));
          const theory=active&&u.generation<=unlock?source.payableAmount.mul(rate):new Prisma.Decimal(0); // actual Binary Paid after K1


          rows.push({
            recipientQualificationId:u.qualification_id,
            sourceQualificationId:source.recipientQualificationId,
            sourceAwardId:source.bonusAwardId,
            generationNo:u.generation,
            theoryAmount:theory,
            activeSnapshot:active,
            effectiveDirectCountSnapshot:directCount,
            planLevelSnapshot:await this.query.qualificationPlanAt(tx,u.qualification_id,periodEnd),
            occurredAt:periodEnd,
            pendingUntil:this.query.pendingUntil(periodEnd,pendingDays),
            calculationDetail:{
              sourceBinaryPaid:source.payableAmount.toString(),
              rate:rate.toString(),generation:u.generation,
              unlockDepth:unlock,effectiveDirectCount:directCount
            }
          });
        }
      }

      const totalTheory=rows.reduce((a,r)=>a.add(r.theoryAmount),new Prisma.Decimal(0));
      const poolAvailable=totalGpv.mul(poolRate);
      const k=totalTheory.gt(0)
        ? Prisma.Decimal.min(new Prisma.Decimal(1),poolAvailable.div(totalTheory))
        : new Prisma.Decimal(1);

      for(const row of rows){
        const award=await tx.bonusAward.create({
          data:{
            settlementBatchId:batch.settlementBatchId,awardType:'MATCHING',
            recipientQualificationId:row.recipientQualificationId,
            sourceQualificationId:row.sourceQualificationId,
            sourceAwardId:row.sourceAwardId,generationNo:row.generationNo,
            theoryAmount:row.theoryAmount,kFactor:k,payableAmount:row.theoryAmount.mul(k),
            activeSnapshot:row.activeSnapshot,effectiveDirectCountSnapshot:row.effectiveDirectCountSnapshot,
            planLevelSnapshot:row.planLevelSnapshot,ruleVersionCode,parameterSnapshotHash:parameterSnapshot.hash,
            occurredAt:periodEnd,pendingUntil:row.pendingUntil,
            calculationDetail:row.calculationDetail
          }
        });
        await tx.bonusAwardLifecycleEvent.createMany({
          data:[
            {bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date()},
            {bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date()}
          ]
        });
      }

      const hash=createHash('sha256')
        .update(JSON.stringify({
          batch:batch.settlementBatchId,totalGpv:totalGpv.toString(),
          poolRate:poolRate.toString(),totalTheory:totalTheory.toString(),k:k.toString()
        })).digest('hex');

      const finalized=await tx.settlementBatch.update({
        where:{settlementBatchId:batch.settlementBatchId},
        data:{
          status:'FINALIZED',totalGpv,poolRate,poolAvailable,totalTheory,kFactor:k,
          calculationHash:hash,finalizedAt:new Date()
        }
      });
      await sealSettlement(tx,finalized);
      return finalized;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
